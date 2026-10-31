// @vitest-environment jsdom
/**
 * MAPEAMENTO DOM ↔ MODELO da vista visual: o contrato é que toda folha é `[data-folha]`, cada trecho de texto é um
 * `<span data-ini>` com um nó de texto, e cada átomo é `[data-atomo]` valendo UMA posição. Aqui se cobra a
 * conversão nos dois sentidos e a releitura do DOM depois de uma mutação que o navegador fez sozinho.
 */
import { describe, expect, it } from 'vitest';
import { deslocamentoNoDOM, elementoDaFolha, elementoDaFolhaPorID, lerConteudoDoDOM, pontoDoModelo } from '@core/components/asciidoc/wysiwyg/mapeamentoDOM';
import type { Inline } from '@core/components/asciidoc/modelo/tipos';

/** Monta a folha como o `renderizarInline` a monta: span por trecho, [data-atomo] por átomo, <br> por quebra. */
function folha(pHTML: string, pID = 'f1'): HTMLElement {
  const raiz = document.createElement('div');
  raiz.innerHTML = `<p data-folha="${pID}" class="adc-folha">${pHTML}</p>`;
  document.body.appendChild(raiz);
  return raiz.querySelector('[data-folha]') as HTMLElement;
}

const CONTEUDO: Inline[] = [
  { tipo: 'texto', texto: 'ab', marcas: [{ tipo: 'negrito' }] },
  { tipo: 'atomo', especie: 'tecla', dados: { texto: 'A' } },
  { tipo: 'texto', texto: 'cd', marcas: [] },
];
const HTML = '<span data-ini="0" class="adc-negrito">ab</span><span data-ini="2" data-atomo="tecla" contenteditable="false">A</span><span data-ini="3">cd</span>';

describe('elemento da folha', () => {
  it('acha a folha a partir de um nó de texto, de um elemento, por id, e devolve null fora dela', () => {
    const f = folha(HTML);
    const textoAB = f.firstChild!.firstChild as Text;
    expect(elementoDaFolha(textoAB)).toBe(f);
    expect(elementoDaFolha(f.lastChild)).toBe(f);
    expect(elementoDaFolha(null)).toBeNull();
    expect(elementoDaFolha(document.body)).toBeNull();
    expect(elementoDaFolhaPorID(document.body, 'f1')).toBe(f);
    expect(elementoDaFolhaPorID(document.body, 'nao')).toBeNull();
  });
});

describe('DOM → modelo (deslocamentoNoDOM)', () => {
  it('conta o texto até o ponto e cada átomo como uma posição', () => {
    const f = folha(HTML);
    const [spanAB, atomo, spanCD] = Array.from(f.childNodes);
    expect(deslocamentoNoDOM(f, spanAB.firstChild as Text, 1)).toBe(1);
    expect(deslocamentoNoDOM(f, spanCD.firstChild as Text, 2)).toBe(5);
    // Ponto "antes do elemento N" no próprio parágrafo.
    expect(deslocamentoNoDOM(f, f, 1)).toBe(2);
    expect(deslocamentoNoDOM(f, f, 2)).toBe(3);
    // Fim do parágrafo: tudo o que há nele.
    expect(deslocamentoNoDOM(f, f, 3)).toBe(5);
    // Ponto dentro do átomo cai logo depois dele.
    expect(deslocamentoNoDOM(f, atomo.firstChild as Text, 0)).toBe(3);
    // Fim de um span interno: conta o texto dele inteiro.
    expect(deslocamentoNoDOM(f, spanAB, 1)).toBe(2);
  });

  it('ignora <br> de folha vazia e atravessa elementos aninhados criados pelo navegador', () => {
    const vazia = folha('<br data-vazio="">', 'v');
    expect(deslocamentoNoDOM(vazia, vazia, 0)).toBe(0);
    const aninhada = folha('<span data-ini="0">a<b>bc</b></span>', 'n');
    const negrito = aninhada.querySelector('b') as HTMLElement;
    expect(deslocamentoNoDOM(aninhada, negrito.firstChild as Text, 2)).toBe(3);
  });
});

describe('modelo → DOM (pontoDoModelo)', () => {
  it('leva o deslocamento ao nó de texto certo, à borda do átomo ou ao fim da folha', () => {
    const f = folha(HTML);
    const [spanAB, atomo, spanCD] = Array.from(f.childNodes);
    expect(pontoDoModelo(f, 1)).toEqual({ no: spanAB.firstChild, deslocamento: 1 });
    // Posição 2 ainda cabe no fim do texto "ab"; a borda antes do átomo pertence ao trecho anterior.
    expect(pontoDoModelo(f, 2)).toEqual({ no: spanAB.firstChild, deslocamento: 2 });
    expect(pontoDoModelo(f, 3)).toEqual({ no: f, deslocamento: Array.from(f.childNodes).indexOf(atomo as ChildNode) + 1 });
    expect(pontoDoModelo(f, 5)).toEqual({ no: spanCD.firstChild, deslocamento: 2 });
    // Além do fim: o último texto, no fim dele.
    expect(pontoDoModelo(f, 99)).toEqual({ no: spanCD.firstChild, deslocamento: 2 });
  });

  it('átomo no início e folha vazia', () => {
    const comAtomo = folha('<span data-ini="0" data-atomo="tecla" contenteditable="false">A</span><span data-ini="1">x</span>', 'a');
    expect(pontoDoModelo(comAtomo, 0)).toEqual({ no: comAtomo, deslocamento: 0 });
    const vazia = folha('<br data-vazio="">', 'v2');
    expect(pontoDoModelo(vazia, 0)).toEqual({ no: vazia, deslocamento: 0 });
    const semNada = folha('', 'v3');
    expect(pontoDoModelo(semNada, 0)).toEqual({ no: semNada, deslocamento: 0 });
  });
});

describe('releitura do DOM (lerConteudoDoDOM)', () => {
  it('texto dentro de um trecho herda as marcas dele; texto solto herda as do trecho anterior; átomos vêm do modelo', () => {
    const f = folha(HTML);
    // O navegador inseriu "X" no negrito e um <i> solto depois do átomo.
    (f.firstChild!.firstChild as Text).data = 'aXb';
    const solto = document.createElement('i');
    solto.textContent = 'Z';
    f.insertBefore(solto, f.lastChild);
    const lido = lerConteudoDoDOM(f, CONTEUDO);
    // O texto solto herda as marcas do ÚLTIMO trecho visitado (o negrito), não as do trecho seguinte.
    expect(lido).toEqual([
      { tipo: 'texto', texto: 'aXb', marcas: [{ tipo: 'negrito' }] },
      { tipo: 'atomo', especie: 'tecla', dados: { texto: 'A' } },
      { tipo: 'texto', texto: 'Z', marcas: [{ tipo: 'negrito' }] },
      { tipo: 'texto', texto: 'cd', marcas: [] },
    ]);
  });

  it('descarta o espaço de largura zero, ignora <br> e átomo que o modelo não conhece', () => {
    const f = folha('<span data-ini="0">a​b</span><br><span data-ini="9" data-atomo="tecla">?</span>', 'z');
    expect(lerConteudoDoDOM(f, [{ tipo: 'texto', texto: 'ab', marcas: [] }])).toEqual([{ tipo: 'texto', texto: 'ab', marcas: [] }]);
    const soTexto = folha('novo', 'w');
    expect(lerConteudoDoDOM(soTexto, [{ tipo: 'texto', texto: 'x', marcas: [{ tipo: 'italico' }] }])).toEqual([{ tipo: 'texto', texto: 'novo', marcas: [] }]);
  });
});
