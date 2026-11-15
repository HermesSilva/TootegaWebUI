/**
 * XAtendimentoDeSuporte — o lado de QUEM ATENDE o suporte remoto. São duas ações custom da App de
 * plataforma "Atendimento de suporte", que diferem só em COMO a chamada é assumida:
 *
 *   - `XAtenderProximaChamada` (`supportAttend`): assume a próxima chamada da fila, a mais antiga dos grupos
 *     do atendente. Não há escolha: a ordem é a de chegada;
 *   - `XRetornarChamado` (`supportReturn`): assume o chamado selecionado no quadro de avisos (registrado
 *     enquanto não havia atendente online). Quem o registrou é avisado no sino e entra na sessão ao abrir
 *     "Chamar suporte".
 *
 * Daí em diante é a mesma sessão: o vídeo da tela de quem chamou, o áudio nos dois sentidos e o controle
 * da aba dele.
 *
 * O controle é feito SOBRE O VÍDEO: com "Operar a aba" ligado, o movimento do mouse, o clique, a roda e
 * as teclas viram gestos enviados pelo canal de dados, com as coordenadas normalizadas pelo tamanho da
 * imagem. Quem os reproduz é a página de quem chamou — que pode recusá-los (campo de senha, usuário
 * mexendo no mouse) e avisa de volta, para o atendente não ficar clicando no vazio.
 *
 * Fechar o diálogo ENCERRA o atendimento — não há sessão de suporte correndo sem atendente olhando —, e
 * antes de sair o atendente diz se o caso foi resolvido.
 */

import { useCallback, useEffect, useRef, useState, type JSX, type KeyboardEvent, type MouseEvent, type WheelEvent } from 'react';
import { CheckCircle, Loader2, Mic, MicOff, MousePointerClick, PhoneOff, TriangleAlert } from 'lucide-react';
import type { HubConnection } from '@microsoft/signalr';

import { api } from '@core/lib/api';
import { getFieldValue } from '@core/lib/fieldAccess';
import { XModalShell } from '@core/components/templates/XModalShell';
import type { XButtonActionComponentProps } from '@core/components/templates/XButtonActionRegistry';
import { criarCanalDeSuporte, encerrarCanal, entrarNaChamada, sinalizar } from '@core/lib/suporte/canalDeSuporte';
import { ConexaoDeMidia, pararMidia, pedirMicrofone } from '@core/lib/suporte/conexaoDeMidia';
import { lerAviso, pontoNoVideo, serializarGesto, type GestoRemoto } from '@core/lib/suporte/controleRemoto';
import {
  ROTA_DAS_CHAMADAS, formatarDuracao, servidoresDoNavegador,
  type ChamadaDeSuporte, type ServidorICE, type TipoDeRecado,
} from '@core/lib/suporte/tipos';

/** Intervalo mínimo entre dois gestos de movimento: o ponteiro segue suave sem inundar o canal. */
const INTERVALO_DO_MOVIMENTO_MS = 40;

/** Por quanto tempo o aviso de gesto recusado fica na tela. */
const DURACAO_DO_AVISO_MS = 4000;

const AVISO_DE_BLOQUEIO = {
  senha: 'O foco está num campo de senha: só quem chamou digita ali. Peça a ele que digite.',
  usuario: 'Quem chamou está usando o mouse ou o teclado agora; o seu gesto foi descartado. Combine por voz quem opera.',
} as const;

const BOTAO_NEUTRO = 'inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover disabled:opacity-50';
const BOTAO_VERMELHO = 'inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50';

type Modo = 'proxima' | 'retorno';

interface SessaoProps extends XButtonActionComponentProps {
  modo: Modo;
}

/** Ação `supportAttend`: assume a próxima chamada da fila. */
export function XAtenderProximaChamada(pProps: XButtonActionComponentProps): JSX.Element | null {
  return <SessaoDeAtendimento {...pProps} modo="proxima" />;
}

/** Ação `supportReturn`: retorna o chamado selecionado no quadro de avisos. */
export function XRetornarChamado(pProps: XButtonActionComponentProps): JSX.Element | null {
  return <SessaoDeAtendimento {...pProps} modo="retorno" />;
}

