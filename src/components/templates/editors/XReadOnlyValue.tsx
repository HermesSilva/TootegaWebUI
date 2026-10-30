/**
 * XReadOnlyValue - Read-only display for non-editable fields
 *
 * Native inputs (date/time/number) render in the BROWSER locale, ignoring the app's own formatting.
 * For read-only fields we render pt-BR formatted static text instead (dd/MM/yyyy HH:mm).
 *
 * O valor chega PRONTO do back — inclusive o rótulo de lookup. Não há chave a resolver aqui: quem
 * escreve o texto é quem tem o dado (dono, 2026-08-03).
 */

import type { JSX, ReactNode } from 'react';
import type { XDataEditor } from '@core/types';
import { XEditorLabel } from './XEditorLabel';

// ============================================================================
// Types
// ============================================================================

interface XReadOnlyValueProps {
  editor: XDataEditor;
  icon: ReactNode;
  display: string;
  error?: string;
  alignRight?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function XReadOnlyValue({
  editor,
  icon,
  display,
  error,
  alignRight,
}: XReadOnlyValueProps): JSX.Element {
  const editorModel = editor.editor;
  const shown = display;

  return (
    <div className="w-full">
      {/* Label */}
      <XEditorLabel title={editor.title} isRequired={editorModel.isRequired} />

      {/* Display Container */}
      <div className="relative">
        {/* Icon */}
        {icon}

        {/* Value */}
        <div
          id={editor.id}
          className={`
            w-full h-editor pl-10 pr-4 flex items-center truncate
            text-ui rounded-lg border border-border
            bg-muted-bg text-brand-text-primary
            opacity-60 cursor-not-allowed
            ${alignRight ? 'justify-end' : ''}
          `}
          title={shown}
        >
          {shown || (editor.nullText ? (editor.nullText ?? '') : '—')}
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
