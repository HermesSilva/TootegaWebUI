/**
 * Serialização da árvore MathML para texto XML (o que vai no HTML/DocBook exportado e no `annotation`).
 */

import type { ElementoMathML } from './arvore';

function escapar(pTexto: string): string {
  return pTexto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function paraXML(pElemento: ElementoMathML): string {
  const atributos = Object.entries(pElemento.atributos)
    .map(([nome, valor]) => ` ${nome}="${escapar(valor)}"`)
    .join('');
  if (pElemento.filhos.length === 0)
    return `<${pElemento.nome}${atributos}/>`;
  const filhos = pElemento.filhos.map((pF) => (typeof pF === 'string' ? escapar(pF) : paraXML(pF))).join('');
  return `<${pElemento.nome}${atributos}>${filhos}</${pElemento.nome}>`;
}
