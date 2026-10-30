import { useState, useCallback, createContext, type ReactNode, type JSX } from 'react';
import type { MenuItem, UserMenu } from '@core/types';
import { safeRandomUUID } from '@core/lib/uuid';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';

/** Chave da preferência "abas no cabeçalho" no perfil do usuário. */
export const CHAVE_ABAS_NO_CABECALHO = 'casca.abasNoCabecalho';

// ============================================================================
// Types
// ============================================================================

export interface AppTab {
  id: string;
  menuItem: MenuItem;
  title: string;
  instanceNumber: number;
  /**
   * Recorte com que a App ABRE, chaveado pelo nome do CAMPO (não do editor). Serve a quem chega de
   * fora apontando para algo específico: um alerta de log que leva ao evento que o disparou. Sem
   * ele, o link entrega a tela e deixa o usuário caçar a linha no meio de milhares — que é a mesma
   * falha de não dizer aonde ir.
   */
  filtroInicial?: Record<string, string>;
  /**
   * Registro que a App ABRE em visualização, pela chave. É o passo seguinte ao recorte: o filtro
   * entrega a lista das ocorrências, este aponta a linha de que a mensagem fala — e o operador cai
   * nela sem procurar. Vazio ⇒ a App abre como abriria pelo menu.
   */
  registroInicial?: string;
  /**
   * Complemento discreto do título: QUAL coisa a aba mostra (o projeto, o pedido), quando o título diz só o tipo
   * da tela. Quem o define é o conteúdo da aba, por `definirSubtitulo`; a barra o desenha menor e esmaecido.
   */
  subtitulo?: string;
  /**
   * O título que o CONTEÚDO dá à aba, no lugar do da App: o AppX diz em que nível está ("Empresa", "Projeto",
   * "Repositório" — dono, 2026-10-26). Quem o define é o conteúdo, por `definirTitulo`; vazio ⇒ vale o do menu.
   */
  tituloDoConteudo?: string;
  /**
   * Aba FIXA: não se fecha (sem botão de fechar, e `closeTab` a ignora) e fica à esquerda das demais. É a do painel
   * que abre sozinho quando o usuário entra (dono, 2026-10-25): sem entrada no menu, fechá-la seria perdê-la.
   */
  fixa?: boolean;
}

/** Opções de abertura de uma aba. */
export interface OpcoesDeAba {
  /** A aba nasce fixa (ver `AppTab.fixa`). */
  fixa?: boolean;
  /** Abre sem tomar a frente de uma aba já ativa (padrão: a aba nova fica ativa). */
  emSegundoPlano?: boolean;
}

export interface TabsContextValue {
  tabs: AppTab[];
  activeTabId: string | null;
  openTab: (
    pMenuItem: MenuItem,
    pFiltroInicial?: Record<string, string>,
    pRegistroInicial?: string,
    pOpcoes?: OpcoesDeAba
  ) => void;
  closeTab: (pTabId: string) => void;
  setActiveTab: (pTabId: string) => void;
  getTabsByMenuItemID: (pMenuItemID: string) => AppTab[];
  getInstanceCount: (pMenuItemID: string) => number;
  updateTabTitlesFromMenu: (pMenu: UserMenu) => void;
  /** Define (ou limpa, com vazio) o complemento discreto do título da aba. */
  definirSubtitulo: (pTabId: string, pSubtitulo?: string) => void;
  /** Define (ou limpa, com vazio) o título que o conteúdo dá à aba, no lugar do da App. */
  definirTitulo: (pTabId: string, pTitulo?: string) => void;
  /**
   * Área de trabalho EXPANDIDA (dono, 2026-10-25): as abas sobem para o cabeçalho, entre a empresa e a Jaci, e o
   * nome do produto sai do cabeçalho — uma linha a menos sobre o conteúdo. Preferência do usuário, lembrada no
   * perfil. Quem desenha as abas no lugar certo é o Core (`Header` e `AppTabBar`); a casca do SaaS não muda.
   */
  abasNoCabecalho: boolean;
  definirAbasNoCabecalho: (pNoCabecalho: boolean) => void;
}

// ============================================================================
// Context
// ============================================================================

export const TabsContext = createContext<TabsContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface TabsProviderProps {
  children: ReactNode;
}

