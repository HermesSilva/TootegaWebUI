/**
 * conexaoDeMidia — a ligação WebRTC de uma chamada de suporte: tela e áudio de quem chamou, áudio do
 * atendente, e um canal de dados por onde passam os gestos do controle remoto.
 *
 * A mídia vai de um navegador ao outro; o servidor só repassa os recados da negociação (oferta, resposta
 * e candidatos de rede), que saem daqui por `enviarRecado` e entram por `receberRecado`.
 *
 * <b>Quem oferta é quem chamou</b>, porque é ele quem tem a tela a enviar; o atendente responde. A oferta
 * leva sempre uma faixa de áudio — com o microfone de quem chamou, ou só de recepção, se ele não o
 * liberou —, para que a voz do atendente tenha por onde chegar.
 *
 * <b>A câmera tem faixa própria, reservada na oferta, nos dois sentidos.</b> A oferta leva DUAS faixas de
 * vídeo, nesta ordem: a tela e a câmera. A ordem das faixas na negociação é a ordem em que foram criadas,
 * e o atendente reconhece a câmera por ela: é a segunda faixa de vídeo. Como a faixa existe desde o
 * início, ligar e desligar a câmera só troca o que vai nela (`replaceTrack`), sem refazer a ligação; e
 * quem liga ou desliga avisa a outra ponta pelo canal de dados (`{"t":"camera","ligada":…}`), porque
 * faixa sem imagem não se distingue, do outro lado, de faixa com a imagem parada.
 *
 * <b>A tela também para sem derrubar a ligação</b> (dono, 2026-11-19): quem chamou para de compartilhar pela
 * janela de controle (ou pela barra do navegador) e volta a compartilhar quando quiser; a faixa da tela fica
 * vazia nesse meio-tempo, a voz continua, e a outra ponta é avisada (`{"t":"tela","ligada":…}`).
 */

import type { SuperficieCompartilhada } from './controleRemoto';
import type { TipoDeRecado } from './tipos';

export interface OpcoesDaConexaoDeMidia {
  servidores: RTCIceServer[];
  /** Manda um recado da negociação à outra ponta (pelo hub). */
  enviarRecado: (pTipo: TipoDeRecado, pDados: string) => void;
  /** A mídia da outra ponta chegou (ou ganhou mais uma faixa). */
  aoReceberMidia: (pMidia: MediaStream) => void;
  /** O estado da ligação mudou: `connecting`, `connected`, `disconnected`, `failed`, `closed`. */
  aoMudarEstado: (pEstado: RTCPeerConnectionState) => void;
  /** Chegou uma mensagem pelo canal de dados (gesto do atendente, ou aviso de quem chamou). */
  aoReceberDados?: (pTexto: string) => void;
  /** A faixa da câmera da outra ponta chegou. Só há imagem quando ela avisa que a ligou. */
  aoReceberCamera?: (pMidia: MediaStream) => void;
  /** A outra ponta ligou ou desligou a câmera. */
  aoMudarCameraRemota?: (pLigada: boolean) => void;
  /** A outra ponta parou ou voltou a compartilhar a tela. */
  aoMudarTelaRemota?: (pLigada: boolean) => void;
}

/** O aviso de mídia que passa pelo canal de dados (câmera ou tela). Não é gesto: nunca chega a `aoReceberDados`. */
export type AvisoDeMidia = { t: 'camera' | 'tela'; ligada: boolean };

/** Lê um aviso de câmera ou de tela. `null` para qualquer outra coisa (inclusive os gestos). */
export function lerAvisoDeMidia(pTexto: string): AvisoDeMidia | null {
  try {
    const bruto = JSON.parse(pTexto) as Record<string, unknown> | null;

    return bruto && (bruto.t === 'camera' || bruto.t === 'tela') && typeof bruto.ligada === 'boolean'
      ? { t: bruto.t, ligada: bruto.ligada }
      : null;
  } catch {
    return null;
  }
}

/** Nome do canal de dados do controle remoto. */
const CANAL_DE_CONTROLE = 'controle';

