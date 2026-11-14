/**
 * MOTOR DE FÓRMULAS da casa (2026-10-31): TeX (`latexmath`) e AsciiMath (`asciimath`) → MathML Core, sem
 * dependência externa. O KaTeX foi estudado como referência e serve de oráculo nos testes; nenhum código dele
 * entra aqui. Plano e decisões: `Docs/PLAN-formulas.md` na extensão TootegaAsciiDoc (DF-1..DF-7).
 *
 * Uso: `renderizarFormula('\\frac{a}{b}', { notacao: 'latexmath', bloco: true })` → `{ mathml, arvore, avisos }`.
 * Nunca lança: comando desconhecido vira `merror` com o nome, e `avisos` diz o que e onde.
 */

import type { AvisoDaFormula, No } from './ast';
import { analisarAsciiMath } from './asciimath/parser';
import type { ElementoMathML } from './mathml/arvore';
import { construirMathML } from './mathml/construtor';
import { paraXML } from './mathml/serializar';
import { analisarTeX } from './tex/parser';

export type NotacaoEfetiva = 'latexmath' | 'asciimath';

export interface OpcoesDeRenderizacao {
  notacao: NotacaoEfetiva;
  /** Fórmula em bloco (display) ou na linha. */
  bloco: boolean;
  /** Inclui `<semantics>` + `<annotation>` com a fonte (padrão: sim). */
  anotar?: boolean;
}

export interface FormulaRenderizada {
  /** O `<math>` como XML. */
  mathml: string;
  /** A mesma árvore, para quem renderiza em React. */
  arvore: ElementoMathML;
  /** A árvore semântica (para testes e ferramentas). */
  nos: No[];
  avisos: AvisoDaFormula[];
}

export function analisarFormula(pFonte: string, pNotacao: NotacaoEfetiva, pBloco: boolean): { nos: No[]; avisos: AvisoDaFormula[] } {
  return pNotacao === 'asciimath' ? analisarAsciiMath(pFonte) : analisarTeX(pFonte, { display: pBloco });
}

export function renderizarFormula(pFonte: string, pOpcoes: OpcoesDeRenderizacao): FormulaRenderizada {
  const { nos, avisos } = analisarFormula(pFonte, pOpcoes.notacao, pOpcoes.bloco);
  const arvore = construirMathML(nos, {
    display: pOpcoes.bloco,
    fonte: pOpcoes.anotar === false ? undefined : pFonte,
    codificacao: pOpcoes.notacao === 'asciimath' ? 'text/x-asciimath' : 'application/x-tex',
  });
  return { mathml: paraXML(arvore), arvore, nos, avisos };
}

export type { AvisoDaFormula, No } from './ast';
export type { ElementoMathML } from './mathml/arvore';
export { paraXML } from './mathml/serializar';
export { analisarTeX } from './tex/parser';
export { analisarAsciiMath } from './asciimath/parser';
export { construirMathML } from './mathml/construtor';