export function TabsProvider({ children }: TabsProviderProps): JSX.Element {
  const [tabs, setTabs] = useState<AppTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [abasNoCabecalho, definirAbasNoCabecalho] = usePreferenciaDoUsuario<boolean>(CHAVE_ABAS_NO_CABECALHO, false);

  // Update tab titles when menu is refetched (language change)
  const updateTabTitlesFromMenu = useCallback((pMenu: UserMenu) => {
    if (!pMenu?.groups) return;
    
    // Build a map of menuItemID -> title from the new menu
    const titleMap = new Map<string, string>();
    for (const group of pMenu.groups) {
      for (const item of group.items) {
        titleMap.set(item.id, item.title);
      }
    }

    // Update tabs with new titles
    setTabs(prev => prev.map(tab => {
      const newTitle = titleMap.get(tab.menuItem.id);
      if (!newTitle) return tab;
      
      const baseTitle = tab.instanceNumber > 1 
        ? `${newTitle} (${tab.instanceNumber})` 
        : newTitle;
      
      // Also update menuItem.title for consistency
      return {
        ...tab,
        title: baseTitle,
        menuItem: { ...tab.menuItem, title: newTitle }
      };
    }));
  }, []);

  const getTabsByMenuItemID = useCallback((pMenuItemID: string): AppTab[] => {
    return tabs.filter((t) => t.menuItem.id === pMenuItemID);
  }, [tabs]);

  const getInstanceCount = useCallback((pMenuItemID: string): number => {
    return tabs.filter((t) => t.menuItem.id === pMenuItemID).length;
  }, [tabs]);

  const openTab = useCallback((
    pMenuItem: MenuItem,
    pFiltroInicial?: Record<string, string>,
    pRegistroInicial?: string,
    pOpcoes?: OpcoesDeAba
  ) => {
    // Calculate instance number based on menuItem.id
    const existingTabs = tabs.filter((t) => t.menuItem.id === pMenuItem.id);
    const instanceNumber = existingTabs.length + 1;

    const newTab: AppTab = {
      id: safeRandomUUID(),
      menuItem: pMenuItem,
      title: instanceNumber > 1 ? `${pMenuItem.title} (${instanceNumber})` : pMenuItem.title,
      instanceNumber,
      filtroInicial: pFiltroInicial,
      registroInicial: pRegistroInicial,
      fixa: pOpcoes?.fixa || undefined,
    };

    // A aba fixa entra depois das outras fixas e antes das comuns: as fixas ficam sempre à esquerda.
    setTabs((prev) => {
      if (!newTab.fixa)
        return [...prev, newTab];
      const fixas = prev.filter((t) => t.fixa).length;
      return [...prev.slice(0, fixas), newTab, ...prev.slice(fixas)];
    });
    if (pOpcoes?.emSegundoPlano)
      setActiveTabId((pAtual) => pAtual ?? newTab.id);
    else
      setActiveTabId(newTab.id);
    // MRU recording is handled by Sidebar (covers all activation paths)
    // and invalidates the menu query cache after recording.
  }, [tabs]);

  const closeTab = useCallback((pTabId: string) => {
    setTabs((prev) => {
      // Aba fixa não se fecha (o botão nem aparece; isto cobre quem chamar por código).
      if (prev.some((t) => t.id === pTabId && t.fixa))
        return prev;
      const newTabs = prev.filter((t) => t.id !== pTabId);
      
      // If closing active tab, switch to another
      if (activeTabId === pTabId && newTabs.length > 0) {
        const closedIndex = prev.findIndex((t) => t.id === pTabId);
        const newActiveIndex = Math.min(closedIndex, newTabs.length - 1);
        setActiveTabId(newTabs[newActiveIndex].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }

      return newTabs;
    });
  }, [activeTabId]);

  const setActiveTab = useCallback((pTabId: string) => {
    setActiveTabId(pTabId);
  }, []);

  const definirSubtitulo = useCallback((pTabId: string, pSubtitulo?: string) => {
    const subtitulo = pSubtitulo?.trim() || undefined;
    setTabs((prev) => prev.some((t) => t.id === pTabId && t.subtitulo !== subtitulo)
      ? prev.map((t) => (t.id === pTabId ? { ...t, subtitulo } : t))
      : prev);
  }, []);

  const definirTitulo = useCallback((pTabId: string, pTitulo?: string) => {
    const tituloDoConteudo = pTitulo?.trim() || undefined;
    setTabs((prev) => prev.some((t) => t.id === pTabId && t.tituloDoConteudo !== tituloDoConteudo)
      ? prev.map((t) => (t.id === pTabId ? { ...t, tituloDoConteudo } : t))
      : prev);
  }, []);

  const value: TabsContextValue = {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    setActiveTab,
    getTabsByMenuItemID,
    getInstanceCount,
    updateTabTitlesFromMenu,
    definirSubtitulo,
    definirTitulo,
    abasNoCabecalho,
    definirAbasNoCabecalho,
  };

  return (
    <TabsContext.Provider value={value}>
      {children}
    </TabsContext.Provider>
  );
}
