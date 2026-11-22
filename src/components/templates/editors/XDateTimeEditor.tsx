/**
 * XDateTimeEditor - Editor de Data e Hora
 * 
 * Campo de data e hora do motor (`XCampoDeData`): digitação com máscara `dd/mm/aaaa hh:mm`, calendário e escolha de
 * hora do sistema, com mínimo e máximo. O valor entregue ao formulário é o instante ISO, ou nulo quando vazio.
 */

import { useCallback, useMemo, type JSX } from 'react';
import { Calendar } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { XCampoDeData } from './XCampoDeData';
import { XReadOnlyValue } from './XReadOnlyValue';
import { formatDateTime, getDateFormat } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

interface XDateTimeEditorProps {
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
 * Converte valor para formato datetime-local (YYYY-MM-DDTHH:mm)
 */
function toDateTimeLocalString(pValue: unknown): string {
  if (!pValue)
    return '';

  // Se já é uma string ISO
  if (typeof pValue === 'string') {
    const date = new Date(pValue);
    if (!isNaN(date.getTime())) {
      // Formata para datetime-local (sem segundos e timezone)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    return '';
  }

  // Se é um Date
  if (pValue instanceof Date) {
    if (!isNaN(pValue.getTime())) {
      const year = pValue.getFullYear();
      const month = String(pValue.getMonth() + 1).padStart(2, '0');
      const day = String(pValue.getDate()).padStart(2, '0');
      const hours = String(pValue.getHours()).padStart(2, '0');
      const minutes = String(pValue.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    return '';
  }

  // Se é timestamp
  if (typeof pValue === 'number') {
    const date = new Date(pValue);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    return '';
  }

  return '';
}

// ============================================================================
// Component
// ============================================================================

export function XDateTimeEditor({
  editor,
  value,
  onChange,
  error,
  disabled,
}: XDateTimeEditorProps): JSX.Element {
  const editorModel = editor.editor;

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const inputValue = useMemo(() => toDateTimeLocalString(value), [value]);

  const minDateTime = useMemo(() => {
    if (editorModel.minValue)
      return toDateTimeLocalString(editorModel.minValue);

    return undefined;
  }, [editorModel.minValue]);

  const maxDateTime = useMemo(() => {
    if (editorModel.maxValue)
      return toDateTimeLocalString(editorModel.maxValue);

    return undefined;
  }, [editorModel.maxValue]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleChange = useCallback((newValue: string) => {
    // Converte para ISO com timezone
    if (newValue) {
      const date = new Date(newValue);
      onChange(date.toISOString());
    } else {
      onChange(null);
    }
  }, [onChange]);

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
        display={value ? formatDateTime(value, editor.format || getDateFormat('dateTime')) : ''}
        error={error}
      />
    );

  return (
    <div className="w-full">
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      <XCampoDeData
        tipo="dataHora" id={editor.id} valor={inputValue} aoMudar={handleChange}
        minimo={minDateTime} maximo={maxDateTime} comErro={!!error}
      />

      {/* Hint or Error */}
      {(error || editorModel.hintText) && (
        <p className={`mt-1 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
          {error || (editorModel.hintText ?? '')}
        </p>
      )}
    </div>
  );
}
