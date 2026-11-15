/**
 * XChamarSuporte — o lado de QUEM CHAMA o suporte remoto. Aberto pelo menu do perfil ("Chamar suporte").
 *
 * O caminho, na ordem:
 *   1. disponibilidade — antes de pedir qualquer coisa, a tela pergunta ao servidor se a conta pode chamar
 *      (o assinante precisa estar num grupo de atendimento) e se há atendente online;
 *   2. senha — a de quem está logado, conferida no servidor: o atendente vai ver a tela e operar esta aba,
 *      e a sessão aberta não prova quem está diante dela. Sem atendente online, a tela pede também a
 *      DESCRIÇÃO do problema e mostra o horário de atendimento: o chamado vai ao quadro de avisos, e um
 *      atendente retorna quando entrar;
 *   3. espera — spinner, contagem regressiva do prazo, posição na fila e espera estimada (tudo do servidor;
 *      aqui é só exibição). É nesta etapa que o usuário libera a tela e o microfone, num clique próprio: o
 *      navegador só mostra o seletor de compartilhamento logo depois de um gesto, e o atendimento pode
 *      chegar minutos depois;
 *   4. atendimento — o diálogo sai da frente e fica uma barra fixa com o nome do atendente, o microfone e
 *      "Encerrar", para a aplicação continuar inteira à vista e em uso;
 *   5. fim — o motivo do encerramento e, depois de um atendimento, a pergunta: o caso foi resolvido?
 *
 * É diálogo DA CASCA (nasce do menu do perfil; App nenhum o aciona), o único tipo que usa overlay.
 *
 * O controle da aba é feito por eventos criados nesta página (`ReprodutorDeGestos`), com as travas de lá:
 * campo de senha não recebe digitação remota, e o gesto do próprio usuário tem prioridade.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Headset, Loader2, Mic, MicOff, MonitorUp, MousePointer2, PhoneOff, TriangleAlert } from 'lucide-react';
import type { HubConnection } from '@microsoft/signalr';

import { api } from '@core/lib/api';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { XModalShell } from '@core/components/templates/XModalShell';
import { criarCanalDeSuporte, encerrarCanal, entrarNaChamada, sinalizar } from '@core/lib/suporte/canalDeSuporte';
import { ConexaoDeMidia, compartilhouUmaAba, pararMidia, pedirMicrofone, pedirTela } from '@core/lib/suporte/conexaoDeMidia';
import { lerGesto, serializarGesto } from '@core/lib/suporte/controleRemoto';
import { ATRIBUTO_DO_SUPORTE, ReprodutorDeGestos } from '@core/lib/suporte/reproducaoDeGesto';
import {
  ROTA_DAS_CHAMADAS, formatarEspera, formatarEstimativa, servidoresDoNavegador,
  type ChamadaDeSuporte, type DisponibilidadeDoSuporte, type ServidorICE, type TipoDeRecado,
} from '@core/lib/suporte/tipos';

interface XChamarSuporteProps {
  /** O menu do perfil pediu a chamada. Durante o atendimento a barra fica visível mesmo com `false`. */
  aberto: boolean;
  aoFechar: () => void;
}

type Fase = 'inativo' | 'consultando' | 'indisponivel' | 'senha' | 'aguardando' | 'atendimento' | 'fim';

/** De quanto em quanto tempo a situação é relida do servidor, para o caso de o aviso em tempo real não chegar. */
const RELEITURA_MS = 15_000;

/** Tamanho máximo da descrição do problema (o mesmo do servidor). */
const TAMANHO_MAXIMO_DA_DESCRICAO = 2000;

const MOTIVO_DO_FIM: Record<string, string> = {
  Encerrada: 'O atendimento foi encerrado.',
  Cancelada: 'A chamada foi cancelada. Nenhum atendente chegou a ver a sua tela.',
  Expirada: 'Nenhum atendente pôde atender dentro do prazo de espera. A sua tela não foi compartilhada com ninguém. '
    + 'Se ainda precisa de ajuda, chame o suporte de novo.',
  Registrada: 'O seu chamado ficou registrado no quadro do suporte. Assim que um atendente entrar, ele retorna: você '
    + 'recebe um aviso no sino e, ao abrir "Chamar suporte" de novo, entra direto no atendimento.',
};

