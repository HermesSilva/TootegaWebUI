/**
 * Medidas do TeX (`2em`, `-3mu`, `1.5ex`, `10pt`…) e sua conversão para `em`, que é o que o MathML recebe.
 * Fatores do TeXbook (pt por unidade); `em` = 10pt no tamanho-base, `ex` ≈ 0,431em (Computer Modern), `mu` = 1/18em.
 */

import type { Medida } from '../ast';

const PT_POR_UNIDADE: Record<string, number> = {
  pt: 1,
  mm: 7227 / 2540,
  cm: 7227 / 254,
  in: 72.27,
  bp: 803 / 800,
  pc: 12,
  dd: 1238 / 1157,
  cc: 14856 / 1157,
  nd: 685 / 642,
  nc: 1370 / 107,
  sp: 1 / 65536,
  px: 803 / 800,
};

const MEDIDA = /^\s*([-+]?\s*(?:\d+\.?\d*|\.\d+))\s*([a-zA-Z]{2})\s*$/;

/** Lê `-1.5em`; `null` quando o texto não é uma medida válida. */
export function lerMedida(pTexto: string): Medida | null {
  const m = MEDIDA.exec(pTexto);
  if (!m)
    return null;
  const numero = Number(m[1].replace(/\s+/g, ''));
  const unidade = m[2].toLowerCase();
  if (Number.isNaN(numero) || !unidadeValida(unidade))
    return null;
  return { numero, unidade };
}

export function unidadeValida(pUnidade: string): boolean {
  return pUnidade === 'em' || pUnidade === 'ex' || pUnidade === 'mu' || pUnidade in PT_POR_UNIDADE;
}

/** A medida em `em` (número). */
export function emEm(pMedida: Medida): number {
  switch (pMedida.unidade) {
    case 'em':
      return pMedida.numero;
    case 'ex':
      return pMedida.numero * 0.431;
    case 'mu':
      return pMedida.numero / 18;
    default: {
      const pt = PT_POR_UNIDADE[pMedida.unidade] ?? 1;
      return (pMedida.numero * pt) / 10;
    }
  }
}

/** Texto CSS da medida (`0.1667em`), arredondado a 4 casas. */
export function cssDaMedida(pMedida: Medida): string {
  return `${arredondar(emEm(pMedida))}em`;
}

export function medidaEm(pNumero: number): Medida {
  return { numero: pNumero, unidade: 'em' };
}

export function medidaMu(pNumero: number): Medida {
  return { numero: pNumero, unidade: 'mu' };
}

export function arredondar(pNumero: number): number {
  return Math.round(pNumero * 10000) / 10000;
}
