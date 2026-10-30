/**
 * XDataViewHeader - Cabeçalho do Grid
 * 
 * Renderiza colunas do header com suporte a ordenação.
 * Suporta sticky header e checkbox para seleção múltipla.
 */

import { useCallback, useMemo, type JSX } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Minus } from 'lucide-react';
import { XSortDirection } from '@core/types';
import { gridAlignmentClass } from '@core/lib';
import type {
  XDataViewHeader as XDataViewHeaderType,
  XDataViewRow as XDataViewRowType,
  XDataField,
} from '@core/types';

// ============================================================================
// Types
// ============================================================================

interface XDataViewHeaderProps {
  header: XDataViewHeaderType;
  row: XDataViewRowType;
  sortConfig: { field: string; direction: XSortDirection } | null;
  onSort: (pFieldName: string) => void;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onSelectAll: () => void;
  /** State control: whether the app has state control enabled */
  hasStateControl?: boolean;
  /** State control: all rows are state-checked */
  isAllStateChecked?: boolean;
  /** State control: some (but not all) rows are state-checked */
  isSomeStateChecked?: boolean;
  /** State control: callback to check/uncheck all rows for batch state change */
  onStateCheckAll?: (pChecked: boolean) => void;
}

// ============================================================================
// Alignment Styles
// ============================================================================

// Mesma regra da célula (gridAlignmentClass): o título acompanha o alinhamento do dado.
const JUSTIFY_BY_ALIGNMENT: Record<string, string> = {
  'text-left': 'justify-start',
  'text-center': 'justify-center',
  'text-right': 'justify-end',
};

// ============================================================================
// Component
// ============================================================================

