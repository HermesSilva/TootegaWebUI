/**
 * XCurrencyCell — célula NUMÉRICA da grade de itens (XItemsGridEditor): moeda, decimal e inteiro
 * (casas = 0). É o MESMO comportamento do editor do formulário — formata no locale enquanto se digita,
 * alinha à direita, propaga ao vivo a cada tecla, arredonda e aplica limites ao sair — porém SEM os
 * enfeites do editor (rótulo, botão de desfazer), porque na grade o cabeçalho já rotula a coluna.
 * A máscara é a de toda a plataforma (`useMascaraNumerica`, dono 2026-10-12): a célula não tem
 * máquina própria.
 *
 * NUNCA usa <input type="number">: nada de spin em valor numérico de grade — o `<input type="number">`
 * não admite formatação, e o inteiro com milhar (tara de 9.000 kg) se lê no locale (dono, 2026-10-11).
 * Coluna só-leitura (ou grade travada) é exibida com COR distinta (fundo esmaecido), como o campo
 * só-leitura do formulário — não um campo editável desabilitado.
 */

import { type JSX } from 'react';
import { useMascaraNumerica } from './useMascaraNumerica';

interface XCurrencyCellProps {
  value: unknown;
  onChange: (pValue: number | null) => void;
  /** Casas decimais fixas (padrão 2 — moeda; 0 = inteiro). */
  decimalPlaces?: number;
  /** Grade INTEIRA travada. */
  disabled?: boolean;
  /** ESTA coluna é só-leitura (valor vem de vínculo/cálculo). */
  readOnly?: boolean;
  /** Aceita negativo (padrão: não — quantidade e preço de grade são positivos). */
  permiteNegativo?: boolean;
  /**
   * O valor fere uma regra da linha: a frase que diz o quê e o que fazer. Presente ⇒ a célula fica marcada (borda de
   * erro, `aria-invalid`) e a frase aparece logo abaixo. Ausente ⇒ célula normal.
   */
  invalido?: string;
}

const base = 'w-full h-editor px-2 text-ui text-right rounded-md border border-border';
const editavel = 'bg-brand-surface text-brand-text-primary focus:outline-none focus:border-brand-primary';
const soLeitura = 'bg-muted-bg text-brand-text-secondary opacity-60 cursor-not-allowed';

export function XCurrencyCell({
  value,
  onChange,
  decimalPlaces = 2,
  disabled,
  readOnly,
  permiteNegativo = false,
  invalido,
}: XCurrencyCellProps): JSX.Element {
  const bloqueado = Boolean(disabled) || Boolean(readOnly);

  const mascara = useMascaraNumerica({
    valor: value,
    aoMudar: onChange,
    casas: decimalPlaces,
    permiteNegativo,
  });

  if (bloqueado)
    return (
      <div className={`${base} ${soLeitura} flex items-center justify-end truncate`} title={mascara.formatado}>
        {mascara.formatado || '—'}
      </div>
    );

  const entrada = (
    <input
      ref={mascara.inputRef}
      type="text"
      inputMode={decimalPlaces === 0 ? 'numeric' : 'decimal'}
      value={mascara.texto}
      onChange={mascara.aoDigitar}
      onFocus={mascara.aoFocar}
      onBlur={mascara.aoSair}
      aria-invalid={invalido ? true : undefined}
      title={invalido}
      className={`${invalido ? base.replace('border-border', 'border-danger') : base} ${editavel}`}
    />
  );

  // Sempre o MESMO fragmento, com a entrada na mesma posição: a frase entra e sai como irmã. Embrulhar a entrada só
  // quando inválida trocaria a árvore no meio da digitação ("46" vale, "460" não) — o input remontaria e o foco
  // escaparia no dígito que tornou o valor inválido.
  return (
    <>
      {entrada}
      {invalido && (
        <p role="alert" className="mt-0.5 text-ui-xs text-danger whitespace-normal leading-tight">{invalido}</p>
      )}
    </>
  );
}