const BOTAO_NEUTRO = 'px-4 py-2 text-ui font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover';
const BOTAO_DESTAQUE = 'inline-flex items-center gap-2 px-4 py-2 text-ui font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed';

export function XChamarSuporte({ aberto, aoFechar }: XChamarSuporteProps): JSX.Element | null {
  const [fase, setFase] = useState<Fase>('inativo');
  const [disponibilidade, setDisponibilidade] = useState<DisponibilidadeDoSuporte | null>(null);
  const [senha, setSenha] = useState('');
  const [descricao, setDescricao] = useState('');
  const [abrindo, setAbrindo] = useState(false);
  const [chamada, setChamada] = useState<ChamadaDeSuporte | null>(null);
  const [restantes, setRestantes] = useState(0);
  const [telaPronta, setTelaPronta] = useState(false);
  const [pedindoTela, setPedindoTela] = useState(false);
  const [falhaDaTela, setFalhaDaTela] = useState('');
  const [abaCompartilhada, setAbaCompartilhada] = useState(true);
  const [temMicrofone, setTemMicrofone] = useState(false);
  const [mudo, setMudo] = useState(false);
  const [ligacao, setLigacao] = useState<RTCPeerConnectionState>('new');
  const [motivoDoFim, setMotivoDoFim] = useState('');
  // A chamada encerrada depois de um atendimento: é sobre ela que se pergunta se o caso foi resolvido.
  const [aAvaliar, setAAvaliar] = useState<string | null>(null);
  const [avaliando, setAvaliando] = useState(false);
  const [zIndex] = useState(() => ZIndexManager.next());

  // O que vive fora do ciclo de render: conexões, mídias e o que os ouvintes do hub precisam ler "agora".
  const canal = useRef<HubConnection | null>(null);
  const midia = useRef<ConexaoDeMidia | null>(null);
  const tela = useRef<MediaStream | null>(null);
  const microfone = useRef<MediaStream | null>(null);
  const reprodutor = useRef<ReprodutorDeGestos | null>(null);
  const chamadaAtual = useRef<ChamadaDeSuporte | null>(null);
  const atendentePresente = useRef(false);
  const ofertando = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const ponteiro = useRef<HTMLDivElement | null>(null);

  const desligarMidia = useCallback(() => {
    midia.current?.fechar();
    midia.current = null;
    ofertando.current = false;
    setLigacao('new');
  }, []);

  const limpar = useCallback(() => {
    const id = chamadaAtual.current?.id ?? null;

    desligarMidia();
    reprodutor.current?.parar();
    reprodutor.current = null;
    pararMidia(tela.current);
    pararMidia(microfone.current);
    tela.current = null;
    microfone.current = null;
    atendentePresente.current = false;
    chamadaAtual.current = null;

    void encerrarCanal(canal.current, id);
    canal.current = null;

    setTelaPronta(false);
    setTemMicrofone(false);
    setMudo(false);
    setFalhaDaTela('');
    setAbaCompartilhada(true);
  }, [desligarMidia]);

  const finalizar = useCallback((pChamada: ChamadaDeSuporte) => {
    // Só depois de um atendimento de verdade há o que avaliar.
    const atendida = pChamada.situacao === 'Encerrada' && !!pChamada.atendente;

    limpar();
    setChamada(null);
    setAAvaliar(atendida ? pChamada.id : null);
    setMotivoDoFim(MOTIVO_DO_FIM[pChamada.situacao] ?? `A chamada terminou: ${pChamada.situacaoTexto}.`);
    setFase('fim');
  }, [limpar]);

  // Inicia a negociação quando as três condições se cumprem: a chamada foi atendida, o atendente está na
  // chamada e a tela foi liberada. Cada uma chega por um caminho e em qualquer ordem; por isso esta função é
  // chamada de todos eles e só age quando nada falta.
  const tentarOfertar = useCallback(async () => {
    const atual = chamadaAtual.current;
    const hub = canal.current;

    if (!atual || atual.situacao !== 'EmAtendimento' || !hub || !tela.current || !atendentePresente.current)
      return;

    if (midia.current || ofertando.current)
      return;

    ofertando.current = true;

    try {
      const servidores = await api.get<ServidorICE[]>(`${ROTA_DAS_CHAMADAS}/${atual.id}/servidores-ice`);

      // Enquanto os servidores vinham, a chamada pode ter acabado ou a tela pode ter sido retirada.
      if (chamadaAtual.current?.id !== atual.id || !tela.current)
        return;

      const conexao = new ConexaoDeMidia({
        servidores: servidoresDoNavegador(servidores),
        enviarRecado: (pTipo, pDados) => sinalizar(hub, atual.id, pTipo, pDados),
        aoReceberMidia: (pRemota) => {
          if (audio.current)
            audio.current.srcObject = pRemota;
        },
        aoMudarEstado: setLigacao,
        aoReceberDados: (pTexto) => {
          const gesto = lerGesto(pTexto);
          if (!gesto || !reprodutor.current)
            return;

          const desfecho = reprodutor.current.aplicar(gesto);

          if (desfecho === 'senha' || desfecho === 'usuario')
            conexao.enviarDados(serializarGesto({ t: 'bloqueio', motivo: desfecho }));
        },
      });

      conexao.adicionarMidia(tela.current);
      if (microfone.current)
        conexao.adicionarMidia(microfone.current);

      midia.current = conexao;

      reprodutor.current ??= new ReprodutorDeGestos((pX, pY) => {
        if (ponteiro.current) {
          ponteiro.current.style.transform = `translate(${pX}px, ${pY}px)`;
          ponteiro.current.style.opacity = '1';
        }
      });

      await conexao.ofertar();
    } catch {
      // A recusa do servidor já saiu no diálogo de mensagem; a ligação fica por fazer e a barra o diz.
      desligarMidia();
    } finally {
      ofertando.current = false;
    }
  }, [desligarMidia]);

  const aplicarSituacao = useCallback((pChamada: ChamadaDeSuporte) => {
    if (chamadaAtual.current?.id !== pChamada.id)
      return;

    // O aviso em tempo real não traz a posição nem a estimativa (são de quem relê): não apaga as que há.
    const anterior = chamadaAtual.current;
    const atual = pChamada.situacao === 'Aguardando' && pChamada.posicao === 0
      ? { ...pChamada, posicao: anterior.posicao, esperaEstimadaSegundos: anterior.esperaEstimadaSegundos }
      : pChamada;

    chamadaAtual.current = atual;
    setChamada(atual);

    if (atual.situacao === 'Aguardando') {
      setRestantes(atual.segundosRestantes);
      return;
    }

    if (atual.situacao === 'EmAtendimento') {
      setFase('atendimento');
      void tentarOfertar();
      return;
    }

    finalizar(atual);
  }, [finalizar, tentarOfertar]);

  const reler = useCallback(async () => {
    const id = chamadaAtual.current?.id;
    if (!id)
      return;

    try {
      aplicarSituacao(await api.get<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${id}`, undefined, true));
    } catch {
      // Releitura é rede de segurança do aviso em tempo real: falhou agora, tenta de novo na próxima.
    }
  }, [aplicarSituacao]);

  const fechar = useCallback(() => {
    setMotivoDoFim('');
    setAAvaliar(null);
    setSenha('');
    setDescricao('');
    setDisponibilidade(null);
    setFase('inativo');
    aoFechar();
  }, [aoFechar]);

  // O menu pediu a chamada: primeiro pergunta-se ao servidor o que é possível. Havendo chamada em curso, o
  // pedido não a derruba.
  useEffect(() => {
    if (!aberto || fase !== 'inativo')
      return;

    let vivo = true;

    setFase('consultando');

    api.get<DisponibilidadeDoSuporte>(`${ROTA_DAS_CHAMADAS}/disponibilidade`)
      .then((pDisponibilidade) => {
        if (!vivo)
          return;

        setDisponibilidade(pDisponibilidade);
        setFase(pDisponibilidade.disponivel ? 'senha' : 'indisponivel');
      })
      // A falha já saiu no diálogo de mensagem, com o motivo: não há o que mostrar aqui.
      .catch(() => { if (vivo) fechar(); });

    return () => { vivo = false; };
    // Só a abertura dispara a consulta: `fase` muda dentro do próprio efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  // Contagem regressiva da espera. No zero, quem decide é o servidor: relê-se a chamada.
  useEffect(() => {
    if (fase !== 'aguardando')
      return;

    const relogio = window.setInterval(() => {
      setRestantes((pAtual) => {
        if (pAtual <= 1)
          void reler();

        return Math.max(0, pAtual - 1);
      });
    }, 1000);

    return () => window.clearInterval(relogio);
  }, [fase, reler]);

  // Releitura periódica enquanto há chamada em aberto: traz também a posição na fila e a espera estimada.
  useEffect(() => {
    if (fase !== 'aguardando' && fase !== 'atendimento')
      return;

    const releitura = window.setInterval(() => void reler(), RELEITURA_MS);

    return () => window.clearInterval(releitura);
  }, [fase, reler]);

  // Saiu da página com a chamada em aberto: as conexões e as mídias são soltas.
  useEffect(() => limpar, [limpar]);

  const semAtendente = disponibilidade !== null && !disponibilidade.atendenteOnline;
  const faltaDescrever = semAtendente && descricao.trim().length === 0;

  async function abrir(pEvento: FormEvent): Promise<void> {
    pEvento.preventDefault();

    if (!senha || faltaDescrever || abrindo)
      return;

    setAbrindo(true);

    try {
      const nova = await api.post<ChamadaDeSuporte>(ROTA_DAS_CHAMADAS, { senha, descricao: descricao.trim() });

      setSenha('');

      // Sem atendente online o chamado foi para o quadro: não há fila a esperar nem sessão a abrir agora.
      if (!nova.emAberto) {
        finalizar(nova);
        return;
      }

      const hub = criarCanalDeSuporte();

      chamadaAtual.current = nova;
      canal.current = hub;

      hub.on('ChamadaMudou', (pChamada: ChamadaDeSuporte) => aplicarSituacao(pChamada));
      hub.on('ParticipanteEntrou', (pID: string) => {
        if (pID !== chamadaAtual.current?.id)
          return;

        // O atendente entrou (ou voltou, depois de recarregar a página): a ligação anterior, se havia, era
        // com a aba antiga dele e não serve mais.
        atendentePresente.current = true;
        desligarMidia();
        void tentarOfertar();
      });
      hub.on('ParticipanteSaiu', (pID: string) => {
        if (pID !== chamadaAtual.current?.id)
          return;

        // O atendente caiu, mas a chamada continua dele: se voltar, a ligação se refaz.
        atendentePresente.current = false;
        desligarMidia();
      });
      hub.on('Recado', (pID: string, pTipo: TipoDeRecado, pDados: string) => {
        if (pID === chamadaAtual.current?.id)
          void midia.current?.receberRecado(pTipo, pDados).catch(() => desligarMidia());
      });
      // Reconectou: o hub esqueceu em que chamada esta conexão estava.
      hub.onreconnected(() => {
        const id = chamadaAtual.current?.id;
        if (id)
          void entrarNaChamada(hub, id).then(() => reler());
      });

      await hub.start();
      await entrarNaChamada(hub, nova.id);

      setChamada(nova);
      setRestantes(nova.segundosRestantes);

      // Em atendimento logo de saída: é o retorno de um chamado do quadro. O atendente já espera na chamada,
      // e entrou nela antes desta conexão existir — por isso conta como presente sem aviso de entrada.
      if (nova.situacao === 'EmAtendimento') {
        atendentePresente.current = true;
        setFase('atendimento');
      } else {
        setFase('aguardando');
      }
    } catch {
      // Senha recusada ou servidor fora: o motivo já saiu no diálogo de mensagem. Nada ficou aberto.
      limpar();
    } finally {
      setAbrindo(false);
    }
  }

  async function compartilhar(): Promise<void> {
    if (pedindoTela)
      return;

    setPedindoTela(true);
    setFalhaDaTela('');

    try {
      const novaTela = await pedirTela();

      // O usuário pode parar o compartilhamento pela barra do próprio navegador, a qualquer momento.
      novaTela.getVideoTracks()[0]?.addEventListener('ended', () => {
        tela.current = null;
        setTelaPronta(false);
        desligarMidia();
      });

      tela.current = novaTela;
      setAbaCompartilhada(compartilhouUmaAba(novaTela));
      setTelaPronta(true);

      if (!microfone.current) {
        microfone.current = await pedirMicrofone();
        setTemMicrofone(microfone.current !== null);
      }

      void tentarOfertar();
    } catch {
      setFalhaDaTela(
        'A tela não foi compartilhada: o pedido foi recusado ou a janela de escolha foi fechada. '
        + 'Sem a tela, o atendente não vê o que você vê. Clique de novo e escolha a aba deste sistema.');
    } finally {
      setPedindoTela(false);
    }
  }

  async function encerrar(): Promise<void> {
    const atual = chamadaAtual.current;

    if (!atual) {
      fechar();
      return;
    }

    const acao = atual.situacao === 'EmAtendimento' ? 'encerrar' : 'cancelar';

    try {
      // Cancelar uma chamada que acabou de ser atendida devolve "em atendimento": aí ela segue.
      aplicarSituacao(await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${atual.id}/${acao}`));
    } catch {
      // O motivo já saiu no diálogo de mensagem. A chamada segue como está no servidor.
      void reler();
    }
  }

  async function avaliar(pResolvido: boolean): Promise<void> {
    if (!aAvaliar || avaliando)
      return;

    setAvaliando(true);

    try {
      await api.post<ChamadaDeSuporte>(`${ROTA_DAS_CHAMADAS}/${aAvaliar}/avaliar`, { resolvido: pResolvido });
      setAAvaliar(null);
      setMotivoDoFim(pResolvido
        ? 'Obrigado. Ficou registrado que o seu caso foi resolvido.'
        : 'Obrigado. Ficou registrado que o seu caso não foi resolvido, e a equipe de suporte vê essa resposta. '
          + 'Se quiser continuar agora, chame o suporte de novo.');
    } catch {
      // O motivo já saiu no diálogo de mensagem; a pergunta continua na tela.
    } finally {
      setAvaliando(false);
    }
  }

  function alternarMudo(): void {
    const novo = !mudo;

    microfone.current?.getAudioTracks().forEach((pFaixa) => { pFaixa.enabled = !novo; });
    setMudo(novo);
  }

  if (fase === 'inativo')
    return null;

  if (fase === 'consultando') {
    return (
      <XModalShell variant="overlay" size="sm" title={'Chamar suporte'} closeLabel={'Cancelar'} onClose={fechar}>
        <div role="status" aria-live="polite" className="flex items-center gap-3 p-6 text-ui text-brand-text-primary">
          <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden="true" />
          <span>{'Verificando o suporte disponível para a sua conta…'}</span>
        </div>
      </XModalShell>
    );
  }

  if (fase === 'indisponivel') {
    return (
      <XModalShell variant="overlay" size="sm" title={'Chamar suporte'} closeLabel={'Fechar'} onClose={fechar}>
        <div className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-indisponivel">
          <p className="flex items-start gap-2">
            <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <span>{disponibilidade?.motivo}</span>
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={fechar} className={BOTAO_NEUTRO}>{'Fechar'}</button>
          </div>
        </div>
      </XModalShell>
    );
  }

  if (fase === 'senha') {
    return (
      <XModalShell variant="overlay" size="md" title={'Chamar suporte'} closeLabel={'Cancelar'} onClose={fechar}>
        <form onSubmit={abrir} className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-senha">
          {semAtendente ? (
            <div className="space-y-2" data-testid="suporte-sem-atendente">
              <p className="flex items-start gap-2">
                <TriangleAlert className="w-5 h-5 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  <strong>{'Não há atendente online agora.'}</strong>
                  {' O seu chamado fica registrado, e um atendente retorna assim que entrar: você recebe um aviso no sino.'}
                </span>
              </p>
              {disponibilidade.horarios.length > 0 && (
                <div className="text-ui-sm">
                  <p className="font-medium">{'Horário de atendimento'}</p>
                  <ul className="text-brand-text-secondary">
                    {disponibilidade.horarios.map((pLinha) => <li key={pLinha}>{pLinha}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p>
              {'Um atendente vai '}<strong>{'ver a sua tela'}</strong>{', falar com você por áudio e poderá '}
              <strong>{'operar esta aba'}</strong>{'. Você encerra quando quiser.'}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="suporte-descricao-campo" className="block font-medium">
              {semAtendente ? 'Descreva o problema' : 'Descreva o problema (opcional)'}
            </label>
            <p className="text-ui-sm text-brand-text-secondary">
              {semAtendente
                ? 'É o que o atendente vai ler antes de falar com você: o que você estava fazendo e o que aconteceu.'
                : 'Se quiser, adiante ao atendente o que está acontecendo.'}
            </p>
            <textarea
              id="suporte-descricao-campo" value={descricao} rows={3} maxLength={TAMANHO_MAXIMO_DA_DESCRICAO}
              autoFocus={semAtendente}
              onChange={(pEvento) => setDescricao(pEvento.target.value)}
              className="w-full px-2.5 py-2 text-ui border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="suporte-senha-campo" className="block font-medium">{'Sua senha'}</label>
            <p className="text-ui-sm text-brand-text-secondary">
              {'A senha com que você entra no sistema. Ela é pedida de novo para confirmar que é você quem está chamando.'}
            </p>
            <input
              id="suporte-senha-campo" type="password" value={senha} autoComplete="current-password" autoFocus={!semAtendente}
              onChange={(pEvento) => setSenha(pEvento.target.value)}
              className="w-full px-2.5 min-h-editor text-ui border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            {faltaDescrever && (
              <p className="mr-auto text-ui-sm text-brand-text-secondary">{'Para registrar o chamado, falta descrever o problema.'}</p>
            )}
            <button type="button" onClick={fechar} className={BOTAO_NEUTRO}>{'Cancelar'}</button>
            <button type="submit" disabled={!senha || faltaDescrever || abrindo} data-testid="suporte-chamar" className={BOTAO_DESTAQUE}>
              {abrindo ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Headset className="w-4 h-4" aria-hidden="true" />}
              {semAtendente ? 'Registrar o chamado' : 'Chamar suporte'}
            </button>
          </div>
        </form>
      </XModalShell>
    );
  }

  if (fase === 'fim') {
    return (
      <XModalShell variant="overlay" size="sm" title={'Suporte'} closeLabel={'Fechar'} onClose={fechar}>
        <div className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-fim">
          <p>{motivoDoFim}</p>
          {aAvaliar ? (
            <div className="space-y-2" data-testid="suporte-avaliacao">
              <p className="font-medium">{'O seu caso foi resolvido?'}</p>
              <div className="flex gap-2">
                <button type="button" disabled={avaliando} onClick={() => void avaliar(true)} className={BOTAO_DESTAQUE}>
                  <CheckCircle className="w-4 h-4" aria-hidden="true" /> {'Sim, foi resolvido'}
                </button>
                <button type="button" disabled={avaliando} onClick={() => void avaliar(false)} className={BOTAO_NEUTRO}>
                  {'Não foi resolvido'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <button type="button" onClick={fechar} className={BOTAO_NEUTRO}>{'Fechar'}</button>
            </div>
          )}
        </div>
      </XModalShell>
    );
  }

  const blocoDaTela = (
    <div className="space-y-2">
      {telaPronta ? (
        <p className="flex items-center gap-2 text-ui-sm">
          <CheckCircle className="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
          <span>
            {'Tela liberada'}
            {temMicrofone ? ' e microfone ligado.' : '. O microfone não foi liberado: você ouve o atendente, mas ele não ouve você.'}
          </span>
        </p>
      ) : (
        <button
          type="button" onClick={() => void compartilhar()} disabled={pedindoTela} data-testid="suporte-compartilhar"
          className="inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-semibold text-white bg-indigo-700 rounded-lg hover:bg-indigo-800 disabled:opacity-50"
        >
          {pedindoTela ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <MonitorUp className="w-4 h-4" aria-hidden="true" />}
          {'Compartilhar a tela e o microfone'}
        </button>
      )}
      {telaPronta && !abaCompartilhada && (
        <p className="flex items-start gap-2 text-ui-sm">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span>
            {'Você compartilhou uma janela ou a tela inteira, e não a aba deste sistema. O atendente vê a imagem, '
              + 'mas os cliques dele não vão cair no lugar certo. Para ele poder operar, pare o compartilhamento '
              + 'e escolha a aba deste sistema.'}
          </span>
        </p>
      )}
      {falhaDaTela && (
        <p className="flex items-start gap-2 text-ui-sm" role="alert">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <span>{falhaDaTela}</span>
        </p>
      )}
    </div>
  );

  if (fase === 'aguardando') {
    return (
      <XModalShell
        variant="overlay" size="sm" title={'Chamando o suporte'} closeLabel={'Cancelar a chamada'}
        onClose={() => void encerrar()}
      >
        <div className="p-5 space-y-4 text-ui text-brand-text-primary" data-testid="suporte-espera">
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <Loader2 className="w-6 h-6 shrink-0 animate-spin text-brand-primary" aria-hidden="true" />
            <span>{'Aguardando um atendente assumir a sua chamada…'}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {chamada && chamada.posicao > 0 && (
              <>
                <dt className="text-brand-text-secondary">{'Sua posição na fila'}</dt>
                <dd className="font-semibold tabular-nums" data-testid="suporte-posicao">{`${chamada.posicao}º`}</dd>
                <dt className="text-brand-text-secondary">{'Atendimento estimado'}</dt>
                <dd className="font-semibold" data-testid="suporte-estimativa">{formatarEstimativa(chamada.esperaEstimadaSegundos)}</dd>
              </>
            )}
            <dt className="text-brand-text-secondary">{'Tempo máximo de espera'}</dt>
            <dd className="font-semibold tabular-nums text-lg" role="timer" data-testid="suporte-contador">{formatarEspera(restantes)}</dd>
          </dl>
          <div className="pt-3 border-t border-border-light space-y-2">
            <p className="font-medium">{'Enquanto espera, libere a tela'}</p>
            <p className="text-ui-sm text-brand-text-secondary">
              {'O navegador vai perguntar o que compartilhar: escolha a aba deste sistema. Nada é transmitido antes de um atendente assumir a chamada.'}
            </p>
            {blocoDaTela}
          </div>
          <div className="flex justify-end">
            <button type="button" onClick={() => void encerrar()} data-testid="suporte-cancelar" className={BOTAO_NEUTRO}>
              {'Cancelar a chamada'}
            </button>
          </div>
        </div>
      </XModalShell>
    );
  }

  // Em atendimento: uma barra fixa embaixo, fora do caminho. A aplicação fica inteira à vista e em uso —
  // é ela que o atendente precisa ver. O ponteiro dele aparece por cima de tudo e não recebe clique.
  const situacaoDaLigacao = !telaPronta ? 'Falta liberar a tela para o atendente ver.'
    : ligacao === 'connected' ? 'O atendente vê a sua tela e pode operar esta aba.'
      : ligacao === 'failed' ? 'A conexão de tela e áudio não se estabeleceu: as duas redes não se alcançaram. Encerre e chame de novo.'
        : ligacao === 'disconnected' ? 'A conexão com o atendente caiu; tentando retomar…'
          : 'Conectando tela e áudio ao atendente…';

  return createPortal(
    <>
      <audio ref={audio} autoPlay />
      <div
        ref={ponteiro} aria-hidden="true"
        className="fixed top-0 left-0 pointer-events-none opacity-0 transition-opacity"
        style={{ zIndex: zIndex + 1 }}
      >
        <MousePointer2 className="w-6 h-6 text-indigo-700 fill-indigo-300 drop-shadow" />
      </div>
      <div
        {...{ [ATRIBUTO_DO_SUPORTE]: '' }}
        role="region" aria-label={'Atendimento de suporte em curso'} data-testid="suporte-barra"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100vw-2rem)] x-moldura-modal bg-brand-surface rounded-xl shadow-lg px-4 py-3 space-y-2 text-ui text-brand-text-primary"
        style={{ zIndex }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Headset className="w-5 h-5 shrink-0 text-indigo-700" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">{'Suporte conectado'}{chamada?.atendente ? ` · ${chamada.atendente}` : ''}</p>
            <p className="text-ui-sm text-brand-text-secondary" role="status" aria-live="polite">{situacaoDaLigacao}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {temMicrofone && (
              <button
                type="button" onClick={alternarMudo} aria-pressed={mudo}
                className="inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-medium text-brand-text-primary bg-brand-surface border border-border rounded-lg hover:bg-hover"
              >
                {mudo ? <MicOff className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
                {mudo ? 'Microfone desligado' : 'Microfone ligado'}
              </button>
            )}
            <button
              type="button" onClick={() => void encerrar()} data-testid="suporte-encerrar"
              className="inline-flex items-center gap-2 px-3 py-2 text-ui-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800"
            >
              <PhoneOff className="w-4 h-4" aria-hidden="true" /> {'Encerrar'}
            </button>
          </div>
        </div>
        {(!telaPronta || !abaCompartilhada || falhaDaTela) && blocoDaTela}
      </div>
    </>,
    document.body
  );
}