function SessaoDeAtendimento({ modo, selectedRow, onCancel, onDone }: SessaoProps): JSX.Element | null {
  const selecionado = String(getFieldValue(selectedRow ?? {}, 'ID') ?? '');

  const [chamada, setChamada] = useState<ChamadaDeSuporte | null>(null);
  const [ligacao, setLigacao] = useState<RTCPeerConnectionState>('new');
  const [temVideo, setTemVideo] = useState(false);
  const [usuarioPresente, setUsuarioPresente] = useState(modo === 'proxima');
  const [operando, setOperando] = useState(false);
  const [temMicrofone, setTemMicrofone] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [aviso, setAviso] = useState('');
  // Encerrado o atendimento, o diálogo fica só para a pergunta final.
  const [encerrada, setEncerrada] = useState<ChamadaDeSuporte | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const midia = useRef<ConexaoDeMidia | null>(null);
  const microfone = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const ultimoMovimento = useRef(0);
  const relogioDoAviso = useRef<number | null>(null);

  // Quem monta a ação recria os callbacks a cada render; por ref, eles não reiniciam a sessão.
  const cancelar = useRef(onCancel);
  cancelar.current = onCancel;

  const mostrarAviso = useCallback((pTexto: string) => {
    setAviso(pTexto);

    if (relogioDoAviso.current !== null)
      window.clearTimeout(relogioDoAviso.current);

    relogioDoAviso.current = window.setTimeout(() => setAviso(''), DURACAO_DO_AVISO_MS);
  }, []);

  useEffect(() => {
    if (modo === 'retorno' && !selecionado) {
      cancelar.current();
      return;
    }

    let vivo = true;
    let id = '';
    let hub: HubConnection | null = null;

    const desligarMidia = (): void => {
      midia.current?.fechar();
      midia.current = null;
      setTemVideo(false);
      setLigacao('new');
    };

    // A oferta de quem chamou inicia (ou refaz) a ligação: uma oferta nova é uma ligação nova.
    const responder = async (pTipo: TipoDeRecado, pDados: string): Promise<void> => {
      const canal = hub;
      if (!canal)
        return;

      if (pTipo === 'oferta') {
        desligarMidia();

        const servidores = await api.get<ServidorICE[]>(`${ROTA_DAS_CHAMADAS}/${id}/servidores-ice`);
        if (!vivo)
          return;

        midia.current = new ConexaoDeMidia({
          servidores: servidoresDoNavegador(servidores),
          enviarRecado: (pT, pD) => sinalizar(canal, id, pT, pD),
          aoReceberMidia: (pRemota) => {
            if (video.current)
              video.current.srcObject = pRemota;

            setTemVideo(pRemota.getVideoTracks().length > 0);
          },
          aoMudarEstado: setLigacao,
          aoReceberDados: (pTexto) => {
            const bloqueio = lerAviso(pTexto);
            if (bloqueio)
              mostrarAviso(AVISO_DE_BLOQUEIO[bloqueio.motivo]);
          },
        });
      }

      await midia.current?.receberRecado(pTipo, pDados, pTipo === 'oferta' ? microfone.current : null);
    };

    void (async () => {
      try {
        // Assume a chamada (ou volta à que já é deste atendente). Recusada, o motivo sai no diálogo de
        // mensagem e a ação se fecha.
        const assumida = await api.post<ChamadaDeSuporte>(
          modo === 'retorno' ? `${ROTA_DAS_CHAMADAS}/${selecionado}/retornar` : `${ROTA_DAS_CHAMADAS}/proxima/atender`);
        if (!vivo)
          return;

        id = assumida.id;
        setChamada(assumida);

        microfone.current = await pedirMicrofone();
        if (!vivo) {
          pararMidia(microfone.current);
          return;
        }

        setTemMicrofone(microfone.current !== null);

        const canal = criarCanalDeSuporte();

        hub = canal;

        canal.on('Recado', (pID: string, pTipo: TipoDeRecado, pDados: string) => {
          if (pID === id)
            void responder(pTipo, pDados).catch(() => desligarMidia());
        });
        canal.on('ParticipanteEntrou', (pID: string) => { if (pID === id) setUsuarioPresente(true); });
        canal.on('ParticipanteSaiu', (pID: string) => {
          if (pID !== id)
            return;

          setUsuarioPresente(false);
          desligarMidia();
        });
        canal.on('ChamadaMudou', (pChamada: ChamadaDeSuporte) => {
          if (pChamada.id !== id)
            return;

          setChamada(pChamada);

          // Quem chamou encerrou do lado dele: a sessão acaba aqui também, e fica a pergunta final.
          if (!pChamada.emAberto) {
            desligarMidia();
            setOperando(false);
            setEncerrada(pChamada);
          }
        });
        canal.onreconnected(() => void entrarNaChamada(canal, id));

        // Entrar na chamada é o que faz quem chamou mandar a oferta: só depois de o microfone estar decidido.
        await canal.start();
        await entrarNaChamada(canal, id);
      } catch {
        if (vivo)
          cancelar.current();
      }
    })();

    return () => {
      vivo = false;
      desligarMidia();
      pararMidia(microfone.current);
      microfone.current = null;
      void encerrarCanal(hub, id);

      if (relogioDoAviso.current !== null)
        window.clearTimeout(relogioDoAviso.current);
    };
  }, [modo, selecionado, mostrarAviso]);

  const encerrar = useCallback(async () => {
    if (!chamada || ocupado)
      return;

    setOcupado(true);

    try {
      setOperando(false);
      setEncerrada(await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${chamada.id}/encerrar`));
    } catch {
      // O motivo já saiu no diálogo de mensagem; o atendimento segue como está no servidor.
    } finally {
      setOcupado(false);
    }
  }, [chamada, ocupado]);

  const avaliar = useCallback(async (pResolvido: boolean) => {
    if (!encerrada || ocupado)
      return;

    setOcupado(true);

    try {
      await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${encerrada.id}/avaliar`, { resolvido: pResolvido });
      onDone?.();
    } catch {
      // O motivo já saiu no diálogo de mensagem; a pergunta continua na tela.
    } finally {
      setOcupado(false);
    }
  }, [encerrada, ocupado, onDone]);

  const enviar = useCallback((pGesto: GestoRemoto): void => {
    if (operando)
      midia.current?.enviarDados(serializarGesto(pGesto));
  }, [operando]);

  const ponto = (pEvento: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const elemento = video.current;

    return elemento
      ? pontoNoVideo(pEvento.clientX, pEvento.clientY, elemento.getBoundingClientRect(), elemento.videoWidth, elemento.videoHeight)
      : null;
  };

  function aoMover(pEvento: MouseEvent<HTMLVideoElement>): void {
    const agora = performance.now();
    if (!operando || agora - ultimoMovimento.current < INTERVALO_DO_MOVIMENTO_MS)
      return;

    const p = ponto(pEvento);
    if (p) {
      ultimoMovimento.current = agora;
      enviar({ t: 'mover', ...p });
    }
  }

  function aoPressionarOuSoltar(pEvento: MouseEvent<HTMLVideoElement>, pTipo: 'pressionar' | 'soltar'): void {
    if (!operando)
      return;

    pEvento.preventDefault();
    video.current?.focus();

    const p = ponto(pEvento);
    if (p && pEvento.button <= 2)
      enviar({ t: pTipo, ...p, b: pEvento.button });
  }

  function aoRolar(pEvento: WheelEvent<HTMLVideoElement>): void {
    const p = operando ? ponto(pEvento) : null;
    if (p)
      enviar({ t: 'rolar', ...p, dx: pEvento.deltaX, dy: pEvento.deltaY });
  }

  function aoTeclar(pEvento: KeyboardEvent<HTMLVideoElement>): void {
    // Tecla modificadora sozinha não é gesto; e sem operar, o teclado é do atendente.
    if (!operando || ['Control', 'Shift', 'Alt', 'Meta'].includes(pEvento.key))
      return;

    pEvento.preventDefault();
    enviar({ t: 'tecla', k: pEvento.key, ctrl: pEvento.ctrlKey || pEvento.metaKey, shift: pEvento.shiftKey, alt: pEvento.altKey });
  }

  function alternarMudo(): void {
    const novo = !mudo;

    microfone.current?.getAudioTracks().forEach((pFaixa) => { pFaixa.enabled = !novo; });
    setMudo(novo);
  }

  if (modo === 'retorno' && !selecionado)
    return null;

  if (!chamada) {
    return (
      <XModalShell variant="inline" size="md" title={'Atendimento de suporte'} closeLabel={'Cancelar'} onClose={onCancel}>
        <div role="status" aria-live="polite" className="flex items-center gap-3 p-6 text-ui text-brand-text-primary">
          <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden="true" />
          <span>{modo === 'retorno' ? 'Assumindo o chamado do quadro…' : 'Assumindo a próxima chamada da fila…'}</span>
        </div>
      </XModalShell>
    );
  }

  // Encerrado: a pergunta final. O diálogo só sai depois da resposta — é ela que diz à equipe o que ficou pendente.
  if (encerrada) {
    return (
      <XModalShell
        variant="inline" size="md" title={`Atendimento encerrado · ${encerrada.usuario}`} subtitle={encerrada.assinante}
        closeLabel={'Fechar sem responder'} onClose={() => onDone?.()}
      >
        <div className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="atendimento-avaliacao">
          <p>
            {'O atendimento durou '}<strong>{formatarDuracao(encerrada.duracaoSegundos)}</strong>{'.'}
          </p>
          <p className="font-medium">{'O caso foi resolvido?'}</p>
          <div className="flex gap-2">
            <button
              type="button" disabled={ocupado} onClick={() => void avaliar(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-ui font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" aria-hidden="true" /> {'Resolvido'}
            </button>
            <button type="button" disabled={ocupado} onClick={() => void avaliar(false)} className={BOTAO_NEUTRO}>
              {'Não resolvido'}
            </button>
          </div>
        </div>
      </XModalShell>
    );
  }

  const situacao = !usuarioPresente
    ? (modo === 'retorno' && ligacao === 'new'
      ? 'Quem registrou o chamado foi avisado no sino. A tela aparece aqui quando ele abrir "Chamar suporte".'
      : 'Quem chamou saiu da página ou perdeu a conexão. Se ele voltar, a tela reaparece aqui.')
    : ligacao === 'connected' ? (temVideo ? 'Conectado: você vê a tela de quem chamou.' : 'Conectado por áudio; quem chamou ainda não liberou a tela.')
      : ligacao === 'failed' ? 'A conexão de tela e áudio não se estabeleceu: as duas redes não se alcançaram e não houve servidor que retransmitisse (TURN). Encerre e peça nova chamada.'
        : ligacao === 'disconnected' ? 'A conexão caiu; tentando retomar…'
          : ligacao === 'connecting' ? 'Conectando tela e áudio…'
            : 'Aguardando quem chamou liberar a tela.';

  return (
    <XModalShell
      variant="inline" size="xl" draggable rolarConteudo={false}
      title={`Atendimento · ${chamada.usuario}`} subtitle={`${chamada.assinante} · ${chamada.email} · grupo ${chamada.grupo}`}
      closeLabel={'Encerrar o atendimento'} onClose={() => void encerrar()}
      footer={
        <div className="flex items-center justify-end w-full gap-2 flex-wrap">
          <p className="mr-auto text-ui-sm text-brand-text-secondary" role="status" aria-live="polite" data-testid="atendimento-situacao">
            {situacao}
          </p>
          {temMicrofone && (
            <button type="button" onClick={alternarMudo} aria-pressed={mudo} className={BOTAO_NEUTRO}>
              {mudo ? <MicOff className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
              {mudo ? 'Microfone desligado' : 'Microfone ligado'}
            </button>
          )}
          <button
            type="button" onClick={() => setOperando((pAtual) => !pAtual)} aria-pressed={operando}
            disabled={ligacao !== 'connected' || !temVideo} data-testid="atendimento-operar"
            className={`inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-semibold rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed ${
              operando ? 'text-white bg-indigo-700 border-indigo-700 hover:bg-indigo-800' : 'text-brand-text-primary bg-brand-surface border-border hover:bg-hover'}`}
          >
            <MousePointerClick className="w-4 h-4" aria-hidden="true" />
            {operando ? 'Operando a aba (clique para só ver)' : 'Operar a aba'}
          </button>
          <button type="button" disabled={ocupado} onClick={() => void encerrar()} data-testid="atendimento-encerrar" className={BOTAO_VERMELHO}>
            <PhoneOff className="w-4 h-4" aria-hidden="true" /> {'Encerrar'}
          </button>
        </div>
      }
    >
      <div className="flex flex-col flex-1 min-h-0 p-3 gap-2">
        {chamada.descricao && (
          <p className="text-ui-sm text-brand-text-primary" data-testid="atendimento-descricao">
            <span className="font-medium">{'Problema descrito: '}</span>{chamada.descricao}
          </p>
        )}
        {!temMicrofone && (
          <p className="flex items-start gap-2 text-ui-sm text-brand-text-primary">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>{'O seu microfone não foi liberado: você ouve quem chamou, mas ele não ouve você.'}</span>
          </p>
        )}
        {aviso && (
          <p className="flex items-start gap-2 text-ui-sm text-brand-text-primary" role="alert" data-testid="atendimento-aviso">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>{aviso}</span>
          </p>
        )}
        {/* A tela de quem chamou, inteira e sem corte: é sobre ela que os gestos são medidos. */}
        <video
          ref={video} autoPlay playsInline tabIndex={0} data-testid="atendimento-video"
          aria-label={operando ? 'Tela de quem chamou; os seus gestos aqui são reproduzidos na aba dele' : 'Tela de quem chamou'}
          onMouseMove={aoMover}
          onMouseDown={(pEvento) => aoPressionarOuSoltar(pEvento, 'pressionar')}
          onMouseUp={(pEvento) => aoPressionarOuSoltar(pEvento, 'soltar')}
          onWheel={aoRolar}
          onKeyDown={aoTeclar}
          onContextMenu={(pEvento) => { if (operando) pEvento.preventDefault(); }}
          className={`flex-1 min-h-[16rem] w-full bg-black rounded-lg object-contain focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
            operando ? 'cursor-crosshair' : 'cursor-default'}`}
        />
      </div>
    </XModalShell>
  );
}
