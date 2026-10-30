import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ExternalLink, History, Loader2, MessageSquarePlus, Moon, Pin, Send, Trash2, X, XCircle } from 'lucide-react';
import { api } from '@core/lib/api';
import { mensagemDeFalha } from '@core/lib/mensagemDeFalha';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { MessageText } from '@core/components/ui/MessageText';
import { useContextoDeTela, type ContextoDeTela } from './useContextoDeTela';
import { XJanelaDeTrecho } from '../ajuda/XJanelaDeTrecho';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';
import { useSiteConfig } from '@core/hooks/useSiteConfig';
import { prepararMarkdown } from './prepararMarkdown';

// ============================================================================
// Contratos (espelho do SYS: RespostaJaciDTO / FonteJaciDTO / PerguntaJaci / ConversaJaciDTO / TurnoJaciDTO)
// ============================================================================

export interface FonteJaci {
  id: string;
  titulo: string;
  caminho: string;
  ancora: string;
  tipo: string;
}

export interface RespostaJaci {
  id: string;
  status: string;
  concluido: boolean;
  resposta: string;
  fase: string;
  soubeResponder: boolean;
  fontes: FonteJaci[];
  erro: string;
}

interface PerguntaJaci {
  pergunta: string;
  contexto: ContextoDeTela | null;
}

/** Uma conversa do usuário logado, como o painel a lista (dono, 2026-10-18). */
export interface ConversaJaci {
  id: string;
  titulo: string;
  app: string;
  iniciadaEm: string;
  ultimaAtividadeEm: string;
  numTurnos: number;
  status: string;
  ativa: boolean;
}

/** Um turno guardado no servidor: a pergunta e a resposta no contrato do polling. */
export interface TurnoJaci {
  id: string;
  iniciadoEm: string;
  concluidoEm: string;
  pergunta: string;
  resposta: RespostaJaci;
}

export interface PaginaDeTurnosJaci {
  conversaID: string;
  turnos: TurnoJaci[];
  haMaisAntigos: boolean;
}

/** Um turno da conversa: a pergunta e, quando chega, a resposta ou a falha nomeada. */
interface Turno {
  id: string;
  pergunta: string;
  resposta: RespostaJaci | null;
  erro: string;
  /** Horário de envio (HH:mm), como nos aplicativos de mensagem. */
  hora: string;
  /** Horário em que a resposta chegou (HH:mm). */
  horaResposta: string;
  /** Instante de envio (ISO, UTC) — a chave da paginação "Carregar anteriores". */
  iniciadoEm: string;
}

