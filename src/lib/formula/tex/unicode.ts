/**
 * Alfanuméricos matemáticos do Unicode (bloco U+1D400–U+1D7FF e as exceções no BMP). O MathML Core só honra
 * `mathvariant="normal"`, então `\mathbf{x}` precisa sair como o caractere 𝐱, e não como `x` com atributo.
 */

import type { FonteMatematica } from '../ast';

/** Base de cada fonte para A–Z, a–z (letras latinas), dígitos e gregas; `null` = não existe (fica como está). */
const LATINAS: Record<FonteMatematica, number | null> = {
  normal: null,
  negrito: 0x1d400,
  italico: 0x1d434,
  negritoItalico: 0x1d468,
  caligrafico: 0x1d49c,
  caligraficoNegrito: 0x1d4d0,
  fraktur: 0x1d504,
  frakturNegrito: 0x1d56c,
  duplo: 0x1d538,
  semSerifa: 0x1d5a0,
  semSerifaNegrito: 0x1d5d4,
  semSerifaItalico: 0x1d608,
  semSerifaNegritoItalico: 0x1d63c,
  mono: 0x1d670,
};

const DIGITOS: Record<FonteMatematica, number | null> = {
  normal: null,
  negrito: 0x1d7ce,
  italico: null,
  negritoItalico: 0x1d7ce,
  caligrafico: null,
  caligraficoNegrito: 0x1d7ce,
  fraktur: null,
  frakturNegrito: 0x1d7ce,
  duplo: 0x1d7d8,
  semSerifa: 0x1d7e2,
  semSerifaNegrito: 0x1d7ec,
  semSerifaItalico: 0x1d7e2,
  semSerifaNegritoItalico: 0x1d7ec,
  mono: 0x1d7f6,
};

/** Gregas: Α..Ω (0x391..0x3A9, com ϴ em 0x3F4 no lugar de 0x3A2), ∇, α..ω (0x3B1..0x3C9), ∂ ϵ ϑ ϰ ϕ ϱ ϖ. */
const GREGAS: Record<FonteMatematica, number | null> = {
  normal: null,
  negrito: 0x1d6a8,
  italico: 0x1d6e2,
  negritoItalico: 0x1d71c,
  caligrafico: null,
  caligraficoNegrito: null,
  fraktur: null,
  frakturNegrito: null,
  duplo: null,
  semSerifa: null,
  semSerifaNegrito: 0x1d756,
  semSerifaItalico: null,
  semSerifaNegritoItalico: 0x1d790,
  mono: null,
};

/** Exceções: os caracteres que já existiam no BMP e ficaram de fora do bloco. */
const EXCECOES: Partial<Record<FonteMatematica, Record<string, string>>> = {
  italico: { h: 'ℎ' },
  caligrafico: { B: 'ℬ', E: 'ℰ', F: 'ℱ', H: 'ℋ', I: 'ℐ', L: 'ℒ', M: 'ℳ', R: 'ℛ', e: 'ℯ', g: 'ℊ', o: 'ℴ' },
  fraktur: { C: 'ℭ', H: 'ℌ', I: 'ℑ', R: 'ℜ', Z: 'ℨ' },
  duplo: { C: 'ℂ', H: 'ℍ', N: 'ℕ', P: 'ℙ', Q: 'ℚ', R: 'ℝ', Z: 'ℤ' },
};

const GREGAS_EXTRAS: Record<string, number> = { '∇': 25, '∂': 51, 'ϵ': 52, 'ϑ': 53, 'ϰ': 54, 'ϕ': 55, 'ϱ': 56, 'ϖ': 57 };

function converterCaractere(pC: string, pFonte: FonteMatematica): string {
  const excecao = EXCECOES[pFonte]?.[pC];
  if (excecao)
    return excecao;
  const cp = pC.codePointAt(0) as number;
  if (cp >= 0x41 && cp <= 0x5a) {
    const base = LATINAS[pFonte];
    return base === null ? pC : String.fromCodePoint(base + (cp - 0x41));
  }
  if (cp >= 0x61 && cp <= 0x7a) {
    const base = LATINAS[pFonte];
    return base === null ? pC : String.fromCodePoint(base + 26 + (cp - 0x61));
  }
  if (cp >= 0x30 && cp <= 0x39) {
    const base = DIGITOS[pFonte];
    return base === null ? pC : String.fromCodePoint(base + (cp - 0x30));
  }
  const gregas = GREGAS[pFonte];
  if (gregas !== null) {
    if (cp >= 0x391 && cp <= 0x3a9 && cp !== 0x3a2)
      return String.fromCodePoint(gregas + (cp - 0x391));
    if (cp === 0x3f4)
      return String.fromCodePoint(gregas + 17);
    if (cp >= 0x3b1 && cp <= 0x3c9)
      return String.fromCodePoint(gregas + 26 + (cp - 0x3b1));
    const extra = GREGAS_EXTRAS[pC];
    if (extra !== undefined)
      return String.fromCodePoint(gregas + extra);
  }
  return pC;
}

/** Converte cada caractere para a fonte matemática pedida; o que não tem variante fica como está. */
export function comFonte(pTexto: string, pFonte: FonteMatematica): string {
  if (pFonte === 'normal')
    return pTexto;
  let saida = '';
  for (const c of pTexto)
    saida += converterCaractere(c, pFonte);
  return saida;
}

/** A fonte tem variante própria para este caractere? (decide se `mathvariant="normal"` ainda é preciso). */
export function temVariante(pC: string, pFonte: FonteMatematica): boolean {
  return comFonte(pC, pFonte) !== pC;
}
