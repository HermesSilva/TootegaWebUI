/**
 * XFormula — uma fórmula (TeX ou AsciiMath) desenhada como MathML pelo motor da casa (`lib/formula`). Recebe a
 * fonte e a notação efetiva; renderiza a árvore MathML em elementos React (o navegador faz o layout) e, quando há
 * avisos, expõe-os no `title` do invólucro. Não é editável: a edição é da ilha/diálogo que a contém.
 */

import { createElement, memo, useMemo, type JSX, type ReactNode } from 'react';
import { renderizarFormula, type ElementoMathML } from '../../../lib/formula';
import '../../../lib/formula/formula.css';

export interface XFormulaProps {
  fonte: string;
  notacao: 'latexmath' | 'asciimath';
  bloco: boolean;
  className?: string;
  /** Texto do título quando há avisos ("{0} avisos: …"). */
  rotuloDeAvisos?: (pAvisos: string[]) => string;
}

function paraReact(pElemento: ElementoMathML, pChave: number): ReactNode {
  const props: Record<string, unknown> = { key: pChave };
  for (const [nome, valor] of Object.entries(pElemento.atributos)) {
    if (nome === 'class')
      props.className = valor;
    else if (nome === 'style') {
      const estilo: Record<string, string> = {};
      for (const declaracao of valor.split(';')) {
        const [propriedade, ...resto] = declaracao.split(':');
        if (propriedade && resto.length > 0)
          estilo[propriedade.trim().replace(/-([a-z])/g, (pTudo, pL: string) => (pTudo ? pL.toUpperCase() : ''))] = resto.join(':').trim();
      }
      props.style = estilo;
    } else
      props[nome] = valor;
  }
  const filhos = pElemento.filhos.map((pF, pI) => (typeof pF === 'string' ? pF : paraReact(pF, pI)));
  return createElement(pElemento.nome, props, ...filhos);
}

export const XFormula = memo(function XFormula({ fonte, notacao, bloco, className, rotuloDeAvisos }: XFormulaProps): JSX.Element {
  const resultado = useMemo(() => renderizarFormula(fonte, { notacao, bloco }), [bloco, fonte, notacao]);
  const avisos = resultado.avisos.map((pA) => pA.texto);
  const titulo = avisos.length > 0 ? (rotuloDeAvisos ? rotuloDeAvisos(avisos) : avisos.join('\n')) : undefined;
  return (
    <span className={`adc-formula-caixa${bloco ? ' adc-formula-bloco' : ''}${avisos.length > 0 ? ' adc-formula-com-avisos' : ''}${className ? ` ${className}` : ''}`} title={titulo}>
      {paraReact(resultado.arvore, 0)}
    </span>
  );
});
