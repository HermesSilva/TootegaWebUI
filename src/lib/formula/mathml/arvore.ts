/**
 * ÁRVORE MathML — a saída do construtor, independente de DOM: elemento com nome, atributos e filhos (elementos ou
 * texto). Serializa para XML (exportação) e para React (vista), em `serializar.ts` e no componente da vista.
 */

export interface ElementoMathML {
  nome: string;
  atributos: Record<string, string>;
  filhos: (ElementoMathML | string)[];
}

export function el(pNome: string, pAtributos: Record<string, string> = {}, pFilhos: (ElementoMathML | string)[] = []): ElementoMathML {
  return { nome: pNome, atributos: pAtributos, filhos: pFilhos };
}

export function comClasse(pElemento: ElementoMathML, pClasse: string): ElementoMathML {
  const atual = pElemento.atributos.class;
  pElemento.atributos.class = atual ? `${atual} ${pClasse}` : pClasse;
  return pElemento;
}

/** Texto de um elemento (folhas concatenadas). */
export function textoDe(pElemento: ElementoMathML): string {
  return pElemento.filhos.map((pF) => (typeof pF === 'string' ? pF : textoDe(pF))).join('');
}
