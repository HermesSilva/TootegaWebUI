import { useState, useRef, useEffect, useContext, type JSX } from 'react';
import { X, LogOut, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { TabsContext, type AppTab } from '@core/contexts/TabsContext';
import { SidebarContext } from '@core/contexts/SidebarContext';

// ============================================================================
// Types
// ============================================================================

interface AppTabBarProps {
  tabs: AppTab[];
  activeTabId: string | null;
  onTabChange: (pTabId: string) => void;
  onTabClose: (pTabId: string) => void;
  /**
   * A barra desenhada DENTRO do cabeçalho, na área de trabalho expandida (dono, 2026-10-25) — quem a usa assim é o
   * `Header` do Core. Sem esta marca, a barra é a de sempre, logo abaixo do cabeçalho, e SOME sozinha quando o
   * usuário expande a área: a casca do SaaS continua desenhando `<AppTabBar>` como sempre, sem saber do modo.
   */
  noCabecalho?: boolean;
}

/** O título exibido: o que o conteúdo deu à aba (o nível do AppX), senão o da App. */
const tituloDaAba = (pAba: AppTab): string => pAba.tituloDoConteudo ?? pAba.title ?? '';

// ============================================================================
// Component
// ============================================================================

export function AppTabBar({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  noCabecalho = false,
}: AppTabBarProps): JSX.Element | null {
  // Sem provider (barra isolada, como nos testes), o modo fica desligado. No celular não há cabeçalho que caiba
  // as abas: o modo não se aplica.
  const abasNoCabecalho = !!useContext(TabsContext)?.abasNoCabecalho && !useContext(SidebarContext)?.isMobile;
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });

  // Check if scroll buttons are needed
  useEffect(() => {
    function checkScroll(): void {
      const container = containerRef.current;
      if (!container) return;

      const hasOverflow = container.scrollWidth > container.clientWidth;
      setShowScrollButtons(hasOverflow);
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    }

    checkScroll();

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }

    return () => {
      if (container)
        container.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [tabs]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node))
        setShowDropdown(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (showDropdown && dropdownButtonRef.current) {
      const rect = dropdownButtonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }, [showDropdown]);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (activeTabId)
      setTimeout(() => scrollToTab(activeTabId), 50);
  }, [activeTabId]);

  function scrollLeft(): void {
    const container = containerRef.current;
    if (container)
      container.scrollBy({ left: -150, behavior: 'smooth' });
  }

  function scrollRight(): void {
    const container = containerRef.current;
    if (container)
      container.scrollBy({ left: 150, behavior: 'smooth' });
  }

  function scrollToTab(pTabId: string): void {
    const container = containerRef.current;
    const tabElement = tabRefs.current.get(pTabId);
    
    if (container && tabElement) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = tabElement.getBoundingClientRect();
      
      if (tabRect.left < containerRect.left)
        container.scrollBy({ left: tabRect.left - containerRect.left - 16, behavior: 'smooth' });
      else if (tabRect.right > containerRect.right)
        container.scrollBy({ left: tabRect.right - containerRect.right + 16, behavior: 'smooth' });
    }
  }

  function handleDropdownSelect(pTabId: string): void {
    onTabChange(pTabId);
    setShowDropdown(false);
    // Small delay to let state update before scrolling
    setTimeout(() => scrollToTab(pTabId), 50);
  }

  // A barra de baixo sai quando as abas estão no cabeçalho; a do cabeçalho só existe nesse modo.
  if (tabs.length === 0 || abasNoCabecalho !== noCabecalho)
    return null;

  return (
    <div
      className={noCabecalho
        ? 'h-full min-w-0 flex items-end relative overflow-hidden'
        : 'min-h-[28px] sm:min-h-row flex items-center bg-brand-surface border-b border-border-light relative overflow-hidden'}
      data-tour="app-tabs"
    >
      {/* Tabs Container */}
      <div
        ref={containerRef}
        className="flex-1 h-full flex items-end overflow-x-auto scrollbar-hide"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;

          return (
            <div
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              className={`
                group flex items-center gap-1 px-3 sm:px-4 py-1 sm:py-2 mt-1 whitespace-nowrap text-ui-sm sm:text-ui font-medium
                rounded-t-lg cursor-pointer transition-all duration-150 flex-shrink-0
                min-h-[28px] sm:min-h-[36px]
                ${isActive
                  // No cabeçalho, a aba ativa tem a cor do CONTEÚDO e cobre a borda do cabeçalho: ela se abre sobre a
                  // área da App, como a aba de um navegador.
                  ? `text-brand-primary border border-b-0 border-border -mb-px z-10 ${noCabecalho ? 'bg-brand-background' : 'bg-brand-surface shadow-md'}`
                  : 'text-brand-text-secondary bg-muted-bg border border-b-0 border-border-light hover:bg-hover hover:text-brand-text-primary'
                }
              `}
              onClick={() => onTabChange(tab.id)}
            >
              {/* Título e complemento alinhados PELA BASE do texto (dono, 2026-10-25): com fontes de tamanhos
                  diferentes, centralizar deixava o complemento flutuando acima da linha do título. */}
              {/* Título e complemento inteiros, numa linha (dono, 2026-10-25): a aba tem a largura do texto, e o que não
                  cabe na barra rola — nunca reticências. */}
              <span className="flex items-baseline">
                <span>{tituloDaAba(tab)}</span>
                {/* O complemento (qual projeto, qual pedido): menor e esmaecido, para o título seguir mandando; o traço
                    os separa ("Empresa - Construtora Horizonte" — dono, 2026-10-26). */}
                {tab.subtitulo && (
                  <span className="hidden sm:inline ml-1.5 text-ui-xs font-normal text-brand-text-muted">
                    {`- ${tab.subtitulo}`}
                  </span>
                )}
              </span>

              {/* Close button — elegant icon + soft glow. Same close action as the button bar (closes the application tab).
                  Aba FIXA (o painel que abre sozinho ao entrar) não tem o botão: ela não se fecha. */}
              {!tab.fixa && <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                aria-label={`${'Fechar'} ${tituloDaAba(tab)}`}
                title={'Fechar'}
                className={`
                  group/close ml-1.5 hidden sm:flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full
                  text-brand-text-muted/70
                  transition-all duration-200 ease-out
                  hover:text-danger hover:bg-danger/10
                  hover:shadow-[0_0_12px_rgba(239,68,68,0.28)]
                  hover:ring-1 hover:ring-danger/25
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-danger/40
                  ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                `}
              >
                <LogOut size={12} strokeWidth={2} />
              </button>}
            </div>
          );
        })}
      </div>

      {/* Scroll Buttons (hidden on mobile) */}
      {showScrollButtons && (
        <div className="hidden md:flex items-center h-full border-l border-border-light">
          <button
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            className={`
              w-8 h-full flex items-center justify-center transition-colors duration-150
              ${canScrollLeft
                ? 'text-brand-text-secondary hover:bg-brand-background hover:text-brand-primary'
                : 'text-brand-text-muted/30 cursor-not-allowed'
              }
            `}
            aria-label={'Rolar para a esquerda'}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={scrollRight}
            disabled={!canScrollRight}
            className={`
              w-8 h-full flex items-center justify-center transition-colors duration-150
              ${canScrollRight
                ? 'text-brand-text-secondary hover:bg-brand-background hover:text-brand-primary'
                : 'text-brand-text-muted/30 cursor-not-allowed'
              }
            `}
            aria-label={'Rolar para a direita'}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Tabs Dropdown (visible on all screen sizes when there's overflow) */}
      {showScrollButtons && (
        <div className="relative border-l border-border-light flex-shrink-0" ref={dropdownRef}>
          <button
            ref={dropdownButtonRef}
            onClick={() => setShowDropdown(!showDropdown)}
            className={`
              min-w-touch min-h-touch h-full flex items-center justify-center transition-colors duration-150
              ${showDropdown
                ? 'bg-brand-background text-brand-primary'
                : 'text-brand-text-secondary hover:bg-brand-background hover:text-brand-primary'
              }
            `}
            aria-label={'Lista de abas'}
            aria-expanded={showDropdown}
            aria-haspopup="true"
          >
            <MoreHorizontal size={18} />
          </button>

          {showDropdown && (
            <div 
              className="fixed w-max min-w-56 bg-brand-surface rounded-lg shadow-lg border border-border-light py-1 z-50 max-h-[300px] overflow-y-auto scrollbar-thin"
              style={{ top: dropdownPosition.top, right: dropdownPosition.right }}
            >
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;

                return (
                  <button
                    key={tab.id}
                    onClick={() => handleDropdownSelect(tab.id)}
                    className={`
                      w-full min-h-row flex items-center justify-between px-3 text-ui text-left
                      transition-colors duration-150
                      ${isActive
                        ? 'bg-brand-background text-brand-primary font-medium'
                        : 'text-brand-text-secondary hover:bg-brand-background hover:text-brand-primary'
                      }
                    `}
                  >
                    <span className="whitespace-nowrap">
                      {tituloDaAba(tab)}
                      {tab.subtitulo && <span className="ml-1.5 text-ui-xs font-normal text-brand-text-muted">{`- ${tab.subtitulo}`}</span>}
                    </span>
                    {!tab.fixa && <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTabClose(tab.id);
                        if (tabs.length === 1)
                          setShowDropdown(false);
                      }}
                      className="min-w-touch min-h-touch flex items-center justify-center rounded text-brand-text-muted hover:text-danger hover:bg-danger-bg transition-colors"
                      aria-label={`${'Fechar'} ${tituloDaAba(tab)}`}
                    >
                      <X size={14} />
                    </button>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
