/**
 * XComboBoxEditor - Dropdown Multi-Coluna
 * 
 * Select dropdown com suporte a:
 * - Múltiplas colunas com header
 * - Agrupamento de itens
 * - Field bindings (alimentar múltiplos campos ao selecionar)
 */

import { useState, useRef, useCallback, useMemo, useEffect, type JSX } from 'react';

import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';
import type { XDataEditor, XLookupItem, XLookupColumn, XFieldAlignment } from '@core/types';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { usePosicaoFlutuante } from '@core/hooks/usePosicaoFlutuante';
import { XEditorLabel } from './XEditorLabel';
import { lookupLabel } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

interface XComboBoxEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown, pBindings?: Record<string, unknown>) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Alignment Styles
// ============================================================================

const ALIGNMENT_STYLES: Record<XFieldAlignment, string> = {
  1: 'text-left',    // Left
  2: 'text-center',  // Center
  3: 'text-right',   // Right
};

// ============================================================================
// Component
// ============================================================================

export function XComboBoxEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XComboBoxEditorProps): JSX.Element {
  const editorModel = editor.editor;
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownZIndex, setDropdownZIndex] = useState(0);
  // Abaixo; não coube ⇒ acima, direita, esquerda (dono, 2026-10-23). Regra única no usePosicaoFlutuante.
  const { posicao: dropdownPosition } = usePosicaoFlutuante(isOpen, containerRef, listRef, { alturaMaxima: 300 });

  // ---------------------------------------------------------------------------
  // Items and Columns
  // ---------------------------------------------------------------------------

  const items = useMemo(() => editorModel.lookupItems || [], [editorModel.lookupItems]);

  const columns = useMemo(() => {
    const cols = editorModel.lookupColumns || [];
    return cols.filter((c) => c.isVisible);
  }, [editorModel.lookupColumns]);

  const hasMultipleColumns = columns.length > 1;
  const showHeader = editorModel.lookupShowHeader && hasMultipleColumns;

  // ---------------------------------------------------------------------------
  // Selected Item
  // ---------------------------------------------------------------------------

  const selectedItem = useMemo(() => {
    if (value === undefined || value === null || value === '')
      return null;

    return items.find((item) => item.value === String(value)) || null;
  }, [items, value]);

  /**
   * Texto do item escolhido. O campo de display configurado (coluna do lookup) tem precedência e
   * sai como veio — é dado, não chave. Sem ele, o rótulo é o padrão da casa: `SIGLA - nome`
   * traduzido, o MESMO que a lista mostra, para o campo fechado não dizer outra coisa que a opção.
   */
  const displayText = useMemo(() => {
    if (!selectedItem)
      return '';

    if (editorModel.lookupDisplayField && selectedItem.columns)
      return String(selectedItem.columns[editorModel.lookupDisplayField] ?? selectedItem.text);

    return lookupLabel(selectedItem);
  }, [selectedItem, editorModel.lookupDisplayField]);

  // ---------------------------------------------------------------------------
  // Grouped Items
  // ---------------------------------------------------------------------------

  const groupedItems = useMemo(() => {
    const groups = new Map<string, XLookupItem[]>();

    for (const item of items) {
      const group = item.group || '';
      if (!groups.has(group))
        groups.set(group, []);

      groups.get(group)!.push(item);
    }

    return groups;
  }, [items]);

  const hasGroups = groupedItems.size > 1 || (groupedItems.size === 1 && !groupedItems.has(''));

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleToggle = useCallback(() => {
    if (!disabled && !editorModel.isReadOnly) {
      setIsOpen((prev) => {
        if (!prev)
          setDropdownZIndex(ZIndexManager.next());
        return !prev;
      });
    }
  }, [disabled, editorModel.isReadOnly]);

  const openDropdown = useCallback(() => {
    if (!disabled && !editorModel.isReadOnly) {
      setDropdownZIndex(ZIndexManager.next());
      setIsOpen(true);
    }
  }, [disabled, editorModel.isReadOnly]);

  const handleSelect = useCallback((pItem: XLookupItem) => {
    // Valor principal
    const newValue = pItem.value;

    // Field bindings
    const bindings: Record<string, unknown> = {};
    if (editorModel.fieldBindings && pItem.columns) {
      for (const binding of editorModel.fieldBindings) {
        bindings[binding.targetField] = pItem.columns[binding.sourceField];
      }
    }

    onChange(newValue, Object.keys(bindings).length > 0 ? bindings : undefined);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [editorModel.fieldBindings, onChange]);

  const handleRevert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(originalValue ?? '', undefined);
  }, [onChange, originalValue]);

  // ---------------------------------------------------------------------------
  // Computed: Show Revert Button
  // ---------------------------------------------------------------------------

  const normalizedValue = String(value ?? '');
  const normalizedOriginal = String(originalValue ?? '');
  const hasChanged = normalizedValue !== normalizedOriginal;
  const showRevertButton = hasChanged && !disabled && !editorModel.isReadOnly;

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled || editorModel.isReadOnly)
      return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0)
          handleSelect(items[highlightedIndex]);
        else
          openDropdown();
        break;

      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          openDropdown();
        } else {
          setHighlightedIndex((prev) =>
            prev < items.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : 0
          );
        }
        break;

      case 'Home':
        e.preventDefault();
        setHighlightedIndex(0);
        break;

      case 'End':
        e.preventDefault();
        setHighlightedIndex(items.length - 1);
        break;
    }
  }, [disabled, editorModel.isReadOnly, isOpen, highlightedIndex, items, handleSelect, openDropdown]);

  // ---------------------------------------------------------------------------
  // Click Outside
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const clickedInContainer = containerRef.current?.contains(target);
      const clickedInDropdown = listRef.current?.contains(target);
      
      if (!clickedInContainer && !clickedInDropdown)
        setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Scroll to Highlighted
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const highlightedEl = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
      if (highlightedEl)
        highlightedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  // ---------------------------------------------------------------------------
  // Render Column Value
  // ---------------------------------------------------------------------------

  const renderColumnValue = useCallback((pItem: XLookupItem, pColumn: XLookupColumn) => {
    if (pItem.columns && pColumn.fieldName in pItem.columns)
      return String(pItem.columns[pColumn.fieldName] ?? '');

    // Fallback para text se for a primeira coluna
    if (pColumn.fieldName === editorModel.lookupDisplayField || columns.indexOf(pColumn) === 0)
      return pItem.text;

    return '';
  }, [columns, editorModel.lookupDisplayField]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      {/* Trigger */}
      <div
        id={editor.id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled || editorModel.isReadOnly ? -1 : 0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`
          relative w-full h-editor px-3 pr-10
          flex items-center
          text-ui rounded-lg border cursor-pointer
          bg-brand-surface text-brand-text-primary
          focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
          ${disabled || editorModel.isReadOnly ? 'opacity-50 cursor-not-allowed bg-muted-bg' : ''}
          ${error ? 'border-danger focus:ring-danger' : 'border-border'}
        `}
      >
        {/* Display Value */}
        <span className={`truncate flex-1 ${!displayText ? 'text-brand-text-muted' : ''}`}>
          {displayText || (editorModel.placeholderText ?? '') || 'Selecione...'}
        </span>

        {/* Revert Button */}
        {showRevertButton && (
          <button
            type="button"
            onClick={handleRevert}
            className="absolute right-8 p-1 hover:bg-hover rounded"
            tabIndex={-1}
            title={'Desfazer alteração'}
          >
            <X className="w-3 h-3 text-brand-text-muted" />
          </button>
        )}

        {/* Chevron */}
        <ChevronDown
          className={`absolute right-3 w-4 h-4 text-brand-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Dropdown via Portal - renders outside container hierarchy */}
      {isOpen && createPortal(
        <div
          ref={listRef}
          role="listbox"
          data-x-portal-dropdown=""
          className="
            fixed
            bg-brand-surface border border-border rounded-lg shadow-lg
            overflow-auto
          "
          style={{
            zIndex: dropdownZIndex,
            top: dropdownPosition.top,
            bottom: dropdownPosition.bottom,
            left: dropdownPosition.left,
            visibility: dropdownPosition.medido ? undefined : 'hidden',
            // O painel pode ser MAIS LARGO que o editor: cresce com o conteúdo (max-content) até o
            // limite da viewport. Nunca mais estreito que o editor (minWidth). Assim as opções não
            // quebram linha (whitespace-nowrap nos itens). O teto é a JANELA, não "da esquerda do
            // painel em diante": quem decide onde ele começa para caber é o posicionamento.
            width: hasMultipleColumns
              ? Math.max(dropdownPosition.larguraCampo, columns.reduce((sum, c) => sum + (c.width || 100), 0) + 20)
              : 'max-content',
            minWidth: dropdownPosition.larguraCampo,
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: dropdownPosition.maxHeight,
          }}
        >
          {/* Header */}
          {showHeader && (
            <div className="sticky top-0 flex bg-muted-bg border-b border-border-light">
              {columns.map((column) => (
                <div
                  key={column.fieldName}
                  className={`px-3 py-2 text-ui font-medium text-brand-text-secondary ${ALIGNMENT_STYLES[column.alignment]}`}
                  style={{ width: column.width || 100, flexShrink: 0 }}
                >
                  {(column.title ?? '')}
                </div>
              ))}
            </div>
          )}

          {/* Items */}
          {hasGroups ? (
            // Grouped rendering
            Array.from(groupedItems.entries()).map(([group, groupItems]) => (
              <div key={group || '__no_group__'}>
                {group && (
                  <div className="px-3 py-1.5 text-ui-xs font-semibold text-brand-text-muted bg-muted-bg">
                    {group}
                  </div>
                )}
                {groupItems.map((item) => {
                  const flatIndex = items.indexOf(item);
                  const isHighlighted = flatIndex === highlightedIndex;
                  const isSelected = item.value === String(value);

                  return (
                    <div
                      key={item.value}
                      data-index={flatIndex}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => !item.isDisabled && handleSelect(item)}
                      className={`
                        flex items-center cursor-pointer transition-colors
                        ${item.isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-hover'}
                        ${isHighlighted ? 'bg-muted-bg' : ''}
                        ${isSelected ? 'bg-brand-primary/10' : ''}
                      `}
                    >
                      {hasMultipleColumns ? (
                        columns.map((column) => (
                          <div
                            key={column.fieldName}
                            className={`px-3 py-1.5 text-ui truncate ${ALIGNMENT_STYLES[column.alignment]}`}
                            style={{ width: column.width || 100, flexShrink: 0 }}
                          >
                            {renderColumnValue(item, column)}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-1.5 text-ui w-full whitespace-nowrap">
                          {lookupLabel(item)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          ) : (
            // Flat rendering
            items.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              const isSelected = item.value === String(value);

              return (
                <div
                  key={item.value}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => !item.isDisabled && handleSelect(item)}
                  className={`
                    flex items-center cursor-pointer transition-colors
                    ${item.isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-hover'}
                    ${isHighlighted ? 'bg-muted-bg' : ''}
                    ${isSelected ? 'bg-brand-primary/10' : ''}
                  `}
                >
                  {hasMultipleColumns ? (
                    columns.map((column) => (
                      <div
                        key={column.fieldName}
                        className={`px-3 py-1.5 text-ui truncate ${ALIGNMENT_STYLES[column.alignment]}`}
                        style={{ width: column.width || 100, flexShrink: 0 }}
                      >
                        {renderColumnValue(item, column)}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-1.5 text-ui w-full">
                      {lookupLabel(item)}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Empty */}
          {items.length === 0 && (
            <div className="px-3 py-4 text-ui text-center text-brand-text-muted">
              {'Nenhuma opção disponível'}
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Hint or Error */}
      {(error || editorModel.hintText) && (
        <p className={`mt-1 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
          {error || (editorModel.hintText ?? '')}
        </p>
      )}
    </div>
  );
}
