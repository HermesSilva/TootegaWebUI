/**
 * XDataViewRow - Linha do Grid
 * 
 * Renderiza uma linha de dados com formatação por tipo,
 * seleção por clique e duplo-clique para ação.
 * 
 * Mobile Features:
 * - Botão de ação (chevron) para abrir edição
 * - Long press (500ms) para abrir menu de contexto
 */

import { useCallback, useMemo, useState, useRef, type JSX } from 'react';

import { ChevronRight, Pencil, Eye, X, Lock } from 'lucide-react';
import { XDataType } from '@core/types';
import { formatCEP, formatCurrency, formatDate, formatDateTime, formatDecimal, formatDocument, formatNumber, formatPercentage, formatPhone, formatTime, getFieldValue, gridAlignmentClass, linhaMarcadaReadOnly } from '@core/lib';
import type {
  XDataViewRow as XDataViewRowType,
  XDataField,
} from '@core/types';

// ============================================================================
// Constants
// ============================================================================

const LONG_PRESS_DURATION = 500; // ms

// ============================================================================
// Types
// ============================================================================

interface XDataViewRowProps {
  row: XDataViewRowType;
  data: Record<string, unknown>;
  rowID: string;
  rowIndex: number;
  isSelected: boolean;
  onSelect: (pID: string) => void;
  onDoubleClick: (pID: string) => void;
  /** State control: whether the app has state control enabled */
  hasStateControl?: boolean;
  /** State control: whether this row is checked for batch state change */
  isStateChecked?: boolean;
  /** State control: callback to toggle state check for this row */
  onStateCheck?: (pRowID: string) => void;
}

// ============================================================================
// Alignment Styles
// ============================================================================

// O alinhamento vem de gridAlignmentClass: número à direita por padrão, texto à esquerda; o modelo
// sobrepõe com centro/direita explícitos. Regra única, compartilhada com o cabeçalho e com as grades
// de detalhe — a coluna e o seu título nunca divergem.

// ============================================================================
// Data Formatters
// ============================================================================

function formatValue(pValue: unknown, pColumn: XDataField): string {
  if (pValue === null || pValue === undefined)
    return pColumn.nullText || '';

  const value = pValue;

  switch (pColumn.dataType) {
    case XDataType.String:
      // Toda célula chega como TEXTO pt-BR do back (dono, 2026-08-03) — inclusive o rótulo de
      // lookup, que vem da Description do membro. Não há o que resolver aqui.
      return String(value);

    case XDataType.Integer:
      return formatNumber(Number(value), { maximumFractionDigits: 0 });

    case XDataType.Decimal:
      return formatDecimal(Number(value), 2);

    case XDataType.Date:
      return formatDate(value);

    case XDataType.DateTime:
      return formatDateTime(value);

    case XDataType.Time:
      return formatTime(value);

    case XDataType.Boolean:
      return value ? 'Sim' : 'Não';

    case XDataType.Currency:
      return formatCurrency(Number(value));

    case XDataType.Percentage:
      return formatPercentage(Number(value), 2);

    case XDataType.Email:
      return String(value);

    case XDataType.Phone:
      return formatPhone(String(value));

    case XDataType.URL:
      return String(value);

    // CPF e CNPJ compartilham o mesmo formatador tolerante (detecta pelo tamanho): uma coluna de
    // documento formata certo tanto pessoa física quanto jurídica, independente do tipo declarado.
    case XDataType.CPF:
    case XDataType.CNPJ:
      return formatDocument(String(value));

    case XDataType.CEP:
      return formatCEP(String(value));

    default:
      return String(value);
  }
}

// ============================================================================
// XDataType enum values (matching backend)
// ============================================================================
// Component
// ============================================================================

