/**
 * O registro do nível do AppX na rota das telas (dono, 2026-10-25): o marcador `{contexto}` dos endpoints do modelo vira
 * a chave do registro. Vale para o SubAppX e, dentro de um navegador, para a App de cada elemento.
 */

import { TOKEN_CONTEXTO, type XApplication } from '@core/types';

/** O modelo com o marcador `{contexto}` trocado pela chave do registro, em todo endpoint. Sem registro, o mesmo modelo. */
export function comContexto(pModelo: XApplication, pRegistro: string | null): XApplication {
  if (!pRegistro)
    return pModelo;
  const json = JSON.stringify(pModelo).split(TOKEN_CONTEXTO).join(encodeURIComponent(pRegistro));
  return JSON.parse(json) as XApplication;
}
