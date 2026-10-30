/**
 * XCurrencyEditor - Editor de Moeda
 *
 * Campo monetário com:
 * - Formatação no locale ENQUANTO se digita (máscara única do template, `useMascaraNumerica`)
 * - Casas decimais configuráveis (padrão 2)
 * - Alinhamento à direita
 *
 * Nada de máscara própria aqui (dono, 2026-10-12): moeda, número, percentual e as células da grade
 * formatam do mesmo jeito, e é o hook que o garante. Este editor só decide as casas, o sinal e os
 * limites. Negativo só quando o modelo declara mínimo abaixo de zero: dinheiro que entra num
 * formulário é positivo por natureza, e o sinal perdido num campo de preço é um estorno acidental.
 */

import { type JSX } from 'react';
import { X } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { numeroOuIndefinido } from './mascaraNumerica';
import { useMascaraNumerica } from './useMascaraNumerica';

// ============================================================================
// Types
// ============================================================================

interface XCurrencyEditorProps {
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

export function XCurrencyEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XCurrencyEditorProps): JSX.Element {
  const editorModel = editor.editor;

  const decimalPlaces = editorModel.decimalPlaces ?? 2;
  const minValue = numeroOuIndefinido(editorModel.minValue);
  const maxValue = numeroOuIndefinido(editorModel.maxValue);

  const mascara = useMascaraNumerica({
    valor: value,
    aoMudar: onChange,
    casas: decimalPlaces,
    permiteNegativo: minValue !== undefined && minValue < 0,
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

  return (
    <div className="w-full">
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      {/* Input Container */}
      <div className="relative">
        {/* Input */}
        <input
          ref={mascara.inputRef}
          id={editor.id}
          type="text"
          inputMode="decimal"
          value={mascara.texto}
          onChange={mascara.aoDigitar}
          onFocus={mascara.aoFocar}
          onBlur={mascara.aoSair}
          placeholder={(editorModel.placeholderText ?? '') || '0,00'}
          disabled={disabled || editorModel.isReadOnly}
          className={`
            w-full h-editor pl-4 ${showRevertButton ? 'pr-8' : 'pr-4'}
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
    </div>
  );
}
