/**
 * TOKENIZADORES de MARCAÇÃO do editor de código: XML/HTML, CSS, YAML e Markdown. Cada um é um tokenizador de linha
 * com estado — o que se cobra aqui é o estado atravessando linhas (comentário, CDATA, bloco de regras, cerca) e a
 * classificação de cada pedaço da linha.
 */
import { describe, expect, it } from 'vitest';
import { CSS, MARKDOWN, XML, YAML } from '@core/components/asciidoc/codigo/linguagens/marcacao';
import type { Linguagem } from '@core/components/asciidoc/codigo/tokens';

function tipos(pLinguagem: Linguagem, pLinha: string, pEstado = ''): string[] {
  return pLinguagem.tokenizarLinha(pLinha, pEstado).tokens.map((pT) => `${pT.tipo}:${pLinha.slice(pT.ini, pT.fim)}`);
}

describe('XML / HTML', () => {
  it('etiqueta, atributo, valor e texto', () => {
    // O coletor funde vizinhos do mesmo tipo: `</a` e `>` saem como um token só.
    expect(tipos(XML, '<a href="x">t</a>')).toEqual(['etiqueta:<a', 'atributo:href', 'operador:=', 'texto:"x"', 'etiqueta:>', 'normal:t', 'etiqueta:</a>']);
  });

  it('auto-fechamento, declaração XML e entidade', () => {
    expect(tipos(XML, '<br/>')).toEqual(['etiqueta:<br/>']);
    expect(tipos(XML, '<?xml version="1.0"?>')).toEqual(['etiqueta:<?xml', 'atributo:version', 'operador:=', 'texto:"1.0"', 'etiqueta:?>']);
    // A entidade só é reconhecida no início de um trecho de texto (logo depois de uma etiqueta); no meio do texto
    // corrido ela segue como texto normal, porque o texto vai inteiro até o próximo `<`.
    expect(tipos(XML, '<p>&amp;b')).toEqual(['etiqueta:<p>', 'escape:&amp;', 'normal:b']);
    expect(tipos(XML, 'a &amp; b')).toEqual(['normal:a &amp; b']);
    expect(tipos(XML, '<!DOCTYPE html>')).toEqual(['macro:<!DOCTYPE html>']);
  });

  it('comentário atravessa linhas pelo estado', () => {
    const primeira = XML.tokenizarLinha('<p>x</p> <!-- abre', '');
    expect(primeira.estadoFinal).toBe('comentario');
    expect(primeira.tokens[primeira.tokens.length - 1].tipo).toBe('comentario');
    const segunda = XML.tokenizarLinha('fim --><b>', primeira.estadoFinal);
    expect(segunda.tokens.map((pT) => pT.tipo)).toEqual(['comentario', 'etiqueta']);
    expect(segunda.estadoFinal).toBe('');
  });

  it('CDATA atravessa linhas e fecha com ]]>', () => {
    const primeira = XML.tokenizarLinha('<![CDATA[um <b>', '');
    expect(primeira.tokens.map((pT) => pT.tipo)).toEqual(['macro', 'texto']);
    expect(primeira.estadoFinal).toBe('cdata');
    const segunda = XML.tokenizarLinha('dois]]><i>', 'cdata');
    expect(segunda.tokens.map((pT) => pT.tipo)).toEqual(['texto', 'etiqueta']);
    expect(segunda.estadoFinal).toBe('');
  });

  it('etiqueta aberta na linha: aspas sem fechamento e caractere estranho', () => {
    const aberta = XML.tokenizarLinha('<a b="sem fim', '');
    expect(aberta.estadoFinal).toBe('etiqueta');
    expect(aberta.tokens.map((pT) => pT.tipo)).toEqual(['etiqueta', 'atributo', 'operador', 'texto']);
    expect(tipos(XML, '<a @>')).toEqual(['etiqueta:<a', 'normal:@', 'etiqueta:>']);
  });

  it('apelidos e rótulo', () => {
    expect(XML.apelidos).toContain('html');
    expect(XML.rotulo).toBe('XML / HTML');
  });
});

