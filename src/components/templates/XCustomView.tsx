/**
 * XCustomView — Custom Template Layout
 *
 * Renders the Custom view template: Filter bar + custom content component.
 * No ButtonBar, DataGrid, Pagination, FormModal, or Export.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │  Filter Bar                    [?] [Q] [⌫]     │
 * ├─────────────────────────────────────────────────┤
 * │                                                 │
 * │  Custom Component (fills remaining space)       │
 * │                                                 │
 * └─────────────────────────────────────────────────┘
 *
 * The custom component is resolved from XCustomComponentRegistry by name.
 * If the component is not registered, a fallback message is displayed.
 */

import { useState, useCallback, useMemo, type JSX } from 'react';
import { AlertTriangle, LogOut, Search } from 'lucide-react';
import { XApplicationMode, XFilterOperator } from '@core/types';
import type {
  XApplication,
  XApplicationState,
  XFilterInfo,
  XSortInfo,
} from '@core/types';
import { CLOSE_BUTTON_CLASS } from '@core/lib';
import { XHint } from '@core/components/ui/XHint';
import { XFilter } from './XFilter';
import { XCustomComponentRegistry } from './XCustomComponentRegistry';

// ============================================================================
// Types
// ============================================================================

export interface XCustomViewProps {
  application: XApplication;
  tabID: string;
  onClose?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function XCustomView({
  application,
  tabID,
  onClose,
}: XCustomViewProps): JSX.Element {

  // ---------------------------------------------------------------------------
  // Filter Action Portal — allows custom component to inject buttons into filter
  // ---------------------------------------------------------------------------

  const [filterActionEl, setFilterActionEl] = useState<HTMLDivElement | null>(null);

  // ---------------------------------------------------------------------------
  // Application Translations
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // State — Minimal: only filter-related state (no grid, no form, no pagination)
  // ---------------------------------------------------------------------------

  const [state, setState] = useState<XApplicationState>({
    currentMode: XApplicationMode.List,
    selectedRows: [],
    filterValues: {},
    appliedFilters: {},
    sortConfig: null,
    currentPage: 1,
    pageSize: application.dataView.pagination.pageSize,
  });

  // ---------------------------------------------------------------------------
  // Filter Handlers
  // ---------------------------------------------------------------------------

  const handleFilterChange = useCallback((pFieldName: string, pValue: unknown) => {
    setState(prev => ({
      ...prev,
      filterValues: { ...prev.filterValues, [pFieldName]: pValue },
    }));
  }, []);

  const handleSearch = useCallback(() => {
    // Filters flow to the custom component via props — no grid refetch needed.
    // Reset page to 1 when filters change.
    setState(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  // ---------------------------------------------------------------------------
  // Computed — Active filters/sort (passed to custom component)
  // ---------------------------------------------------------------------------

  const activeFilters = useMemo((): XFilterInfo[] => {
    const filters: XFilterInfo[] = [];
    for (const [fieldName, value] of Object.entries(state.filterValues)) {
      if (value === undefined || value === null || value === '')
        continue;

      const editor = application.dataView.filter.editors.find(
        e => e.fieldName === fieldName
      );
      const operator = editor?.defaultOperator ?? XFilterOperator.Contains;

      filters.push({ fieldName, operator, value: String(value) });
    }
    return filters;
  }, [state.filterValues, application.dataView.filter.editors]);

  const activeSort = useMemo((): XSortInfo[] => {
    if (!state.sortConfig)
      return [];
    return [{
      fieldName: state.sortConfig.field,
      direction: state.sortConfig.direction,
    }];
  }, [state.sortConfig]);

  // ---------------------------------------------------------------------------
  // Resolve Custom Component
  // ---------------------------------------------------------------------------

  const componentName = application.customComponentName ?? '';
  const CustomComponent = componentName
    ? XCustomComponentRegistry.resolve(componentName)
    : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="relative flex flex-col h-full bg-brand-surface"
      data-tab-id={tabID}
      data-application-id={application.id}
    >
      {/* Unified Header — same pattern as DataGrid.
          Order: [filter-editors] [🔍] [🧹] [spacer] [portal: custom buttons] [?] [×] */}
      <div
        className="flex flex-wrap items-end px-2 sm:px-4 py-2 border-b border-border-light bg-brand-surface min-h-row gap-1 sm:gap-2"
        data-tour="header"
      >
        {/* Filter editors inline (no outer wrapper) */}
        {application.dataView.filter.isVisible && (
          <XFilter
            filter={application.dataView.filter}
            values={state.filterValues}
            onChange={handleFilterChange}
            onSearch={handleSearch}
            embedded
          />
        )}

        {/* Search — after editors, before spacer. Âmbar fixo em todos os temas. */}
        {application.dataView.filter.isVisible &&
          application.dataView.filter.showSearchButton &&
          !application.dataView.filter.autoSearch && (
          <button
            type="button"
            onClick={handleSearch}
            title={'Pesquisar'}
            className="h-10 sm:h-8 sm:w-8 inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-amber-500 min-h-[44px] sm:min-h-[32px] px-3 sm:px-0"
          >
            <Search className="w-4 h-4" />
            <span className="sm:hidden text-ui">{'Pesquisar'}</span>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-[8px]" />

        {/* Portal target: custom component injects action buttons here (e.g. +Novo Documento) */}
        <div ref={setFilterActionEl} className="contents" />

        {/* Close — rightmost. Mesma cor e ícone do Fechar da barra da App (CLOSE_BUTTON_CLASS). */}
        {onClose && (
          <XHint label={'Fechar'} body={'Encerra a consulta e retorna à listagem. Nada é alterado.'} tone="info" placement="bottom">
          <button
            type="button"
            onClick={onClose}
            aria-label={'Fechar'}
            className={CLOSE_BUTTON_CLASS}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{'Fechar'}</span>
          </button>
          </XHint>
        )}
      </div>

      {/* Custom Content Area */}
      <div className="flex-1 min-h-0 overflow-auto">
        {CustomComponent ? (
          <CustomComponent
            application={application}
            state={state}
            filters={activeFilters}
            sort={activeSort}
            tabID={tabID}
            filterActionPortal={filterActionEl}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-brand-muted">
            <AlertTriangle className="h-10 w-10" />
            <p className="text-sm font-medium">
              {`Componente '${componentName || '(undefined)'}' não está registrado`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
