/**
 * XPercentEditor - Editor de Percentual
 *
 * Campo de percentual com:
 * - Símbolo % à direita
 * - Armazena como decimal (50% = 0.5) ou inteiro configurável
 * - Casas decimais configuráveis
 * - Formatação no locale ENQUANTO se digita — a mesma máscara de toda a plataforma
 *   (`useMascaraNumerica`, dono 2026-10-12). O que o hook vê é o número EXIBIDO (o percentual);
 *   a conversão de/para a fração guardada fica nas duas pontas deste editor.
 */

import { useCallback, type JSX } from 'react';
import { Percent, X } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';
import { arredondarAsCasas, numeroOuIndefinido } from './mascaraNumerica';
import { useMascaraNumerica } from './useMascaraNumerica';

// ============================================================================
// Types
// ============================================================================

interface XPercentEditorProps {
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

export function XPercentEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XPercentEditorProps): JSX.Element {
  const editorModel = editor.editor;

  const decimalPlaces = editorModel.decimalPlaces ?? 2;
  const storeAsDecimal = editorModel.percentStoreAsDecimal ?? true;
  const minValue = numeroOuIndefinido(editorModel.minValue);
  const maxValue = numeroOuIndefinido(editorModel.maxValue);

  // Guardado → exibido (fração vira percentual) e exibido → guardado. O arredondamento às casas do
  // modelo é feito no exibido, porque 0,155 × 100 em ponto flutuante dá 15,500000000000002.
  const paraExibido = (pGuardado: number | undefined): number | undefined =>
    pGuardado === undefined ? undefined : arredondarAsCasas(storeAsDecimal ? pGuardado * 100 : pGuardado, decimalPlaces);
  const paraGuardado = (pExibido: number): number =>
    storeAsDecimal ? Number((pExibido / 100).toFixed(decimalPlaces + 2)) : pExibido;

  const aoMudar = useCallback((pExibido: number | null) => {
    onChange(pExibido === null ? null : paraGuardado(pExibido));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, storeAsDecimal, decimalPlaces]);

  const mascara = useMascaraNumerica({
    valor: paraExibido(numeroOuIndefinido(value)),
    aoMudar,
    casas: decimalPlaces,
    permiteNegativo: minValue === undefined || minValue < 0,
    minimo: paraExibido(minValue),
    maximo: paraExibido(maxValue),
  });

  const handleRevert = (): void => {
    const originalNum = numeroOuIndefinido(originalValue);
    mascara.reexibir(paraExibido(originalNum));
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
            w-full h-editor ${showRevertButton ? 'pl-4 pr-16' : 'pl-4 pr-10'}
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
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 hover:bg-hover rounded"
            tabIndex={-1}
            title={'Desfazer alteração'}
          >
            <X className="w-3 h-3 text-brand-text-muted" />
          </button>
        )}

        {/* Percent Icon */}
        <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
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
