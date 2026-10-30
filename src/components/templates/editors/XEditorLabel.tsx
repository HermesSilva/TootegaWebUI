/**
 * XEditorLabel - Label Component for Editors
 * 
 * Shared label component that handles:
 * - Translation of title keys
 * - Required field indicator
 * - Consistent styling
 */

import type { JSX } from 'react';

// ============================================================================
// Types
// ============================================================================

interface XEditorLabelProps {
  /**
   * O id do CONTROLE que o rótulo rotula (`<input>`, `<textarea>`, `<select>`, `<button>`). Omitido
   * quando o editor não tem um — grade de itens, valor somente-leitura num `<div>`, listas, upload:
   * `<label for>` apontando para um elemento não rotulável é o aviso "Incorrect use of <label
   * for=FORM_ELEMENT>" do navegador (dono, 2026-10-12), e aí o título sai como `<span>`.
   */
  id?: string;
  title: string | undefined;
  isRequired?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function XEditorLabel({ id, title, isRequired }: XEditorLabelProps): JSX.Element | null {

  if (!title)
    return null;

  const translatedTitle = (title ?? '');
  const classe = 'block text-ui font-medium text-brand-text-secondary mb-1';
  const conteudo = (
    <>
      {translatedTitle}
      {isRequired && (
        <span className="text-danger ml-1">*</span>
      )}
    </>
  );

  if (!id)
    return <span className={classe}>{conteudo}</span>;

  return (
    <label htmlFor={id} className={classe}>
      {conteudo}
    </label>
  );
}
