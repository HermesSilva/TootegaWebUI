/**
 * XBooleanEditor - Editor de Booleano
 * 
 * Suporta diferentes tipos de apresentação:
 * - Checkbox simples
 * - Toggle switch
 * - Radio buttons (Sim/Não)
 */

import { useCallback, useMemo, type JSX } from 'react';
import type { XDataEditor } from '@core/types';

// ============================================================================
// Types
// ============================================================================

interface XBooleanEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown) => void;
  error?: string;
  disabled?: boolean;
}

type BooleanStyle = 'checkbox' | 'toggle' | 'radio';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Converte valor para boolean
 */
function toBoolean(pValue: unknown): boolean {
  if (pValue === true || pValue === 1 || pValue === '1' || pValue === 'true')
    return true;

  return false;
}

// ============================================================================
// Component
// ============================================================================

export function XBooleanEditor({
  editor,
  value,
  onChange,
  error,
  disabled,
}: XBooleanEditorProps): JSX.Element {
  const editorModel = editor.editor;

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------

  const style: BooleanStyle = (editorModel.booleanStyle as BooleanStyle) || 'checkbox';
  const trueLabel = editorModel.booleanTrueLabel || 'Sim';
  const falseLabel = editorModel.booleanFalseLabel || 'Não';
  const translatedTitle = (editor.title ?? '');

  // ---------------------------------------------------------------------------
  // Computed Values
  // ---------------------------------------------------------------------------

  const isChecked = useMemo(() => toBoolean(value), [value]);
  const isDisabled = disabled || editorModel.isReadOnly;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleToggle = useCallback(() => {
    if (!isDisabled)
      onChange(!isChecked);
  }, [isDisabled, isChecked, onChange]);

  const handleRadioChange = useCallback((pValue: boolean) => {
    if (!isDisabled)
      onChange(pValue);
  }, [isDisabled, onChange]);

  // ---------------------------------------------------------------------------
  // Render: Checkbox
  // ---------------------------------------------------------------------------

  if (style === 'checkbox') {
    return (
      <div className="w-full">
        {/* Title label ABOVE, matching the other editors */}
        {translatedTitle && (
          <label
            htmlFor={editor.id}
            className="block text-ui font-medium text-brand-text-secondary mb-1"
          >
            {translatedTitle}
            {editorModel.isRequired && <span className="text-danger ml-1">*</span>}
          </label>
        )}

        {/* Bordered field box (same height/shape as inputs) holding a toggle + state text */}
        <button
          type="button"
          id={editor.id}
          role="switch"
          aria-checked={isChecked ? 'true' : 'false'}
          onClick={handleToggle}
          disabled={isDisabled}
          className={`
            w-full h-editor px-3 flex items-center gap-3 rounded-lg border bg-brand-surface
            transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary
            ${error ? 'border-danger' : 'border-border'}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-brand-primary/60'}
          `}
        >
          <span
            className={`
              relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors
              ${isChecked ? 'bg-brand-primary' : 'bg-active'}
            `}
          >
            <span
              className={`
                inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform
                ${isChecked ? 'translate-x-[18px]' : 'translate-x-[3px]'}
              `}
            />
          </span>
          <span className="text-ui text-brand-text-primary">
            {isChecked ? trueLabel : falseLabel}
          </span>
        </button>

        {/* Hint or Error */}
        {(error || editorModel.hintText) && (
          <p className={`mt-1.5 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
            {error || (editorModel.hintText ?? '')}
          </p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Toggle
  // ---------------------------------------------------------------------------

  if (style === 'toggle') {
    return (
      <div className="w-full">
        {/* Label acima se existir */}
        {translatedTitle && (
          <label
            htmlFor={editor.id}
            className="block text-ui font-medium text-brand-text-secondary mb-1"
          >
            {translatedTitle}
            {editorModel.isRequired && (
              <span className="text-danger ml-1">*</span>
            )}
          </label>
        )}

        {/* Toggle */}
        <button
          type="button"
          id={editor.id}
          role="switch"
          aria-checked={isChecked}
          onClick={handleToggle}
          disabled={isDisabled}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full
            transition-colors focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2
            ${isChecked ? 'bg-brand-primary' : 'bg-active'}
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            ${error ? 'ring-2 ring-danger' : ''}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-brand-surface shadow-sm
              transition-transform
              ${isChecked ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>

        {/* True/False Labels */}
        <span className="ml-3 text-ui text-brand-text-secondary">
          {isChecked ? trueLabel : falseLabel}
        </span>

        {/* Hint or Error */}
        {(error || editorModel.hintText) && (
          <p className={`mt-1.5 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
            {error || (editorModel.hintText ?? '')}
          </p>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Radio
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* Label */}
      {translatedTitle && (
        <label className="block text-ui font-medium text-brand-text-secondary mb-2">
          {translatedTitle}
          {editorModel.isRequired && (
            <span className="text-danger ml-1">*</span>
          )}
        </label>
      )}

      {/* Radio Group */}
      <div className="flex gap-4">
        {/* True Option */}
        <label
          className={`
            flex items-center gap-2 cursor-pointer
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            type="radio"
            name={editor.id}
            checked={isChecked === true}
            onChange={() => handleRadioChange(true)}
            disabled={isDisabled}
            className="sr-only peer"
          />
          <div
            className={`
              w-4 h-4 rounded-full border-2 transition-colors
              flex items-center justify-center
              peer-focus:ring-2 peer-focus:ring-brand-primary peer-focus:ring-offset-2
              ${isChecked === true
                ? 'border-brand-primary'
                : 'border-border'
              }
              ${error ? 'border-danger' : ''}
            `}
          >
            {isChecked === true && (
              <div className="w-2 h-2 rounded-full bg-brand-primary" />
            )}
          </div>
          <span className="text-ui text-brand-text-primary">{trueLabel}</span>
        </label>

        {/* False Option */}
        <label
          className={`
            flex items-center gap-2 cursor-pointer
            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input
            type="radio"
            name={editor.id}
            checked={isChecked === false}
            onChange={() => handleRadioChange(false)}
            disabled={isDisabled}
            className="sr-only peer"
          />
          <div
            className={`
              w-4 h-4 rounded-full border-2 transition-colors
              flex items-center justify-center
              peer-focus:ring-2 peer-focus:ring-brand-primary peer-focus:ring-offset-2
              ${isChecked === false
                ? 'border-brand-primary'
                : 'border-border'
              }
              ${error ? 'border-danger' : ''}
            `}
          >
            {isChecked === false && (
              <div className="w-2 h-2 rounded-full bg-brand-primary" />
            )}
          </div>
          <span className="text-ui text-brand-text-primary">{falseLabel}</span>
        </label>
      </div>

      {/* Hint or Error */}
      {(error || editorModel.hintText) && (
        <p className={`mt-1.5 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
          {error || (editorModel.hintText ?? '')}
        </p>
      )}
    </div>
  );
}
