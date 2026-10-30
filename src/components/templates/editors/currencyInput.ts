/**
 * currencyInput — funções de máscara monetária COMPARTILHADAS pelo editor de moeda do formulário
 * (XCurrencyEditor) e pela célula de moeda da grade de itens (XCurrencyCell). Ficam num módulo único
 * para que a forma de editar valor monetário seja EXATAMENTE a mesma em qualquer lugar (padronização
 * pedida pelo dono, 2026-07-14): mesmo parse, mesma formatação, mesmo arredondamento.
 */

import { getIntlLocale } from '@core/lib';

/** Converte um valor cru em número, ou `undefined` quando vazio/inválido. */
export function parseNumber(pValue: unknown): number | undefined {
  if (pValue === null || pValue === undefined || pValue === '')
    return undefined;

  const num = Number(pValue);
  return isNaN(num) ? undefined : num;
}

/** Formata o número como moeda no locale corrente, com casas decimais fixas (padrão 2). */
export function formatCurrencyValue(
  pValue: number | undefined,
  pDecimalPlaces: number = 2,
): string {
  if (pValue === undefined)
    return '';

  return pValue.toLocaleString(getIntlLocale(), {
    minimumFractionDigits: pDecimalPlaces,
    maximumFractionDigits: pDecimalPlaces,
  });
}

/**
 * Remove a formatação e devolve o número. Aceita os dois formatos: `1,234.56` (en) e `1.234,56`
 * (pt-BR), decidindo pelo separador que aparece por último.
 */
export function parseCurrency(pValue: string): number | undefined {
  if (!pValue)
    return undefined;

  const lastComma = pValue.lastIndexOf(',');
  const lastDot = pValue.lastIndexOf('.');

  let normalized: string;

  if (lastComma > lastDot) {
    // Formato europeu/brasileiro: 1.234,56
    normalized = pValue.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato inglês: 1,234.56
    normalized = pValue.replace(/,/g, '');
  }

  const num = Number(normalized);
  return isNaN(num) ? undefined : num;
}
