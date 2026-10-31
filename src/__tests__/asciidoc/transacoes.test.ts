/**
 * TRANSAÇÕES do editor AsciiDoc: inserir, apagar, dividir, unir, marcar, listas e tabela — puras, sobre o modelo,
 * com compartilhamento estrutural (o bloco não tocado é o MESMO objeto).
 */
import { describe, expect, it } from 'vitest';
import { analisarAsciiDoc } from '@core/components/asciidoc/parser/blocos';
import { serializarDocumento } from '@core/components/asciidoc/serializador/serializar';
import { folhasDoDocumento, textoPuro } from '@core/components/asciidoc/modelo/documento';
import { selecaoColapsada, type Selecao } from '@core/components/asciidoc/editor/selecao';
import {
  alternarLista,
  alternarMarca,
  apagarIntervalo,
  apagarParaTras,
  dividirBloco,
  inserirLinhaNaTabela,
  inserirTexto,
  recuarItem,
  selecaoTemMarca,
} from '@core/components/asciidoc/editor/transacoes';
import type { Documento } from '@core/components/asciidoc/modelo/tipos';

function doc(pTexto: string): Documento {
  return analisarAsciiDoc(pTexto).documento;
}

function folha(pDocumento: Documento, pIndice: number): string {
  return folhasDoDocumento(pDocumento)[pIndice].folha.id;
}

function intervalo(pDocumento: Documento, pDe: [number, number], pAte: [number, number]): Selecao {
  return { ancora: { folha: folha(pDocumento, pDe[0]), deslocamento: pDe[1] }, foco: { folha: folha(pDocumento, pAte[0]), deslocamento: pAte[1] } };
}

describe('transações do editor AsciiDoc', () => {
  it('inserir texto herda as marcas da posição e não toca os outros blocos', () => {
    const d = doc('Um *negrito* aqui.\n\nSegundo parágrafo.');
    const r = inserirTexto(d, selecaoColapsada(folha(d, 0), 6), 'XY');
    expect(serializarDocumento(r.documento)).toBe('Um *negXYrito* aqui.\n\nSegundo parágrafo.');
    expect(r.documento.blocos[1]).toBe(d.blocos[1]);
    expect(r.selecao?.foco.deslocamento).toBe(8);
  });

  it('apagar intervalo entre folhas funde a cabeça da primeira com a cauda da última', () => {
    const d = doc('Primeiro.\n\nSegundo.\n\nTerceiro.');
    const r = apagarIntervalo(d, intervalo(d, [0, 3], [2, 3]));
    expect(serializarDocumento(r.documento)).toBe('Priceiro.');
    expect(r.selecao?.ancora.deslocamento).toBe(3);
  });

  it('Enter divide o parágrafo e Backspace no início une de volta', () => {
    const d = doc('Antes depois');
    const dividido = dividirBloco(d, selecaoColapsada(folha(d, 0), 5));
    expect(serializarDocumento(dividido.documento)).toBe('Antes\n\n depois');
    const unido = apagarParaTras(dividido.documento, dividido.selecao as Selecao);
    expect(serializarDocumento(unido.documento)).toBe('Antes depois');
  });

  it('Enter em item vazio sai da lista; em item com texto cria outro item', () => {
    const d = doc('* um\n* dois');
    const r = dividirBloco(d, selecaoColapsada(folha(d, 1), 4));
    expect(serializarDocumento(r.documento)).toBe('* um\n* dois\n* ');
    const saida = dividirBloco(r.documento, r.selecao as Selecao);
    expect(serializarDocumento(saida.documento)).toBe('* um\n* dois\n\n');
    expect(saida.documento.blocos[1].tipo).toBe('paragrafo');
  });

  it('alternar marca aplica e remove, inclusive atravessando folhas', () => {
    const d = doc('abc\n\ndef');
    const sel = intervalo(d, [0, 1], [1, 2]);
    const marcado = alternarMarca(d, sel, { tipo: 'negrito' });
    // Colado a uma letra, o par constrained não valeria: o serializador escolhe o unconstrained.
    expect(serializarDocumento(marcado.documento)).toBe('a**bc**\n\n**de**f');
    expect(selecaoTemMarca(marcado.documento, sel, 'negrito')).toBe(true);
    const limpo = alternarMarca(marcado.documento, sel, { tipo: 'negrito' });
    expect(serializarDocumento(limpo.documento)).toBe('abc\n\ndef');
  });

  it('lista: parágrafo vira item, funde com a lista vizinha, e recuar aninha', () => {
    const d = doc('* um\n\nparágrafo');
    const lista = alternarLista(d, selecaoColapsada(folha(d, 1), 0), 'marcadores');
    expect(serializarDocumento(lista.documento)).toBe('* um\n* parágrafo');
    const folhas = folhasDoDocumento(lista.documento);
    const recuado = recuarItem(lista.documento, folhas[1], 1);
    expect(serializarDocumento(recuado.documento)).toBe('* um\n** parágrafo');
    const avancado = recuarItem(recuado.documento, folhasDoDocumento(recuado.documento)[1], -1);
    expect(serializarDocumento(avancado.documento)).toBe('* um\n* parágrafo');
  });

  it('tabela: inserir linha mantém o número de colunas', () => {
    const d = doc('|===\n|a |b\n|c |d\n|===');
    const tabela = d.blocos[0];
    const r = inserirLinhaNaTabela(d, tabela.id, 1);
    const nova = r.documento.blocos[0];
    if (nova.tipo !== 'tabela')
      throw new Error('esperava tabela');
    expect(nova.linhas).toHaveLength(3);
    expect(nova.linhas[1].celulas).toHaveLength(2);
    expect(textoPuro(nova.linhas[1].celulas[0].conteudo)).toBe('');
  });
});