/** Hora local curta, para o balão. */
function horaAgora(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Hora local curta de um instante ISO do servidor; vazio quando o instante é o "zero" do servidor. */
function horaDe(pISO: string): string {
  if (!pISO || pISO.startsWith('0001-'))
    return '';
  const data = new Date(pISO.endsWith('Z') || /[+-]\d\d:\d\d$/.test(pISO) ? pISO : `${pISO}Z`);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Data e hora curtas para a lista de conversas. */
function dataDe(pISO: string): string {
  const data = new Date(pISO.endsWith('Z') || /[+-]\d\d:\d\d$/.test(pISO) ? pISO : `${pISO}Z`);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Um turno guardado no servidor vira um turno do painel; turno pendente volta a ser acompanhado por quem chama. */
function turnoDoServidor(pTurno: TurnoJaci): Turno {
  const concluido = pTurno.resposta.concluido;
  return {
    id: pTurno.id,
    pergunta: pTurno.pergunta,
    resposta: concluido && !pTurno.resposta.erro ? pTurno.resposta : null,
    erro: concluido ? pTurno.resposta.erro : '',
    hora: horaDe(pTurno.iniciadoEm),
    horaResposta: concluido ? horaDe(pTurno.concluidoEm) : '',
    iniciadoEm: pTurno.iniciadoEm,
  };
}

// ============================================================================
// Constantes
// ============================================================================

const ROTA_PERGUNTAR = '/jaci/perguntar';
const ROTA_RESPOSTA = '/jaci/resposta/{id}';
const ROTA_CONVERSAS = '/jaci/conversas';
const ROTA_TURNOS = '/jaci/conversas/turnos';
const ROTA_NOVA_CONVERSA = '/jaci/conversas/nova';
const ROTA_REMOVER_CONVERSA = '/jaci/conversas/{id}';
const INTERVALO_CONSULTA_MS = 1000;
const MANUAL = '/manual/index.html';
/** Turnos por página: o painel esconde o passado longo e o traz sob demanda (dono, 2026-10-18). */
const TURNOS_POR_PAGINA = 10;

/** O rótulo da fase da lua, para quem lê: `nova` confirma, `crescente` ensina, `cheia` explica. */
const ROTULO_DA_FASE: Record<string, string> = {
  nova: 'Lua nova · resposta curta',
  crescente: 'Lua crescente · passo a passo',
  cheia: 'Lua cheia · explicação inteira',
};

export { prepararMarkdown } from './prepararMarkdown';

/** Link da estrela: a seção exata do manual publicado. */
export function linkDaFonte(pFonte: FonteJaci): string {
  return pFonte.ancora ? `${MANUAL}#${pFonte.ancora}` : MANUAL;
}

// ============================================================================
// Componente
// ============================================================================

/** Evento que abre o painel da Jaci de qualquer lugar da página (`window.dispatchEvent(new Event(...))`). */
export const EVENTO_ABRIR_JACI = 'jaci:abrir';

interface PainelJaciProps {
  /**
   * Visitante sem sessão (tela de entrada): só a pergunta vai ao servidor, sem contexto — regra do
   * dono (2026-10-17). Com sessão, o contexto da tela à frente acompanha a pergunta.
   */
  anonimo?: boolean;
  /**
   * Traje do botão: o do cabeçalho (discreto), o da tela de entrada (destacado) ou o FLUTUANTE —
   * botão redondo fixo no canto inferior direito da página (landing), com o painel abrindo para cima.
   */
  variante?: 'cabecalho' | 'login' | 'flutuante';
  /** `data-testid` do botão — a casca e a tela de entrada têm os seus, e o E2E os procura. */
  testId?: string;
}

/**
 * Jaci, a assistente do Tootega ERP (ADR-0007). Painel da CASCA — portal, camada do `ZIndexManager`,
 * ancorado ao botão, como o sino de mensagens — porque não é modal de App: é ajuda, e pode ficar
 * sobre o que estiver aberto sem cobrir a página.
 *
 * Conversa (pergunta → resposta em Markdown → "estrelas" = fontes com link para a seção do manual),
 * polling de 1 s como o Teste de Prompt, e toda falha NOMEADA (CE-21-quater): o texto do servidor
 * quando há, ou a operação com método, rota e status quando não há.
 *
 * Para o LOGADO a conversa CONTINUA entre aberturas do painel (dono, 2026-10-18): ao abrir, os últimos
 * turnos da conversa ativa são recarregados do servidor; "Carregar anteriores" traz o passado; "Nova
 * conversa" arquiva a atual; a lista de conversas reabre uma antiga em leitura ou a remove do painel.
 * O visitante não tem nada disso — a conversa dele não é guardada.
 */
/** Direção de uma alça de redimensionar: as quatro arestas e os quatro cantos, como numa janela. */
type DirecaoDeAlca = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** As oito alças: arestas finas e cantos um pouco maiores, cada uma com o cursor da sua direção. */
const ALCAS: ReadonlyArray<{ direcao: DirecaoDeAlca; classe: string }> = [
  { direcao: 'n', classe: 'top-0 left-3 right-3 h-1.5 cursor-ns-resize' },
  { direcao: 's', classe: 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize' },
  { direcao: 'e', classe: 'right-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
  { direcao: 'w', classe: 'left-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
  { direcao: 'ne', classe: 'top-0 right-0 h-4 w-4 cursor-nesw-resize' },
  { direcao: 'nw', classe: 'top-0 left-0 h-4 w-4 cursor-nwse-resize' },
  { direcao: 'se', classe: 'bottom-0 right-0 h-5 w-5 cursor-nwse-resize flex items-end justify-end text-brand-text-muted' },
  { direcao: 'sw', classe: 'bottom-0 left-0 h-5 w-5 cursor-nesw-resize flex items-end justify-start text-brand-text-muted' },
];

/**
 * Camada da Jaci FIXADA: acima de todo diálogo de App (o contador comum começa em 1000 e cresce um por
 * abertura) e ABAIXO das mensagens de erro/aviso e das dicas (9999), que precisam continuar visíveis.
 */
const Z_JACI_FIXADA = 9000;

export function PainelJaci({ anonimo = false, variante = 'cabecalho', testId = 'header-help' }: PainelJaciProps): JSX.Element {
  const [aberto, setAberto] = useState(false);
  const { config } = useSiteConfig();

  // Abrir de FORA (dono, 2026-10-22): a seção "Conheça a Jaci" da landing tem o botão "Perguntar à Jaci
  // agora". Quem quiser abrir o painel dispara `window.dispatchEvent(new Event(EVENTO_ABRIR_JACI))` — sem
  // conhecer o componente nem caçar o botão no DOM.

  // A estrela clicada abre a janela de trecho à esquerda (dono, 2026-10-18) — só a seção citada, não o manual inteiro.
  const [trecho, setTrecho] = useState<{ id: string; titulo: string } | null>(null);
  // O painel é arrastável pelo cabeçalho (dono, 2026-10-18): o deslocamento soma-se à âncora e fica lembrado
  // no PERFIL do usuário (preferência `jaci.painel`; no navegador quando não há sessão).
  // `largura`/`altura` (dono, 2026-10-18: painel redimensionável) só existem depois que a pessoa puxou o canto;
  // sem eles valem as classes (30 × 40 rem).
  const [deslocamento, gravarDeslocamento] = usePreferenciaDoUsuario<{ x: number; y: number; largura?: number; altura?: number }>('jaci.painel', { x: 0, y: 0 });
  // FIXADA (dono, 2026-10-25): com o pino, a Jaci fica visível o tempo todo — clicar fora não a fecha, e ela
  // fica ACIMA dos diálogos das Apps (que, abertos depois, a cobririam pelo contador de camadas). Só o X a
  // fecha, e o pino continua ao reabrir: o estado é preferência do perfil (`jaci.fixado`), como a posição.
  const [fixada, gravarFixada] = usePreferenciaDoUsuario<boolean>('jaci.fixado', false);
  const arrasto = useRef<{ x: number; y: number; origem: { x: number; y: number }; rect: DOMRect } | null>(null);
  const redimensionamento = useRef<{ direcao: DirecaoDeAlca; x: number; y: number; largura: number; altura: number; origem: { x: number; y: number } } | null>(null);
  const [pergunta, setPergunta] = useState('');
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [ancora, setAncora] = useState<{ top?: number; bottom?: number; left?: number; right?: number; z: number } | null>(null);
  // Ancorado à esquerda (tela de entrada) cresce para a direita; ancorado à direita (cabeçalho) cresce para a esquerda.
  const ancoradoAEsquerda = ancora?.left !== undefined;
  // Ancorado ao topo cresce para baixo; ancorado embaixo (acima do botão flutuante) cresce para cima.
  const ancoradoAoTopo = ancora?.top !== undefined;
  // O canto "livre" (oposto aos dois lados ancorados) leva o ícone de redimensionar.
  const cantoLivre: DirecaoDeAlca = `${ancoradoAoTopo ? 's' : 'n'}${ancoradoAEsquerda ? 'e' : 'w'}`;

  // Conversas do logado: a vista (nula = a ativa), se é só leitura (arquivada), se há mais antigos, a lista.
  const [conversaVista, setConversaVista] = useState<string | null>(null);
  const [somenteLeitura, setSomenteLeitura] = useState(false);
  const [haMaisAntigos, setHaMaisAntigos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [falhaDoHistorico, setFalhaDoHistorico] = useState('');
  const [listaAberta, setListaAberta] = useState(false);
  const [conversas, setConversas] = useState<ConversaJaci[]>([]);

  const raizRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const vivo = useRef(true);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortar = useRef<AbortController | null>(null);

  const montarContexto = useContextoDeTela();

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
      if (relogio.current)
        clearTimeout(relogio.current);
      abortar.current?.abort();
    };
  }, []);

  // Rola para o fim quando chega turno novo ou resposta.
  useEffect(() => {
    if (aberto)
      fimRef.current?.scrollIntoView({ block: 'end' });
  }, [aberto, turnos]);

  /** Calcula onde o painel abre (ancorado ao botão, cabendo inteiro na janela) e a camada dele. */
  const posicionarPainel = useCallback((): void => {
    const botao = raizRef.current?.getBoundingClientRect();

    // O painel tem de caber INTEIRO na janela (dono, 2026-10-18: no login ele abria abaixo do botão
    // e saía pelo rodapé e pela borda esquerda). As dimensões aqui espelham as classes do painel
    // (w-[30rem] max-w-[calc(100vw-1rem)], h-[40rem] max-h-[calc(100vh-6rem)]); a posição pedida
    // pelo botão é então limitada ao que cabe, com 8 px de folga em cada borda.
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const largura = Math.min(30 * rem, window.innerWidth - rem);
    const altura = Math.min(40 * rem, window.innerHeight - 6 * rem);
    const rightPedido = Math.max(8, window.innerWidth - (botao?.right ?? 0));
    const right = Math.max(8, Math.min(rightPedido, window.innerWidth - largura - 8));

    // Login (dono, 2026-10-18): o painel fica À DIREITA do cartão de entrada, alinhado ao topo dele,
    // quando há espaço para isso; sem espaço (tela estreita), cai no caso geral abaixo do botão.
    const cartao = variante === 'login' ? raizRef.current?.closest('.card')?.getBoundingClientRect() : undefined;
    if (cartao && cartao.right + 16 + largura <= window.innerWidth - 8) {
      const top = Math.max(8, Math.min(cartao.top, window.innerHeight - altura - 8));
      setAncora({ top, left: cartao.right + 16, z: ZIndexManager.next() });
      return;
    }

    // Flutuante: o botão está no rodapé da janela, então o painel abre PARA CIMA dele.
    if (variante === 'flutuante') {
      setAncora({ bottom: window.innerHeight - (botao?.top ?? window.innerHeight) + 8, right, z: ZIndexManager.next() });
    } else {
      const topPedido = (botao?.bottom ?? 0) + 8;
      const top = Math.max(8, Math.min(topPedido, window.innerHeight - altura - 8));
      setAncora({ top, right, z: ZIndexManager.next() });
    }
  }, [variante]);

  const alternarPainel = useCallback(() => {
    setAberto((pAtual) => {
      if (pAtual)
        return false;

      posicionarPainel();
      return true;
    });
  }, [posicionarPainel]);

  // ABRIR DE FORA passa pelo MESMO posicionamento do botão (2026-10-22): só marcar `aberto` deixava o
  // painel sem âncora — sem posição nem camada —, e ele abria escondido atrás da página. Foi o "não
  // acontece nada" do "Pergunte à Jaci agora" da landing.
  const abrirPainel = useCallback(() => {
    setAberto((pAtual) => {
      if (!pAtual)
        posicionarPainel();
      return true;
    });
  }, [posicionarPainel]);

  // O PAINEL NUNCA NASCE FORA DA JANELA (2026-10-22). O arrasto limita a posição durante o gesto, mas a
  // posição LEMBRADA no perfil vem de uma janela que podia ser maior: reaberta numa estreita, ela empurrava
  // o painel para além da borda (o corte visto pelo dono). Ao abrir e a cada mudança de tamanho da janela,
  // mede-se o painel e, se escapou, ele volta para dentro — com a mesma folga de 8 px do arrasto.
  // Roda SÓ ao abrir (ou reposicionar) e quando a janela muda de tamanho — nunca a cada mudança do próprio
  // deslocamento, para não virar laço. O valor atual vem por referência.
  const deslocamentoAtual = useRef(deslocamento);
  deslocamentoAtual.current = deslocamento;
  const gravarAtual = useRef(gravarDeslocamento);
  gravarAtual.current = gravarDeslocamento;

  useLayoutEffect(() => {
    if (!aberto)
      return;

    const trazerParaDentro = (): void => {
      const rect = painelRef.current?.getBoundingClientRect();
      // Sem tamanho medido (ainda não diagramado), não há o que corrigir.
      if (!rect || rect.width === 0 || rect.height === 0)
        return;
      const dx = rect.right > window.innerWidth - 8 ? window.innerWidth - 8 - rect.right : rect.left < 8 ? 8 - rect.left : 0;
      const dy = rect.bottom > window.innerHeight - 8 ? window.innerHeight - 8 - rect.bottom : rect.top < 8 ? 8 - rect.top : 0;
      if (dx === 0 && dy === 0)
        return;
      const atual = deslocamentoAtual.current;
      gravarAtual.current({ ...atual, x: Math.round(atual.x + dx), y: Math.round(atual.y + dy) });
    };

    trazerParaDentro();
    window.addEventListener('resize', trazerParaDentro);
    return () => window.removeEventListener('resize', trazerParaDentro);
  }, [aberto, ancora]);

  // O ouvinte do "abrir de fora" (EVENTO_ABRIR_JACI): quem quiser abrir a Jaci dispara o evento na janela.
  useEffect(() => {
    window.addEventListener(EVENTO_ABRIR_JACI, abrirPainel);
    return () => window.removeEventListener(EVENTO_ABRIR_JACI, abrirPainel);
  }, [abrirPainel]);

  useEffect(() => {
    // Fixada, o clique fora não a fecha: ela está ali para ficar enquanto se trabalha na tela.
    if (!aberto || fixada)
      return;

    const aoClicar = (pEvento: MouseEvent) => {
      const alvo = pEvento.target as Node;
      if (!raizRef.current?.contains(alvo) && !painelRef.current?.contains(alvo))
        setAberto(false);
    };

    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto, fixada]);

  const atualizarTurno = useCallback((pID: string, pMudanca: Partial<Turno>) => {
    setTurnos((pAtuais) => pAtuais.map((pTurno) => (pTurno.id === pID ? { ...pTurno, ...pMudanca } : pTurno)));
  }, []);

  // Consulta o estado até concluir. Reagenda a si mesma; nunca roda depois do desmonte.
  const acompanhar = useCallback(async (pID: string) => {
    if (!vivo.current)
      return;

    abortar.current = new AbortController();

    try {
      const atual = await api.get<RespostaJaci>(ROTA_RESPOSTA.replace('{id}', pID), abortar.current.signal, true);
      if (!vivo.current)
        return;

      if (!atual.concluido) {
        relogio.current = setTimeout(() => { void acompanhar(pID); }, INTERVALO_CONSULTA_MS);
        return;
      }

      setEnviando(false);
      atualizarTurno(pID, atual.erro ? { erro: atual.erro, horaResposta: horaAgora() } : { resposta: atual, horaResposta: horaAgora() });
    } catch (falha) {
      if (!vivo.current)
        return;
      setEnviando(false);
      atualizarTurno(pID, { erro: mensagemDeFalha(falha, 'consultar a resposta da Jaci') });
    }
  }, [atualizarTurno]);

  /**
   * Carrega uma página de turnos do servidor (a conversa ativa, ou a informada). Sem `pAntesDe`, são os
   * mais recentes e SUBSTITUEM o painel; com `pAntesDe`, são os anteriores e vão para o topo. Turno
   * ainda pendente volta a ser acompanhado — a pessoa pode ter fechado o painel antes da resposta.
   */
  const carregarTurnos = useCallback(async (pConversa: string | null, pAntesDe: string | null) => {
    setCarregando(true);
    setFalhaDoHistorico('');
    try {
      const parametros = new URLSearchParams();
      if (pConversa)
        parametros.set('conversa', pConversa);
      if (pAntesDe)
        parametros.set('antesDe', pAntesDe);
      parametros.set('quantidade', String(TURNOS_POR_PAGINA));
      const pagina = await api.get<PaginaDeTurnosJaci>(`${ROTA_TURNOS}?${parametros.toString()}`, undefined, true);
      if (!vivo.current)
        return;

      const novos = pagina.turnos.map(turnoDoServidor);
      setHaMaisAntigos(pagina.haMaisAntigos);
      setTurnos((pAtuais) => (pAntesDe ? [...novos, ...pAtuais] : novos));
      if (!pAntesDe) {
        const pendente = pagina.turnos.find((pTurno) => !pTurno.resposta.concluido);
        if (pendente) {
          setEnviando(true);
          void acompanhar(pendente.id);
        }
      }
    } catch (falha) {
      if (vivo.current)
        setFalhaDoHistorico(mensagemDeFalha(falha, 'carregar a conversa com a Jaci'));
    } finally {
      if (vivo.current)
        setCarregando(false);
    }
  }, [acompanhar]);

  // Logado: ao abrir o painel, a conversa ativa é recarregada do servidor — ela continua de onde parou.
  useEffect(() => {
    if (!aberto || anonimo || enviando)
      return;
    void carregarTurnos(conversaVista, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, anonimo, conversaVista]);

  const carregarAnteriores = useCallback(() => {
    const primeiro = turnos.find((pTurno) => pTurno.iniciadoEm.length > 0);
    if (!primeiro)
      return;
    void carregarTurnos(conversaVista, primeiro.iniciadoEm);
  }, [turnos, conversaVista, carregarTurnos]);

  const voltarAAtual = useCallback(() => {
    setSomenteLeitura(false);
    setListaAberta(false);
    setTurnos([]);
    setConversaVista(null);
  }, []);

  const novaConversa = useCallback(async () => {
    if (enviando)
      return;
    setFalhaDoHistorico('');
    try {
      await api.post<{ arquivou: boolean }>(ROTA_NOVA_CONVERSA);
      if (!vivo.current)
        return;
      setTurnos([]);
      setHaMaisAntigos(false);
      setSomenteLeitura(false);
      setListaAberta(false);
      setConversaVista(null);
    } catch (falha) {
      if (vivo.current)
        setFalhaDoHistorico(mensagemDeFalha(falha, 'começar uma nova conversa com a Jaci'));
    }
  }, [enviando]);

  const alternarLista = useCallback(async () => {
    if (listaAberta) {
      setListaAberta(false);
      return;
    }
    setFalhaDoHistorico('');
    try {
      const lista = await api.get<ConversaJaci[]>(ROTA_CONVERSAS, undefined, true);
      if (!vivo.current)
        return;
      setConversas(lista);
      setListaAberta(true);
    } catch (falha) {
      if (vivo.current)
        setFalhaDoHistorico(mensagemDeFalha(falha, 'listar as conversas com a Jaci'));
    }
  }, [listaAberta]);

  const abrirConversa = useCallback((pConversa: ConversaJaci) => {
    setListaAberta(false);
    setTurnos([]);
    setSomenteLeitura(!pConversa.ativa);
    setConversaVista(pConversa.ativa ? null : pConversa.id);
  }, []);

  const removerConversa = useCallback(async (pConversa: ConversaJaci) => {
    setFalhaDoHistorico('');
    try {
      await api.delete<{ removida: boolean }>(ROTA_REMOVER_CONVERSA.replace('{id}', pConversa.id));
      if (!vivo.current)
        return;
      setConversas((pAtuais) => pAtuais.filter((pItem) => pItem.id !== pConversa.id));
      // Removeu a que estava à vista (a ativa ou a arquivada aberta): o painel volta à conversa atual.
      if (pConversa.ativa || pConversa.id === conversaVista)
        voltarAAtual();
    } catch (falha) {
      if (vivo.current)
        setFalhaDoHistorico(mensagemDeFalha(falha, 'remover a conversa do painel'));
    }
  }, [conversaVista, voltarAAtual]);

  const enviar = useCallback(async (pEvento?: FormEvent) => {
    pEvento?.preventDefault();

    const texto = pergunta.trim();
    if (enviando || somenteLeitura || texto.length === 0)
      return;

    setEnviando(true);
    setPergunta('');

    try {
      const criado = await api.post<RespostaJaci, PerguntaJaci>(ROTA_PERGUNTAR, {
        pergunta: texto,
        contexto: anonimo ? null : montarContexto(),
      });

      if (!vivo.current)
        return;

      setTurnos((pAtuais) => [...pAtuais, { id: criado.id, pergunta: texto, resposta: null, erro: '', hora: horaAgora(), horaResposta: '', iniciadoEm: new Date().toISOString() }]);
      void acompanhar(criado.id);
    } catch (falha) {
      if (!vivo.current)
        return;
      setEnviando(false);
      // Falha no envio não tem id: o turno nasce já com a falha, para a pergunta não sumir da tela.
      setTurnos((pAtuais) => [...pAtuais, {
        id: `falha-${Date.now()}`,
        pergunta: texto,
        resposta: null,
        erro: mensagemDeFalha(falha, 'enviar a pergunta à Jaci'),
        hora: horaAgora(),
        horaResposta: horaAgora(),
        iniciadoEm: '',
      }]);
    }
  }, [pergunta, enviando, somenteLeitura, anonimo, montarContexto, acompanhar]);

  const classeDoBotao = variante === 'login'
    ? `inline-flex items-center gap-2 px-4 min-h-[40px] rounded-lg border border-brand-primary/40 bg-brand-primary/10
       text-brand-primary font-semibold text-ui-sm hover:bg-brand-primary/20 active:bg-brand-primary/25 transition-colors`
    : variante === 'flutuante'
      ? `flex items-center justify-center h-14 w-14 rounded-full bg-brand-surface border border-brand-primary/40 shadow-lg
         hover:shadow-xl hover:scale-105 active:scale-100 transition-all duration-200`
      : 'flex items-center gap-2 px-2 py-1 rounded-lg text-brand-text-primary hover:bg-brand-background transition-colors duration-200';

  // No cabeçalho o ícone tem o tamanho do avatar do usuário (w-8 h-8), para a linha ficar alinhada.
  const classeDoIcone = variante === 'flutuante' ? 'h-10 w-10 rounded-full' : variante === 'cabecalho' ? 'h-8 w-8 flex-shrink-0 rounded-full' : 'h-5 w-5 flex-shrink-0 rounded-full';

  const classeDoBotaoDoCabecalho = 'p-2 rounded-full text-brand-text-secondary hover:bg-brand-background hover:text-brand-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div
      ref={raizRef}
      className={variante === 'flutuante' ? 'fixed bottom-5 right-5 z-40 flex items-center gap-3' : 'relative'}
      data-testid={variante === 'flutuante' ? 'jaci-flutuante' : undefined}
    >
      {variante === 'flutuante' && !aberto && (
        // Hint de ajuda (dono, 2026-10-18): balão em letras grandes e destacadas ao lado do ícone,
        // com a seta apontando para ele. Some enquanto o painel está aberto. Também abre o painel.
        <button
          type="button"
          onClick={alternarPainel}
          data-testid="jaci-hint"
          aria-hidden="true"
          tabIndex={-1}
          className="group relative rounded-2xl bg-brand-primary text-white px-5 py-3 shadow-lg
                     text-xl sm:text-2xl font-extrabold leading-tight tracking-tight whitespace-nowrap
                     hover:bg-brand-primary-dark transition-colors duration-200 animate-pulse"
        >
          {'Precisa de ajuda? Pergunte à Jaci'}
          <span
            aria-hidden="true"
            className="absolute right-[-0.45rem] top-1/2 -translate-y-1/2 h-4 w-4 rotate-45 bg-brand-primary group-hover:bg-brand-primary-dark transition-colors duration-200"
          />
        </button>
      )}
      <button
        type="button"
        onClick={alternarPainel}
        data-testid={testId}
        aria-label={'Ajuda · Perguntar à Jaci'}
        aria-expanded={aberto}
        className={classeDoBotao}
      >
        <img src="/icons/jaci.svg" alt="" aria-hidden="true" className={classeDoIcone} />
        {variante !== 'flutuante' && (
          <span className={variante === 'login' ? '' : 'text-ui hidden sm:block whitespace-nowrap'}>{'Ajuda'}</span>
        )}
      </button>

      {trecho && (
        <XJanelaDeTrecho id={trecho.id} titulo={trecho.titulo} onFechar={() => setTrecho(null)}
          acimaDe={fixada ? Z_JACI_FIXADA : undefined} />
      )}

      {aberto && createPortal(
        // Chat no padrão de mercado: cabeçalho com avatar e estado, conversa em balões (os da pessoa à
        // direita, os da Jaci à esquerda com avatar), horário discreto em cada balão, "digitando" com
        // três pontos, e a barra de entrada em pílula com botão redondo. Largura de 30 rem (cabe em
        // 1366 px ao lado do conteúdo) e altura fixa, para a conversa rolar dentro do painel.
        // Borda na cor da marca e brilho (halo + glow) para a janela se destacar do conteúdo (dono, 2026-10-21).
        <div
          ref={painelRef}
          role="dialog"
          aria-label={`Jaci, assistente do ${config.nome}`}
          data-testid="jaci-painel"
          style={{
            top: ancora?.top, bottom: ancora?.bottom, left: ancora?.left, right: ancora?.left === undefined ? ancora?.right ?? 0 : undefined, zIndex: fixada ? Z_JACI_FIXADA : ancora?.z,
            transform: deslocamento.x || deslocamento.y ? `translate(${deslocamento.x}px, ${deslocamento.y}px)` : undefined,
            width: deslocamento.largura, height: deslocamento.altura,
          }}
          className="fixed w-[30rem] max-w-[calc(100vw-1rem)] h-[40rem] max-h-[calc(100vh-6rem)] flex flex-col overflow-hidden
                     rounded-2xl border-2 border-brand-primary/60 bg-brand-surface shadow-[0_0_0_4px_hsl(var(--brand-primary)/0.12),0_0_28px_6px_hsl(var(--brand-primary)/0.35),0_25px_50px_-12px_rgb(0_0_0/0.4)]"
        >
          {/* Redimensionar por QUALQUER aresta ou canto (dono, 2026-10-21; antes só o canto inferior do lado
              livre). O lado ancorado pela casca fica fixo por CSS; arrastar a aresta desse lado move o painel
              junto (deslocamento), para a aresta oposta não sair do lugar. Tamanho e posição vão ao perfil. */}
          {ALCAS.map((pAlca) => (
            <div
              key={pAlca.direcao}
              className={`absolute z-10 ${pAlca.classe}`}
              title="Arraste para redimensionar"
              data-testid={pAlca.direcao === cantoLivre ? 'jaci-redimensionar' : `jaci-redimensionar-${pAlca.direcao}`}
              onPointerDown={(pEvento) => {
                const rect = painelRef.current?.getBoundingClientRect();
                if (pEvento.button !== 0 || !rect)
                  return;
                pEvento.preventDefault();
                pEvento.stopPropagation();
                redimensionamento.current = { direcao: pAlca.direcao, x: pEvento.clientX, y: pEvento.clientY, largura: rect.width, altura: rect.height, origem: { x: deslocamento.x, y: deslocamento.y } };
                pEvento.currentTarget.setPointerCapture(pEvento.pointerId);
              }}
              onPointerMove={(pEvento) => {
                const atual = redimensionamento.current;
                if (!atual)
                  return;
                const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
                const minimo = 20 * rem;
                const dx = pEvento.clientX - atual.x;
                const dy = pEvento.clientY - atual.y;
                let largura = atual.largura;
                let altura = atual.altura;
                let x = atual.origem.x;
                let y = atual.origem.y;
                const horizontal = atual.direcao.includes('e') ? 'e' : atual.direcao.includes('w') ? 'w' : '';
                const vertical = atual.direcao.includes('n') ? 'n' : atual.direcao.includes('s') ? 's' : '';
                if (horizontal) {
                  largura = Math.max(minimo, Math.min(horizontal === 'e' ? atual.largura + dx : atual.largura - dx, window.innerWidth - rem));
                  const efetivo = largura - atual.largura;
                  // Aresta do lado ancorado: o painel desloca para a aresta oposta ficar parada.
                  if (ancoradoAEsquerda && horizontal === 'w')
                    x = atual.origem.x - efetivo;
                  if (!ancoradoAEsquerda && horizontal === 'e')
                    x = atual.origem.x + efetivo;
                }
                if (vertical) {
                  altura = Math.max(minimo, Math.min(vertical === 's' ? atual.altura + dy : atual.altura - dy, window.innerHeight - 6 * rem));
                  const efetivo = altura - atual.altura;
                  if (ancoradoAoTopo && vertical === 'n')
                    y = atual.origem.y - efetivo;
                  if (!ancoradoAoTopo && vertical === 's')
                    y = atual.origem.y + efetivo;
                }
                gravarDeslocamento({ x: Math.round(x), y: Math.round(y), largura: Math.round(largura), altura: Math.round(altura) });
              }}
              onPointerUp={(pEvento) => {
                redimensionamento.current = null;
                if (pEvento.currentTarget.hasPointerCapture(pEvento.pointerId))
                  pEvento.currentTarget.releasePointerCapture(pEvento.pointerId);
              }}
              onPointerCancel={() => { redimensionamento.current = null; }}
            >
              {pAlca.direcao === cantoLivre && (
                <svg viewBox="0 0 10 10" className={`h-3 w-3 ${ancoradoAEsquerda ? '' : '-scale-x-100'}`} aria-hidden="true"><path d="M1 9h8M3 9v-2M5 9V5M7 9V3" stroke="currentColor" strokeWidth="1.2" fill="none" /></svg>
              )}
            </div>
          ))}

          {/* Cabeçalho — a alça de arrasto (botões e links dentro dele não arrastam). */}
          <div
            className="relative px-4 py-3 border-b border-border-light bg-brand-surface flex items-center justify-between gap-3 cursor-move select-none"
            data-testid="jaci-cabecalho"
            onPointerDown={(pEvento) => {
              if (pEvento.button !== 0 || (pEvento.target as HTMLElement).closest('button, a, input'))
                return;
              const rect = painelRef.current?.getBoundingClientRect();
              if (!rect)
                return;
              pEvento.preventDefault();
              arrasto.current = { x: pEvento.clientX, y: pEvento.clientY, origem: deslocamento, rect };
              pEvento.currentTarget.setPointerCapture(pEvento.pointerId);
            }}
            onPointerMove={(pEvento) => {
              const atual = arrasto.current;
              if (!atual)
                return;
              // O painel inteiro continua dentro da janela, com 8 px de folga — como na abertura.
              const semDeslocamento = { left: atual.rect.left - atual.origem.x, top: atual.rect.top - atual.origem.y };
              const x = Math.max(8 - semDeslocamento.left, Math.min(atual.origem.x + pEvento.clientX - atual.x, window.innerWidth - atual.rect.width - 8 - semDeslocamento.left));
              const y = Math.max(8 - semDeslocamento.top, Math.min(atual.origem.y + pEvento.clientY - atual.y, window.innerHeight - atual.rect.height - 8 - semDeslocamento.top));
              gravarDeslocamento({ ...deslocamento, x, y });
            }}
            onPointerUp={(pEvento) => {
              arrasto.current = null;
              if (pEvento.currentTarget.hasPointerCapture(pEvento.pointerId))
                pEvento.currentTarget.releasePointerCapture(pEvento.pointerId);
            }}
            onPointerCancel={() => { arrasto.current = null; }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex-shrink-0">
                <img src="/icons/jaci.svg" alt="" aria-hidden="true" className="h-10 w-10 rounded-full ring-2 ring-brand-primary/30" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-brand-surface" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="text-ui font-semibold text-brand-text-primary leading-tight">{'Jaci'}</div>
                <div className="text-ui-xs text-brand-text-muted leading-tight truncate">
                  {enviando ? 'digitando…' : anonimo ? 'Assistente · responde com a documentação' : 'Assistente · responde com a documentação e a sua tela'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!anonimo && (
                <>
                  <button
                    type="button"
                    onClick={() => { void novaConversa(); }}
                    disabled={enviando}
                    data-testid="jaci-nova-conversa"
                    title={'Nova conversa'}
                    aria-label={'Nova conversa'}
                    // Destacado com o fundo da marca, como o Enviar (dono, 2026-10-21): é a ação principal do cabeçalho.
                    className="h-8 w-8 flex items-center justify-center rounded-full bg-brand-primary text-white shadow-sm
                               hover:bg-brand-primary/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <MessageSquarePlus size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { void alternarLista(); }}
                    data-testid="jaci-conversas"
                    title={'Conversas anteriores'}
                    aria-label={'Conversas anteriores'}
                    aria-expanded={listaAberta}
                    className={classeDoBotaoDoCabecalho}
                  >
                    <History size={18} />
                  </button>
                </>
              )}
              <a
                href={MANUAL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="jaci-manual"
                title={'Abrir o manual do usuário'}
                className={classeDoBotaoDoCabecalho}
              >
                <BookOpen size={18} />
              </a>
              <button
                type="button"
                onClick={() => gravarFixada(!fixada)}
                data-testid="jaci-fixar"
                title={fixada ? 'Desafixar: volta a fechar ao clicar fora' : 'Fixar: fica visível o tempo todo'}
                aria-label={fixada ? 'Desafixar a Jaci' : 'Fixar a Jaci'}
                aria-pressed={fixada}
                className={fixada
                  ? 'p-2 rounded-full bg-brand-primary/15 text-brand-primary ring-1 ring-inset ring-brand-primary/40 transition-colors'
                  : classeDoBotaoDoCabecalho}
              >
                {/* Pino vazado = solto; cheio e na cor da marca = fixado. */}
                <Pin size={18} className={fixada ? 'fill-current' : ''} />
              </button>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label={'Fechar'}
                className={classeDoBotaoDoCabecalho}
              >
                <X size={18} />
              </button>
            </div>

            {/* Lista de conversas: contida no painel (nada de overlay), abaixo do cabeçalho. */}
            {listaAberta && (
              <div
                data-testid="jaci-lista-conversas"
                className="absolute left-2 right-2 top-full mt-1 z-10 max-h-72 overflow-y-auto scrollbar-thin rounded-xl border border-border-light bg-brand-surface shadow-lg text-ui"
              >
                {conversas.length === 0 && (
                  <div className="px-3 py-3 text-brand-text-muted">{'Nenhuma conversa guardada ainda. A primeira pergunta começa uma.'}</div>
                )}
                {conversas.map((pConversa) => (
                  <div key={pConversa.id} data-testid="jaci-conversa-item" className="flex items-center gap-2 px-2 py-1.5 border-b border-border-light last:border-b-0 hover:bg-brand-background">
                    <button
                      type="button"
                      onClick={() => abrirConversa(pConversa)}
                      className="flex-1 min-w-0 text-left"
                      title={pConversa.titulo}
                    >
                      <div className="truncate text-brand-text-primary">
                        {pConversa.ativa && <span className="mr-1 text-ui-xs font-semibold text-brand-primary">{'Atual ·'}</span>}
                        {pConversa.titulo || '(sem pergunta)'}
                      </div>
                      <div className="text-ui-xs text-brand-text-muted">{`${dataDe(pConversa.ultimaAtividadeEm)} · ${pConversa.numTurnos} pergunta(s)`}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => { void removerConversa(pConversa); }}
                      data-testid="jaci-remover-conversa"
                      aria-label={'Remover conversa do painel'}
                      title={'Remover do painel'}
                      className="p-1.5 rounded-full text-brand-text-muted hover:bg-brand-background hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversa */}
          <div className="flex-1 overflow-y-auto scrollbar-thin bg-brand-background/60 px-4 py-4 space-y-3 text-ui">
            {somenteLeitura && (
              <div data-testid="jaci-arquivada" className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-ui-sm text-brand-text-primary">
                <span>{'Conversa anterior, somente para leitura.'}</span>
                <button type="button" onClick={voltarAAtual} data-testid="jaci-voltar-atual" className="font-semibold text-brand-primary hover:underline underline-offset-2">
                  {'Voltar à conversa atual'}
                </button>
              </div>
            )}

            {falhaDoHistorico && (
              <div data-testid="jaci-falha-historico" className="rounded-xl border border-red-500/40 bg-brand-surface px-3 py-2 text-ui-sm text-brand-text-secondary">
                {falhaDoHistorico}
              </div>
            )}

            {haMaisAntigos && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={carregarAnteriores}
                  disabled={carregando}
                  data-testid="jaci-carregar-anteriores"
                  className="rounded-full border border-border-light bg-brand-surface px-3 py-1 text-ui-sm text-brand-text-secondary hover:bg-brand-background disabled:opacity-40"
                >
                  {carregando ? 'Carregando…' : 'Carregar anteriores'}
                </button>
              </div>
            )}

            {turnos.length === 0 && !carregando && (
              <div className="flex items-start gap-2.5">
                <img src="/icons/jaci.svg" alt="" aria-hidden="true" className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5" />
                <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-brand-surface border border-border-light px-3.5 py-2.5 text-brand-text-primary shadow-sm">
                  {'Olá! Sou a Jaci. Pergunte como fazer algo no sistema — por exemplo, "como emito uma nota fiscal?". Respondo com a documentação e aponto onde ler mais.'}
                </div>
              </div>
            )}

            {turnos.map((pTurno) => (
              <div key={pTurno.id} data-testid="jaci-turno" className="space-y-3">
                {/* Balão da pessoa: à direita, cor da marca, cauda no canto superior direito. */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-primary text-white px-3.5 py-2.5 shadow-sm">
                    <p className="whitespace-pre-line break-words">{pTurno.pergunta}</p>
                    <div className="mt-1 text-right text-[10px] leading-none text-white/70">{pTurno.hora}</div>
                  </div>
                </div>

                {/* Balão da Jaci: à esquerda, com avatar. */}
                <div className="flex items-end gap-2.5">
                  <img src="/icons/jaci.svg" alt="" aria-hidden="true" className="h-7 w-7 rounded-full flex-shrink-0" />

                  {pTurno.erro && (
                    <div data-testid="jaci-falha" className="max-w-[85%] rounded-2xl rounded-bl-md bg-brand-surface border border-red-500/40 px-3.5 py-2.5 shadow-sm">
                      <div className="flex items-start gap-2">
                        <XCircle size={16} className="mt-0.5 flex-shrink-0 text-red-500" />
                        <div className="min-w-0">
                          <div className="font-semibold text-brand-text-primary">{'A Jaci não conseguiu responder'}</div>
                          <p className="mt-0.5 break-words text-brand-text-secondary">{pTurno.erro}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!pTurno.erro && !pTurno.resposta && (
                    <div className="rounded-2xl rounded-bl-md bg-brand-surface border border-border-light px-4 py-3 shadow-sm" aria-label={'A Jaci está lendo a documentação'}>
                      <span className="inline-flex items-center gap-1" aria-hidden="true">
                        <span className="h-2 w-2 rounded-full bg-brand-text-muted animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-2 w-2 rounded-full bg-brand-text-muted animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-2 w-2 rounded-full bg-brand-text-muted animate-bounce" />
                      </span>
                    </div>
                  )}

                  {pTurno.resposta && (
                    <div data-testid="jaci-resposta" className="max-w-[85%] rounded-2xl rounded-bl-md bg-brand-surface border border-border-light px-3.5 py-2.5 shadow-sm space-y-2">
                      <MessageText text={prepararMarkdown(pTurno.resposta.resposta)} className="text-brand-text-primary space-y-2 break-words" />

                      {pTurno.resposta.fontes.length > 0 && (
                        <div className="pt-2 border-t border-border-light">
                          <div className="text-ui-xs font-semibold text-brand-text-secondary mb-1">{'Onde ler mais'}</div>
                          <ul className="space-y-1">
                            {pTurno.resposta.fontes.map((pFonte) => (
                              <li key={pFonte.id}>
                                <a
                                  href={linkDaFonte(pFonte)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  data-testid="jaci-fonte"
                                  className="inline-flex items-start gap-1.5 text-ui-sm text-brand-primary hover:underline underline-offset-2"
                                  title="Abrir o trecho ao lado (o manual completo abre com Ctrl+clique)"
                                  onClick={(pEvento) => {
                                    // Clique simples: a janela de trecho. Ctrl/Cmd/botão do meio: o manual, como o link manda.
                                    if (pEvento.ctrlKey || pEvento.metaKey || pEvento.shiftKey)
                                      return;
                                    pEvento.preventDefault();
                                    setTrecho({ id: pFonte.id, titulo: pFonte.titulo });
                                  }}
                                >
                                  <ExternalLink size={13} className="mt-0.5 flex-shrink-0" />
                                  <span>
                                    {pFonte.titulo}
                                    {pFonte.tipo && <span className="text-brand-text-muted">{` · ${pFonte.tipo}`}</span>}
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 text-[10px] leading-none text-brand-text-muted">
                        <span className="inline-flex items-center gap-1" title={ROTULO_DA_FASE[pTurno.resposta.fase] ?? ''}>
                          <Moon size={10} />
                          {ROTULO_DA_FASE[pTurno.resposta.fase] ?? 'Jaci'}
                          {!pTurno.resposta.soubeResponder && <span>{'· sem fonte suficiente'}</span>}
                        </span>
                        <span>{pTurno.horaResposta}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={fimRef} />
          </div>

          {/* Entrada: pílula + botão redondo, como os aplicativos de mensagem. Em conversa arquivada, não se pergunta. */}
          <form onSubmit={(pEvento) => { void enviar(pEvento); }} className="px-3 py-3 border-t border-border-light bg-brand-surface flex items-end gap-2">
            <textarea
              value={pergunta}
              onChange={(pEvento) => setPergunta(pEvento.target.value)}
              onKeyDown={(pEvento) => {
                if (pEvento.key === 'Enter' && !pEvento.shiftKey) {
                  pEvento.preventDefault();
                  void enviar();
                }
              }}
              rows={1}
              maxLength={2000}
              disabled={somenteLeitura}
              placeholder={somenteLeitura ? 'Conversa anterior: volte à atual para perguntar' : 'Escreva sua pergunta…'}
              aria-label={'Pergunta'}
              data-testid="jaci-pergunta"
              className="flex-1 min-h-[44px] max-h-32 resize-none rounded-full border border-border-light bg-brand-background px-4 py-2.5 text-ui
                         text-brand-text-primary placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/40 scrollbar-thin
                         disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={enviando || somenteLeitura || pergunta.trim().length === 0}
              aria-label={'Enviar pergunta'}
              data-testid="jaci-enviar"
              className="h-11 w-11 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-primary text-white shadow-sm
                         disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-primary/90 active:scale-95 transition-all"
            >
              {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="-ml-0.5" />}
            </button>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
