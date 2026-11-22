/**
 * capturaPorExtensao — a captura da aba pela EXTENSÃO de suporte do SaaS (dono, 2026-11-19): sem o seletor do
 * navegador e sem a barra "Compartilhando esta aba", que a captura comum (`getDisplayMedia`) não evita.
 *
 * A extensão só captura a aba depois que o usuário a aciona pela interface dela (clique no ícone ou atalho): é a
 * regra do navegador, e vale por aba até ela navegar. Por isso a captura pode parar no meio, esperando esse gesto:
 * a extensão responde `liberar`, quem chama mostra ao usuário o que fazer, e o clique dele já entrega a captura.
 *
 * O protocolo com a extensão está no README dela (TootegaCore/Extensoes/Suporte): `versao` para saber se está
 * instalada; porta com `pedirCaptura` → `captura` | `liberar` | `recusa`; e `parou` / `desistiu`.
 */

/** O pedaço da API de extensões que a página enxerga quando alguma extensão aceita falar com ela. */
interface PortaDaExtensao {
  postMessage: (pMensagem: unknown) => void;
  disconnect: () => void;
  onMessage: { addListener: (pOuvinte: (pMensagem: MensagemDaExtensao) => void) => void };
  onDisconnect: { addListener: (pOuvinte: () => void) => void };
}

interface RuntimeDaExtensao {
  sendMessage: (pID: string, pMensagem: unknown, pResposta: (pResposta?: RespostaDaVersao) => void) => void;
  connect: (pID: string) => PortaDaExtensao;
  lastError?: { message?: string };
}

interface RespostaDaVersao {
  versao?: string;
  atalho?: string;
  fixado?: boolean;
  item?: string;
}

type MensagemDaExtensao =
  | { tipo: 'pronto'; versao: string }
  | { tipo: 'captura'; streamId: string }
  | { tipo: 'liberar' }
  | { tipo: 'recusa'; motivo: string };

/** O que a página sabe da extensão instalada. */
export interface ExtensaoDeSuporte {
  versao: string;
  /** O atalho de teclado que aciona a extensão (vazio quando o usuário o tirou). */
  atalho: string;
  /** O usuário fixou o ícone da extensão na barra (o Chrome o esconde no menu do quebra-cabeça ao instalar). */
  fixado: boolean;
  /** O texto do item que a extensão põe no menu do botão direito, nas páginas do sistema. */
  item: string;
}

/** Maior resolução pedida à captura: a aba sai na resolução física da tela (já se viu 4096 × 2160). */
export const LIMITE_DA_CAPTURA = { largura: 1920, altura: 1080, quadrosPorSegundo: 15 } as const;

/** Mínimo de largura e altura pedido à captura: quadrado, para a proporção diferir da do limite (ver `pedir`). */
export const MINIMO_DA_CAPTURA = 2;

function runtime(): RuntimeDaExtensao | null {
  const cromo = (globalThis as { chrome?: { runtime?: RuntimeDaExtensao } }).chrome;

  return typeof cromo?.runtime?.sendMessage === 'function' && typeof cromo.runtime.connect === 'function' ? cromo.runtime : null;
}

/**
 * O navegador aceita a extensão de suporte (Chrome, Edge e os demais baseados no Chromium, no computador)? É o que
 * decide se faz sentido oferecer a instalação. Não se lê de `chrome.runtime`: desde o Chrome 106 ele só existe na
 * página quando alguma extensão conectável a ela já está instalada — antes de instalar, nunca existe.
 */
export function navegadorAceitaExtensoes(pNavegador: Navigator | undefined = globalThis.navigator): boolean {
  if (!pNavegador)
    return false;

  const dados = (pNavegador as Navigator & { userAgentData?: { brands?: Array<{ brand: string }>; mobile?: boolean } }).userAgentData;

  if (dados?.brands?.length)
    return !dados.mobile && dados.brands.some((pMarca) => pMarca.brand === 'Chromium');

  const agente = pNavegador.userAgent ?? '';

  return /(Chrome|Chromium|Edg)\//.test(agente) && !/Mobile|Android|Firefox|FxiOS|CriOS/.test(agente);
}

/**
 * A extensão está instalada (e aceita falar com esta página)? `null` quando não está, quando o navegador não tem
 * extensões (Firefox, celular) ou quando ela não responde a tempo.
 */
export function verificarExtensao(pID: string, pEsperaMs = 1500): Promise<ExtensaoDeSuporte | null> {
  const api = runtime();

  if (!pID || !api)
    return Promise.resolve(null);

  return new Promise((pResolver) => {
    const prazo = setTimeout(() => pResolver(null), pEsperaMs);

    try {
      api.sendMessage(pID, { tipo: 'versao' }, (pResposta) => {
        clearTimeout(prazo);
        // Lido para o navegador não acusar "erro não verificado" quando a extensão não existe.
        void api.lastError;
        pResolver(pResposta?.versao
          ? { versao: pResposta.versao, atalho: pResposta.atalho ?? '', fixado: pResposta.fixado === true, item: pResposta.item ?? '' }
          : null);
      });
    } catch {
      clearTimeout(prazo);
      pResolver(null);
    }
  });
}

/**
 * O que dizer ao usuário para liberar a aba (dono, 2026-11-19): primeiro o menu do botão direito e o atalho, que
 * funcionam com o ícone escondido; o ícone por último, e com a dica de fixá-lo só para quem ainda não o fixou.
 */
