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
 * Daí em diante é a mesma sessão: o vídeo da tela de quem chamou, o áudio nos dois sentidos, a câmera dos
 * dois lados (cada um liga a sua, e ela começa desligada) e o controle da aba dele.
 *
 * <b>A tela de quem chamou ocupa TODA a área da App</b> (dono, 2026-11-19): o atendente precisa ver o que o
 * outro vê, do tamanho mais próximo possível. Os controles (situação, problema descrito, câmeras, microfone,
 * operar, encerrar) ficam num PAINEL FLUTUANTE por cima do vídeo, que o atendente arrasta para onde não
 * atrapalha e enrola até ficar só na alça. O painel é só de ícones, com o texto de cada um no hint (dono,
 * 2026-11-19); texto à vista, só o problema descrito e o que pede ação. Tudo contido na área da App, como todo
 * diálogo acionado por ela.
 *
 * O controle é feito SOBRE O VÍDEO: com "Operar a aba" ligado, o movimento do mouse, o clique, a roda e
 * as teclas viram gestos enviados pelo canal de dados, com as coordenadas normalizadas pelo tamanho da
 * imagem. Quem os reproduz é a página de quem chamou — que pode recusá-los (campo de senha, usuário
 * mexendo no mouse) e avisa de volta, para o atendente não ficar clicando no vazio.
 *
 * Fechar o diálogo ENCERRA o atendimento — não há sessão de suporte correndo sem atendente olhando —, e
 * antes de sair o atendente diz se o caso foi resolvido.
 */

import { useCallback, useContext, useEffect, useRef, useState, type JSX, type KeyboardEvent, type MouseEvent, type WheelEvent } from 'react';
import { ArrowUpToLine, CheckCircle, GripVertical, Loader2, Mic, MicOff, MousePointerClick, PhoneOff, TriangleAlert } from 'lucide-react';
import type { HubConnection } from '@microsoft/signalr';

import { api } from '@core/lib/api';
import { TabsContext } from '@core/contexts';
import { getFieldValue } from '@core/lib/fieldAccess';
import { XModalShell } from '@core/components/templates/XModalShell';
import { useMolduraDeModal } from '@core/hooks/useMolduraDeModal';
import { ZIndexManager } from '@core/lib/zIndexManager';
import type { XButtonActionComponentProps } from '@core/components/templates/XButtonActionRegistry';
import { criarCanalDeSuporte, encerrarCanal, entrarNaChamada, sinalizar } from '@core/lib/suporte/canalDeSuporte';
import { ConexaoDeMidia, pararMidia, pedirMicrofone } from '@core/lib/suporte/conexaoDeMidia';
import { lerAviso, pontoNoVideo, serializarGesto, type GestoRemoto } from '@core/lib/suporte/controleRemoto';
import {
  ROTA_DAS_CHAMADAS, formatarDuracao, politicaDoNavegador, servidoresDoNavegador,
  type ChamadaDeSuporte, type ServidorICE, type TipoDeRecado,
} from '@core/lib/suporte/tipos';

import { XBotaoDeCamera } from './XBotaoDeCamera';
import { XBotaoDeEnrolar } from './XBotaoDeEnrolar';
import { XQuadrosDeCamera } from './XQuadrosDeCamera';
import { useCameraDeSuporte } from './useCameraDeSuporte';
import { CHAVE_DO_PAINEL_DO_ATENDENTE, usePosicaoDoPainel } from './usePosicaoDoPainel';

/** Intervalo mínimo entre dois gestos de movimento: o ponteiro segue suave sem inundar o canal. */
const INTERVALO_DO_MOVIMENTO_MS = 40;

/** Por quanto tempo o aviso de gesto recusado fica na tela. */
const DURACAO_DO_AVISO_MS = 4000;

const AVISO_DE_BLOQUEIO = {
  senha: 'O foco está num campo de senha: só quem chamou digita ali. Peça a ele que digite.',
  usuario: 'Quem chamou está usando o mouse ou o teclado agora; o seu gesto foi descartado. Combine por voz quem opera.',
} as const;

/** Botão só de ícone do painel de controle: o texto vai no hint. */
const BOTAO_DE_ICONE = 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border text-brand-text-primary bg-brand-surface hover:bg-hover disabled:opacity-50 disabled:cursor-not-allowed';

const BOTAO_NEUTRO = 'inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover disabled:opacity-50';

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

