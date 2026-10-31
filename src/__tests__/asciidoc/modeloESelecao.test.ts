/**
 * MODELO, SELEÇÃO E HISTÓRICO do editor AsciiDoc: os utilitários imutáveis sobre o conteúdo inline (marcas, átomos,
 * fatias, normalização), o percurso das folhas em toda espécie de bloco, a busca de blocos, a seleção (ordem,
 * ajuste, folhas tocadas) e o histórico por instantâneos com agrupamento de digitação.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analisarAsciiDoc, documentoVazio } from '@core/components/asciidoc/parser/blocos';
import {
  atomo,
  atomoNaPosicao,
  comprimentoInline,
  concatenarInline,
  encontrarBloco,
  fatiarInline,
  filhosDoBloco,
  folhaPorID,
  folhasDoDocumento,
  indiceDaFolha,
  marcasIguais,
  marcasNaPosicao,
  normalizarInline,
  novoID,
  primeiraFolha,
  temMarca,
  texto,
  textoDoDocumento,
  textoPuro,
} from '@core/components/asciidoc/modelo/documento';
import { ajustarSelecao, compararPosicoes, estaColapsada, folhasDaSelecao, ordenarSelecao, posicao, posicoesIguais, selecaoColapsada, selecoesIguais } from '@core/components/asciidoc/editor/selecao';
import { Historico } from '@core/components/asciidoc/editor/historico';
import type { Documento, Inline } from '@core/components/asciidoc/modelo/tipos';

function doc(pTexto: string): Documento {
  return analisarAsciiDoc(pTexto).documento;
}

describe('conteúdo inline', () => {
  it('ids são únicos; texto e átomo nascem com os campos certos', () => {
    expect(novoID()).not.toBe(novoID());
    expect(texto('a')).toEqual({ tipo: 'texto', texto: 'a', marcas: [] });
    expect(atomo('tecla')).toEqual({ tipo: 'atomo', especie: 'tecla', dados: {} });
  });

  it('marcas: igualdade por tipo e valor, busca por tipo, marcas e átomo na posição', () => {
    expect(marcasIguais([{ tipo: 'negrito' }], [{ tipo: 'negrito' }])).toBe(true);
    expect(marcasIguais([{ tipo: 'negrito' }], [{ tipo: 'italico' }])).toBe(false);
    expect(marcasIguais([{ tipo: 'link', valor: 'a' }], [{ tipo: 'link', valor: 'b' }])).toBe(false);
    expect(temMarca([{ tipo: 'link', valor: 'x' }], 'link')?.valor).toBe('x');
    expect(temMarca([], 'link')).toBeUndefined();

    const conteudo: Inline[] = [texto('ab', [{ tipo: 'negrito' }]), atomo('tecla', { texto: 'A' }), texto('cd')];
    expect(comprimentoInline(conteudo)).toBe(5);
    expect(textoPuro(conteudo)).toBe('ab￼cd');
    expect(marcasNaPosicao(conteudo, 0)).toEqual([{ tipo: 'negrito' }]);
    expect(marcasNaPosicao(conteudo, 2)).toEqual([{ tipo: 'negrito' }]);
    expect(marcasNaPosicao(conteudo, 3)).toEqual([]);
    expect(marcasNaPosicao(conteudo, 5)).toEqual([]);
    expect(marcasNaPosicao([atomo('tecla')], 0)).toEqual([]);
    expect(marcasNaPosicao([], 0)).toEqual([]);
    expect(atomoNaPosicao(conteudo, 2)?.especie).toBe('tecla');
    expect(atomoNaPosicao(conteudo, 1)).toBeUndefined();
  });

  it('fatiar corta trechos, mantém átomos inteiros e normaliza; concatenar funde vizinhos iguais', () => {
    const conteudo: Inline[] = [texto('abc'), atomo('tecla'), texto('def', [{ tipo: 'italico' }])];
    expect(textoPuro(fatiarInline(conteudo, 1, 5))).toBe('bc￼d');
    expect(fatiarInline(conteudo, 3, 4)).toEqual([atomo('tecla')]);
    expect(fatiarInline(conteudo, 0, 0)).toEqual([]);
    expect(concatenarInline([texto('a')], [texto('b')], [texto('c', [{ tipo: 'negrito' }])])).toEqual([texto('ab'), texto('c', [{ tipo: 'negrito' }])]);
    expect(normalizarInline([texto(''), texto('x'), texto('')])).toEqual([texto('x')]);
  });
});

describe('folhas e blocos', () => {
  const d = doc('= Doc\n\n== T\n\npar\n\n* item\n** sub\n\ntermo:: desc\n\n<1> chamada\n\nNOTE: nota\n\n====\nex\n====\n\n|===\n|c1 |c2\n|===\n\n----\ncod\n----');

  it('percorre toda espécie de folha em ordem de leitura, com a cadeia e o item', () => {
    const folhas = folhasDoDocumento(d);
    expect(folhas.map((pF) => pF.especie)).toEqual(['titulo', 'paragrafo', 'item', 'item', 'termo', 'paragrafo', 'chamada', 'paragrafo', 'paragrafo', 'celula', 'celula']);
    const sub = folhas[3];
    expect(sub.cadeia.map((pB) => pB.tipo)).toEqual(['lista', 'lista']);
    expect(sub.item?.id).toBe(sub.folha.id);
    const nota = folhas[7];
    expect(nota.cadeia[0].tipo).toBe('admonicao');
    // Memoizado: o mesmo documento devolve o mesmo vetor.
    expect(folhasDoDocumento(d)).toBe(folhas);
    expect(primeiraFolha(d)?.especie).toBe('titulo');
    expect(primeiraFolha({ blocos: [] })).toBeUndefined();
    expect(folhaPorID(d, folhas[4].folha.id)?.especie).toBe('termo');
    expect(indiceDaFolha(d, folhas[4].folha.id)).toBe(4);
    expect(indiceDaFolha(d, 'nao')).toBe(-1);
  });

  it('encontra bloco em qualquer profundidade e lista os grupos de filhos', () => {
    const lista = d.blocos.find((pB) => pB.tipo === 'lista')!;
    const sub = lista.tipo === 'lista' ? lista.itens[0].filhos[0] : undefined;
    expect(encontrarBloco(d.blocos, sub!.id)).toBe(sub);
    const admonicao = d.blocos.find((pB) => pB.tipo === 'admonicao')!;
    const interno = admonicao.tipo === 'admonicao' ? admonicao.filhos[0] : undefined;
    expect(encontrarBloco(d.blocos, interno!.id)).toBe(interno);
    expect(encontrarBloco(d.blocos, 'nao')).toBeUndefined();
    expect(filhosDoBloco(lista)).toHaveLength(1);
    expect(filhosDoBloco(admonicao)).toHaveLength(1);
    expect(filhosDoBloco(d.blocos[0])).toEqual([]);
  });

  it('o texto do documento junta título, folhas e código, para a contagem de palavras', () => {
    const t = textoDoDocumento(d);
    expect(t.startsWith('Doc\nT\npar')).toBe(true);
    expect(t.endsWith('cod')).toBe(true);
    expect(textoDoDocumento({ blocos: [] })).toBe('');
  });

  it('documento vazio nasce com um parágrafo editável', () => {
    const v = documentoVazio();
    expect(v.blocos).toHaveLength(1);
    expect(v.blocos[0].tipo).toBe('paragrafo');
  });
});

describe('seleção', () => {
  const d = doc('ab\n\ncd\n\nef');
  const f = (pI: number): string => folhasDoDocumento(d)[pI].folha.id;

  it('colapsada, igualdade e comparação de posições', () => {
    expect(estaColapsada(selecaoColapsada(f(0), 1))).toBe(true);
    expect(estaColapsada({ ancora: posicao(f(0), 1), foco: posicao(f(0), 2) })).toBe(false);
    expect(posicoesIguais(posicao(f(0), 1), posicao(f(0), 1))).toBe(true);
    expect(selecoesIguais(null, null)).toBe(true);
    expect(selecoesIguais(selecaoColapsada(f(0), 1), null)).toBe(false);
    expect(selecoesIguais(selecaoColapsada(f(0), 1), selecaoColapsada(f(0), 1))).toBe(true);
    expect(selecoesIguais(selecaoColapsada(f(0), 1), selecaoColapsada(f(1), 1))).toBe(false);
    expect(compararPosicoes(d, posicao(f(0), 2), posicao(f(0), 1))).toBe(1);
    expect(compararPosicoes(d, posicao(f(0), 2), posicao(f(2), 0))).toBeLessThan(0);
  });

  it('ordena a seleção invertida e lista as folhas tocadas', () => {
    const invertida = { ancora: posicao(f(2), 1), foco: posicao(f(0), 1) };
    expect(ordenarSelecao(d, invertida)).toEqual({ inicio: posicao(f(0), 1), fim: posicao(f(2), 1) });
    expect(folhasDaSelecao(d, invertida)).toEqual([f(0), f(1), f(2)]);
    expect(folhasDaSelecao(d, { ancora: posicao('nao', 0), foco: posicao(f(0), 0) })).toEqual([]);
  });

  it('ajusta a seleção a folhas que existem e a deslocamentos dentro do conteúdo', () => {
    expect(ajustarSelecao(d, null)).toBeNull();
    expect(ajustarSelecao({ blocos: [] }, selecaoColapsada(f(0), 0))).toBeNull();
    expect(ajustarSelecao(d, selecaoColapsada('nao', 5))).toEqual(selecaoColapsada(f(0), 0));
    expect(ajustarSelecao(d, selecaoColapsada(f(1), 99))).toEqual(selecaoColapsada(f(1), 2));
    const dentro = selecaoColapsada(f(1), 1);
    expect(ajustarSelecao(d, dentro)).toEqual(dentro);
  });
});

describe('histórico', () => {
  const a: Documento = { blocos: [] };
  const b: Documento = { blocos: [] };
  const c: Documento = { blocos: [] };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('desfaz e refaz por instantâneos; refazer some quando se registra algo novo', () => {
    const h = new Historico();
    expect(h.podeDesfazer).toBe(false);
    expect(h.desfazer({ documento: a, selecao: null })).toBeNull();
    expect(h.refazer({ documento: a, selecao: null })).toBeNull();

    h.registrar({ documento: a, selecao: null });
    expect(h.podeDesfazer).toBe(true);
    const anterior = h.desfazer({ documento: b, selecao: null });
    expect(anterior?.documento).toBe(a);
    expect(h.podeRefazer).toBe(true);
    expect(h.refazer({ documento: a, selecao: null })?.documento).toBe(b);
    h.desfazer({ documento: b, selecao: null });
    h.registrar({ documento: c, selecao: null });
    expect(h.podeRefazer).toBe(false);
  });

  it('digitação consecutiva no mesmo grupo e dentro da janela não cria entrada nova; fechar o grupo cria', () => {
    const h = new Historico();
    h.registrar({ documento: a, selecao: null }, 'digitar');
    vi.advanceTimersByTime(100);
    h.registrar({ documento: b, selecao: null }, 'digitar');
    expect(h.desfazer({ documento: c, selecao: null })?.documento).toBe(a);
    expect(h.podeDesfazer).toBe(false);

    const outro = new Historico();
    outro.registrar({ documento: a, selecao: null }, 'digitar');
    outro.fecharGrupo();
    outro.registrar({ documento: b, selecao: null }, 'digitar');
    expect(outro.desfazer({ documento: c, selecao: null })?.documento).toBe(b);
    expect(outro.desfazer({ documento: b, selecao: null })?.documento).toBe(a);

    const lento = new Historico();
    lento.registrar({ documento: a, selecao: null }, 'digitar');
    vi.advanceTimersByTime(2000);
    lento.registrar({ documento: b, selecao: null }, 'digitar');
    expect(lento.desfazer({ documento: c, selecao: null })?.documento).toBe(b);
  });

  it('o passado tem limite e limpar zera tudo', () => {
    const h = new Historico();
    for (let i = 0; i < 450; i++) {
      h.registrar({ documento: { blocos: [] }, selecao: null });
      vi.advanceTimersByTime(1000);
    }
    let contagem = 0;
    while (h.desfazer({ documento: a, selecao: null }))
      contagem += 1;
    expect(contagem).toBe(400);
    h.registrar({ documento: a, selecao: null });
    h.limpar();
    expect(h.podeDesfazer).toBe(false);
    expect(h.podeRefazer).toBe(false);
  });
});