export class ConexaoDeMidia {
  private readonly _Conexao: RTCPeerConnection;
  private readonly _Opcoes: OpcoesDaConexaoDeMidia;
  private readonly _Remota = new MediaStream();
  private readonly _CameraRemota = new MediaStream();
  private readonly _CandidatosEmEspera: RTCIceCandidateInit[] = [];
  private _Canal: RTCDataChannel | null = null;
  private _Fechada = false;
  /** A faixa da câmera desta ponta; `null` = câmera desligada. Vale também antes de a faixa ser negociada. */
  private _FaixaDaCamera: MediaStreamTrack | null = null;
  private _TransceptorDaCamera: RTCRtpTransceiver | null = null;

  constructor(pOpcoes: OpcoesDaConexaoDeMidia) {
    this._Opcoes = pOpcoes;
    this._Conexao = new RTCPeerConnection({ iceServers: pOpcoes.servidores });

    this._Conexao.onicecandidate = (pEvento) => {
      if (pEvento.candidate)
        pOpcoes.enviarRecado('candidato', JSON.stringify(pEvento.candidate.toJSON()));
    };

    this._Conexao.ontrack = (pEvento) => {
      const camera = this._LocalizarCamera();

      if (camera && pEvento.transceiver === camera) {
        this._CameraRemota.addTrack(pEvento.track);
        pOpcoes.aoReceberCamera?.(this._CameraRemota);
        return;
      }

      this._Remota.addTrack(pEvento.track);
      pOpcoes.aoReceberMidia(this._Remota);
    };

    this._Conexao.onconnectionstatechange = () => pOpcoes.aoMudarEstado(this._Conexao.connectionState);

    // Do lado do atendente o canal chega pronto, criado por quem ofertou.
    this._Conexao.ondatachannel = (pEvento) => this._AdotarCanal(pEvento.channel);
  }

  /** Acrescenta as faixas de uma mídia local (a tela, o microfone) ao que será enviado. */
  adicionarMidia(pMidia: MediaStream): void {
    for (const faixa of pMidia.getTracks())
      this._Conexao.addTrack(faixa, pMidia);
  }

  /** Quem chamou: cria o canal de controle e manda a oferta. */
  async ofertar(): Promise<void> {
    this._AdotarCanal(this._Conexao.createDataChannel(CANAL_DE_CONTROLE, { ordered: true }));

    // Sem microfone local não haveria faixa de áudio na oferta, e a voz do atendente não teria como vir.
    if (!this._Conexao.getSenders().some((pEmissor) => pEmissor.track?.kind === 'audio'))
      this._Conexao.addTransceiver('audio', { direction: 'recvonly' });

    // A faixa da câmera nasce depois da tela, nos dois sentidos, ligada ou não: é a segunda de vídeo.
    this._TransceptorDaCamera = this._Conexao.addTransceiver(this._FaixaDaCamera ?? 'video', { direction: 'sendrecv' });

    const oferta = await this._Conexao.createOffer();

    await this._Conexao.setLocalDescription(oferta);
    this._Opcoes.enviarRecado('oferta', JSON.stringify({ type: oferta.type, sdp: oferta.sdp }));
  }

  /**
   * Trata um recado vindo da outra ponta.
   *
   * @param pMidiaDaResposta Só para quem RESPONDE (o atendente): o microfone dele, acrescentado depois de
   *                         lida a oferta — é a ordem em que o navegador reaproveita a faixa de áudio que
   *                         a oferta já trouxe, em vez de criar outra.
   */
  async receberRecado(pTipo: TipoDeRecado, pDados: string, pMidiaDaResposta?: MediaStream | null): Promise<void> {
    if (this._Fechada)
      return;

    if (pTipo === 'candidato') {
      const candidato = JSON.parse(pDados) as RTCIceCandidateInit;

      // Candidato que chega antes da descrição remota não tem a que se aplicar: espera por ela.
      if (this._Conexao.remoteDescription)
        await this._Conexao.addIceCandidate(candidato);
      else
        this._CandidatosEmEspera.push(candidato);

      return;
    }

    await this._Conexao.setRemoteDescription(JSON.parse(pDados) as RTCSessionDescriptionInit);

    for (const candidato of this._CandidatosEmEspera.splice(0))
      await this._Conexao.addIceCandidate(candidato);

    if (pTipo !== 'oferta')
      return;

    if (pMidiaDaResposta)
      this.adicionarMidia(pMidiaDaResposta);

    // A faixa de câmera que a oferta reservou passa a enviar também: a câmera daqui pode ligar depois sem
    // nova negociação.
    const camera = this._LocalizarCamera();

    if (camera) {
      camera.direction = 'sendrecv';
      await camera.sender.replaceTrack(this._FaixaDaCamera);
    }

    const resposta = await this._Conexao.createAnswer();

    await this._Conexao.setLocalDescription(resposta);
    this._Opcoes.enviarRecado('resposta', JSON.stringify({ type: resposta.type, sdp: resposta.sdp }));
  }

