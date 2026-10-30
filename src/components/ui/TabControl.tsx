import { useRef, useEffect, type JSX, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  title: string;
  content: ReactNode;
}

interface TabControlProps {
  tabs: TabItem[];
  activeTabId: string;
  onTabChange: (pId: string) => void;
  keepAlive?: boolean;
}

export function TabControl({
  tabs,
  activeTabId,
  onTabChange,
  keepAlive = true,
}: TabControlProps): JSX.Element {
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      const container = tabsRef.current;
      const activeTab = activeTabRef.current;
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();

      if (tabRect.left < containerRect.left)
        container.scrollLeft -= containerRect.left - tabRect.left + 16;
      else if (tabRect.right > containerRect.right)
        container.scrollLeft += tabRect.right - containerRect.right + 16;
    }
  }, [activeTabId]);

  return (
    <div className="flex flex-col w-full">
      {/* Tab Bar */}
      <div
        ref={tabsRef}
        className="h-row min-h-row flex items-end bg-brand-surface border-b border-border-light overflow-x-auto scrollbar-thin"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`
                h-full px-4 flex items-center whitespace-nowrap text-ui font-medium
                transition-colors duration-150 border-b-2 -mb-px
                ${isActive
                  ? 'text-brand-primary border-brand-primary'
                  : 'text-brand-text-muted border-transparent hover:text-brand-text-secondary hover:border-border'
                }
              `}
            >
              {tab.title}
            </button>
          );
        })}
      </div>

      {/* Tab Panels. `data-app-area`: é a ÁREA DA APLICAÇÃO (à direita do menu, abaixo das abas). TODO
          diálogo de mensagem — aviso, validação, erro e falha do sistema — se restringe a ela e nunca
          cobre a página (dono, 2026-08-08). `relative` ancora o `absolute inset-0` desse diálogo.
          A casca em uso marca a área no `App/src/routes/__root.tsx`; este componente não está montado. */}
      <div className="flex-1 relative" data-app-area>
        {keepAlive
          ? tabs.map((tab) => (
              <div
                key={tab.id}
                id={`tabpanel-${tab.id}`}
                role="tabpanel"
                aria-labelledby={`tab-${tab.id}`}
                className={tab.id === activeTabId ? 'block' : 'hidden'}
              >
                {tab.content}
              </div>
            ))
          : tabs
              .filter((tab) => tab.id === activeTabId)
              .map((tab) => (
                <div
                  key={tab.id}
                  id={`tabpanel-${tab.id}`}
                  role="tabpanel"
                  aria-labelledby={`tab-${tab.id}`}
                >
                  {tab.content}
                </div>
              ))}
      </div>
    </div>
  );
}
