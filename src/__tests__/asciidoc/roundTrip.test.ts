/**
 * ROUND-TRIP do editor AsciiDoc (RE-3 do plano): `serializar(analisar(x))` é estável na segunda passagem, e as
 * construções do documento de exemplo chegam ao modelo com o tipo certo.
 */
import { describe, expect, it } from 'vitest';
import { analisarAsciiDoc } from '@core/components/asciidoc/parser/blocos';
import { serializarDocumento, serializarInline } from '@core/components/asciidoc/serializador/serializar';
import { analisarInline } from '@core/components/asciidoc/parser/inline';
import { DOCUMENTO_DE_EXEMPLO } from '@core/components/asciidoc/exemplo/documentoDeExemplo';
import { textoPuro } from '@core/components/asciidoc/modelo/documento';
import type { Bloco } from '@core/components/asciidoc/modelo/tipos';

function tipos(pBlocos: Bloco[]): string[] {
  return pBlocos.map((pB) => pB.tipo);
}

describe('parser e serializador AsciiDoc', () => {
  it('round-trip do documento de exemplo é estável na segunda passagem', () => {
    const primeira = serializarDocumento(analisarAsciiDoc(DOCUMENTO_DE_EXEMPLO).documento);
    const segunda = serializarDocumento(analisarAsciiDoc(primeira).documento);
    expect(segunda).toBe(primeira);
  });

  it('o documento de exemplo não gera aviso do parser', () => {
    const { avisos } = analisarAsciiDoc(DOCUMENTO_DE_EXEMPLO);
    expect(avisos).toEqual([]);
  });

  it('lê o cabeçalho: título, autores, revisão e atributos', () => {
    const { documento } = analisarAsciiDoc(DOCUMENTO_DE_EXEMPLO);
    expect(documento.cabecalho).toBeDefined();
    expect(textoPuro(documento.cabecalho?.titulo ?? [])).toBe('Guia do editor AsciiDoc');
    expect(documento.cabecalho?.autores).toBe('Equipe Tootega <anvil@tootega.com.br>');
    expect(documento.cabecalho?.revisao).toBe('v1.0, 2026-10-28: primeira versão');
    expect(documento.cabecalho?.atributos.map((pA) => pA.nome)).toEqual(['toc', 'experimental', 'produto']);
  });

  it('reconhece cada espécie de bloco do exemplo', () => {
    const { documento } = analisarAsciiDoc(DOCUMENTO_DE_EXEMPLO);
    const encontrados = new Set(tipos(documento.blocos));
    for (const tipo of ['paragrafo', 'titulo', 'lista', 'descricao', 'admonicao', 'container', 'codigo', 'chamadas', 'tabela', 'imagem', 'midia', 'quebraTematica', 'quebraDePagina', 'sumario', 'comentario', 'passagem', 'atributo', 'bruto'])
      expect(encontrados.has(tipo), `falta o bloco ${tipo}`).toBe(true);
  });

  it('lista aninhada e continuação ficam dentro do item', () => {
    const { documento } = analisarAsciiDoc('* a\n* b\n** b1\n*** b11\n* c\n+\nanexo\n');
    expect(documento.blocos).toHaveLength(1);
    const lista = documento.blocos[0];
    if (lista.tipo !== 'lista')
      throw new Error('esperava lista');
    expect(lista.itens).toHaveLength(3);
    expect(lista.itens[1].filhos[0].tipo).toBe('lista');
    expect(lista.itens[2].filhos[0].tipo).toBe('paragrafo');
    expect(serializarDocumento(documento)).toBe('* a\n* b\n** b1\n*** b11\n* c\n+\nanexo');
  });

  it('tabela: cabeçalho, colunas e mesclagem', () => {
    const { documento } = analisarAsciiDoc('[cols="1,2",options="header"]\n|===\n|A |B\n\n|1 |2\n2+^|Mesclada\n|===\n');
    const tabela = documento.blocos[0];
    if (tabela.tipo !== 'tabela')
      throw new Error('esperava tabela');
    expect(tabela.cabecalho).toBe(true);
    expect(tabela.numeroDeColunas).toBe(2);
    expect(tabela.linhas).toHaveLength(3);
    expect(tabela.linhas[2].celulas[0].colunas).toBe(2);
    expect(tabela.linhas[2].celulas[0].alinhamento).toBe('centro');
  });

  it('inline: pares constrained e unconstrained, link, referência e átomos', () => {
    const partes = analisarInline('*n* **N**egrito _i_ `m` #r# ^s^ ~b~ https://x.org[X] <<id,texto>> kbd:[Ctrl+S] {attr} fim +\nlinha');
    const marcas = partes.filter((pP) => pP.tipo === 'texto').flatMap((pP) => (pP.tipo === 'texto' ? pP.marcas.map((pM) => pM.tipo) : []));
    for (const tipo of ['negrito', 'italico', 'mono', 'realce', 'sobrescrito', 'subscrito', 'link'])
      expect(marcas, `falta a marca ${tipo}`).toContain(tipo);
    const atomos = partes.filter((pP) => pP.tipo === 'atomo').map((pP) => (pP.tipo === 'atomo' ? pP.especie : ''));
    expect(atomos).toEqual(['referencia', 'tecla', 'atributo', 'quebraDeLinha']);
  });

  it('inline: serialização escolhe constrained quando as bordas permitem e unconstrained quando não', () => {
    expect(serializarInline(analisarInline('a *b* c'))).toBe('a *b* c');
    expect(serializarInline(analisarInline('**N**egrito'))).toBe('**N**egrito');
    expect(serializarInline(analisarInline('*negrito com _itálico_ dentro*'))).toBe('*negrito com _itálico_ dentro*');
  });

  it('inline: escape sobrevive ao round-trip', () => {
    const original = 'Um \\*asterisco* literal e \\{attr} literal';
    const partes = analisarInline(original);
    expect(textoPuro(partes)).toBe('Um *asterisco* literal e {attr} literal');
    expect(textoPuro(analisarInline(serializarInline(partes)))).toBe('Um *asterisco* literal e {attr} literal');
  });

  it('o que não se reconhece vira bloco bruto e volta intacto', () => {
    const texto = 'include::x.adoc[]\n\nmacrodesconhecida::alvo[a=1]';
    const { documento } = analisarAsciiDoc(texto);
    expect(tipos(documento.blocos)).toEqual(['bruto', 'bruto']);
    expect(serializarDocumento(documento)).toBe(texto);
  });

  it('bloco delimitado sem fechamento gera aviso com a linha', () => {
    const { avisos } = analisarAsciiDoc('texto\n\n----\ncódigo sem fim\n');
    expect(avisos).toHaveLength(1);
    expect(avisos[0].linha).toBe(3);
    expect(avisos[0].texto).toContain('não foi fechado');
  });
});