export function XDataViewHeader({
  header,
  row,
  sortConfig,
  onSort,
  isAllSelected,
  isSomeSelected,
  onSelectAll,
  hasStateControl = false,
  isAllStateChecked = false,
  isSomeStateChecked = false,
  onStateCheckAll,
}: XDataViewHeaderProps): JSX.Element {
  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Sorted Columns
  // ---------------------------------------------------------------------------

  const sortedColumns = useMemo(() => {
    const STATUS_FIELDS = ['statusDescricao', 'isActive', 'sysxStateID', 'stateID'];

    return [...header.columns]
      .filter((col) => col.isVisible)
      .filter((col) => !hasStateControl || !STATUS_FIELDS.includes(col.fieldName))
      .sort((a, b) => a.order - b.order);
  }, [header.columns, hasStateControl]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSort = useCallback((pColumn: XDataField) => {
    if (pColumn.isSortable)
      onSort(pColumn.fieldName);
  }, [onSort]);

  // ---------------------------------------------------------------------------
  // Render Sort Icon
  // ---------------------------------------------------------------------------

  const renderSortIcon = useCallback((pColumn: XDataField) => {
    if (!pColumn.isSortable)
      return null;

    const isSorted = sortConfig?.field === pColumn.fieldName;

    if (!isSorted)
      return <ArrowUpDown className="w-3 h-3 text-brand-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />;

    if (sortConfig?.direction === XSortDirection.Ascending)
      return <ArrowUp className="w-3 h-3 text-brand-primary" />;

    return <ArrowDown className="w-3 h-3 text-brand-primary" />;
  }, [sortConfig]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <thead
      className={`
        bg-muted-bg text-brand-text-secondary
        ${header.isSticky ? 'sticky top-0 z-10' : ''}
      `}
    >
      <tr className="h-row border-b-2 border-border">
        {/* State Indicator Column - elegant dot indicator */}
        {hasStateControl && (
          <th className="w-7 min-w-7 max-w-7 px-1 align-middle text-center border-r border-border" aria-label={'Indicador de estado'}>
            <span className="sr-only">{'Estado'}</span>
          </th>
        )}

        {/* State Checkbox Column - batch select for state change */}
        {hasStateControl && (
          <th className="w-10 min-w-10 px-2 align-middle text-center">
            <button
              type="button"
              onClick={() => onStateCheckAll?.(!isAllStateChecked)}
              className="inline-flex items-center justify-center min-h-touch min-w-touch rounded focus:outline-none focus:ring-2 focus:ring-brand-primary"
              aria-label={'Selecionar todos para alteração de estado'}
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-border">
                {isAllStateChecked && (
                  <svg className="w-3 h-3 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {isSomeStateChecked && !isAllStateChecked && (
                  <Minus className="w-3 h-3 text-brand-primary" />
                )}
              </span>
            </button>
          </th>
        )}

        {/* Row Number Column */}
        {row.showRowNumber && (
          <th className="w-12 px-3 align-middle text-ui font-medium text-center">
            #
          </th>
        )}

        {/* Checkbox Column */}
        {row.showCheckboxColumn && row.selectionMode === 2 && (
          <th className="w-12 px-3 align-middle text-center">
            <button
              type="button"
              onClick={onSelectAll}
              aria-label={'Selecionar'}
              className="inline-flex items-center justify-center min-h-touch min-w-touch rounded focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              <span className="inline-flex items-center justify-center w-5 h-5 rounded border border-border">
              {isAllSelected && (
                <svg className="w-3 h-3 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {isSomeSelected && !isAllSelected && (
                <Minus className="w-3 h-3 text-brand-primary" />
              )}
              </span>
            </button>
          </th>
        )}

        {/* Data Columns */}
        {sortedColumns.map((column) => (
          <th
            key={column.fieldName}
            className={`
              px-3 align-middle text-ui font-medium whitespace-nowrap
              ${gridAlignmentClass(column.alignment, column.dataType)}
              ${column.isSortable ? 'cursor-pointer select-none group hover:bg-hover transition-colors' : ''}
            `}
            style={{
              width: column.width ? `${column.width}px` : undefined,
              minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
              maxWidth: column.maxWidth ? `${column.maxWidth}px` : undefined,
            }}
            onClick={() => handleSort(column)}
            role={column.isSortable ? 'button' : undefined}
            tabIndex={column.isSortable ? 0 : undefined}
            onKeyDown={(e) => {
              if (column.isSortable && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handleSort(column);
              }
            }}
          >
            {/* `whitespace-nowrap` no <th>: o título da coluna NUNCA quebra em mais de uma linha
                (dono, 2026-10-11). Antes, coluna estreita partia "Razão social" em duas linhas e o
                cabeçalho crescia além da `h-row`; agora o título fica inteiro numa linha e a coluna
                alarga o que precisar. As demais grades do Core já faziam isso. */}
            {/* O conteúdo do cabeçalho é um flex (título + ícone de ordenação): quem posiciona é o
                `justify`, não o `text-align` do <th>. Deriva-o da MESMA regra da célula, senão a
                coluna numérica ficava com o dado à direita e o título à esquerda. */}
            {(() => {
              const alinhamento = gridAlignmentClass(column.alignment, column.dataType);
              // Coluna à direita: o indicador de ordenação vai ANTES do título. Assim a borda direita
              // do cabeçalho e a dos números ficam na mesma linha vertical — o ícone não empurra o
              // título para dentro.
              const iconeAntes = alinhamento === 'text-right';

              return (
                <div className={`flex items-center gap-2 ${JUSTIFY_BY_ALIGNMENT[alinhamento]}`}>
                  {iconeAntes && renderSortIcon(column)}
                  <span>{(column.title ?? '')}</span>
                  {!iconeAntes && renderSortIcon(column)}
                </div>
              );
            })()}
          </th>
        ))}

        {/* Sem coluna de ações: as ações da App vivem na BARRA do App e agem sobre a linha selecionada
            (dono, 2026-07-13). A grade é dado; o que se faz com a linha decide-se na barra. */}

        {/* Mobile Action Column - Empty header cell for alignment */}
        {row.allowDoubleClick && (
          <th className="sm:hidden w-12 px-2 align-middle">
            {/* Empty - just for alignment with row action button */}
          </th>
        )}
      </tr>
    </thead>
  );
}
