/**
 * Rótulo exibível de um item de lookup: `SIGLA - texto`.
 *
 * A sigla chega do back em campo próprio (`acronym`), separada do `text`, porque nem todo item tem
 * uma e o separador não pode sobrar sozinho. Concatenar as duas é decisão de EXIBIÇÃO, e por isso
 * mora aqui, num lugar só: o combo, o multi-seleção e qualquer lista futura mostram a mesma coisa,
 * sem cada um inventar o seu separador.
 *
 * Item sem sigla devolve apenas o texto — nada de traço solto na frente.
 */

import type { XLookupItem } from '@core/types';

/** Separador entre sigla e nome. Um lugar só, para as telas não divergirem. */
const SEPARADOR = ' - ';

export function lookupLabel(pItem: XLookupItem | null | undefined): string {
  if (!pItem)
    return '';

  const texto = (pItem.text ?? '');
  const sigla = pItem.acronym?.trim() ?? '';

  if (sigla.length === 0)
    return texto;

  if (texto.length === 0)
    return sigla;

  return `${sigla}${SEPARADOR}${texto}`;
}
