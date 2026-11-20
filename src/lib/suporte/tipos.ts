/**
 * Tipos do suporte remoto, como o back os envia (camelCase) pelo REST (`/sys/suporte/chamadas`) e pelo
 * hub (`/hub/suporte`).
 */

/** Nome do membro do enumerado `SYSxSituacaoChamadaSuporte`: é por ele que a tela decide o que mostrar. */
export type SituacaoDaChamada = 'Aguardando' | 'EmAtendimento' | 'Encerrada' | 'Cancelada' | 'Expirada' | 'Registrada';

export interface ChamadaDeSuporte {
  id: string;
  situacao: SituacaoDaChamada;
  situacaoTexto: string;
  /** Grupo de atendimento em cuja fila a chamada entrou. */
  grupo: string;
  assinante: string;
  usuario: string;
  email: string;
  /** O problema, nas palavras de quem chamou. */
  descricao: string;
  abertura: string;
  expiracao: string;
  /** O que falta da espera, calculado no servidor; zero quando a chamada não está mais aguardando. */
  segundosRestantes: number;
  atendente: string;
  /** Na fila ou em atendimento: tem sessão de tela possível. */
  emAberto: boolean;
  /** Registrada no quadro de avisos, esperando um atendente retornar. */
  noQuadro: boolean;
  /** Posição na fila do grupo, a partir de 1; zero quando não está aguardando. */
  posicao: number;
  /** Estimativa do servidor de quanto falta para ser atendida; zero = há atendente livre. */
  esperaEstimadaSegundos: number;
  /** Quanto durou o atendimento; zero enquanto não foi encerrado. */
  duracaoSegundos: number;
}

/** O que a tela de "Chamar suporte" pergunta antes de pedir qualquer coisa ao usuário. */
export interface DisponibilidadeDoSuporte {
  /** A conta do usuário está ligada a um grupo de atendimento. */
  disponivel: boolean;
  /** Por que não está disponível; vazio quando está. */
  motivo: string;
  /**
   * Há atendente do grupo logado agora. A chamada entra na fila nos dois casos; sem ninguém online, é mais
   * provável que o prazo vença e o chamado vá ao quadro, e a tela adianta isso ao usuário.
   */
  atendenteOnline: boolean;
  /** Horário de atendimento do grupo, um dia por linha. */
  horarios: string[];
  /** Prazo de espera na fila, em minutos (o do servidor). */
  minutosDeEspera: number;
  /** ID da extensão de suporte do SaaS (captura sem seletor); vazio quando não há extensão. */
  extensaoID?: string;
  /** Endereço da extensão na loja, para instalar; vazio quando não há onde instalar. */
  extensaoURL?: string;
}

/**
 * O que espera a equipe, nos grupos do atendente: os números do aviso no cabeçalho e a chamada que ele
 * assumiria agora, para o aviso de chamada recebida.
 */
export interface PendenciasDoSuporte {
  naFila: number;
  noQuadro: number;
  /** O atendente já está atendendo alguém: o aviso de chamada nova não o interrompe. */
  emAtendimento: boolean;
  /** A mais antiga da fila que não é do próprio atendente; `null` quando não há. */
  proxima: ChamadaDeSuporte | null;
}

/** Servidor STUN/TURN, no formato do back; a conversão para `RTCIceServer` é de `servidoresDoNavegador`. */
export interface ServidorICE {
  urls: string[];
  username: string;
  credential: string;
}

/** Tipos de recado da negociação que o hub repassa de uma ponta à outra. */
export type TipoDeRecado = 'oferta' | 'resposta' | 'candidato';

export const ROTA_DAS_CHAMADAS = '/sys/suporte/chamadas';
export const HUB_DE_SUPORTE = '/hub/suporte';

/** Nome da App de plataforma que atende as chamadas; é por ela que o cabeçalho sabe quem é atendente. */
export const APP_DE_ATENDIMENTO = 'SYSxAtendimentoSuporte';

/** Comando do botão "Atender a próxima" daquela App: é ele que o aviso de chamada recebida aperta. */
export const COMANDO_DE_ATENDER = 'supportAttend';

/**
 * Início da `referencia` do aviso do inbox que diz que o atendente retornou o chamado (`suporte:retorno:<chamada>`);
 * espelha `ServicoChamadaSuporte.REFERENCIA_DO_RETORNO` do back. É por ela que a tela de quem chamou reconhece o aviso
 * e abre o diálogo de atender, com toque.
 */
export const REFERENCIA_DO_RETORNO = 'suporte:retorno';

/** Onde a aba guarda a chamada em que ENTROU (sobrevive ao F5, não a uma aba nova): é o que a retomada sozinha retoma. */
export const CHAVE_DA_SESSAO_DE_SUPORTE = 'tootega.suporte.chamada';

/** Converte os servidores do back para o formato do navegador. STUN não leva usuário nem credencial. */
export function servidoresDoNavegador(pServidores: ServidorICE[]): RTCIceServer[] {
  return pServidores
    .filter((pServidor) => pServidor.urls.length > 0)
    .map((pServidor) => pServidor.username
      ? { urls: pServidor.urls, username: pServidor.username, credential: pServidor.credential }
      : { urls: pServidor.urls });
}

/** `mm:ss` do contador de espera. Negativo e fração viram zero e inteiro. */
export function formatarEspera(pSegundos: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(pSegundos) ? pSegundos : 0));
  const minutos = Math.floor(total / 60);
  const segundos = total % 60;

  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

/**
 * A espera estimada, em palavras. É estimativa do servidor, e a frase não promete mais do que ela sabe:
 * "em instantes" quando há atendente livre, "cerca de N min" nos demais casos, arredondando para cima.
 */
export function formatarEstimativa(pSegundos: number): string {
  const segundos = Number.isFinite(pSegundos) ? pSegundos : 0;

  if (segundos <= 0)
    return 'em instantes';

  const minutos = Math.ceil(segundos / 60);

  return minutos === 1 ? 'cerca de 1 minuto' : `cerca de ${minutos} minutos`;
}

/** Duração de um atendimento, em palavras: "42 s", "7 min", "1 h 05 min". */
export function formatarDuracao(pSegundos: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(pSegundos) ? pSegundos : 0));

  if (total < 60)
    return `${total} s`;

  const minutos = Math.round(total / 60);

  return minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}
