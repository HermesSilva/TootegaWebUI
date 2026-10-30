/**
 * XDashboardView — Dashboard Template Layout
 *
 * Renders the Dashboard view template: fully custom content area.
 * No ButtonBar, Filter, DataGrid, Pagination, FormModal, or Export.
 *
 * Layout:
 * ┌─────────────────────────────────────────────────┐
 * │  [Context Help]                                 │
 * ├─────────────────────────────────────────────────┤
 * │                                                 │
 * │  Custom Component (fills entire area)           │
 * │                                                 │
 * └─────────────────────────────────────────────────┘
 *
 * The custom component is resolved from XCustomComponentRegistry by name.
 * If the component is not registered, a fallback message is displayed.
 */

import { useState, type JSX } from 'react';
import { AlertTriangle, LogOut } from 'lucide-react';
import { XApplicationMode } from '@core/types';
import type {
  XApplication,
  XApplicationState,
} from '@core/types';
import { CLOSE_BUTTON_CLASS } from '@core/lib';
import { XHint } from '@core/components/ui/XHint';
import { XCustomComponentRegistry } from './XCustomComponentRegistry';

// ============================================================================
// Types
// ============================================================================

export interface XDashboardViewProps {
  application: XApplication;
  tabID: string;
  onClose?: () => void;
  /**
   * Dentro de outra App (a seção de um painel de trabalho): sem fundo, sem barra de fechar e sem rolagem própria —
   * o conteúdo cresce com a página e quem rola é o painel.
   */
  embutido?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function XDashboardView({
  application,
  tabID,
  onClose,
  embutido = false,
}: XDashboardViewProps): JSX.Element {

  // ---------------------------------------------------------------------------
  // Application Translations
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // State — Minimal: no filter, no grid, no form, no pagination
  // ---------------------------------------------------------------------------

  const [state] = useState<XApplicationState>({
    currentMode: XApplicationMode.List,
    selectedRows: [],
    filterValues: {},
    appliedFilters: {},
    sortConfig: null,
    currentPage: 1,
    pageSize: 0,
  });

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
      className={embutido ? 'relative flex-1 flex flex-col' : 'relative flex flex-col h-full bg-brand-surface'}
      data-tab-id={tabID}
      data-application-id={application.id}
    >
      {/* Header bar: close button (top-right) */}
      {onClose && !embutido && (
        <div className="flex items-center justify-end gap-1 px-2 py-1 border-b border-brand-border bg-brand-surface-alt">
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
      )}

      {/* Custom Content Area — fills entire remaining space */}
      <div className={embutido ? 'flex-1 flex flex-col' : 'flex-1 min-h-0 overflow-auto'}>
        {CustomComponent ? (
          <CustomComponent
            application={application}
            state={state}
            filters={[]}
            sort={[]}
            tabID={tabID}
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