describe('CSS', () => {
  it('seletores: etiqueta, classe, id, pseudo e regra @', () => {
    expect(tipos(CSS, 'a.x#y::before')).toEqual(['etiqueta:a', 'atributo:.x', 'constante:#y', 'tipo:::before']);
    const regra = CSS.tokenizarLinha('@media (max-width: 600px) {', '');
    expect(regra.tokens[0]).toMatchObject({ tipo: 'palavraChave', ini: 0, fim: 6 });
    expect(regra.estadoFinal).toBe('bloco');
  });

  it('dentro do bloco: propriedade, número, cor, função, !important, palavra e pontuação', () => {
    expect(tipos(CSS, 'color: #fff;', 'bloco')).toEqual(['propriedade:color', 'pontuacao::', 'constante:#fff', 'pontuacao:;']);
    expect(tipos(CSS, 'margin: 1.5em !important;', 'bloco')).toEqual(['propriedade:margin', 'pontuacao::', 'numero:1.5em', 'palavraChave:!important', 'pontuacao:;']);
    expect(tipos(CSS, 'background: url("x.png") no-repeat;', 'bloco')).toEqual([
      'propriedade:background',
      'pontuacao::',
      'funcao:url',
      'operador:(',
      'texto:"x.png"',
      'operador:)',
      'normal:no-repeat',
      'pontuacao:;',
    ]);
    expect(tipos(CSS, '--cor: 1;', 'bloco')).toEqual(['propriedade:--cor', 'pontuacao::', 'numero:1', 'pontuacao:;']);
    expect(tipos(CSS, 'x: a+b;', 'bloco')).toEqual(['propriedade:x', 'pontuacao::', 'normal:a', 'operador:+', 'normal:b', 'pontuacao:;']);
  });

  it('abre e fecha o bloco pela chave; fecha o estado ao sair', () => {
    const abre = CSS.tokenizarLinha('p {', '');
    expect(abre.estadoFinal).toBe('bloco');
    const fecha = CSS.tokenizarLinha('}', 'bloco');
    expect(fecha.tokens).toEqual([{ ini: 0, fim: 1, tipo: 'pontuacao' }]);
    expect(fecha.estadoFinal).toBe('');
  });

  it('comentário: fechado na linha volta ao estado anterior; aberto atravessa linhas', () => {
    expect(tipos(CSS, 'color: /* nota */ red;', 'bloco')).toEqual(['propriedade:color', 'pontuacao::', 'comentario:/* nota */', 'normal:red', 'pontuacao:;']);
    const aberto = CSS.tokenizarLinha('a { /* abre', '');
    expect(aberto.estadoFinal).toBe('comentario');
    const continua = CSS.tokenizarLinha('ainda', 'comentario');
    expect(continua.tokens).toEqual([{ ini: 0, fim: 5, tipo: 'comentario' }]);
    expect(continua.estadoFinal).toBe('comentario');
    const fecha = CSS.tokenizarLinha('fim */ b', 'comentario');
    expect(fecha.tokens.map((pT) => pT.tipo)).toEqual(['comentario', 'etiqueta']);
    expect(fecha.estadoFinal).toBe('');
  });

  it('string no seletor e operador solto', () => {
    expect(tipos(CSS, "a[x='1'] > b")).toEqual(['etiqueta:a', 'operador:[', 'etiqueta:x', 'operador:=', "texto:'1'", 'operador:]', 'operador:>', 'etiqueta:b']);
  });
});

describe('YAML', () => {
  it('chave, valor e comentário', () => {
    expect(tipos(YAML, 'chave: valor # nota')).toEqual(['propriedade:chave', 'pontuacao::', 'normal:valor', 'comentario:# nota']);
    expect(tipos(YAML, '# só comentário')).toEqual(['comentario:# só comentário']);
  });

  it('tipos de valor: texto, número, constante e macro (âncora, bloco literal)', () => {
    expect(tipos(YAML, 'nome: "texto"')).toEqual(['propriedade:nome', 'pontuacao::', 'texto:"texto"']);
    expect(tipos(YAML, 'n: 42')).toEqual(['propriedade:n', 'pontuacao::', 'numero:42']);
    expect(tipos(YAML, 'b: true')).toEqual(['propriedade:b', 'pontuacao::', 'constante:true']);
    expect(tipos(YAML, 't: |')).toEqual(['propriedade:t', 'pontuacao::', 'macro:|']);
    expect(tipos(YAML, 'a: &ancora x')).toEqual(['propriedade:a', 'pontuacao::', 'macro:&ancora x']);
  });

  it('itens de lista e delimitadores de documento', () => {
    expect(tipos(YAML, '- item')).toEqual(['pontuacao:-', 'normal:item']);
    expect(tipos(YAML, '  - chave: 1')).toEqual(['pontuacao:-', 'propriedade:chave', 'pontuacao::', 'numero:1']);
    // O traço sozinho é marcado como pontuação E como valor (os dois tokens cobrem o mesmo caractere).
    expect(tipos(YAML, '-')).toEqual(['pontuacao:-', 'normal:-']);
    // O delimitador de documento também recebe a marca de valor (os dois tokens cobrem a linha).
    expect(tipos(YAML, '---')).toEqual(['normal:---', 'delimitador:---']);
    expect(YAML.tokenizarLinha('x', 'qualquer').estadoFinal).toBe('');
    expect(YAML.comentarioDeLinha).toBe('#');
  });
});

describe('Markdown', () => {
  it('cerca de código atravessa linhas', () => {
    const abre = MARKDOWN.tokenizarLinha('```js', '');
    expect(abre.tokens[0].tipo).toBe('delimitador');
    expect(abre.estadoFinal).toBe('cerca');
    const dentro = MARKDOWN.tokenizarLinha('const x = 1;', 'cerca');
    expect(dentro.tokens).toEqual([{ ini: 0, fim: 12, tipo: 'texto' }]);
    expect(dentro.estadoFinal).toBe('cerca');
    const fecha = MARKDOWN.tokenizarLinha('```', 'cerca');
    expect(fecha.tokens[0].tipo).toBe('delimitador');
    expect(fecha.estadoFinal).toBe('');
  });

  it('título, lista, citação e inline', () => {
    expect(tipos(MARKDOWN, '## Título')).toEqual(['titulo:## Título']);
    expect(tipos(MARKDOWN, '- item **forte** _ênfase_ `código` [link](http://x)')).toEqual([
      'pontuacao:- ',
      'forte:**forte**',
      'enfase:_ênfase_',
      'texto:`código`',
      'link:[link](http://x)',
    ]);
    expect(tipos(MARKDOWN, '> citação')).toEqual(['pontuacao:>']);
    expect(tipos(MARKDOWN, '1. __forte__ *leve* ![alt](i.png)')).toEqual(['pontuacao:1. ', 'forte:__forte__', 'enfase:*leve*', 'link:![alt](i.png)']);
  });
});
