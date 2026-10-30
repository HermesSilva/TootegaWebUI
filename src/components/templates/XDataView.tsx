/**
 * XDataView - Grid de Dados
 * 
 * Renderiza tabela de dados com header ordenável, linhas selecionáveis,
 * formatação de dados por tipo e estados de loading/empty.
 * 
 * Features:
 * - Loading overlay (não limpa dados durante refetch)
 * - Transições suaves entre estados
 * - Skeleton loading para primeira carga
 */

import { useMemo, useCallback, type JSX } from 'react';
import { Loader2 } from 'lucide-react';
import type {
  XDataView as XDataViewType,
  XSortDirection,
} from '@core/types';
import { XDataViewHeader } from './XDataViewHeader';
import { XDataViewRow } from './XDataViewRow';
import { getFieldValue } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

interface XDataViewProps {
  dataView: XDataViewType;
  data: Record<string, unknown>[];
  isLoading: boolean;      // True durante primeira carga (sem dados)
  isFetching?: boolean;    // True durante refetch (já tem dados)
  selectedRows: string[];
  sortConfig: { field: string; direction: XSortDirection } | null;
  onSort: (pFieldName: string) => void;
  onSelect: (pID: string) => void;
  onSelectAll: (pIDs: string[]) => void;
  onDoubleClick: (pID: string) => void;
  /** State control props - only when app.hasStateControl is true */
  hasStateControl?: boolean;
  stateCheckedRows?: string[];
  onStateCheckRow?: (pRowID: string) => void;
  onStateCheckAll?: (pChecked: boolean) => void;
}

// A grade NÃO tem botões: as ações da App (transmitir, baixar o documento auxiliar, cancelar) vivem na
// BARRA do App e agem sobre a linha selecionada (dono, 2026-07-13). Aqui ficam os dados, e só.

// ============================================================================
// Component
// ============================================================================

export function XDataView({
  dataView,
  data,
  isLoading,
  isFetching = false,
  selectedRows,
  sortConfig,
  onSort,
  onSelect,
  onSelectAll,
  onDoubleClick,
  hasStateControl = false,
  stateCheckedRows = [],
  onStateCheckRow,
  onStateCheckAll,
}: XDataViewProps): JSX.Element {

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const allRowIDs = useMemo(() => {
    return data.map((row) => String(getFieldValue(row, dataView.keyField) ?? ''));
  }, [data, dataView.keyField]);

  // Linhas MARCÁVEIS no controle de estado: as travadas (stateLocked) não entram no "marcar todos".
  const marcaveisCount = useMemo(
    () => (hasStateControl ? data.filter((row) => row['stateLocked'] !== true).length : data.length),
    [data, hasStateControl]);

  const isAllSelected = useMemo(() => {
    if (data.length === 0) return false;
    return allRowIDs.every((id) => selectedRows.includes(id));
  }, [allRowIDs, selectedRows, data.length]);

  const isSomeSelected = useMemo(() => {
    if (data.length === 0) return false;
    return selectedRows.length > 0 && !isAllSelected;
  }, [selectedRows.length, isAllSelected, data.length]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSelectAll = useCallback(() => {
    if (isAllSelected)
      onSelectAll([]);
    else
      onSelectAll(allRowIDs);
  }, [isAllSelected, allRowIDs, onSelectAll]);

  // ---------------------------------------------------------------------------
  // Render - Initial Loading (sem dados)
  // ---------------------------------------------------------------------------

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center bg-brand-surface">
        <div className="flex flex-col items-center gap-3 text-brand-text-muted">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
          <span className="text-ui">{(dataView.loadingMessage ?? '')}</span>
        </div>
      </div>
    );

  // ---------------------------------------------------------------------------
  // Render - Empty (sem loading e sem dados)
  // ---------------------------------------------------------------------------

  if (!isFetching && data.length === 0)
    return (
      <div className="flex-1 flex items-center justify-center bg-brand-surface">
        <div className="flex flex-col items-center gap-2 text-brand-text-muted">
          <svg
            className="w-16 h-16 text-brand-text-muted/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <span className="text-ui">{(dataView.emptyMessage ?? '')}</span>
        </div>
      </div>
    );

  // ---------------------------------------------------------------------------
  // Render - Data Grid
  // ---------------------------------------------------------------------------

  return (
    <div
      className={`
        h-full overflow-auto relative
        ${dataView.showBorder ? 'border-x border-border-light' : ''}
      `}
    >
      {/* Loading Overlay - aparece por cima da grid durante refetch */}
      {isFetching && (
        <div 
          className="
            absolute inset-0 z-10
            bg-brand-surface/60 backdrop-blur-[1px]
            flex items-center justify-center
            transition-opacity duration-200
          "
        >
          <div className="flex items-center gap-3 px-4 py-2 bg-brand-surface rounded-lg shadow-lg border border-border-light">
            <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
            <span className="text-ui text-brand-text-muted">{'Atualizando...'}</span>
          </div>
        </div>
      )}

      <table className="w-full border-collapse">
        {/* Header */}
        {dataView.showHeader && (
          <XDataViewHeader
            header={dataView.header}
            row={dataView.row}
            sortConfig={sortConfig}
            onSort={onSort}
            isAllSelected={isAllSelected}
            isSomeSelected={isSomeSelected}
            onSelectAll={handleSelectAll}
            hasStateControl={hasStateControl}
            isAllStateChecked={hasStateControl && marcaveisCount > 0 && stateCheckedRows.length === marcaveisCount}
            isSomeStateChecked={hasStateControl && stateCheckedRows.length > 0 && stateCheckedRows.length < marcaveisCount}
            onStateCheckAll={onStateCheckAll}
          />
        )}

        {/* Body */}
        <tbody className="transition-opacity duration-200" style={{ opacity: isFetching ? 0.6 : 1 }}>
          {data.map((row, index) => {
            const rowID = String(getFieldValue(row, dataView.keyField) ?? index);
            const isSelected = selectedRows.includes(rowID);

            return (
              <XDataViewRow
                key={`${rowID}-${'pt-BR'}`}
                row={dataView.row}
                data={row}
                rowID={rowID}
                rowIndex={index}
                isSelected={isSelected}
                onSelect={onSelect}
                onDoubleClick={onDoubleClick}
                hasStateControl={hasStateControl}
                isStateChecked={stateCheckedRows.includes(rowID)}
                onStateCheck={onStateCheckRow}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
