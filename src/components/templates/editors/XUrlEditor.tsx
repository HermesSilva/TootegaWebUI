/**
 * XUrlEditor - Editor de URL
 * 
 * Campo de URL com:
 * - Validação de formato
 * - Botão para abrir link
 * - Ícone indicativo
 */

import { useState, useCallback, useEffect, useMemo, useRef, type JSX, type ChangeEvent } from 'react';
import { Link2, ExternalLink, Copy, Check } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';

// ============================================================================
// Types
// ============================================================================

interface XUrlEditorProps {
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
 * Valida URL
 */
function isValidUrl(pValue: string): boolean {
  if (!pValue)
    return true;

  try {
    new URL(pValue);
    return true;
  } catch {
    // Tenta com https prefixo
    try {
      new URL(`https://${pValue}`);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Normaliza URL adicionando protocolo se necessário
 */
function normalizeUrl(pValue: string): string {
  if (!pValue)
    return '';

  if (pValue.startsWith('http://') || pValue.startsWith('https://'))
    return pValue;

  return `https://${pValue}`;
}

// ============================================================================
// Component
// ============================================================================

export function XUrlEditor({
  editor,
  value,
  onChange,
  error,
  disabled,
}: XUrlEditorProps): JSX.Element {
  const editorModel = editor.editor;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [displayValue, setDisplayValue] = useState('');
  const [localError, setLocalError] = useState<string | undefined>();
  const isDisabled = disabled || editorModel.isReadOnly;

  // ---------------------------------------------------------------------------
  // Initialize Display Value
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (value)
      setDisplayValue(String(value));
    else
      setDisplayValue('');
  }, [value]);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const canOpenUrl = useMemo(() => {
    return displayValue && isValidUrl(displayValue);
  }, [displayValue]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);
    setLocalError(undefined);
    onChange(newValue);
  }, [onChange]);

  const handleBlur = useCallback(() => {
    if (displayValue && !isValidUrl(displayValue)) {
      setLocalError('URL inválida');
    } else {
      setLocalError(undefined);
    }
  }, [displayValue]);

  const handleOpenUrl = useCallback(() => {
    if (canOpenUrl) {
      const url = normalizeUrl(displayValue);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [canOpenUrl, displayValue]);

  // Campo COPIÁVEL (o back declara `copiavel` — o endereço de clone, dono 2026-10-26): o botão copia o valor tal como
  // está e NUNCA o abre. "Copiado" fica dois segundos no lugar do ícone, para quem copiou saber que copiou.
  const [copiado, setCopiado] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);
  const copiar = useCallback(async () => {
    if (!displayValue)
      return;
    await navigator.clipboard.writeText(displayValue);
    setCopiado(true);
    if (temporizador.current)
      clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(false), 2000);
  }, [displayValue]);

  // ---------------------------------------------------------------------------
  // Final Error
  // ---------------------------------------------------------------------------

  const finalError = error || localError;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full">
      {/* Label */}
      <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />

      {/* Input Container */}
      <div className="relative flex items-center gap-2">
        {/* Input */}
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted pointer-events-none" />
          <input
            id={editor.id}
            type="url"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder={(editorModel.placeholderText ?? '') || 'https://exemplo.com'}
            disabled={isDisabled}
            className={`
              w-full h-editor pl-10 pr-4
              text-ui rounded-lg border
              bg-brand-surface text-brand-text-primary
              placeholder:text-brand-text-muted
              focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-muted-bg
              ${finalError ? 'border-danger focus:ring-danger' : 'border-border'}
            `}
          />
        </div>

        {/* Copiar (campo copiável): copia e nunca abre. */}
        {editorModel.copiavel && displayValue && (
          <button
            type="button"
            onClick={() => void copiar()}
            className="
              flex-shrink-0 h-editor px-3
              flex items-center gap-1
              text-ui text-brand-primary
              rounded-lg border border-brand-primary
              hover:bg-brand-primary/10
              transition-colors
            "
            title={copiado ? 'Copiado' : 'Copiar'}
            aria-label={copiado ? 'Copiado' : `Copiar ${editor.title}`}
          >
            {copiado ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
          </button>
        )}

        {/* Open Button */}
        {!editorModel.copiavel && canOpenUrl && (
          <button
            type="button"
            onClick={handleOpenUrl}
            className="
              flex-shrink-0 h-editor px-3
              flex items-center gap-1
              text-ui text-brand-primary
              rounded-lg border border-brand-primary
              hover:bg-brand-primary/10
              transition-colors
            "
            title={'Abrir URL'}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Hint or Error */}
      {(finalError || editorModel.hintText) && (
        <p className={`mt-1 text-ui-xs ${finalError ? 'text-danger' : 'text-brand-text-muted'}`}>
          {finalError || (editorModel.hintText ?? '')}
        </p>
      )}
    </div>
  );
}
