/**
 * XDateEditor - Editor de Data
 * 
 * Campo de data do motor (`XCampoDeData`): digitação com máscara `dd/mm/aaaa` e calendário do sistema, com data
 * mínima e máxima. O valor entregue ao formulário é a data ISO (`aaaa-mm-dd`), ou nulo quando o campo está vazio.
 */

import { useCallback, useMemo, type JSX } from 'react';
import { Calendar, X } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { XReadOnlyValue } from './XReadOnlyValue';
import { XCampoDeData } from './XCampoDeData';
import { formatDate, getDateFormat } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

interface XDateEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converte valor para formato ISO (YYYY-MM-DD) para o input
 */
function toISODateString(pValue: unknown): string {
  if (!pValue)
    return '';

  // Se já é uma string ISO
  if (typeof pValue === 'string') {
    // Tenta extrair a parte da data
    const dateMatch = pValue.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch)
      return dateMatch[0];

    // Tenta parsear como data
    const date = new Date(pValue);
    if (!isNaN(date.getTime()))
      return date.toISOString().split('T')[0];

    return '';
  }

  // Se é um Date
  if (pValue instanceof Date) {
    if (!isNaN(pValue.getTime()))
      return pValue.toISOString().split('T')[0];

    return '';
  }

  // Se é timestamp
  if (typeof pValue === 'number') {
    const date = new Date(pValue);
    if (!isNaN(date.getTime()))
      return date.toISOString().split('T')[0];

    return '';
  }

  return '';
}

// ============================================================================
// Component
// ============================================================================

export function XDateEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XDateEditorProps): JSX.Element {
  const editorModel = editor.editor;

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const inputValue = useMemo(() => toISODateString(value), [value]);

  const minDate = useMemo(() => {
    if (editorModel.minValue)
      return toISODateString(editorModel.minValue);

    return undefined;
  }, [editorModel.minValue]);

  const maxDate = useMemo(() => {
    if (editorModel.maxValue)
      return toISODateString(editorModel.maxValue);

    return undefined;
  }, [editorModel.maxValue]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // Propaga como string ISO ou null
  const handleChange = useCallback((pValor: string) => onChange(pValor || null), [onChange]);

  const handleRevert = useCallback(() => {
    const originalDate = toISODateString(originalValue);
    onChange(originalDate || null);
  }, [onChange, originalValue]);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const originalInputValue = useMemo(() => toISODateString(originalValue), [originalValue]);
  const hasChanged = inputValue !== originalInputValue;
  const showRevertButton = hasChanged && !disabled && !editorModel.isReadOnly;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const calendarIcon = (
    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
  );

  // Read-only: render locale-formatted static text (native input ignores app locale)
  if (disabled || editorModel.isReadOnly)
    return (
      <XReadOnlyValue
        editor={editor}
        icon={calendarIcon}
        display={value ? formatDate(value, editor.format || getDateFormat('date')) : ''}
        error={error}
      />
    );

  return (
    <div className="w-full">
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      <XCampoDeData
        tipo="data" id={editor.id} valor={inputValue} aoMudar={handleChange}
        minimo={minDate} maximo={maxDate} comErro={!!error} comBotaoADireita={showRevertButton}
      >
        {/* Revert Button */}
        {showRevertButton && (
          <button
            type="button"
            onClick={handleRevert}
            className="absolute right-9 top-1/2 -translate-y-1/2 p-1 hover:bg-hover rounded"
            tabIndex={-1}
            title={'Desfazer alteração'}
          >
            <X className="w-3 h-3 text-brand-text-muted" />
          </button>
        )}
      </XCampoDeData>

      {/* Hint or Error */}
      {(error || editorModel.hintText) && (
        <p className={`mt-1 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
          {error || (editorModel.hintText ?? '')}
        </p>
      )}
    </div>
  );
}
