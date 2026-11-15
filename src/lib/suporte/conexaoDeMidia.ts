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
 */

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
}

/** Nome do canal de dados do controle remoto. */
const CANAL_DE_CONTROLE = 'controle';

export class ConexaoDeMidia {
  private readonly _Conexao: RTCPeerConnection;
  private readonly _Opcoes: OpcoesDaConexaoDeMidia;
  private readonly _Remota = new MediaStream();
  private readonly _CandidatosEmEspera: RTCIceCandidateInit[] = [];
  private _Canal: RTCDataChannel | null = null;
  private _Fechada = false;

  constructor(pOpcoes: OpcoesDaConexaoDeMidia) {
    this._Opcoes = pOpcoes;
    this._Conexao = new RTCPeerConnection({ iceServers: pOpcoes.servidores });

    this._Conexao.onicecandidate = (pEvento) => {
      if (pEvento.candidate)
        pOpcoes.enviarRecado('candidato', JSON.stringify(pEvento.candidate.toJSON()));
    };

    this._Conexao.ontrack = (pEvento) => {
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
      if (typeof pEvento.data === 'string')
        this._Opcoes.aoReceberDados?.(pEvento.data);
    };
  }
}

/** O navegador consegue compartilhar a tela? No celular, e em navegador antigo, não. */
export function navegadorCompartilhaTela(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

/**
 * Pede a tela a quem chamou. O navegador mostra o seletor dele, e é o usuário quem escolhe o que
 * compartilhar; o que se pode fazer daqui é SUGERIR a aba corrente, que é a única em que o controle
 * remoto tem efeito.
 */
export function pedirTela(): Promise<MediaStream> {
  // `preferCurrentTab` e `selfBrowserSurface` ainda não estão nos tipos do TypeScript; navegador que não
  // os conhece simplesmente os ignora.
  const opcoes = {
    video: { frameRate: { ideal: 15, max: 24 } },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: 'include',
  } as DisplayMediaStreamOptions;

  return navigator.mediaDevices.getDisplayMedia(opcoes);
}

/** O que foi compartilhado é uma aba do navegador (e não uma janela ou a tela inteira)? */
export function compartilhouUmaAba(pTela: MediaStream): boolean {
  const ajustes = pTela.getVideoTracks()[0]?.getSettings() as (MediaTrackSettings & { displaySurface?: string }) | undefined;

  // Navegador que não informa a superfície não dá motivo para alarme.
  return !ajustes?.displaySurface || ajustes.displaySurface === 'browser';
}

/** Pede o microfone. `null` quando o usuário não o libera ou não há microfone: a chamada segue sem ele. */
export async function pedirMicrofone(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  } catch {
    return null;
  }
}

export function pararMidia(pMidia: MediaStream | null | undefined): void {
  pMidia?.getTracks().forEach((pFaixa) => pFaixa.stop());
}
