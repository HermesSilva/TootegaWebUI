/**
 * XColorEditor - Editor de Cor
 * 
 * Campo de seleção de cor com:
 * - Color picker nativo
 * - Preview da cor selecionada
 * - Input para valor hexadecimal
 */

import { useState, useCallback, useEffect, type JSX, type ChangeEvent } from 'react';
import { Palette } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';

// ============================================================================
// Types
// ============================================================================

interface XColorEditorProps {
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
 * Valida e normaliza cor hexadecimal
 */
function normalizeHexColor(pValue: string): string {
  if (!pValue)
    return '#000000';

  let hex = pValue.replace('#', '');

  // Expande formato curto (fff -> ffffff)
  if (hex.length === 3)
    hex = hex.split('').map(c => c + c).join('');

  // Valida
  if (/^[0-9A-Fa-f]{6}$/.test(hex))
    return `#${hex.toLowerCase()}`;

  return '#000000';
}

// ============================================================================
// Component
// ============================================================================

export function XColorEditor({
  editor,
  value,
  onChange,
  error,
  disabled,
}: XColorEditorProps): JSX.Element {
  const editorModel = editor.editor;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [displayValue, setDisplayValue] = useState('#000000');
  const isDisabled = disabled || editorModel.isReadOnly;

  // ---------------------------------------------------------------------------
  // Initialize Display Value
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (value) {
      setDisplayValue(normalizeHexColor(String(value)));
    } else {
      setDisplayValue('#000000');
    }
  }, [value]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleColorChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const handleTextChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;

    // Permite digitação parcial
    if (rawValue.startsWith('#') && rawValue.length <= 7) {
      setDisplayValue(rawValue);

      // Se for um hex válido completo, propaga
      if (/^#[0-9A-Fa-f]{6}$/.test(rawValue))
        onChange(rawValue);
    } else if (!rawValue.startsWith('#') && rawValue.length <= 6) {
      setDisplayValue(`#${rawValue}`);

      if (/^[0-9A-Fa-f]{6}$/.test(rawValue))
        onChange(`#${rawValue}`);
    }
  }, [onChange]);

  const handleTextBlur = useCallback(() => {
    // Normaliza ao sair do campo
    const normalized = normalizeHexColor(displayValue);
    setDisplayValue(normalized);
    onChange(normalized);
  }, [displayValue, onChange]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      {/* Input Container */}
      <div className="relative flex items-center gap-2">
        {/* Color Picker */}
        <div className="relative flex-shrink-0">
          <input
            type="color"
            value={displayValue}
            onChange={handleColorChange}
            disabled={isDisabled}
            className={`
              w-10 h-editor p-0 border-0 cursor-pointer rounded-lg
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            style={{
              backgroundColor: displayValue,
            }}
          />
          {/* Color Preview Overlay */}
          <div
            className="absolute inset-0 rounded-lg border border-border pointer-events-none"
            style={{ backgroundColor: displayValue }}
          />
        </div>

        {/* Hex Input */}
        <div className="relative flex-1">
          <Palette className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
          <input
            id={editor.id}
            type="text"
            value={displayValue}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            placeholder="#000000"
            maxLength={7}
            disabled={isDisabled}
            className={`
              w-full h-editor pl-10 pr-4
              text-ui rounded-lg border font-mono
              bg-brand-surface text-brand-text-primary
              placeholder:text-brand-text-muted
              focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted-bg
              ${error ? 'border-danger focus:ring-danger' : 'border-border'}
            `}
          />
        </div>
      </div>

      {/* Hint or Error */}
      {(error || editorModel.hintText) && (
        <p className={`mt-1 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
          {error || (editorModel.hintText ?? '')}
        </p>
      )}
    </div>
  );
}
