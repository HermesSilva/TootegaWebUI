/**
 * A base de rota de uma App, pronta para compor sub-rotas — e SEM o prefixo `/api`.
 *
 * Existe por um 404 de produção (2026-08-16): o `apiBaseURL` do modelo é DEFAULT nas fábricas do back
 * com o prefixo já embutido (`FabricaAppSYS` → `/api/sys`), enquanto o cliente HTTP também o
 * acrescenta (`api.ts`: `API_BASE_URL + endpoint`). Concatenar o valor cru produzia
 * `/api/api/sys/...` e um 404 sem explicação nenhuma.
 *
 * As Apps que já compunham sub-rotas contornavam isso sobrescrevendo o `APIBaseURL` sem o prefixo
 * (`/nfe/certificates`, `/crm/people`, `/sys`) — ou seja, funcionavam por disciplina de quem
 * escreveu cada App, e não por construção. Aqui o desconto do prefixo é feito num lugar só, para
 * que o default deixe de ser uma armadilha.
 *
 * Preferir SEMPRE o endpoint declarado no modelo (`saveEndpoint`, `loadEndpoint`, `dataEndpoint`)
 * quando ele existir: ele é a rota completa e é a fonte única (CE-19). Este auxiliar serve ao caso
 * em que a sub-rota é do MOTOR e não do modelo — as ações em lote (`/batch-activate`), o
 * `toggle-status`, o upload de certificado —, em que a App declara só a base.
 */

/** O prefixo que o cliente HTTP acrescenta a toda chamada (`api.ts`). */
const PREFIXO_DO_CLIENTE = '/api';

/**
 * Base de composição a partir do `apiBaseURL` do modelo, sem o `/api` e sem barra final.
 *
 * @param pAPIBaseURL  o `application.apiBaseURL` como veio do back (pode trazer `/api`).
 * @param pAlternativa base a usar quando a App não declarou `apiBaseURL` (tipicamente o
 *                     `dataEndpoint` sem o `/query`).
 */
export function baseDaApp(pAPIBaseURL?: string | null, pAlternativa = ''): string {
  const bruto = (pAPIBaseURL && pAPIBaseURL.trim()) || pAlternativa.trim();
  if (!bruto)
    return '';

  const semPrefixo = bruto === PREFIXO_DO_CLIENTE
    ? ''
    : bruto.startsWith(`${PREFIXO_DO_CLIENTE}/`)
      ? bruto.slice(PREFIXO_DO_CLIENTE.length)
      : bruto;

  return semPrefixo.replace(/\/+$/, '');
}
