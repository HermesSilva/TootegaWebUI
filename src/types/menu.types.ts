export interface MenuItem {
  id: string;
  name: string;
  title: string;
  applicationID: string;
  /**
   * Item que existe SÓ no front do SaaS (tela de estudo/prévia, sem App no back): o menu não registra o acesso
   * dele no servidor, e a casca do SaaS decide o que a aba renderiza. O back nunca envia este campo.
   */
  local?: boolean;
}

export interface MenuGroup {
  id: string;
  name: string;
  title: string;
  icon: string;
  items: MenuItem[];
}

export interface UserMenu {
  groups: MenuGroup[];
}
