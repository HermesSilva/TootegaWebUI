/**
 * XMultiSelectEditor - Editor de bitmask [Flags]
 *
 * DROPDOWN com checkboxes: o gatilho mostra o que está selecionado (ou o placeholder) e, ao abrir,
 * a lista de itens marcáveis. Feito assim porque a lista pode ter MUITOS itens — a fileira inline
 * estouraria a largura. O valor vinculado é o OR (soma) dos valores inteiros dos itens marcados —
 * espelha um enum [Flags] do backend (XUIEditorType.MultiSelect = 27).
 *
 * A lista vive num PORTAL com posição FIXA medida a partir do campo (mesmo desenho do XLookupEditor/
 * XComboBoxEditor): dentro de um modal, o corpo rolável recorta um dropdown `absolute` e o rodapé o
 * cobre — z-index sozinho não salva, porque o contexto de empilhamento é o do modal. Portal para o
 * body + z-index do ZIndexManager resolvem o "dropdown por baixo do painel do modal".
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';

import { ChevronDown, RotateCcw } from 'lucide-react';
import type { XDataEditor } from '@core/types';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { usePosicaoFlutuante } from '@core/hooks/usePosicaoFlutuante';
import { XEditorLabel } from './XEditorLabel';
import { lookupLabel } from '@core/lib';

// ============================================================================
// Types
// ============================================================================

interface XMultiSelectEditorProps {
  editor: XDataEditor;
  value: unknown;
  originalValue?: unknown;
  onChange: (pValue: unknown, pBindings?: Record<string, unknown>) => void;
  error?: string;
  disabled?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function toMask(pValue: unknown): number {
  const n = typeof pValue === 'number' ? pValue : parseInt(String(pValue ?? '0'), 10);
  return Number.isFinite(n) ? n : 0;
}

// ============================================================================
// Component
// ============================================================================

export function XMultiSelectEditor({
  editor,
  value,
  originalValue,
  onChange,
  error,
  disabled,
}: XMultiSelectEditorProps): JSX.Element {
  const editorModel = editor.editor;
  const readOnly = disabled || editorModel.isReadOnly;

  const items = useMemo(() => editorModel.lookupItems || [], [editorModel.lookupItems]);
  const mask = toMask(value);

  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // O z-index é pedido A CADA ABERTURA (o modal pediu o dele quando abriu; um editor montado dentro
  // já nasceu com número MENOR). Posição na JANELA porque o portal usa position: fixed.
  const [dropdownZIndex, setDropdownZIndex] = useState(() => ZIndexManager.next());
  // Abaixo; não coube ⇒ acima, direita, esquerda (dono, 2026-10-23). Regra única no usePosicaoFlutuante,
  // que também acompanha a rolagem de ancestrais e o redimensionamento.
  const { posicao } = usePosicaoFlutuante(aberto, raizRef, listaRef, { alturaMaxima: 300 });

  useEffect(() => {
    if (!aberto) return;

    setDropdownZIndex(ZIndexManager.next());

    const aoClicar = (pEvento: MouseEvent) => {
      const alvo = pEvento.target as Node;
      // A lista vive num PORTAL, fora do container: sem esta checagem, o clique num item contaria como
      // "clique fora" e o dropdown fecharia antes de o toggle acontecer.
      if (listaRef.current?.contains(alvo)) return;
      if (raizRef.current && !raizRef.current.contains(alvo)) setAberto(false);
    };

    document.addEventListener('mousedown', aoClicar);

    return () => {
      document.removeEventListener('mousedown', aoClicar);
    };
  }, [aberto]);

  const handleToggle = useCallback(
    (pFlag: number) => {
      if (readOnly) return;
      const next = (mask & pFlag) === pFlag ? mask & ~pFlag : mask | pFlag;
      onChange(next, undefined);
    },
    [mask, onChange, readOnly]
  );

  const hasChanged = toMask(value) !== toMask(originalValue);
  const showRevert = hasChanged && !readOnly && originalValue !== undefined;

  const handleRevert = useCallback(() => {
    onChange(toMask(originalValue), undefined);
  }, [onChange, originalValue]);

  const selecionados = items.filter((item) => {
    const flag = toMask(item.value);
    return (mask & flag) === flag && flag !== 0;
  });
  const resumo =
    selecionados.length > 0
      ? selecionados.map(lookupLabel).join(', ')
      : editorModel.placeholderText || 'Selecione';

  return (
    <div className="relative w-full" ref={raizRef}>
      <div className="flex items-center justify-between">
        <XEditorLabel id={editor.id} title={editor.title} isRequired={editorModel.isRequired} />
        {showRevert && (
          <button
            type="button"
            onClick={handleRevert}
            className="p-1 hover:bg-hover rounded"
            tabIndex={-1}
            title={'Desfazer alteração'}
          >
            <RotateCcw className="w-3 h-3 text-brand-text-muted" />
          </button>
        )}
      </div>

      {/* Gatilho: parece um select, mostra o que está marcado. */}
      <button
        type="button"
        id={editor.id}
        disabled={readOnly}
        onClick={() => setAberto((pA) => !pA)}
        className={`
          w-full flex items-center justify-between gap-2 px-3 h-editor rounded-lg border text-ui text-left
          bg-brand-surface
          ${readOnly ? 'opacity-50 cursor-not-allowed bg-muted-bg' : 'hover:bg-hover'}
          ${error ? 'border-danger' : 'border-border'}
        `}
      >
        <span className={`truncate ${selecionados.length > 0 ? 'text-brand-text-primary' : 'text-brand-text-muted'}`}>
          {resumo}
        </span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-brand-text-muted transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {/* Lista num PORTAL (fora do modal), com posição fixa medida a partir do campo: não é recortada
          pelo corpo rolável nem coberta pelo rodapé de botões. */}
      {aberto && !readOnly && createPortal(
        <div
          ref={listaRef}
          role="group"
          data-x-portal-dropdown=""
          className="fixed overflow-y-auto rounded-lg border border-border bg-brand-surface shadow-lg p-1"
          style={{
            zIndex: dropdownZIndex,
            top: posicao.top,
            bottom: posicao.bottom,
            left: posicao.left,
            visibility: posicao.medido ? undefined : 'hidden',
            width: posicao.larguraCampo,
            maxHeight: posicao.maxHeight,
          }}
        >
          {items.map((item) => {
            const flag = toMask(item.value);
            const checked = (mask & flag) === flag && flag !== 0;
            return (
              <label
                key={item.value}
                className={`
                  flex items-center gap-2 px-3 min-h-[40px] rounded-md cursor-pointer select-none text-ui transition-colors
                  ${checked ? 'text-brand-text-primary' : 'text-brand-text-secondary'}
                  ${item.isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-hover'}
                `}
              >
                <input
                  type="checkbox"
                  className="accent-brand-primary w-4 h-4"
                  checked={checked}
                  disabled={item.isDisabled}
                  // O `disabled` acima já impede o clique NO NAVEGADOR, mas a regra "item desabilitado
                  // não altera o valor" é do componente, e não pode depender só do atributo: qualquer
                  // caminho que chegue ao handler por outra via — teclado, script, um teste — a
                  // burlaria em silêncio, somando um bit que a tela mostrava como indisponível.
                  onChange={() => { if (!item.isDisabled) handleToggle(flag); }}
                />
                {lookupLabel(item)}
              </label>
            );
          })}

          {items.length === 0 && (
            <span className="block px-3 py-2 text-ui text-brand-text-muted">
              {'Nenhuma opção disponível'}
            </span>
          )}
        </div>,
        document.body
      )}

      {(error || editorModel.hintText) && (
        <p className={`mt-1 text-ui-xs ${error ? 'text-danger' : 'text-brand-text-muted'}`}>
          {error || (editorModel.hintText ?? '')}
        </p>
      )}
    </div>
  );
}
