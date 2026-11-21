/**
 * urlDoHub — o endereço de um hub de tempo real (SignalR) do back.
 *
 * Os hubs ficam na RAIZ do host da API (`/hub/mensagens`, `/hub/suporte`), não sob `/api`. Em desenvolvimento a API é
 * relativa (`/api`) e o Vite repassa `/hub` ao back: o caminho relativo serve. Publicado, a API mora em OUTRO host
 * (`VITE_API_URL=https://api.<domínio>/api`), e o caminho relativo ia ao nginx do próprio front, que respondia 405 ao
 * `negotiate` — o sino e o suporte remoto ficavam sem tempo real (apurado em homologação, 2026-11-20). Por isso o hub
 * se resolve contra a ORIGEM da API quando ela é absoluta.
 */

const BASE_DA_API: string = import.meta.env.VITE_API_URL || '/api';

/**
 * @param pCaminho    O caminho do hub na raiz do host da API (`/hub/mensagens`).
 * @param pBaseDaAPI  A base da API; o padrão é a do build (`VITE_API_URL`).
 */
export function urlDoHub(pCaminho: string, pBaseDaAPI: string = BASE_DA_API): string {
  return /^https?:\/\//i.test(pBaseDaAPI) ? new URL(pCaminho, pBaseDaAPI).toString() : pCaminho;
}
