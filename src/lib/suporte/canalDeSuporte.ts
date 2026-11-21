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
