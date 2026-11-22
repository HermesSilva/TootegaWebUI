/**
 * canalDeSuporte — a conexão com o hub do suporte remoto (`/hub/suporte`), por onde passam os recados da
 * negociação WebRTC e os avisos de mudança da chamada e da fila.
 *
 * O que o hub manda:
 *   - `ChamadaMudou(chamada)`      a chamada mudou de situação (atendida, encerrada, expirada…);
 *   - `ParticipanteEntrou(id)`     a outra ponta entrou na chamada — sinal para iniciar a negociação;
 *   - `ParticipanteSaiu(id)`       a outra ponta saiu (aba fechada, rede caída);
 *   - `Recado(id, tipo, dados)`    oferta, resposta ou candidato vindo da outra ponta;
 *   - `FilaMudou()`                (só para a equipe da plataforma) a fila de chamadas mudou.
 */

import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';
import { getAccessToken } from '@core/lib/api';
import { urlDoHub } from '@core/lib/urlDoHub';

import { HUB_DE_SUPORTE, type TipoDeRecado } from './tipos';

/** Cria a conexão, ainda parada. O token vai pelo `accessTokenFactory`, como no hub de mensagens. */
export function criarCanalDeSuporte(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(urlDoHub(HUB_DE_SUPORTE), { accessTokenFactory: () => getAccessToken() ?? '' })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}

/** Entra na chamada. `false` quando ela não está em aberto ou o usuário não participa dela. */
export function entrarNaChamada(pCanal: HubConnection, pChamadaID: string): Promise<boolean> {
  return pCanal.invoke<boolean>('EntrarNaChamada', pChamadaID);
}

/** Nome do erro lançado quando o canal não conecta: é por ele que as telas separam esta falha das demais. */
const NOME_DA_FALHA_DO_CANAL = 'FalhaDoCanalDeSuporte';

/**
 * O texto de uma falha de conexão com o hub de suporte: diz O QUE não conectou e POR QUÊ (o motivo que o cliente do
 * hub deu), para a tela mostrar. Sem o canal não há fila em tempo real, presença do atendente nem negociação da tela.
 */
export function descreverFalhaDoCanal(pErro: unknown): string {
  const motivo = pErro instanceof Error && pErro.message.trim() ? pErro.message.trim() : String(pErro ?? '').trim();

  return `O canal de tempo real do suporte (${urlDoHub(HUB_DE_SUPORTE)}) não conectou`
    + (motivo ? `: ${motivo.replace(/[.\s]+$/, '')}.` : ', e o navegador não informou o motivo.');
}

/** A falha é a do canal de suporte (lançada por `ligarCanal`), e não a de uma chamada à API? */
export function ehFalhaDoCanal(pErro: unknown): pErro is Error {
  return pErro instanceof Error && pErro.name === NOME_DA_FALHA_DO_CANAL;
}

/**
 * Conecta o canal e entra na chamada. Falhou ⇒ lança um erro reconhecível por `ehFalhaDoCanal`, com o texto de
 * `descreverFalhaDoCanal`: quem chamou decide o que fazer da chamada e mostra o motivo — esta falha nunca passa calada
 * (em homologação, 2026-11-21, o proxy recusou o `negotiate` e a tela só voltava ao mesmo lugar).
 */
export async function ligarCanal(pCanal: HubConnection, pChamadaID: string): Promise<void> {
  try {
    await pCanal.start();
    await entrarNaChamada(pCanal, pChamadaID);
  } catch (pErro) {
    const falha = new Error(descreverFalhaDoCanal(pErro));

    falha.name = NOME_DA_FALHA_DO_CANAL;

    throw falha;
  }
}

/** Manda um recado da negociação à outra ponta. Falha de envio não interrompe: a ligação acusa por si. */
export function sinalizar(pCanal: HubConnection, pChamadaID: string, pTipo: TipoDeRecado, pDados: string): void {
  if (pCanal.state === HubConnectionState.Connected)
    void pCanal.send('Sinalizar', pChamadaID, pTipo, pDados).catch(() => { /* a ligação de mídia acusa a falta */ });
}

/** Sai da chamada e encerra a conexão com o hub. Seguro chamar mais de uma vez. */
export async function encerrarCanal(pCanal: HubConnection | null, pChamadaID?: string | null): Promise<void> {
  if (!pCanal)
    return;

  try {
    if (pChamadaID && pCanal.state === HubConnectionState.Connected)
      await pCanal.send('SairDaChamada', pChamadaID);
  } catch {
    // A outra ponta fica sabendo pela queda da conexão, logo abaixo.
  }

  if (pCanal.state !== HubConnectionState.Disconnected)
    await pCanal.stop().catch(() => { /* já estava caindo */ });
}
