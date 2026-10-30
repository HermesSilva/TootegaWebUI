/**
 * resolvedorDoAppX — a regra de navegação do AppX aplicada aos LINKS (dono, 2026-10-25; RX-1 do ADR-ANVIL-0006):
 * dentro de um AppX, um `[[app:Nome]]` só abre um SubAppX do próprio AppX; link para App do menu fica texto.
 *
 * O AppX se registra aqui pela aba da casca em que vive (e também se oferece como contexto React, `AppXContext`).
 * Quem resolve link olha primeiro se a mensagem nasceu dentro de um AppX: dentro da árvore, pelo contexto
 * (`useResolvedorLinkApp`); na casca, pela aba de origem da mensagem (`ErrorModal`, que vive fora da árvore do AppX
 * mas sabe de qual aba a mensagem veio).
 */

/** Resolve um link para dentro do AppX: a ação que abre o SubAppX, ou `null` (o nome fica texto). */
export type XResolvedorDoAppX = (
  pNomeApp: string,
  pRecorte?: Record<string, string>,
  pRegistroID?: string,
) => (() => void) | null;

const porAba = new Map<string, XResolvedorDoAppX>();

/** Registra o resolvedor do AppX da aba e devolve quem o retira (para o efeito de desmontagem). */
export function registrarResolvedorDoAppX(pAba: string, pResolvedor: XResolvedorDoAppX): () => void {
  porAba.set(pAba, pResolvedor);
  return () => {
    if (porAba.get(pAba) === pResolvedor)
      porAba.delete(pAba);
  };
}

/** O resolvedor do AppX que vive na aba, ou `undefined` quando a aba não é de AppX. */
export function resolvedorDoAppX(pAba: string | undefined | null): XResolvedorDoAppX | undefined {
  return pAba ? porAba.get(pAba) : undefined;
}
