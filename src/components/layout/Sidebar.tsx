import { useState, useRef, useEffect, type JSX, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Clock, Menu as HamburgerIcon, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { MenuGroup, MenuItem } from '@core/types';
import { useSidebar, useTabs, menuKeys } from '@core/hooks';
import { api } from '@core/lib';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { MenuIcon, IconButton } from '@core/components/ui';
import type { AppTab } from '@core/contexts/TabsContext';

// ============================================================================
// Types
// ============================================================================

interface SidebarProps {
  groups: MenuGroup[];
  mruGroupName?: string;
  onItemClick: (pItem: MenuItem, pForceNew: boolean) => void;
  /**
   * No desktop, recolhe o menu (fica só a coluna de ícones) quando um item abre ou foca uma App — inclusive a
   * instância escolhida na lista de várias. Escolha de cada SaaS, na casca dele; padrão desligado (dono,
   * 2026-10-25). No celular a gaveta já fecha sempre.
   */
  collapseOnItemOpen?: boolean;
}

interface SidebarGroupProps {
  group: MenuGroup;
  isMru?: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onItemClick: (pItem: MenuItem, pForceNew: boolean) => void;
  isCollapsed: boolean;
  getInstanceCount: (pMenuItemID: string) => number;
  getTabsByMenuItemID: (pMenuItemID: string) => AppTab[];
  onSelectTab: (pTabId: string) => void;
}

interface FlyoutMenuProps {
  group: MenuGroup;
  isMru?: boolean;
  onItemClick: (pItem: MenuItem, pForceNew: boolean) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  getInstanceCount: (pMenuItemID: string) => number;
  getTabsByMenuItemID: (pMenuItemID: string) => AppTab[];
  onSelectTab: (pTabId: string) => void;
}

interface InstancePopupProps {
  instances: AppTab[];
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (pTabId: string) => void;
  onClose: () => void;
}

// ============================================================================
// Sidebar Toggle Button (for Header)
// ============================================================================

export function SidebarToggle(): JSX.Element {
  const { toggle, isCollapsed, isMobile } = useSidebar();

  return (
    <IconButton
      onClick={toggle}
      aria-label={isCollapsed || isMobile ? 'Abrir menu' : 'Fechar menu'}
    >
      <HamburgerIcon size={20} className="text-brand-text-secondary" />
    </IconButton>
  );
}

// ============================================================================
// Instance Popup (for selecting between multiple instances)
// ============================================================================

function InstancePopup({
  instances,
  anchorRef,
  onSelect,
  onClose,
}: InstancePopupProps): JSX.Element | null {
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [popupZIndex] = useState(() => ZIndexManager.next());

  // Calculate position after mount
  useEffect(() => {
    function updatePosition(): void {
      if (!anchorRef.current) return;

      const rect = anchorRef.current.getBoundingClientRect();
      // Anchor right edge + gap — width-agnostic, works collapsed or expanded
      // regardless of the --sidebar-width token value.
      setPosition({
        top: rect.top,
        left: rect.right + 8,
      });
    }

    // Use requestAnimationFrame to ensure DOM is painted
    const frameId = requestAnimationFrame(() => {
      updatePosition();
    });

    // Recalculate on scroll/resize
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent): void {
      if (
        popupRef.current && 
        !popupRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      )
        onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorRef, onClose]);

  // Don't render until position is calculated
  if (!position) return null;

  const popup = (
    <div
      ref={popupRef}
      className="fixed min-w-[200px] bg-brand-surface rounded-lg shadow-lg border border-border-light py-1 animate-in fade-in zoom-in-95 duration-150"
      style={{ top: position.top, left: position.left, zIndex: popupZIndex }}
    >
      <div className="px-3 py-2 border-b border-border-light">
        <span className="text-ui-xs text-brand-text-muted">{'Selecione a instância:'}</span>
      </div>
      {instances.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            onSelect(tab.id);
            onClose();
          }}
          className="w-full min-h-row flex items-center px-3 text-ui text-brand-text-secondary hover:bg-hover hover:text-brand-primary transition-colors duration-150"
        >
          <span className="truncate">{tab.title}</span>
        </button>
      ))}
    </div>
  );

  // Use portal to render outside the sidebar DOM hierarchy
  return createPortal(popup, document.body);
}

// ============================================================================
// Menu Item with Instance Counter
// ============================================================================

