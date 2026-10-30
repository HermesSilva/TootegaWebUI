/**
 * XFilter - Painel de Filtros
 * 
 * Renderiza editores de filtro em layout configurável (Horizontal, Vertical, Grid).
 * Suporta busca automática com debounce e busca manual com botões.
 */

import { useState, useEffect, useCallback, useMemo, type CSSProperties, type JSX, useRef } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  XFilter as XFilterType,
  XFilterLayout,
} from '@core/types';
import { XEditor } from './editors/XEditor';

// ============================================================================
// Types
// ============================================================================

interface XFilterProps {
  filter: XFilterType;
  /**
   * Valores digitados, chaveados pelo NOME DO EDITOR — não pelo campo. Um mesmo campo aparece em
   * mais de um editor sempre que a App pede um intervalo ("de" e "até" sobre a mesma data), e
   * chavear por campo fazia o segundo sobrescrever o primeiro: a tela mostrava os dois, e só um
   * chegava à consulta.
   */
  values: Record<string, unknown>;
  onChange: (pEditorName: string, pValue: unknown) => void;
  onSearch: () => void;
  /** Optional slot rendered after the search button (e.g. context help, close button). */
  rightSlot?: JSX.Element;
  /** Ref callback for the portal target rendered before the search button. */
  actionPortalRef?: (node: HTMLDivElement | null) => void;
  /**
   * Embedded mode: renders only the filter editors as an inline fragment,
   * with no outer wrapper div, no background, no border, and no action buttons.
   * The parent is responsible for layout, search/clear buttons, and close button.
   */
  embedded?: boolean;
  /**
   * Force the panel always expanded and hide the collapse toggle/header,
   * regardless of the app's `filter.isCollapsible`/`isCollapsed`. Used by the
   * mobile search dropdown so EVERY app renders the identical panel (the panel
   * is Core-defined; apps only supply the filter fields).
   */
  forceExpanded?: boolean;
}

// ============================================================================
// Layout Styles
// ============================================================================

const LAYOUT_STYLES: Record<XFilterLayout, (pColumnsCount: number) => string> = {
  1: () => 'flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 sm:gap-4',  // Horizontal
  2: () => 'flex flex-col gap-3',                                                               // Vertical
  3: (cols) => `grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(cols, 6)}`, // Grid
};

// Largura máxima de UM editor no leiaute horizontal: é o `max-w-xs` (20rem) da classe do wrapper.
const LARGURA_MAXIMA_EDITOR_REM = 20;

/**
 * O `colSpan` declarado no modelo (CE-19) vale nos DOIS leiautes que dimensionam editor. Na grade
 * (3) ele é literalmente o span de colunas. No horizontal (1) ele é o PESO do editor na fileira
 * (dono, 2026-10-11): `flexGrow` multiplica a fatia do espaço livre e a largura máxima acompanha,
 * senão o `max-w-xs` da classe travaria o campo no tamanho de um só. Era por isso que o filtro de
 * razão social de Pessoas não conseguia ocupar o dobro — o back já dizia `ColSpan = 2` e o front
 * ignorava fora da grade. Span 1 (o padrão) não escreve nada: a classe continua mandando.
 */
function estiloDoEditor(pLayout: XFilterLayout, pColSpan?: number, pRowSpan?: number): CSSProperties | undefined {
  const span = Math.max(1, pColSpan || 1);

  if (pLayout === 3)
    return { gridColumn: `span ${span}`, gridRow: `span ${pRowSpan || 1}` };

  if (pLayout === 1 && span > 1)
    return { flexGrow: span, maxWidth: `${LARGURA_MAXIMA_EDITOR_REM * span}rem` };

  return undefined;
}

// ============================================================================
// Component
// ============================================================================