  /** Manda uma mensagem pelo canal de controle. Devolve `false` quando o canal ainda não abriu. */
  enviarDados(pTexto: string): boolean {
    if (this._Canal?.readyState !== 'open')
      return false;

    this._Canal.send(pTexto);

    return true;
  }

  /**
   * Quem chamou para (`null`) ou volta a compartilhar (`pFaixa`) a tela, sem refazer a ligação: troca a faixa
   * da tela (a PRIMEIRA de vídeo) e avisa a outra ponta. Antes da oferta não há faixa a trocar: a tela entra
   * por `adicionarMidia`.
   */
  async definirTela(pFaixa: MediaStreamTrack | null): Promise<void> {
    if (this._Fechada)
      return;

    const tela = this._Conexao.getTransceivers().filter((pTransceptor) => pTransceptor.receiver.track?.kind === 'video')[0];

    if (tela)
      await tela.sender.replaceTrack(pFaixa);

    const aviso: AvisoDeMidia = { t: 'tela', ligada: pFaixa !== null };

    this.enviarDados(JSON.stringify(aviso));
  }

  /**
   * Liga (`pFaixa`) ou desliga (`null`) a câmera desta ponta e avisa a outra. Pode ser chamada antes da
   * negociação: a faixa entra na oferta ou na resposta.
   */
  async definirCamera(pFaixa: MediaStreamTrack | null): Promise<void> {
    if (this._Fechada)
      return;

    this._FaixaDaCamera = pFaixa;

    const camera = this._LocalizarCamera();

    if (camera)
      await camera.sender.replaceTrack(pFaixa);

    this._AvisarCamera();
  }

  fechar(): void {
    if (this._Fechada)
      return;

    this._Fechada = true;
    this._Canal?.close();
    this._Conexao.onicecandidate = null;
    this._Conexao.ontrack = null;
    this._Conexao.onconnectionstatechange = null;
    this._Conexao.ondatachannel = null;
    this._Conexao.close();
  }

  private _AdotarCanal(pCanal: RTCDataChannel): void {
    this._Canal = pCanal;
    pCanal.onmessage = (pEvento) => {
      if (typeof pEvento.data !== 'string')
        return;

      const aviso = lerAvisoDeMidia(pEvento.data);

      if (aviso?.t === 'camera')
        this._Opcoes.aoMudarCameraRemota?.(aviso.ligada);
      else if (aviso?.t === 'tela')
        this._Opcoes.aoMudarTelaRemota?.(aviso.ligada);
      else
        this._Opcoes.aoReceberDados?.(pEvento.data);
    };

    // Câmera ligada antes de o canal abrir: o aviso sai assim que ele abre. Do lado do atendente o canal
    // pode chegar já aberto.
    pCanal.onopen = () => this._AvisarCamera();
    if (pCanal.readyState === 'open')
      this._AvisarCamera();
  }

  /** Conta à outra ponta se a câmera está ligada. Com o canal ainda fechado, o aviso sai quando ele abrir. */
  private _AvisarCamera(): void {
    const aviso: AvisoDeMidia = { t: 'camera', ligada: this._FaixaDaCamera !== null };

    this.enviarDados(JSON.stringify(aviso));
  }