export function textoDeLiberacao(pExtensao: ExtensaoDeSuporte): string {
  const item = pExtensao.item || 'Mostrar esta aba ao suporte';
  const atalho = pExtensao.atalho ? `, ou aperte ${pExtensao.atalho}` : '';
  const icone = pExtensao.fixado
    ? ' Também vale clicar no ícone do suporte, à direita da barra de endereço.'
    : ' O ícone do suporte fica no menu do quebra-cabeça, à direita da barra de endereço; fixe-o com o alfinete para '
      + 'tê-lo sempre à vista.';

  return `Para mostrar esta aba ao atendente, clique com o botão direito em qualquer lugar da página e escolha `
    + `"${item}"${atalho}.${icone} É só uma vez nesta aba.`;
}

export interface OpcoesDaCapturaPorExtensao {
  /** A aba ainda não foi liberada: a extensão acendeu o ícone e espera o clique (ou o atalho) do usuário. */
  aoPrecisarLiberar: () => void;
}

/** Erro de captura que já diz ao usuário o que aconteceu. */
export class FalhaDaCaptura extends Error {}

export class CapturaPorExtensao {
  private readonly _ID: string;
  private readonly _Opcoes: OpcoesDaCapturaPorExtensao;
  private _Porta: PortaDaExtensao | null = null;
  private _Pendente: { resolver: (pID: string) => void; rejeitar: (pErro: Error) => void } | null = null;

  constructor(pID: string, pOpcoes: OpcoesDaCapturaPorExtensao) {
    this._ID = pID;
    this._Opcoes = pOpcoes;
  }

  /** Pede a captura da aba. Pode esperar o gesto de liberação do usuário; resolve com o vídeo da aba. */
  async pedir(): Promise<MediaStream> {
    const streamId = await new Promise<string>((pResolver, pRejeitar) => {
      this._Pendente?.rejeitar(new FalhaDaCaptura('Um pedido de captura mais novo tomou o lugar deste.'));
      this._Pendente = { resolver: pResolver, rejeitar: pRejeitar };
      this._Conectar().postMessage({ tipo: 'pedirCaptura' });
    });

    // O mínimo de 2 × 2 não é tamanho, é a POLÍTICA de resolução: na captura da aba, o Chrome usa a resolução fixa (o
    // quadro sempre no tamanho máximo, com a página encaixada nele com tarjas pretas) a menos que mínimo e máximo, ambos
    // acima de 1, tenham proporções diferentes, quando passa a "qualquer uma dentro do limite" e o quadro segue a
    // proporção da página (SelectResolutionPolicyFromCandidates, media_stream_constraints_util_video_content.cc). Sem
    // isso, o atendente via a página encolhida dentro de tarjas, longe de ocupar a área dele.
    const restricoes = {
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId,
          minWidth: MINIMO_DA_CAPTURA,
          minHeight: MINIMO_DA_CAPTURA,
          maxWidth: LIMITE_DA_CAPTURA.largura,
          maxHeight: LIMITE_DA_CAPTURA.altura,
          maxFrameRate: LIMITE_DA_CAPTURA.quadrosPorSegundo,
        },
      },
    } as unknown as MediaStreamConstraints;

    return navigator.mediaDevices.getUserMedia(restricoes);
  }

  /** O usuário desistiu de esperar a liberação: a extensão apaga o ícone, e o pedido em curso é recusado. */
  desistir(): void {
    this._Pendente?.rejeitar(new FalhaDaCaptura('O compartilhamento foi cancelado antes de a aba ser liberada.'));
    this._Pendente = null;
    this._Porta?.postMessage({ tipo: 'desistiu' });
  }

  /** A captura parou (pelo painel ou pelo navegador): a extensão apaga o selo do ícone. */
  avisarParou(): void {
    this._Porta?.postMessage({ tipo: 'parou' });
  }

  fechar(): void {
    this._Pendente = null;
    const porta = this._Porta;
    this._Porta = null;
    porta?.disconnect();
  }

  private _Conectar(): PortaDaExtensao {
    if (this._Porta)
      return this._Porta;

    const api = runtime();
    if (!api)
      throw new FalhaDaCaptura('Este navegador não aceita a extensão de suporte. Use "Compartilhar sem a extensão".');

    const porta = api.connect(this._ID);

    porta.onMessage.addListener((pMensagem) => {
      if (pMensagem.tipo === 'liberar') {
        this._Opcoes.aoPrecisarLiberar();
        return;
      }

      const pendente = this._Pendente;
      if (!pendente || (pMensagem.tipo !== 'captura' && pMensagem.tipo !== 'recusa'))
        return;

      this._Pendente = null;

      if (pMensagem.tipo === 'captura')
        pendente.resolver(pMensagem.streamId);
      else
        pendente.rejeitar(new FalhaDaCaptura(`A extensão de suporte não conseguiu capturar esta aba: ${pMensagem.motivo}`));
    });

    porta.onDisconnect.addListener(() => {
      if (this._Porta !== porta)
        return;

      this._Porta = null;
      this._Pendente?.rejeitar(new FalhaDaCaptura(
        'A conexão com a extensão de suporte caiu (ela foi desativada, atualizada ou removida). Clique de novo em compartilhar.'));
      this._Pendente = null;
    });

    this._Porta = porta;

    return porta;
  }
}