export function XDataViewRow({
  row,
  data,
  rowID,
  rowIndex,
  isSelected,
  onSelect,
  onDoubleClick,
  hasStateControl = false,
  isStateChecked = false,
  onStateCheck,
}: XDataViewRowProps): JSX.Element {

  // ---------------------------------------------------------------------------
  // Row Actions (modelo do back — CE-19)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // State - Long Press Context Menu
  // ---------------------------------------------------------------------------

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  // ---------------------------------------------------------------------------
  // Sorted Columns
  // ---------------------------------------------------------------------------

  const sortedColumns = useMemo(() => {
    const STATUS_FIELDS = ['statusDescricao', 'isActive', 'sysxStateID', 'stateID', 'stateLocked'];

    return [...row.columns]
      .filter((col) => col.isVisible)
      .filter((col) => !hasStateControl || !STATUS_FIELDS.includes(col.fieldName))
      .sort((a, b) => a.order - b.order);
  }, [row.columns, hasStateControl]);

  // Linha SOMENTE-LEITURA: o registro traz o sinal `readOnly` do back (contrato XILinhaComEstado —
  // dado livre de plataforma, D51). Motor genérico (CE-19): a grade a esmaece e mostra um cadeado, e
  // o form já abre em leitura (a mesma decisão de `abreEmLeitura`, no XApplicationView). Nenhum código
  // por-App. A linha continua clicável e visualizável — só não se edita.
  const isReadOnly = linhaMarcadaReadOnly(data);

  // ---------------------------------------------------------------------------
  // Handlers - Click
  // ---------------------------------------------------------------------------

  const handleClick = useCallback(() => {
    if (row.allowRowClick)
      onSelect(rowID);
  }, [row.allowRowClick, rowID, onSelect]);

  const handleDoubleClick = useCallback(() => {
    if (row.allowDoubleClick)
      onDoubleClick(rowID);
  }, [row.allowDoubleClick, rowID, onDoubleClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter')
      handleDoubleClick();
    else if (e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick, handleDoubleClick]);

  // ---------------------------------------------------------------------------
  // Handlers - Long Press (Mobile Context Menu)
  // ---------------------------------------------------------------------------

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!row.allowDoubleClick) return;
    
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    
    longPressTimer.current = window.setTimeout(() => {
      // Vibration feedback if available
      if (navigator.vibrate)
        navigator.vibrate(50);
      
      // Position context menu near touch point
      setContextMenuPosition({ 
        x: touch.clientX, 
        y: touch.clientY 
      });
      setShowContextMenu(true);
      
      // Select the row
      onSelect(rowID);
    }, LONG_PRESS_DURATION);
  }, [row.allowDoubleClick, rowID, onSelect]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Cancel long press if user moves finger more than 10px
    if (touchStartPos.current) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);
      
      if (dx > 10 || dy > 10)
        clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  const handleTouchEnd = useCallback(() => {
    clearLongPressTimer();
    touchStartPos.current = null;
  }, [clearLongPressTimer]);

  const handleContextMenuAction = useCallback((action: 'edit' | 'detail' | 'close') => {
    setShowContextMenu(false);
    
    if (action === 'edit' || action === 'detail')
      onDoubleClick(rowID);
  }, [rowID, onDoubleClick]);

  // ---------------------------------------------------------------------------
  // Render Value
  // ---------------------------------------------------------------------------

  const renderValue = useCallback((pColumn: XDataField) => {
    const value = getFieldValue(data, pColumn.fieldName);
    const formatted = formatValue(value, pColumn);

    // Boolean rendering com badge
    if (pColumn.dataType === XDataType.Boolean)
      return (
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded-full text-ui-xs font-medium
            ${value ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}
          `}
        >
          {formatted}
        </span>
      );

    // Email rendering com link
    if (pColumn.dataType === XDataType.Email && value)
      return (
        <a
          href={`mailto:${value}`}
          className="text-brand-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {formatted}
        </a>
      );

    // URL rendering com link
    if (pColumn.dataType === XDataType.URL && value)
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {formatted}
        </a>
      );

    return formatted;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <tr
        className={`
          h-row border-b border-border-light transition-colors
          ${row.allowRowClick ? 'cursor-pointer' : ''}
          ${isReadOnly && !isSelected ? 'text-brand-text-muted' : ''}
          ${isSelected
            ? `bg-brand-primary/20 hover:bg-brand-primary/25 font-medium text-brand-text-primary
               [&>td:first-child]:shadow-[inset_3px_0_0_0_hsl(var(--brand-primary))]`
            : `${row.highlightOnHover ? 'hover:bg-hover' : ''}
               ${row.alternateRowStyle && rowIndex % 2 === 1 ? 'bg-muted-bg/50' : 'bg-brand-surface'}`}
        `}
        // Pelo ÍNDICE na página, não pela chave: o teste e2e não conhece o ID que o back gerou, e o
        // que ele precisa afirmar é "a grade passou a ter linha" / "a 1ª linha é a que cadastrei".
        data-testid={`grid-row-${rowIndex}`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        tabIndex={row.allowRowClick ? 0 : undefined}
        role={row.allowRowClick ? 'button' : undefined}
        aria-selected={isSelected}
      >
        {/* State Indicator - elegant dot. Rows flagged stateLocked (e.g. synthetic "access to all")
            have no state: render an empty cell so the toggle never applies to them. */}
        {hasStateControl && (
          <td
            className="w-7 min-w-7 max-w-7 px-1 align-middle text-center border-r border-border"
            aria-label={data['stateLocked'] === true ? '' : (data['isActive'] === true ? 'Active' : 'Inactive')}
          >
            {data['stateLocked'] !== true && (
              <span
                className={`
                  inline-block w-2.5 h-2.5 rounded-full
                  ${data['isActive'] === true ? 'bg-success' : 'bg-danger'}
                `}
              />
            )}
          </td>
        )}

        {/* State Checkbox - also selects the row (hidden for stateLocked rows) */}
        {hasStateControl && data['stateLocked'] === true && (
          <td className="w-10 min-w-10 px-2 align-middle text-center" />
        )}
        {hasStateControl && data['stateLocked'] !== true && (
          <td className="w-10 min-w-10 px-2 align-middle text-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStateCheck?.(rowID);
                if (!isSelected)
                  onSelect(rowID);
              }}
              className="inline-flex items-center justify-center min-h-touch min-w-touch rounded focus:outline-none focus:ring-2 focus:ring-brand-primary"
              aria-label={'Selecionar para alteração de estado'}
            >
              <span className={`
                inline-flex items-center justify-center w-5 h-5 rounded border
                ${isStateChecked ? 'bg-brand-primary border-brand-primary' : 'border-border bg-brand-surface'}
              `}>
                {isStateChecked && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </span>
            </button>
          </td>
        )}

        {/* Row Number */}
        {row.showRowNumber && (
          <td className="w-12 px-3 align-middle text-ui text-center text-brand-text-muted">
            {rowIndex + 1}
          </td>
        )}

      {/* Checkbox */}
      {row.showCheckboxColumn && (
        <td className="w-12 px-3 align-middle text-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(rowID);
            }}
            aria-label={'Selecionar'}
            className="inline-flex items-center justify-center min-h-touch min-w-touch rounded focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <span className={`
              inline-flex items-center justify-center w-5 h-5 rounded border
              ${isSelected ? 'bg-brand-primary border-brand-primary' : 'border-border bg-brand-surface'}
            `}>
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </span>
          </button>
        </td>
      )}

      {/* Data Cells */}
      {sortedColumns.map((column, colIndex) => (
        <td
          key={column.fieldName}
          className={`
            px-3 align-middle text-ui truncate
            ${gridAlignmentClass(column.alignment, column.dataType)}
          `}
          style={{
            width: column.width ? `${column.width}px` : undefined,
            minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
            maxWidth: column.maxWidth ? `${column.maxWidth}px` : undefined,
          }}
          title={String(getFieldValue(data, column.fieldName) ?? '')}
        >
          {/* Cadeado na 1ª coluna da linha somente-leitura: sinal de que este é um registro padrão da
              plataforma, que se lê mas não se altera (D51). Só marca; a barra e o form já ajustam. */}
          {isReadOnly && colIndex === 0 && (
            <Lock
              className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5 text-brand-text-muted shrink-0"
              aria-label="Registro padrão da plataforma (somente leitura)"
            />
          )}
          {renderValue(column)}
        </td>
      ))}

      {/* Sem coluna de botões: as ações da App vivem na BARRA e agem sobre a linha selecionada (dono,
          2026-07-13). A linha é dado — clicar nela seleciona; o que se faz com ela decide-se na barra. */}

      {/* Mobile Action Button - Visible only on mobile when doubleClick is allowed */}
      {row.allowDoubleClick && (
        <td className="sm:hidden w-12 px-2 align-middle text-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDoubleClick(rowID);
            }}
            className="
              inline-flex items-center justify-center
              min-h-touch min-w-touch rounded-lg
              text-brand-text-muted hover:text-brand-primary
              hover:bg-hover active:bg-active
              transition-colors
              focus:outline-none focus:ring-2 focus:ring-brand-primary
            "
            title={'Abrir'}
            aria-label={'Abrir'}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </td>
      )}
      </tr>

      {/* Mobile Context Menu - Shown on long press */}
      {showContextMenu && (
        <>
          {/* Backdrop */}
          <tr className="sm:hidden">
            <td colSpan={100}>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setShowContextMenu(false)}
              />
            </td>
          </tr>
          
          {/* Context Menu */}
          <tr className="sm:hidden">
            <td colSpan={100} className="p-0">
              <div 
                className="fixed z-50 bg-brand-surface rounded-xl shadow-xl border border-border-light overflow-hidden min-w-[200px]"
                style={{
                  left: Math.min(contextMenuPosition.x, window.innerWidth - 220),
                  top: Math.min(contextMenuPosition.y, window.innerHeight - 180),
                }}
              >
                {/* Menu Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted-bg border-b border-border-light">
                  <span className="text-ui-sm font-medium text-brand-text-secondary">
                    {'Ações'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowContextMenu(false)}
                    aria-label={'Fechar'}
                    className="min-h-touch min-w-touch flex items-center justify-center rounded-lg hover:bg-hover transition-colors"
                  >
                    <X className="w-4 h-4 text-brand-text-muted" />
                  </button>
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  {row.doubleClickAction === 'edit' && (
                    <button
                      type="button"
                      onClick={() => handleContextMenuAction('edit')}
                      className="
                        w-full flex items-center gap-3 px-4 py-3
                        text-left text-ui text-brand-text-primary
                        hover:bg-hover active:bg-active
                        transition-colors min-h-[48px]
                      "
                    >
                      <Pencil className="w-5 h-5 text-brand-primary" />
                      <span>{'Editar'}</span>
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => handleContextMenuAction('detail')}
                    className="
                      w-full flex items-center gap-3 px-4 py-3
                      text-left text-ui text-brand-text-primary
                      hover:bg-hover active:bg-active
                      transition-colors min-h-[48px]
                    "
                  >
                    <Eye className="w-5 h-5 text-brand-text-secondary" />
                    <span>{'Detalhes'}</span>
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </>
      )}
    </>
  );
}
