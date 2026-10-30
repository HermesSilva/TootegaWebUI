/**
 * XLookupEditor - Campo com Pesquisa Assíncrona
 * 
 * Campo de lookup com:
 * - Pesquisa assíncrona via API
 * - Debounce configurável
 * - Múltiplas colunas com header
 * - Field bindings (alimentar múltiplos campos ao selecionar)
 * - Indicador de loading
 */

import { useState, useRef, useCallback, useMemo, useEffect, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, ChevronDown } from 'lucide-react';
import type { XDataEditor, XLookupItem, XLookupColumn, XFieldAlignment } from '@core/types';
import { useLookupSearch } from '@core/hooks/useApplication';
import { api } from '@core/lib/api';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { usePosicaoFlutuante } from '@core/hooks/usePosicaoFlutuante';
import { XEditorLabel } from './XEditorLabel';

// ============================================================================
// Types
// ============================================================================

interface XLookupEditorProps {
  editor: XDataEditor;
  value: unknown;
  /** Texto do valor guardado (a chave). É o que se mostra ao abrir um registro para edição. */
  displayText?: unknown;
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

export function XLookupEditor({
  editor,
  value,
  displayText,
  originalValue,
  onChange,
  error,
  disabled,
}: XLookupEditorProps): JSX.Element {
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

  // TRAVADO: desabilitado por fora, só-leitura fixo, OU só-leitura-quando-preenchido com valor presente
  // (a conta da baixa que veio do boleto — não se troca; mas parcela sem boleto deixa o campo vazio e
  // editável). Um só predicado, para todos os pontos que decidem se o campo aceita interação.
  const travado = Boolean(disabled) || editorModel.isReadOnly
    || Boolean(editorModel.readOnlyWhenFilled && value !== undefined && value !== null && String(value).length > 0);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<XLookupItem | null>(null);
  // O z-index é pedido A CADA ABERTURA, não na montagem: o modal pede o dele QUANDO ABRE, e um editor
  // montado dentro dele já nasceu com número MENOR — a lista ficava atrás do modal. É o que o
  // XComboBoxEditor já fazia; aqui faltava, e era a causa do dropdown "por baixo".
  const [dropdownZIndex, setDropdownZIndex] = useState(() => ZIndexManager.next());

  // Posição da lista na JANELA (o portal usa position: fixed). Mesmo desenho do XComboBoxEditor, que já
  // resolvia isto: dentro do modal, o corpo rolável recorta a lista e o rodapé fica por cima — z-index
  // não salva, porque o contexto de empilhamento é o do modal. Nasce com valores, nunca nula: uma versão
  // anterior condicionava o render à medida e, no primeiro quadro, a lista simplesmente não aparecia.
  //
  // Onde ela abre: abaixo; não coube ⇒ acima, direita, esquerda (dono, 2026-10-23). A regra é uma só,
  // no usePosicaoFlutuante, que também acompanha a rolagem de ancestrais e o redimensionamento.
  const { posicao: dropdownPosition } = usePosicaoFlutuante(isOpen, containerRef, listRef, { alturaMaxima: 300 });

  useEffect(() => {
    if (isOpen)
      setDropdownZIndex(ZIndexManager.next());
  }, [isOpen]);

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

  const items = useMemo((): XLookupItem[] => {
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

  // ---------------------------------------------------------------------------
  // Columns Configuration
  // ---------------------------------------------------------------------------

  const columns = useMemo(() => {
    const cols = editorModel.lookupColumns || [];
    return cols.filter((c) => c.isVisible);
  }, [editorModel.lookupColumns]);

  const hasMultipleColumns = columns.length > 1;
  const showHeader = editorModel.lookupShowHeader && hasMultipleColumns;

  // ---------------------------------------------------------------------------
  // Initialize Display Value from Current Value
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!value || selectedItem)
      return;

    // Registro carregado do servidor: o campo guarda a CHAVE (ex.: 9). Mostrar a chave seria mostrar um
    // número sem sentido ao usuário — por isso o modelo pode indicar o campo que traz o TEXTO
    // (displayValueField). Sem ele, resta exibir o próprio valor.
    const texto = typeof displayText === 'string' && displayText.length > 0
      ? displayText
      : String(value);

    setDisplayValue(texto);
  }, [value, displayText, selectedItem]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setDisplayValue(newValue);
    setSelectedItem(null);
    setHighlightedIndex(-1);

    if (!isOpen && newValue.length > 0)
      setIsOpen(true);

    // Se limpar o input, limpa o valor
    if (newValue === '') {
      onChange('', undefined);
    }
  }, [isOpen, onChange]);

  const handleSelect = useCallback((pItem: XLookupItem) => {
    // Valor principal
    const newValue = pItem.value;

    // Display value
    let display = pItem.text;
    if (editorModel.lookupDisplayField && pItem.columns) {
      display = String(pItem.columns[editorModel.lookupDisplayField] ?? pItem.text);
    }

    // Field bindings — a partir das colunas do próprio item.
    const bindings: Record<string, unknown> = {};
    if (editorModel.fieldBindings && pItem.columns) {
      for (const binding of editorModel.fieldBindings) {
        bindings[binding.targetField] = pItem.columns[binding.sourceField];
      }
    }

    // O TEXTO da escolha vai também para o campo de exibição (displayValueField), gravado no data do
    // formulário. Sem isto, o texto vive só no estado LOCAL do editor: ao trocar de aba o editor
    // desmonta, e ao voltar o data só tem a CHAVE — o campo reapareceria mostrando o id cru (o combo do
    // pedido mostrava "10" em vez do nome da condição). Com o texto no data, ele sobrevive à remontagem.
    if (editorModel.displayValueField)
      bindings[editorModel.displayValueField] = display;

    setSelectedItem(pItem);
    setDisplayValue(display);
    setSearchTerm('');
    setDebouncedSearch('');
    setIsOpen(false);
    setHighlightedIndex(-1);

    onChange(newValue, Object.keys(bindings).length > 0 ? bindings : undefined);

    // DETALHE do item escolhido: o que só se conhece depois da escolha (a alíquota do serviço no
    // município da empresa, por exemplo). Falha ou ausência não desfaz a seleção — o campo ligado
    // simplesmente não é preenchido, e a tela segue utilizável.
    const detalhe = editorModel.detailEndpoint;
    if (!detalhe || !newValue)
      return;

    void (async () => {
      try {
        const resposta = await api.get<Record<string, unknown>>(`${detalhe}/${encodeURIComponent(newValue)}`);

        const ligados: Record<string, unknown> = {};
        for (const binding of editorModel.fieldBindings ?? []) {
          const valor = resposta?.[binding.sourceField];
          if (valor !== undefined)
            ligados[binding.targetField] = valor;
        }

        if (Object.keys(ligados).length > 0)
          onChange(newValue, ligados);
      } catch {
        // Terceiro fora do ar: o serviço escolhido continua escolhido.
      }
    })();
  }, [editorModel.fieldBindings, editorModel.lookupDisplayField, editorModel.detailEndpoint, onChange]);

  // AUTO-SELEÇÃO do item ÚNICO (editorModel.lookupAutoSelectSingle): quando o back declara que uma lista
  // de um só elemento não é escolha a se pedir — uma conta de cobrança só —, o editor a seleciona
  // sozinho assim que a busca vazia resolve com exatamente UM item. Só age SEM valor ainda (não atropela
  // registro carregado nem escolha do usuário) e uma vez (o ref trava re-disparos). Dois ou mais ⇒ nada.
  const autoSelecionado = useRef(false);
  useEffect(() => {
    if (!editorModel.lookupAutoSelectSingle || autoSelecionado.current)
      return;
    if (value || selectedItem || isLoading || isFetching)
      return;
    if (items.length === 1) {
      autoSelecionado.current = true;
      handleSelect(items[0]);
    }
  }, [editorModel.lookupAutoSelectSingle, value, selectedItem, isLoading, isFetching, items, handleSelect]);

  const handleRevert = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(null);
    setDisplayValue(String(originalValue ?? ''));
    setSearchTerm('');
    setDebouncedSearch('');
    onChange(originalValue ?? '', undefined);
    inputRef.current?.focus();
  }, [onChange, originalValue]);

  // ---------------------------------------------------------------------------
  // Computed: Show Revert Button
  // ---------------------------------------------------------------------------

  const normalizedValue = String(value ?? '');
  const normalizedOriginal = String(originalValue ?? '');
  const hasChanged = normalizedValue !== normalizedOriginal;
  const showRevertButton = hasChanged && !travado;

  const handleFocus = useCallback(() => {
    if (minSearchLength === 0 && !debouncedSearch && !selectedItem) {
      setSearchTerm('');
      setDebouncedSearch('');
      setIsOpen(true);
    } else if (items.length > 0 || searchTerm.length >= minSearchLength) {
      setIsOpen(true);
    }
  }, [items.length, searchTerm.length, minSearchLength, debouncedSearch, selectedItem]);

  // Clique na seta: alterna o dropdown. Ao abrir, foca o input e — quando MinSearchLength=0
  // (catálogos pequenos, ex.: planos) — dispara a busca vazia para listar tudo, mesmo já havendo
  // item selecionado (permite trocar a escolha). O ícone antes NÃO tinha handler → não abria.
  const handleToggleDropdown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (travado)
      return;

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    inputRef.current?.focus();

    if (minSearchLength === 0 && !searchTerm) {
      setSearchTerm('');
      setDebouncedSearch('');
    }

    setIsOpen(true);
  }, [disabled, editorModel.isReadOnly, isOpen, minSearchLength, searchTerm]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (travado)
      return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && items[highlightedIndex])
          handleSelect(items[highlightedIndex]);
        break;

      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          if (items.length > 0)
            setIsOpen(true);
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

      // Home/End (e Shift+Home/End) NÃO são capturados: o campo é um input de texto e precisa
      // deles para mover o cursor / SELECIONAR texto. Interceptá-los quebrava a edição da busca.
    }
  }, [disabled, editorModel.isReadOnly, isOpen, highlightedIndex, items, handleSelect]);

  // ---------------------------------------------------------------------------
  // Click Outside
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const alvo = e.target as Node;

      // A lista vive num PORTAL, fora do container: sem esta checagem, o clique num item contaria como
      // "clique fora", o dropdown fecharia no mousedown e a seleção nunca chegaria a acontecer.
      if (listRef.current?.contains(alvo))
        return;

      if (containerRef.current && !containerRef.current.contains(alvo)) {
        setIsOpen(false);
        // Restaura o display value se não houver seleção
        if (selectedItem)
          setDisplayValue(selectedItem.text);
        else if (value)
          setDisplayValue(String(value));
        else
          setDisplayValue('');
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, selectedItem, value]);

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

    if (pColumn.fieldName === editorModel.lookupDisplayField || columns.indexOf(pColumn) === 0)
      return pItem.text;

    return '';
  }, [columns, editorModel.lookupDisplayField]);

  // ---------------------------------------------------------------------------
  // Show Dropdown
  // ---------------------------------------------------------------------------

  const showDropdown = isOpen && (
    items.length > 0 ||
    isLoading ||
    isFetching ||
    (searchTerm.length > 0 && searchTerm.length < minSearchLength)
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full relative" ref={containerRef}>
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      {/* Input Container */}
      <div className="relative">
        {/* Search Icon */}
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />

        {/* Input */}
        <input
          ref={inputRef}
          id={editor.id}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={(editorModel.placeholderText ?? '') || 'Digite para pesquisar...'}
          disabled={travado}
          className={`
            w-full h-editor pl-10 pr-20 
            text-ui rounded-lg border
            bg-brand-surface text-brand-text-primary
            placeholder:text-brand-text-muted
            focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted-bg
            ${error ? 'border-danger focus:ring-danger' : 'border-border'}
          `}
        />

        {/* Loading Indicator */}
        {(isLoading || isFetching) && (
          <Loader2 className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-primary animate-spin" />
        )}

        {/* Revert Button */}
        {showRevertButton && (
          <button
            type="button"
            onClick={handleRevert}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-hover rounded"
            tabIndex={-1}
            title={'Desfazer alteração'}
          >
            <X className="w-3 h-3 text-brand-text-muted" />
          </button>
        )}

        {/* Dropdown Arrow — clicável: abre/fecha a lista (antes era só ícone e não abria) */}
        <button
          type="button"
          onClick={handleToggleDropdown}
          disabled={travado}
          tabIndex={-1}
          aria-label={'Selecione...'}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-hover disabled:cursor-not-allowed"
        >
          <ChevronDown
            className={`
              w-4 h-4 text-brand-text-muted transition-transform
              ${isOpen ? 'rotate-180' : ''}
            `}
          />
        </button>
      </div>

      {/* Dropdown num PORTAL (mesmo desenho do XComboBoxEditor, que já funcionava): fora do modal, com
          posição fixa medida a partir do campo — assim não é recortado pelo corpo rolável nem coberto
          pelo rodapé de botões. */}
      {showDropdown && createPortal(
        <div
          ref={listRef}
          role="listbox"
          data-x-portal-dropdown=""
          className="
            fixed max-w-[80vw]
            bg-brand-surface border border-border rounded-lg shadow-lg
            overflow-auto
          "
          style={{
            zIndex: dropdownZIndex,
            top: dropdownPosition.top,
            bottom: dropdownPosition.bottom,
            left: dropdownPosition.left,
            visibility: dropdownPosition.medido ? undefined : 'hidden',
            width: hasMultipleColumns ? 'max-content' : dropdownPosition.larguraCampo,
            minWidth: hasMultipleColumns
              ? `${columns.reduce((sum, c) => sum + (c.width || 100), 0) + 20}px`
              : dropdownPosition.larguraCampo,
            maxHeight: dropdownPosition.maxHeight,
          }}
        >
          {/* Header */}
          {showHeader && items.length > 0 && (
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

          {/* Loading State */}
          {(isLoading || isFetching) && items.length === 0 && (
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
          {!isLoading && !isFetching && debouncedSearch.length >= minSearchLength && items.length === 0 && (
            <div className="px-3 py-4 text-ui text-center text-brand-text-muted">
              {'Nenhum resultado encontrado'}
            </div>
          )}

          {/* Results */}
          {items.map((item, index) => {
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
                      className={`px-3 py-2 text-ui truncate ${ALIGNMENT_STYLES[column.alignment]}`}
                      style={{ width: column.width || 100, flexShrink: 0 }}
                    >
                      {renderColumnValue(item, column)}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-ui w-full whitespace-nowrap">
                    {item.text}
                  </div>
                )}
              </div>
            );
          })}
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