  /**
   * A faixa da câmera: a que esta ponta criou na oferta ou, do lado de quem responde, a SEGUNDA faixa de
   * vídeo da negociação (a primeira é a tela). `null` enquanto a negociação não a trouxe.
   */
  private _LocalizarCamera(): RTCRtpTransceiver | null {
    if (this._TransceptorDaCamera)
      return this._TransceptorDaCamera;

    const videos = this._Conexao.getTransceivers().filter((pTransceptor) => pTransceptor.receiver.track?.kind === 'video');

    return videos[1] ?? null;
  }
}

/** O navegador consegue compartilhar a tela? No celular, e em navegador antigo, não. */
export function navegadorCompartilhaTela(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

/**
 * Pede a tela a quem chamou, sugerindo a JANELA do navegador (dono, 2026-11-19). O navegador mostra o seletor
 * dele, e é o usuário quem escolhe.
 *
 * <b>Por que a janela, e não a aba.</b> Na captura de ABA o Chrome põe, no alto da própria aba, a barra
 * "compartilhando esta aba / parar", que a página não esconde. Na captura de JANELA (como o Meet sugere) essa
 * barra não aparece; o aviso do navegador é um quadro pequeno, fora da página, que o usuário pode ocultar.
 * Por isso a aba corrente nem é oferecida (`selfBrowserSurface: 'exclude'`), e o seletor abre na lista de
 * janelas (`displaySurface: 'window'`). O controle remoto desconta da imagem a moldura do navegador
 * (`pontoNaPagina`).
 *
 * `selfBrowserSurface`, `surfaceSwitching` e `monitorTypeSurfaces` ainda não estão todos nos tipos do
 * TypeScript; navegador que não os conhece simplesmente os ignora.
 */
export function pedirTela(): Promise<MediaStream> {
  const opcoes = {
    video: { displaySurface: 'window', frameRate: { ideal: 15, max: 24 } },
    audio: false,
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'exclude',
    monitorTypeSurfaces: 'include',
  } as DisplayMediaStreamOptions;

  return navigator.mediaDevices.getDisplayMedia(opcoes);
}

/**
 * O que foi compartilhado: a aba (`browser`), uma janela (`window`) ou a tela inteira (`monitor`). `undefined`
 * quando o navegador não informa, e então vale a aba.
 */
export function superficieCompartilhada(pTela: MediaStream): SuperficieCompartilhada | undefined {
  const ajustes = pTela.getVideoTracks()[0]?.getSettings() as (MediaTrackSettings & { displaySurface?: string }) | undefined;
  const superficie = ajustes?.displaySurface;

  return superficie === 'browser' || superficie === 'window' || superficie === 'monitor' ? superficie : undefined;
}

/** Pede o microfone. `null` quando o usuário não o libera ou não há microfone: a chamada segue sem ele. */
export async function pedirMicrofone(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  } catch {
    return null;
  }
}

/** Pede a câmera. Falha com o erro do navegador, que `motivoDaFalhaDaCamera` põe em palavras. */
export function pedirCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 24 } },
    audio: false,
  });
}

/** Por que a câmera não ligou, em palavras para quem clicou: cada causa diz o que fazer. */
export function motivoDaFalhaDaCamera(pErro: unknown): string {
  const nome = typeof pErro === 'object' && pErro !== null && 'name' in pErro ? String((pErro as { name: unknown }).name) : '';

  switch (nome) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'A câmera não ligou porque o navegador não deu permissão. Libere a câmera para este site no cadeado '
        + 'da barra de endereço e clique de novo.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'A câmera não ligou porque o navegador não encontrou câmera neste computador. Conecte uma e clique de novo.';
    case 'NotReadableError':
    case 'AbortError':
      return 'A câmera não ligou porque está em uso por outro programa (outra chamada de vídeo, por exemplo). '
        + 'Feche-o e clique de novo.';
    default:
      return 'A câmera não ligou: o navegador recusou o pedido' + (nome ? ' (' + nome + ')' : '') + '. Confira se há '
        + 'câmera conectada e liberada para este site, e clique de novo.';
  }
}

export function pararMidia(pMidia: MediaStream | null | undefined): void {
  pMidia?.getTracks().forEach((pFaixa) => pFaixa.stop());
}
