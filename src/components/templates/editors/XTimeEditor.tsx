/**
 * XTimeEditor - Editor de Hora
 * 
 * Campo de hora do motor (`XCampoDeData`): digitação com máscara `hh:mm` e escolha de hora e minuto do sistema, com
 * mínimo e máximo. O valor entregue ao formulário é `hh:mm`, ou nulo quando o campo está vazio.
 */

import { useCallback, useMemo, type JSX } from 'react';
import { Clock, X } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { XReadOnlyValue } from './XReadOnlyValue';
import { XCampoDeData } from './XCampoDeData';
import { formatTime, getDateFormat } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

interface XTimeEditorProps {
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
 * Converte valor para formato time (HH:mm)
 */
function toTimeString(pValue: unknown): string {
  if (!pValue)
    return '';

  // Se já é uma string de hora (HH:mm ou HH:mm:ss)
  if (typeof pValue === 'string') {
    const timeMatch = pValue.match(/^(\d{2}):(\d{2})/);
    if (timeMatch)
      return `${timeMatch[1]}:${timeMatch[2]}`;

    // Tenta parsear como data
    const date = new Date(pValue);
    if (!isNaN(date.getTime())) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }

    return '';
  }

  // Se é um Date
  if (pValue instanceof Date) {
    if (!isNaN(pValue.getTime())) {
      const hours = String(pValue.getHours()).padStart(2, '0');
      const minutes = String(pValue.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    return '';
  }

  return '';
}

// ============================================================================
// Component
// ============================================================================

export function XTimeEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XTimeEditorProps): JSX.Element {
  const editorModel = editor.editor;

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const inputValue = useMemo(() => toTimeString(value), [value]);

  const minTime = useMemo(() => {
    if (editorModel.minValue)
      return toTimeString(editorModel.minValue);

    return undefined;
  }, [editorModel.minValue]);

  const maxTime = useMemo(() => {
    if (editorModel.maxValue)
      return toTimeString(editorModel.maxValue);

    return undefined;
  }, [editorModel.maxValue]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // Propaga como string HH:mm ou null
  const handleChange = useCallback((pValor: string) => onChange(pValor || null), [onChange]);

  const handleRevert = useCallback(() => {
    const originalTime = toTimeString(originalValue);
    onChange(originalTime || null);
  }, [onChange, originalValue]);

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const originalInputValue = useMemo(() => toTimeString(originalValue), [originalValue]);
  const hasChanged = inputValue !== originalInputValue;
  const showRevertButton = hasChanged && !disabled && !editorModel.isReadOnly;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const clockIcon = (
    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
  );

  // Read-only: render locale-formatted static text (native input ignores app locale)
  if (disabled || editorModel.isReadOnly)
    return (
      <XReadOnlyValue
        editor={editor}
        icon={clockIcon}
        display={value ? formatTime(value, editor.format || getDateFormat('time')) : ''}
        error={error}
      />
    );

  return (
    <div className="w-full">
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      <XCampoDeData
        tipo="hora" id={editor.id} valor={inputValue} aoMudar={handleChange}
        minimo={minTime} maximo={maxTime} comErro={!!error} comBotaoADireita={showRevertButton}
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
