import { describe, expect, it } from 'vitest';
import { analisarFormula, paraXML } from '@core/lib/formula';
import { comClasse, el, textoDe } from '@core/lib/formula/mathml/arvore';
import { delimitadorDoTexto } from '@core/lib/formula/tex/delimitadores';
import { Lexer } from '@core/lib/formula/tex/lexer';
import { arredondar, cssDaMedida, emEm, lerMedida, medidaEm, medidaMu, unidadeValida } from '@core/lib/formula/tex/medidas';
import { comFonte, temVariante } from '@core/lib/formula/tex/unicode';

describe('medidas', () => {
  it('lê número com sinal e unidade; recusa o resto', () => {
    expect(lerMedida('2em')).toEqual({ numero: 2, unidade: 'em' });
    expect(lerMedida(' -1.5 pt ')).toEqual({ numero: -1.5, unidade: 'pt' });
    expect(lerMedida('')).toBeNull();
    expect(lerMedida('em')).toBeNull();
    expect(lerMedida('2zz')).toBeNull();
  });

  it('conhece as unidades do TeX', () => {
    for (const unidade of ['em', 'ex', 'mu', 'pt', 'mm', 'cm', 'in', 'bp', 'pc', 'dd', 'cc', 'nd', 'nc', 'sp', 'px'])
      expect(unidadeValida(unidade)).toBe(true);
    expect(unidadeValida('zz')).toBe(false);
  });

  it('converte para em', () => {
    expect(emEm({ numero: 3, unidade: 'em' })).toBe(3);
    expect(emEm({ numero: 18, unidade: 'mu' })).toBe(1);
    expect(emEm({ numero: 1, unidade: 'ex' })).toBeCloseTo(0.431);
    expect(emEm({ numero: 10, unidade: 'pt' })).toBeCloseTo(1);
    expect(emEm({ numero: 1, unidade: 'in' })).toBeCloseTo(7.227);
  });

  it('gera CSS e arredonda', () => {
    expect(cssDaMedida({ numero: 18, unidade: 'mu' })).toBe('1em');
    expect(cssDaMedida(medidaEm(2))).toBe('2em');
    expect(medidaMu(3)).toEqual({ numero: 3, unidade: 'mu' });
    expect(arredondar(0.16666666)).toBeCloseTo(0.1667, 4);
  });
});

describe('delimitadores', () => {
  it('traduz o comando; o ponto é o delimitador vazio; o desconhecido é nulo', () => {
    expect(delimitadorDoTexto('(')).toBe('(');
    expect(delimitadorDoTexto('\\lfloor')).toBe('⌊');
    expect(delimitadorDoTexto('\\{')).toBe('{');
    expect(delimitadorDoTexto('.')).toBe('');
    expect(delimitadorDoTexto('x')).toBeNull();
  });
});

describe('fontes do Unicode', () => {
  it('troca letras e dígitos; deixa o que não tem variante', () => {
    expect(comFonte('A', 'negrito')).toBe('𝐀');
    expect(comFonte('1', 'negrito')).toBe('𝟏');
    expect(comFonte('R', 'duplo')).toBe('ℝ');
    expect(comFonte('h', 'italico')).toBe('ℎ');
    expect(comFonte('+', 'negrito')).toBe('+');
    expect(comFonte('A', 'normal')).toBe('A');
  });

  it('informa se há variante', () => {
    expect(temVariante('A', 'negrito')).toBe(true);
    expect(temVariante('+', 'negrito')).toBe(false);
  });
});

describe('árvore MathML', () => {
  it('serializa com escape em atributo e em texto; elemento vazio se fecha sozinho', () => {
    expect(paraXML(el('mi', { title: 'a"b' }, ['<&>']))).toBe('<mi title="a&quot;b">&lt;&amp;&gt;</mi>');
    expect(paraXML(el('mspace', { width: '1em' }))).toBe('<mspace width="1em"/>');
    expect(paraXML(el('mrow', {}, [el('mi', {}, ['a']), 'b']))).toBe('<mrow><mi>a</mi>b</mrow>');
  });

  it('comClasse soma à classe existente; textoDe junta os filhos', () => {
    expect(comClasse(el('mi', { class: 'a' }), 'b').atributos.class).toBe('a b');
    expect(comClasse(el('mi'), 'b').atributos.class).toBe('b');
    expect(textoDe(el('mrow', {}, [el('mi', {}, ['a']), 'b']))).toBe('ab');
  });
});

describe('lexer', () => {
  it('separa comando, caractere, espaço e parâmetro, com a posição', () => {
    const lexer = new Lexer('\\alpha x #1');
    const lidos = [];
    for (let token = lexer.proximo(); token.tipo !== 'fim'; token = lexer.proximo())
      lidos.push([token.tipo, token.texto, token.posicao]);
    expect(lidos[0]).toEqual(['controle', '\\alpha', 0]);
    expect(lidos.map((pL) => pL[0])).toContain('espaco');
    expect(lidos.map((pL) => pL[0])).toContain('parametro');
    expect(lidos.map((pL) => pL[1])).toContain('x');
  });

  it('comentário some até o fim da linha', () => {
    const lexer = new Lexer('%oi\na');
    let token = lexer.proximo();
    while (token.tipo === 'espaco')
      token = lexer.proximo();
    expect(token.texto).toBe('a');
  });
});

describe('analisarFormula escolhe o parser pela notação', () => {
  it('a mesma fonte tem leituras diferentes', () => {
    expect(analisarFormula('a/b', 'asciimath', false).nos[0].tipo).toBe('fracao');
    expect(analisarFormula('a/b', 'latexmath', false).nos[0].tipo).not.toBe('fracao');
  });
});