export function XFilter({
  filter,
  values,
  onChange,
  onSearch,
  rightSlot,
  actionPortalRef,
  embedded = false,
  forceExpanded = false,
}: XFilterProps): JSX.Element {
  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [isCollapsed, setIsCollapsed] = useState(filter.isCollapsed);
  // Distingue a montagem do componente da digitação do usuário.
  const jaDigitou = useRef(false);

  // ---------------------------------------------------------------------------
  // Auto Search (Debounced)
  // ---------------------------------------------------------------------------

  // Busca automática com PAUSA (debounce): o cronômetro reinicia a cada tecla e só dispara quando o
  // usuário para de digitar. Sem isso, "AGUIA" seriam cinco consultas — e a última a chegar poderia
  // não ser a da última tecla.
  useEffect(() => {
    if (!filter.autoSearch)
      return;

    // O primeiro render não é digitação: a grade já carrega sozinha. Buscar aqui seria uma consulta
    // duplicada em toda abertura de App.
    if (!jaDigitou.current) {
      jaDigitou.current = true;
      return;
    }

    // O cleanup do efeito cancela o cronômetro pendente: cada tecla nova substitui o anterior.
    const timeout = window.setTimeout(() => {
      onSearch();
    }, filter.autoSearchDelay || 400);

    return () => window.clearTimeout(timeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, filter.autoSearch, filter.autoSearchDelay]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !filter.autoSearch)
      onSearch();
  }, [filter.autoSearch, onSearch]);

  // ---------------------------------------------------------------------------
  // Sorted Editors
  // ---------------------------------------------------------------------------

  const sortedEditors = useMemo(() => {
    return [...filter.editors]
      .filter((e) => e.isVisible)
      .sort((a, b) => a.order - b.order);
  }, [filter.editors]);

  // ---------------------------------------------------------------------------
  // Layout Classes
  // ---------------------------------------------------------------------------

  const layoutClass = useMemo(() => {
    return LAYOUT_STYLES[filter.layout](filter.columnsCount);
  }, [filter.layout, filter.columnsCount]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Embutido: só os editores, sem fundo, sem borda e sem botões — quem cuida do leiaute, do
  // pesquisar e do fechar é o cabeçalho unificado do XApplicationView.
  //
  // `contents` (display: contents), e NÃO um flex próprio: assim cada editor vira item do MESMO
  // container do cabeçalho, e a quebra de linha distribui filtros e botões na mesma malha. Com uma
  // caixa de layout aqui, o bloco de filtros consumia a linha inteira do pai, quebrava internamente,
  // e os botões eram empurrados para uma linha exclusiva — o "Fechar" sozinho embaixo, com a linha
  // do último filtro vazia à direita. O elemento continua no DOM: é ele que carrega o `role` e o
  // Enter-para-pesquisar, que borbulha normalmente por baixo de `display: contents`.
  if (embedded) {
    return (
      <div
        className="contents"
        onKeyDown={handleKeyDown}
        role="search"
      >
        {sortedEditors.map((editor) => (
          <div
            key={editor.id}
            className="min-w-[140px] sm:min-w-[180px] max-w-[240px]"
          >
            <XEditor
              editor={editor}
              value={values[editor.name]}
              onChange={(pValue: unknown) => onChange(editor.name, pValue)}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-muted-bg border-b border-border-light">
      {/* Header (se colapsável) — oculto quando forceExpanded (ex.: dropdown mobile) */}
      {filter.isCollapsible && !forceExpanded && (
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="w-full h-row px-3 sm:px-4 flex items-center justify-between text-ui font-medium text-brand-text-primary hover:bg-hover transition-colors min-h-[44px]"
        >
          <span>{(filter.title ?? '') || 'Pesquisa'}</span>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-brand-text-muted" />
          ) : (
            <ChevronUp className="w-4 h-4 text-brand-text-muted" />
          )}
        </button>
      )}

      {/* Filter Content */}
      {(!isCollapsed || forceExpanded) && (
        <div
          className="px-3 sm:px-4 py-3"
          onKeyDown={handleKeyDown}
          role="search"
        >
          <div className={layoutClass}>
            {/* Editors */}
            {sortedEditors.map((editor) => (
              <div
                key={editor.id}
                className={filter.layout === 1 ? 'w-full sm:min-w-[200px] sm:flex-1 sm:max-w-xs' : ''}
                style={estiloDoEditor(filter.layout, editor.colSpan, editor.rowSpan)}
              >
                <XEditor
                  editor={editor}
                  value={values[editor.name]}
                  onChange={(pValue: unknown) => onChange(editor.name, pValue)}
                />
              </div>
            ))}

            {/* Action Buttons - Touch friendly */}
            {(filter.showSearchButton || rightSlot) && (
              <div className={`
                flex items-end gap-2 w-full sm:w-auto
                ${filter.layout === 1 ? 'sm:ml-auto' : ''}
                ${filter.layout === 3 ? 'col-span-1 justify-end' : ''}
              `}>
                <div ref={actionPortalRef} className="contents" />
                {/* Pesquisar: âmbar fixo em TODOS os temas (--brand-primary varia por tema). */}
                {filter.showSearchButton && !filter.autoSearch && (
                  <button
                    type="button"
                    onClick={onSearch}
                    title={'Pesquisar'}
                    className="
                      flex-1 sm:flex-none h-10 sm:h-8 sm:w-8
                      inline-flex items-center justify-center gap-2
                      bg-amber-500 hover:bg-amber-600 text-white
                      rounded-lg transition-colors
                      focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-500
                      min-h-[44px] sm:min-h-[32px]
                    "
                  >
                    <Search className="w-4 h-4" />
                    <span className="sm:hidden text-ui">{'Pesquisar'}</span>
                  </button>
                )}

                {rightSlot}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
