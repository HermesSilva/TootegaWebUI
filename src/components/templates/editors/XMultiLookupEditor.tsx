/**
 * XMultiLookupEditor - Multi-Select Lookup with Async Search
 *
 * Allows selecting one or more items from an async lookup endpoint.
 * Selected items are displayed as removable pills.
 * Value is stored as comma-separated string.
 */

import { useState, useRef, useCallback, useMemo, useEffect, type JSX } from 'react';
import { Search, X, Loader2, ChevronDown } from 'lucide-react';
import type { XDataEditor, XLookupItem } from '@core/types';
import { useLookupSearch } from '@core/hooks/useApplication';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { XEditorLabel } from './XEditorLabel';

// ============================================================================
// Types
// ============================================================================

interface XMultiLookupEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown, pBindings?: Record<string, unknown>) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function parseSelectedValues(pValue: unknown): string[] {
  if (!pValue || pValue === '')
    return [];

  if (typeof pValue === 'string')
    return pValue.split(',').map(v => v.trim()).filter(Boolean);

  return [];
}

// ============================================================================
// Component
// ============================================================================

export function XMultiLookupEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XMultiLookupEditorProps): JSX.Element {
  const editorModel = editor.editor;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const minSearchLength = editorModel.lookupMinSearchLength ?? 2;
  const searchDelay = editorModel.lookupSearchDelay ?? 300;
  const apiEndpoint = editorModel.lookupEndpoint || '';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownZIndex] = useState(() => ZIndexManager.next());

  // ---------------------------------------------------------------------------
  // Selected Values (derived from value prop)
  // ---------------------------------------------------------------------------

  const selectedValues = useMemo(() => parseSelectedValues(value), [value]);

  // ---------------------------------------------------------------------------
  // Debounced Search
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (searchTerm.length < minSearchLength) {
      setDebouncedSearch('');
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, searchDelay);

    return () => clearTimeout(timer);
  }, [searchTerm, minSearchLength, searchDelay]);

  // ---------------------------------------------------------------------------
  // API Search
  // ---------------------------------------------------------------------------

  const shouldSearch = debouncedSearch.length >= minSearchLength && !!apiEndpoint;

  const {
    data: searchResults,
    isLoading,
    isFetching,
  } = useLookupSearch({
    endpoint: apiEndpoint,
    searchText: debouncedSearch,
    minLength: minSearchLength,
    enabled: shouldSearch,
  });

  const allItems = useMemo((): XLookupItem[] => {
    if (!searchResults?.items)
      return [];

    return searchResults.items.map((item): XLookupItem => ({
      value: String(item.value ?? ''),
      text: String(item.text ?? ''),
      group: String(item.group ?? ''),
      isDisabled: Boolean(item.isDisabled),
      columns: item.columns as Record<string, unknown>,
    }));
  }, [searchResults]);

  // Filter out already-selected items
  const availableItems = useMemo(() => {
    const selected = new Set(selectedValues);
    return allItems.filter(item => !selected.has(item.value));
  }, [allItems, selectedValues]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setHighlightedIndex(-1);

    if (!isOpen && (newValue.length > 0 || minSearchLength === 0))
      setIsOpen(true);
  }, [isOpen, minSearchLength]);

  const handleFocus = useCallback(() => {
    if (minSearchLength === 0) {
      setSearchTerm('');
      setDebouncedSearch('');
      setIsOpen(true);
    } else if (availableItems.length > 0 || searchTerm.length >= minSearchLength) {
      setIsOpen(true);
    }
  }, [availableItems.length, searchTerm.length, minSearchLength]);

  const handleSelect = useCallback((pItem: XLookupItem) => {
    const newSelected = [...selectedValues, pItem.value];
    const newValue = newSelected.join(',');

    setSearchTerm('');
    setDebouncedSearch('');
    setHighlightedIndex(-1);
    onChange(newValue, undefined);

    // Keep dropdown open and refocus for quick multi-select
    inputRef.current?.focus();
  }, [selectedValues, onChange]);

  const handleRemove = useCallback((pValue: string) => {
    const newSelected = selectedValues.filter(v => v !== pValue);
    const newValue = newSelected.join(',');
    onChange(newValue || '', undefined);
  }, [selectedValues, onChange]);

  const handleClearAll = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearch('');
    onChange('', undefined);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled || editorModel.isReadOnly)
      return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && availableItems[highlightedIndex])
          handleSelect(availableItems[highlightedIndex]);
        break;

      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          if (availableItems.length > 0 || minSearchLength === 0)
            setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < availableItems.length - 1 ? prev + 1 : prev
          );
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (isOpen)
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;

      case 'Backspace':
        if (searchTerm === '' && selectedValues.length > 0)
          handleRemove(selectedValues[selectedValues.length - 1]);
        break;

      case 'Home':
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(0);
        }
        break;

      case 'End':
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(availableItems.length - 1);
        }
        break;
    }
  }, [disabled, editorModel.isReadOnly, isOpen, highlightedIndex, availableItems,
    handleSelect, minSearchLength, searchTerm, selectedValues, handleRemove]);

  // ---------------------------------------------------------------------------
  // Click Outside
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isOpen)
      return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
  // Computed
  // ---------------------------------------------------------------------------

  const showDropdown = isOpen && (
    availableItems.length > 0 ||
    isLoading ||
    isFetching ||
    (searchTerm.length > 0 && searchTerm.length < minSearchLength)
  );

  const normalizedOriginal = useMemo(() => parseSelectedValues(originalValue), [originalValue]);
  const hasChanged = JSON.stringify(selectedValues) !== JSON.stringify(normalizedOriginal);
  const showRevertButton = hasChanged && !disabled && !editorModel.isReadOnly && selectedValues.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full relative" ref={containerRef}>
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      {/* Input Container */}
      <div
        className={`
          relative flex flex-wrap items-center gap-1
          min-h-editor px-2 py-1
          rounded-lg border
          bg-brand-surface text-brand-text-primary
          focus-within:ring-2 focus-within:ring-brand-primary focus-within:border-transparent
          ${disabled || editorModel.isReadOnly ? 'opacity-50 cursor-not-allowed bg-muted-bg' : 'cursor-text'}
          ${error ? 'border-danger focus-within:ring-danger' : 'border-border'}
        `}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Search Icon */}
        <Search className="w-4 h-4 text-brand-text-muted flex-shrink-0" />

        {/* Selected Pills */}
        {selectedValues.map(val => (
          <span
            key={val}
            className="
              inline-flex items-center gap-1
              px-2 py-0.5 rounded-full
              bg-brand-primary/15 text-brand-primary
              text-ui-xs font-medium
              max-w-[140px]
            "
          >
            <span className="truncate">{val}</span>
            {!disabled && !editorModel.isReadOnly && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(val); }}
                className="flex-shrink-0 -mr-1 p-1 rounded-full hover:text-danger hover:bg-danger-bg transition-colors"
                tabIndex={-1}
                aria-label={'Remover'}
                title={'Remover'}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}

        {/* Search Input */}
        <input
          ref={inputRef}
          id={editor.id}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={selectedValues.length === 0
            ? ((editorModel.placeholderText ?? '') || 'Digite para pesquisar...')
            : ''
          }
          disabled={disabled || editorModel.isReadOnly}
          className="
            flex-1 min-w-[80px] h-[28px]
            bg-transparent text-ui
            placeholder:text-brand-text-muted
            focus:outline-none
            disabled:cursor-not-allowed
          "
        />

        {/* Loading Indicator */}
        {(isLoading || isFetching) && (
          <Loader2 className="w-4 h-4 text-brand-primary animate-spin flex-shrink-0" />
        )}

        {/* Clear All Button */}
        {showRevertButton && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClearAll(); }}
            className="flex-shrink-0 p-1 hover:bg-hover rounded"
            tabIndex={-1}
            aria-label={'Limpar'}
            title={'Limpar'}
          >
            <X className="w-3.5 h-3.5 text-brand-text-muted" />
          </button>
        )}

        {/* Dropdown Arrow */}
        <ChevronDown
          className={`
            w-4 h-4 text-brand-text-muted transition-transform flex-shrink-0
            ${isOpen ? 'rotate-180' : ''}
          `}
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={listRef}
          role="listbox"
          style={{ zIndex: dropdownZIndex }}
          className="
            absolute mt-1 min-w-full w-max max-w-[80vw]
            bg-brand-surface border border-border rounded-lg shadow-lg
            max-h-[300px] overflow-auto
          "
        >
          {/* Loading State */}
          {(isLoading || isFetching) && availableItems.length === 0 && (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-ui text-brand-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{'Pesquisando...'}</span>
            </div>
          )}

          {/* Min Length Warning */}
          {searchTerm.length > 0 && searchTerm.length < minSearchLength && !isLoading && (
            <div className="px-3 py-4 text-ui text-center text-brand-text-muted">
              {`Digite pelo menos ${minSearchLength} caracteres para pesquisar`}
            </div>
          )}

          {/* No Results */}
          {!isLoading && !isFetching && debouncedSearch.length >= minSearchLength && availableItems.length === 0 && (
            <div className="px-3 py-4 text-ui text-center text-brand-text-muted">
              {'Nenhum resultado encontrado'}
            </div>
          )}

          {/* Results */}
          {availableItems.map((item, index) => {
            const isHighlighted = index === highlightedIndex;

            return (
              <div
                key={item.value}
                data-index={index}
                role="option"
                aria-selected={false}
                onClick={() => !item.isDisabled && handleSelect(item)}
                className={`
                  flex items-center cursor-pointer transition-colors px-3 py-2 text-ui whitespace-nowrap
                  ${item.isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-hover'}
                  ${isHighlighted ? 'bg-muted-bg' : ''}
                `}
              >
                {item.text}
              </div>
            );
          })}
        </div>
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
