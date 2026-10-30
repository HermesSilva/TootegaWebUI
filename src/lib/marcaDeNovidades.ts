/**
 * A marca "as novidades da versão já foram mostradas neste login" (dono, 2026-10-25). Vive no sessionStorage, por
 * usuário; quem a grava é o `XNovidadesDoLogin`, depois de o servidor responder, e quem a apaga é o fim da sessão
 * (`AuthContext.clearTokens`: logout ou sessão invalidada) — o próximo login é outro login e mostra de novo.
 *
 * Mora na lib, e não no componente, porque o componente só existe com o usuário logado: no logout ele já foi
 * desmontado, e uma limpeza escrita nele nunca rodaria.
 */

const PREFIXO = 'novidades:mostradas';

/** A chave da marca de um usuário. */
export function chaveDasNovidadesMostradas(pUsuarioID: string): string {
  return `${PREFIXO}:${pUsuarioID}`;
}

/** Apaga a marca de qualquer usuário desta aba. */
export function esquecerNovidadesMostradas(): void {
  try {
    for (const chave of Object.keys(sessionStorage))
      if (chave.startsWith(PREFIXO))
        sessionStorage.removeItem(chave);
  } catch {
    // Navegador sem sessionStorage: não há marca a apagar.
  }
}
