/**
 * Tipos do NAVEGADOR (`XViewTemplate.Navigator`) — espelho do contrato do back em `Tootega.Core/Model/Navigator/` (dono,
 * 2026-10-26). À esquerda, a lista do que se gerencia, em grupos; à direita, a App do elemento escolhido, dentro da área
 * do navegador. O modelo chega já podado: só os elementos cujas Apps o ator acessa.
 */

/** Um elemento da lista: escolhido, abre a App `applicationName` à direita. */
export interface XNavigatorItem {
  key: string;
  title: string;
  /** Ícone lucide em kebab-case ("folder-kanban"); o elemento é legível sem ele. */
  icon: string;
  applicationName: string;
  /**
   * O rótulo da inclusão pelo elemento (dono, 2026-10-26): preenchido, a linha ganha o botão "+" à direita, que abre o
   * formulário da App em inclusão, contido na área do navegador. É o nome acessível do botão. Vazio ⇒ sem botão.
   */
  createTitle?: string;
}

/** Um grupo de elementos; título vazio ⇒ grupo sem título (os elementos de topo). */
export interface XNavigatorGroup {
  title: string;
  items: XNavigatorItem[];
}

/** O navegador declarado na App. */
export interface XNavigatorView {
  groups: XNavigatorGroup[];
  /** Chave do elemento que abre sem escolha do usuário; vazio ⇒ o primeiro. */
  defaultItem: string;
}