function SessaoDeAtendimento({ modo, selectedRow, tabID, onCancel, onDone }: SessaoProps): JSX.Element | null {
  const selecionado = String(getFieldValue(selectedRow ?? {}, 'ID') ?? '');

  const [chamada, setChamada] = useState<ChamadaDeSuporte | null>(null);

  // Assumida a chamada, a aba passa a dizer QUEM está sendo atendido (dono, 2026-11-19); ao sair do atendimento,
  // volta ao nome da App. Opcional: fora de uma aba (nos testes, por exemplo) não há título a trocar.
  const abas = useContext(TabsContext);
  const definirTitulo = abas?.definirTitulo;
  const atendido = chamada?.usuario ?? '';

  useEffect(() => {
    if (!definirTitulo || !tabID || !atendido)
      return;

    definirTitulo(tabID, atendido);

    return () => definirTitulo(tabID, '');
  }, [definirTitulo, tabID, atendido]);
  const [ligacao, setLigacao] = useState<RTCPeerConnectionState>('new');
  const [temVideo, setTemVideo] = useState(false);
  // Quem chamou parou de compartilhar a tela (a ligação e a voz seguem).
  const [telaParada, setTelaParada] = useState(false);
  // Quem chamou está na chamada? `null` enquanto esta aba não entrou nela: o servidor conta, ao entrar, se ele já está.
  const [usuarioPresente, setUsuarioPresente] = useState<boolean | null>(null);
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

  const camera = useCameraDeSuporte(() => midia.current);

  // O painel de controle flutua sobre o vídeo: arrasta-se pelo cabeçalho, contido na área da App.
  // A posição em que o atendente deixou o painel fica no perfil: o próximo atendimento o abre ali.
  const [posicaoDoPainel, gravarPosicaoDoPainel] = usePosicaoDoPainel(CHAVE_DO_PAINEL_DO_ATENDENTE);
  const painel = useMolduraDeModal({
    arrastavel: true, redimensionavel: false, posicionamento: 'ancorado', conterAoMudarDeTamanho: true,
    aberto: !!chamada && !encerrada, quadroSalvo: posicaoDoPainel, aoMudarQuadro: gravarPosicaoDoPainel,
  });
  const [painelEnrolado, setPainelEnrolado] = useState(false);
  const [zIndex] = useState(() => ZIndexManager.next());
  const { aoReceberCamera, aoMudarCameraRemota, esquecerRemota, faixa: faixaDaCamera, desligar: desligarCamera } = camera;

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
    let recados: Promise<void> = Promise.resolve();

    const desligarMidia = (): void => {
      midia.current?.fechar();
      midia.current = null;
      esquecerRemota();
      setTemVideo(false);
      setTelaParada(false);
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

        const conexao = new ConexaoDeMidia({
          servidores: servidoresDoNavegador(servidores),
          politica: politicaDoNavegador(servidores),
          enviarRecado: (pT, pD) => sinalizar(canal, id, pT, pD),
          aoReceberMidia: (pRemota) => {
            if (video.current)
              video.current.srcObject = pRemota;

            setTemVideo(pRemota.getVideoTracks().length > 0);
          },
          aoMudarEstado: setLigacao,
          aoReceberCamera,
          aoMudarCameraRemota,
          aoMudarTelaRemota: (pLigada) => {
            setTelaParada(!pLigada);
            if (!pLigada)
              setOperando(false);
          },
          aoReceberDados: (pTexto) => {
            const bloqueio = lerAviso(pTexto);
            if (bloqueio)
              mostrarAviso(AVISO_DE_BLOQUEIO[bloqueio.motivo]);
          },
        });

        // A câmera já ligada entra na resposta: a oferta reservou a faixa dela.
        await conexao.definirCamera(faixaDaCamera());
        midia.current = conexao;
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

        // Os recados são tratados UM DE CADA VEZ, na ordem de chegada. A oferta espera os servidores ICE (uma ida
        // ao servidor), e os candidatos de rede que quem chamou manda logo em seguida chegariam antes de haver
        // ligação para recebê-los — e se perderiam, deixando a ligação sem caminho.
        canal.on('Recado', (pID: string, pTipo: TipoDeRecado, pDados: string) => {
          if (pID === id)
            recados = recados.then(() => responder(pTipo, pDados)).catch(() => desligarMidia());
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
            desligarCamera();
            setOperando(false);
            setEncerrada(pChamada);
          }
        });
        canal.onreconnected(() => void entrarNaChamada(canal, id));

        // Entrar na chamada é o que faz quem chamou mandar a oferta: só depois de o microfone estar decidido.
        await canal.start();
        await entrarNaChamada(canal, id);

        // Entrou e o servidor não contou que quem chamou está lá: ele não está (ainda, ou saiu).
        if (vivo)
          setUsuarioPresente((pAtual) => pAtual ?? false);
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
  }, [modo, selecionado, mostrarAviso, aoReceberCamera, aoMudarCameraRemota, esquecerRemota, faixaDaCamera, desligarCamera]);

  const encerrar = useCallback(async () => {
    if (!chamada || ocupado)
      return;

    setOcupado(true);

    try {
      setOperando(false);
      setEncerrada(await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${chamada.id}/encerrar`));
      desligarCamera();
    } catch {
      // O motivo já saiu no diálogo de mensagem; o atendimento segue como está no servidor.
    } finally {
      setOcupado(false);
    }
  }, [chamada, ocupado, desligarCamera]);

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

  // O painel de quem chamou aparece no vídeo (a captura é da aba inteira): o atendente o recolhe e o leva ao topo da
  // aba dele sem precisar pedir ao usuário (dono, 2026-11-19). Vale mesmo só olhando: não é gesto.
  const recolherPainelDoUsuario = useCallback((): void => {
    midia.current?.enviarDados(serializarGesto({ t: 'recolherPainel' }));
  }, []);

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

  const situacao = usuarioPresente === null
    ? 'Entrando na chamada…'
    : !usuarioPresente
    ? (modo === 'retorno' && ligacao === 'new'
      ? 'Quem registrou o chamado foi avisado no sino. A tela aparece aqui quando ele abrir "Chamar suporte".'
      : 'Quem chamou saiu da página ou perdeu a conexão. Se ele voltar, a tela reaparece aqui.')
    : ligacao === 'connected' ? (telaParada ? 'Quem chamou parou de compartilhar a tela; vocês continuam se ouvindo. A tela volta aqui quando ele compartilhar de novo.'
      : temVideo ? 'Conectado: você vê a tela de quem chamou.' : 'Conectado por áudio; quem chamou ainda não liberou a tela.')
      : ligacao === 'failed' ? 'A conexão de tela e áudio não se estabeleceu: as duas redes não se alcançaram e não houve servidor que retransmitisse (TURN). Encerre e peça nova chamada.'
        : ligacao === 'disconnected' ? 'A conexão caiu; tentando retomar…'
          : ligacao === 'connecting' ? 'Conectando tela e áudio…'
            : 'Aguardando quem chamou liberar a tela.';

  const dicaDeOperar = ligacao !== 'connected' || !temVideo || telaParada
    ? 'Operar a aba de quem chamou (disponível quando a tela dele estiver à vista)'
    : operando ? 'Operando a aba de quem chamou: clique para só ver' : 'Operar a aba de quem chamou';

  const dicaDoPainelDoUsuario = ligacao !== 'connected' || !temVideo || telaParada
    ? 'Recolher o painel de quem chamou e levá-lo ao topo da aba dele (disponível quando a tela dele estiver à vista)'
    : 'Recolher o painel de quem chamou e levá-lo ao topo da aba dele, para ele não cobrir o que você precisa ver';

  const dicaDoMicrofone = !temMicrofone
    ? 'O seu microfone não foi liberado: você ouve quem chamou, mas ele não ouve você'
    : mudo ? 'Microfone desligado: clique para ligar' : 'Microfone ligado: clique para desligar';


  const tituloDoPainel = `Atendimento · ${chamada.usuario} · ${chamada.assinante} · ${chamada.email} · grupo ${chamada.grupo}`;

  return (
    <div
      className="absolute inset-0 bg-black overflow-hidden" style={{ zIndex }}
      role="region" aria-label={`Atendimento de suporte · ${chamada.usuario}`} data-testid="atendimento-sessao"
    >
      {/* A tela de quem chamou, inteira e sem corte, em toda a área: é sobre ela que os gestos são medidos. */}
      <video
        ref={video} autoPlay playsInline tabIndex={0} data-testid="atendimento-video"
        aria-label={operando ? 'Tela de quem chamou; os seus gestos aqui são reproduzidos na aba dele' : 'Tela de quem chamou'}
        onMouseMove={aoMover}
        onMouseDown={(pEvento) => aoPressionarOuSoltar(pEvento, 'pressionar')}
        onMouseUp={(pEvento) => aoPressionarOuSoltar(pEvento, 'soltar')}
        onWheel={aoRolar}
        onKeyDown={aoTeclar}
        onContextMenu={(pEvento) => { if (operando) pEvento.preventDefault(); }}
        className={`absolute inset-0 w-full h-full object-contain focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 ${
          operando ? 'cursor-crosshair' : 'cursor-default'}`}
      />

      {/* O painel de controle: por cima do vídeo, arrastável pela alça, enrolável até ficar só nela. */}
      <div
        ref={painel.ref}
        className="x-moldura-modal absolute right-4 bottom-4 max-w-[min(26rem,calc(100%-2rem))] max-h-[calc(100%-2rem)] flex flex-col gap-1.5 p-1.5 bg-brand-surface rounded-xl shadow-lg text-brand-text-primary will-change-transform transition-none"
        data-testid="atendimento-painel"
      >
        {/* O que o painel diz em ícones, inteiro, para quem usa leitor de tela. */}
        <p className="sr-only">{tituloDoPainel}</p>
        <p className="sr-only" role="status" aria-live="polite" data-testid="atendimento-situacao">{situacao}</p>
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center px-0.5 h-9 cursor-move select-none touch-none text-brand-text-secondary"
            {...painel.alca}
            title={`${tituloDoPainel}\n${situacao}\nArraste para mudar o painel de lugar.`}
            data-testid="atendimento-painel-alca"
          >
            <GripVertical className="w-4 h-4" aria-hidden="true" />
          </div>
          {!painelEnrolado && (
            <>
              <XBotaoDeCamera camera={camera} compacto className={BOTAO_DE_ICONE} />
              <button
                type="button" onClick={alternarMudo} disabled={!temMicrofone} aria-pressed={temMicrofone ? mudo : undefined}
                aria-label={dicaDoMicrofone} title={dicaDoMicrofone} data-testid="atendimento-microfone"
                className={BOTAO_DE_ICONE}
              >
                {mudo || !temMicrofone ? <MicOff className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
              </button>
              <button
                type="button" onClick={() => setOperando((pAtual) => !pAtual)} aria-pressed={operando}
                disabled={ligacao !== 'connected' || !temVideo || telaParada} data-testid="atendimento-operar"
                aria-label={dicaDeOperar} title={dicaDeOperar}
                className={`${BOTAO_DE_ICONE} ${operando ? '!text-white !bg-indigo-700 !border-indigo-700 hover:!bg-indigo-800' : ''}`}
              >
                <MousePointerClick className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button" onClick={recolherPainelDoUsuario}
                disabled={ligacao !== 'connected' || !temVideo || telaParada} data-testid="atendimento-recolher-painel-do-usuario"
                aria-label={dicaDoPainelDoUsuario} title={dicaDoPainelDoUsuario}
                className={BOTAO_DE_ICONE}
              >
                <ArrowUpToLine className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button" disabled={ocupado} onClick={() => void encerrar()} data-testid="atendimento-encerrar"
                aria-label={'Encerrar o atendimento'} title={'Encerrar o atendimento'}
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-white bg-red-700 hover:bg-red-800 disabled:opacity-50"
              >
                <PhoneOff className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}
          <XBotaoDeEnrolar enrolado={painelEnrolado} aoAlternar={() => setPainelEnrolado((pAtual) => !pAtual)} />
        </div>

        {/* O aviso de gesto recusado aparece mesmo enrolado: é a resposta ao que o atendente acabou de fazer. */}
        {aviso && (
          <p className="flex items-start gap-2 px-1 text-ui-sm" role="alert" data-testid="atendimento-aviso">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>{aviso}</span>
          </p>
        )}
        {!painelEnrolado && (
          <div className="flex flex-col gap-1.5 px-1 overflow-y-auto min-h-0">
            {ligacao === 'failed' && (
              <p className="flex items-start gap-2 text-ui-sm" role="alert">
                <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                <span>{situacao}</span>
              </p>
            )}
            {chamada.descricao && (
              <p className="text-ui-sm" data-testid="atendimento-descricao">
                <span className="font-medium">{'Problema descrito: '}</span>{chamada.descricao}
              </p>
            )}
            <XQuadrosDeCamera camera={camera} nomeDaOutraPonta={'quem chamou'} />
          </div>
        )}
      </div>
    </div>
  );
}
