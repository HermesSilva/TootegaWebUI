import { useState, useEffect, useCallback, createContext, type ReactNode, type JSX } from 'react';
import { usePreferenciaDoUsuario } from '@core/hooks/usePreferenciaDoUsuario';

/**
 * Chave da preferência "menu recolhido" no perfil do usuário (dono, 2026-10-25): recolhido ou expandido, o menu
 * lateral volta como o usuário o deixou — em qualquer navegador, porque mora no perfil (`SYSxUsuarioPreferencia`).
 */
export const CHAVE_MENU_RECOLHIDO = 'casca.menuRecolhido';

// ============================================================================
// Types
// ============================================================================

export interface SidebarContextValue {
  isOpen: boolean;
  isCollapsed: boolean;
  isMobile: boolean;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
  close: () => void;
}

// ============================================================================
// Context
// ============================================================================

export const SidebarContext = createContext<SidebarContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface SidebarProviderProps {
  children: ReactNode;
  defaultCollapsed?: boolean;
}

export function SidebarProvider({
  children,
  defaultCollapsed = false,
}: SidebarProviderProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false); // Mobile drawer
  // Recolhido/expandido é PREFERÊNCIA DO USUÁRIO, gravada no perfil (dono, 2026-10-25). Vale para o desktop: no
  // celular o menu é gaveta (aberta/fechada) e nunca "recolhido" — o que se vê lá não regrava a preferência.
  const [recolhidoGravado, gravarRecolhido] = usePreferenciaDoUsuario<boolean>(CHAVE_MENU_RECOLHIDO, defaultCollapsed);
  const [isMobile, setIsMobile] = useState(false);
  const isCollapsed = !isMobile && recolhidoGravado;

  useEffect(() => {
    function handleResize(): void {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile)
        setIsOpen(false);
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Só grava quando muda: recolher ao abrir uma App (collapseOnItemOpen) com o menu já recolhido não vai ao servidor.
  const definirRecolhido = useCallback((pRecolhido: boolean) => {
    if (pRecolhido !== recolhidoGravado)
      gravarRecolhido(pRecolhido);
  }, [recolhidoGravado, gravarRecolhido]);

  const toggle = useCallback(() => {
    if (isMobile)
      setIsOpen((prev) => !prev);
    else
      definirRecolhido(!recolhidoGravado);
  }, [isMobile, recolhidoGravado, definirRecolhido]);

  const collapse = useCallback(() => definirRecolhido(true), [definirRecolhido]);
  const expand = useCallback(() => definirRecolhido(false), [definirRecolhido]);
  const close = useCallback(() => setIsOpen(false), []);

  const value: SidebarContextValue = {
    isOpen,
    isCollapsed,
    isMobile,
    toggle,
    collapse,
    expand,
    close,
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