interface MenuItemButtonProps {
  item: MenuItem;
  onItemClick: (pItem: MenuItem, pForceNew: boolean) => void;
  instanceCount: number;
  instances: AppTab[];
  onSelectTab: (pTabId: string) => void;
  className?: string;
}

function MenuItemButton({
  item,
  onItemClick,
  instanceCount,
  instances,
  onSelectTab,
  className = '',
}: MenuItemButtonProps): JSX.Element {
  const [showPopup, setShowPopup] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();

  // Record MRU access for ANY activation path (open / select / popup). Without this,
  // the "Recentes" group never populates because the select-existing-tab branch
  // bypasses onItemClick. Fire-and-forget; always refresh the menu so the sidebar reorders,
  // even if the POST fails (so existing MRU items still render correctly).
  function recordAccess(): void {
    // Item local (só do front do SaaS): o servidor não o conhece, e não há acesso a registrar.
    if (item.local)
      return;
    void api.menu.incrementMRU(item.id)
      .catch(() => { /* POST failed — non-critical, continue to invalidate */ })
      // Invalida pelo PREFIXO (menuKeys.all), nao pela chave exata: a chave do menu leva a empresa
      // corrente desde 2026-08-28, e `user(id)` so atingiria a empresa de agora — o MRU vale para
      // todas as entradas ja em cache.
      .then(() => queryClient.invalidateQueries({ queryKey: menuKeys.all }));
  }

  function handleClick(e: MouseEvent<HTMLButtonElement>): void {
    const forceNew = e.ctrlKey || e.metaKey;
    recordAccess();

    if (forceNew) {
      // Ctrl+Click: always open new instance
      onItemClick(item, true);
    } else if (instanceCount === 0) {
      // No instances: open new
      onItemClick(item, false);
    } else if (instanceCount === 1) {
      // One instance: select it
      onSelectTab(instances[0].id);
    } else {
      // Multiple instances: show popup
      setShowPopup(true);
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleClick}
        className={className}
        // Pelo NOME da App, não pelo título: o título vem do back (CE-19) e é o rótulo exibido; o
        // nome é o identificador declarado. É por aqui que o e2e abre uma App — não há rota por URL.
        data-testid={`menu-item-${item.name}`}
      >
        <span className="truncate flex-1 text-left">{item.title}</span>
        {instanceCount > 0 && (
          <span className="text-[10px] text-brand-primary font-semibold ml-1 -mt-1 min-w-[14px]">
            {instanceCount}
          </span>
        )}
      </button>

      {showPopup && (
        <InstancePopup
          instances={instances}
          anchorRef={buttonRef}
          onSelect={onSelectTab}
          onClose={() => setShowPopup(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// Flyout Menu (for collapsed state hover)
// ============================================================================

function FlyoutMenu({
  group,
  isMru,
  onItemClick,
  anchorRef,
  onClose,
  getInstanceCount,
  getTabsByMenuItemID,
  onSelectTab,
}: FlyoutMenuProps): JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [flyoutZIndex] = useState(() => ZIndexManager.next());

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.right - 4,
      });
    }
  }, [anchorRef]);

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent): void {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      )
        onClose();
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [anchorRef, onClose]);

  // Por portal, como o InstancePopup: dentro do <aside> (fixed, z-30) o z-index do flyout ficava preso ao contexto
  // de empilhamento do menu, e o formulário aberto na área do App (z do ZIndexManager) o cobria.
  return createPortal(
    <div
      ref={menuRef}
      className="fixed min-w-[200px] max-w-[280px] bg-brand-surface rounded-lg shadow-lg border border-border-light"
      style={{ top: position.top, left: position.left, zIndex: flyoutZIndex }}
    >
      {/* Flyout Header */}
      <div className="h-row flex items-center gap-2 px-3 border-b border-border-light">
        {isMru ? (
          <Clock size={16} className="text-brand-primary flex-shrink-0" />
        ) : (
          <MenuIcon name={group.icon} size={16} className="text-brand-primary flex-shrink-0" />
        )}
        <span className="text-ui font-medium text-brand-text-primary truncate">
          {group.title}
        </span>
      </div>

      {/* Flyout Items */}
      <div className="py-1 max-h-[300px] overflow-y-auto scrollbar-thin">
        {group.items.map((item) => {
          const count = getInstanceCount(item.id);
          const instances = getTabsByMenuItemID(item.id);

          return (
            <MenuItemButton
              key={item.id}
              item={item}
              onItemClick={(pItem, pForceNew) => {
                onItemClick(pItem, pForceNew);
                onClose();
              }}
              instanceCount={count}
              instances={instances}
              onSelectTab={(pTabId) => {
                onSelectTab(pTabId);
                onClose();
              }}
              className="w-full min-h-row flex items-center px-3 text-ui text-brand-text-secondary hover:bg-hover hover:text-brand-primary transition-colors duration-150"
            />
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

// ============================================================================
// Sidebar Group (Accordion)
// ============================================================================

function SidebarGroup({
  group,
  isMru,
  isExpanded,
  onToggle,
  onItemClick,
  isCollapsed,
  getInstanceCount,
  getTabsByMenuItemID,
  onSelectTab,
}: SidebarGroupProps): JSX.Element {
  const [showFlyout, setShowFlyout] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMouseEnter(): void {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setShowFlyout(true);
  }

  function handleMouseLeave(): void {
    closeTimeoutRef.current = setTimeout(() => {
      setShowFlyout(false);
    }, 150);
  }

  // Collapsed mode: show flyout on hover
  if (isCollapsed)
    return (
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          ref={buttonRef}
          className="w-full h-row flex items-center justify-center text-brand-text-secondary hover:text-brand-primary hover:bg-hover transition-colors duration-150"
          aria-label={group.title}
        >
          {isMru ? (
            <Clock size={20} className="text-brand-primary" />
          ) : (
            <MenuIcon name={group.icon} size={20} />
          )}
        </button>

        {showFlyout && (
          <FlyoutMenu
            group={group}
            isMru={isMru}
            onItemClick={onItemClick}
            anchorRef={buttonRef}
            onClose={() => setShowFlyout(false)}
            getInstanceCount={getInstanceCount}
            getTabsByMenuItemID={getTabsByMenuItemID}
            onSelectTab={onSelectTab}
          />
        )}
      </div>
    );

  // Expanded mode: accordion
  return (
    <div className="border-b border-border-light last:border-b-0">
      {/* Group Header */}
      <button
        onClick={onToggle}
        // Pelo NOME do grupo: o acordeão recolhido deixa os itens no DOM mas com `max-h-0`, logo
        // invisíveis e não clicáveis — o e2e precisa abrir o grupo antes de achar a App.
        data-testid={`menu-group-${group.name}`}
        className="w-full h-row flex items-center gap-2 px-3 text-ui font-medium text-brand-text-primary hover:bg-hover transition-colors duration-150"
      >
        {isMru ? (
          <Clock size={18} className="text-brand-primary flex-shrink-0" />
        ) : (
          <MenuIcon name={group.icon} size={18} className="text-brand-primary flex-shrink-0" />
        )}
        <span className="flex-1 text-left truncate">{group.title}</span>
        <ChevronDown
          size={16}
          className={`text-brand-text-muted transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Group Items */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {group.items.map((item) => {
          const count = getInstanceCount(item.id);
          const instances = getTabsByMenuItemID(item.id);

          return (
            <MenuItemButton
              key={item.id}
              item={item}
              onItemClick={onItemClick}
              instanceCount={count}
              instances={instances}
              onSelectTab={onSelectTab}
              className="w-full h-row flex items-center pl-9 pr-3 text-ui text-brand-text-secondary hover:bg-hover hover:text-brand-primary transition-colors duration-150"
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Main Sidebar Component
// ============================================================================

export function Sidebar({
  groups,
  mruGroupName = 'mru',
  onItemClick,
  collapseOnItemOpen = false,
}: SidebarProps): JSX.Element {
  const { isOpen, isCollapsed, isMobile, close, toggle, collapse } = useSidebar();
  const { getInstanceCount, getTabsByMenuItemID, setActiveTab } = useTabs();
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Separate MRU group from other groups
  const mruGroup = groups.find((g) => g.name === mruGroupName);
  const otherGroups = groups.filter((g) => g.name !== mruGroupName);

  // Auto-expand MRU by default
  useEffect(() => {
    if (mruGroup && !expandedGroupId)
      setExpandedGroupId(mruGroup.id);
  }, [mruGroup, expandedGroupId]);

  function handleGroupToggle(pGroupId: string): void {
    setExpandedGroupId((prev) => (prev === pGroupId ? null : pGroupId));
  }

  // Depois de abrir ou focar uma App: no celular a gaveta fecha; no desktop o menu recolhe, se o SaaS pediu.
  function afterItemOpen(): void {
    if (isMobile)
      close();
    else if (collapseOnItemOpen)
      collapse();
  }

  function handleItemClick(pItem: MenuItem, pForceNew: boolean): void {
    onItemClick(pItem, pForceNew);
    afterItemOpen();
  }

  function handleSelectTab(pTabId: string): void {
    setActiveTab(pTabId);
    afterItemOpen();
  }

  // Mobile Drawer
  if (isMobile)
    return (
      <>
        {/* Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
            onClick={close}
          />
        )}

        {/* Drawer */}
        <aside
          className={`
            fixed top-0 left-0 h-full w-[85vw] max-w-[320px] bg-brand-surface z-50
            shadow-xl transition-transform duration-300 ease-out
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          {/* Drawer Header */}
          <div className="h-header flex items-center justify-between px-3 sm:px-4 border-b border-border-light">
            <span className="text-ui font-semibold text-brand-text-primary">{'Menu'}</span>
            <IconButton onClick={close} aria-label={'Fechar menu'}>
              <X size={22} className="text-brand-text-secondary" />
            </IconButton>
          </div>

          {/* Drawer Content */}
          <nav className="h-[calc(100%-var(--header-height))] overflow-y-auto scrollbar-thin">
            {/* MRU Group (Fixed at top) */}
            {mruGroup && mruGroup.items.length > 0 && (
              <SidebarGroup
                group={mruGroup}
                isMru
                isExpanded={expandedGroupId === mruGroup.id}
                onToggle={() => handleGroupToggle(mruGroup.id)}
                onItemClick={handleItemClick}
                isCollapsed={false}
                getInstanceCount={getInstanceCount}
                getTabsByMenuItemID={getTabsByMenuItemID}
                onSelectTab={handleSelectTab}
              />
            )}

            {/* Other Groups */}
            {otherGroups.map((group) => (
              <SidebarGroup
                key={group.id}
                group={group}
                isExpanded={expandedGroupId === group.id}
                onToggle={() => handleGroupToggle(group.id)}
                onItemClick={handleItemClick}
                isCollapsed={false}
                getInstanceCount={getInstanceCount}
                getTabsByMenuItemID={getTabsByMenuItemID}
                onSelectTab={handleSelectTab}
              />
            ))}
          </nav>
        </aside>
      </>
    );

  // Desktop Sidebar
  return (
    <aside
      className={`
        fixed top-header left-0 h-[calc(100vh-var(--header-height))] bg-brand-surface
        border-r border-border-light z-30 transition-all duration-300 ease-out
        ${isCollapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'}
      `}
      data-tour="app-sidebar"
    >
      {/* Sidebar Header */}
      <div
        className={`
          h-row flex items-center border-b border-border-light
          ${isCollapsed ? 'justify-center px-2' : 'px-2'}
        `}
      >
        <IconButton
          onClick={toggle}
          className="flex-shrink-0"
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
          data-tour="sidebar-toggle"
        >
          <HamburgerIcon size={20} className="text-brand-text-secondary" />
        </IconButton>
        {!isCollapsed && (
          <span className="text-ui font-semibold text-brand-text-primary ml-2">
            {'Navegação'}
          </span>
        )}
      </div>

      {/* Sidebar Content */}
      <nav 
        className="h-[calc(100%-var(--row-height))] overflow-y-auto scrollbar-thin"
        data-tour="sidebar-groups"
      >
        {/* MRU Group (Fixed at top) */}
        {mruGroup && mruGroup.items.length > 0 && (
          <SidebarGroup
            group={mruGroup}
            isMru
            isExpanded={expandedGroupId === mruGroup.id}
            onToggle={() => handleGroupToggle(mruGroup.id)}
            onItemClick={handleItemClick}
            isCollapsed={isCollapsed}
            getInstanceCount={getInstanceCount}
            getTabsByMenuItemID={getTabsByMenuItemID}
            onSelectTab={handleSelectTab}
          />
        )}

        {/* Other Groups */}
        {otherGroups.map((group) => (
          <SidebarGroup
            key={group.id}
            group={group}
            isExpanded={expandedGroupId === group.id}
            onToggle={() => handleGroupToggle(group.id)}
            onItemClick={handleItemClick}
            isCollapsed={isCollapsed}
            getInstanceCount={getInstanceCount}
            getTabsByMenuItemID={getTabsByMenuItemID}
            onSelectTab={handleSelectTab}
          />
        ))}
      </nav>
    </aside>
  );
}
