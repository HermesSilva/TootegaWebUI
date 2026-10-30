/**
 * XNumberEditor - Editor de Números
 *
 * Campo numérico com:
 * - Inteiros (casas = 0) e decimais (casas do modelo, ou livres)
 * - Min/max
 * - Formatação no locale ENQUANTO se digita — a mesma máscara de toda a plataforma
 *   (`useMascaraNumerica`, dono 2026-10-12). Até aqui este editor NUNCA mostrava o milhar, porque o
 *   ponto era aceito como decimal e um "1.234" seria lido como 1,234; a máscara resolve a ambiguidade
 *   pela origem do ponto (digitado = decimal, posto pela máscara = milhar) e o milhar voltou.
 */

import { type JSX } from 'react';
import { Hash, X } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { XReadOnlyValue } from './XReadOnlyValue';
import { formatarValor, numeroOuIndefinido } from './mascaraNumerica';
import { useMascaraNumerica } from './useMascaraNumerica';

// ============================================================================
// Types
// ============================================================================

interface XNumberEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function XNumberEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XNumberEditorProps): JSX.Element {
  const editorModel = editor.editor;

  const decimalPlaces = editorModel.decimalPlaces;
  const minValue = numeroOuIndefinido(editorModel.minValue);
  const maxValue = numeroOuIndefinido(editorModel.maxValue);

  const mascara = useMascaraNumerica({
    valor: value,
    aoMudar: onChange,
    casas: decimalPlaces,
    // Sem mínimo declarado o número pode ser negativo (saldo, ajuste); com mínimo em zero ou acima,
    // o sinal nem entra — o campo não deixa o operador errar.
    permiteNegativo: minValue === undefined || minValue < 0,
    minimo: minValue,
    maximo: maxValue,
  });

  const handleRevert = (): void => {
    const originalNum = numeroOuIndefinido(originalValue);
    mascara.reexibir(originalNum);
    onChange(originalNum ?? null);
  };

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  const normalizedValue = numeroOuIndefinido(value);
  const normalizedOriginal = numeroOuIndefinido(originalValue);
  const hasChanged = normalizedValue !== normalizedOriginal;
  const showRevertButton = hasChanged && !disabled && !editorModel.isReadOnly;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hashIcon = (
    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
  );

  // Somente-leitura: texto formatado no locale, com as casas do modelo (duas quando não declaradas).
  if (disabled || editorModel.isReadOnly)
    return (
      <XReadOnlyValue
        editor={editor}
        icon={hashIcon}
        display={normalizedValue !== undefined ? formatarValor(normalizedValue, decimalPlaces ?? 2) : ''}
        error={error}
        alignRight
      />
    );

  return (
    <div className="w-full">
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      {/* Input Container */}
      <div className="relative">
        {/* Hash Icon */}
        {hashIcon}

        {/* Input */}
        <input
          ref={mascara.inputRef}
          id={editor.id}
          type="text"
          inputMode={decimalPlaces === 0 ? 'numeric' : 'decimal'}
          value={mascara.texto}
          onChange={mascara.aoDigitar}
          onFocus={mascara.aoFocar}
          onBlur={mascara.aoSair}
          placeholder={(editorModel.placeholderText ?? '')}
          disabled={disabled || editorModel.isReadOnly}
          className={`
            w-full h-editor pl-10 ${showRevertButton ? 'pr-8' : 'pr-4'}
            text-ui text-right rounded-lg border
            bg-brand-surface text-brand-text-primary
            placeholder:text-brand-text-muted
            focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted-bg
            ${error ? 'border-danger focus:ring-danger' : 'border-border'}
          `}
        />

        {/* Revert Button */}
        {showRevertButton && (
          <button
            type="button"
            onClick={handleRevert}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-hover rounded"
            tabIndex={-1}
            title={'Desfazer alteração'}
          >
            <X className="w-3 h-3 text-brand-text-muted" />
          </button>
        )}
      </div>

      {/* Hint or Error */}
      {(error || editorModel.hintText) && (
        <p className={`mt-1 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
          {error || (editorModel.hintText ?? '')}
        </p>
      )}

      {/* Range hint */}
      {!error && !editorModel.hintText && (minValue !== undefined || maxValue !== undefined) && (
        <p className="mt-1 text-ui-xs text-brand-text-muted">
          {minValue !== undefined && maxValue !== undefined
            ? `Entre ${formatarValor(minValue, decimalPlaces)} e ${formatarValor(maxValue, decimalPlaces)}`
            : minValue !== undefined
              ? `Mínimo: ${formatarValor(minValue, decimalPlaces)}`
              : `Máximo: ${formatarValor(maxValue, decimalPlaces)}`
          }
        </p>
      )}
    </div>
  );
}
