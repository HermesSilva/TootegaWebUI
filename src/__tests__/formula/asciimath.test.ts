import { describe, expect, it } from 'vitest';
import { renderizarFormula } from '@core/lib/formula';
import { avisos, corpo, problemas } from './apoio';

const am = (pFonte: string) => corpo(pFonte, 'asciimath');

describe('AsciiMath: estrutura', () => {
  it.each([
    ['x^2', '<msup><mi>x</mi><mn>2</mn></msup>'],
    ['x_i^2', '<msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup>'],
    ['a/b', '<mfrac><mi>a</mi><mi>b</mi></mfrac>'],
    ['(a+b)/c', '<mfrac><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow><mi>c</mi></mfrac>'],
    ['frac(a)(b)', '<mfrac><mi>a</mi><mi>b</mi></mfrac>'],
    ['sqrt x', '<msqrt><mi>x</mi></msqrt>'],
    ['sqrt(x+1)', '<msqrt><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow></msqrt>'],
    ['root(3)(x)', '<mroot><mi>x</mi><mn>3</mn></mroot>'],
    ['text(oi)', '<mtext>oi</mtext>'],
    ['"oi"', '<mtext>oi</mtext>'],
    ['color(red)(x)', '<mstyle mathcolor="red"><mi>x</mi></mstyle>'],
    ['2.5x', '<mrow><mn>2.5</mn><mi>x</mi></mrow>'],
    ['hat x', '<mover accent="true"><mi>x</mi><mo stretchy="false">^</mo></mover>'],
    ['ul x', '<munder accentunder="true"><mi>x</mi><mo stretchy="true">‾</mo></munder>'],
    ['cancel(x)', '<mrow class="adc-f-cerc adc-f-cerc-cancel"><mi>x</mi></mrow>'],
  ])('%s', (pFonte, pEsperado) => {
    expect(am(pFonte)).toBe(pEsperado);
    expect(avisos(pFonte, 'asciimath')).toEqual([]);
  });

  it('a divisão pega só o átomo vizinho, como em dy/dx', () => {
    expect(am('dy/dx')).toBe('<mrow><mi>d</mi><mfrac><mi>y</mi><mi>d</mi></mfrac><mi>x</mi></mrow>');
  });

  it('o parêntese do expoente e do índice só agrupa: não aparece', () => {
    expect(am('x^(a+b)')).toBe('<msup><mi>x</mi><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow></msup>');
    expect(am('x_(a+b)')).toBe('<msub><mi>x</mi><mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow></msub>');
  });

  it('operadores grandes e funções', () => {
    expect(am('sum_(i=1)^n i')).toContain('<msubsup><mo largeop="true" movablelimits="false">∑</mo>');
    expect(am('int_0^1 x dx')).toContain('∫');
    expect(am('lim_(x->0) f')).toContain('<mi>lim</mi>');
    expect(am('sin x')).toBe('<mrow><mi>sin</mi><mo>⁡</mo><mi>x</mi></mrow>');
    expect(am('sin(x)')).toContain('class="adc-f-delimitado"');
    expect(am('log_2 x')).toContain('<msub><mrow><mi>log</mi>');
  });

  it('fontes', () => {
    expect(am('bb(A)')).toBe('<mi>𝐀</mi>');
    expect(am('bbb(A)')).toBe('<mi>𝔸</mi>');
    expect(am('cc(A)')).toBe('<mi>𝒜</mi>');
    expect(am('fr(A)')).toBe('<mi>𝔄</mi>');
    expect(am('tt(A)')).toBe('<mi>𝙰</mi>');
    expect(am('sf(A)')).toBe('<mi>𝖠</mi>');
  });

  it('delimitadores: pares próprios, abs, floor, ceil, norm, e o invisível {: :}', () => {
    expect(am('abs(x)')).toContain('fence="true">|</mo>');
    expect(am('floor(x)')).toContain('⌊');
    expect(am('ceil(x)')).toContain('⌈');
    expect(am('norm(x)')).toContain('‖');
    expect(am('{:a,b:}')).toBe('<mrow class="adc-f-delimitado"><mi>a</mi><mo>,</mo><mi>b</mi></mrow>');
    expect(am('<<a,b>>')).toContain('⟨');
    expect(am('(:a,b:)')).toContain('⟨');
  });

  it('matrizes: linhas entre colchetes ou parênteses, com o delimitador de fora', () => {
    for (const [fonte, delimitador] of [['[[a,b],[c,d]]', '['], ['((a,b),(c,d))', '('], ['{(a,b),(c,d):}', '{']]) {
      const matriz = am(fonte);
      expect(matriz).toContain(`fence="true">${delimitador}</mo>`);
      expect(matriz.match(/<mtr>/g)).toHaveLength(2);
      expect(matriz.match(/<mtd/g)).toHaveLength(4);
    }
  });

  it('chaves com rótulo em cima e embaixo', () => {
    expect(am('ubrace(a)_b')).toBe('<munder><munder accentunder="true"><mi>a</mi><mo stretchy="true">⏟</mo></munder><mi>b</mi></munder>');
    expect(am('obrace(a)^b')).toBe('<mover><mover accent="true"><mi>a</mi><mo stretchy="true">⏞</mo></mover><mi>b</mi></mover>');
    expect(am('overset(a)(b)')).toContain('<mover>');
    expect(am('underset(a)(b)')).toContain('<munder>');
    expect(am('stackrel(a)(b)')).toContain('<mover>');
  });
});

describe('AsciiMath: símbolos', () => {
  it.each([
    ['<=', '≤'], ['>=', '≥'], ['!=', '≠'], ['->', '→'], ['=>', '⇒'], ['<=>', '⇔'], ['+-', '±'], ['xx', '×'], ['-:', '÷'],
    ['**', '∗'], ['in', '∈'], ['!in', '∉'], ['sub', '⊂'], ['sup', '⊃'], ['sube', '⊆'], ['uu', '∪'], ['nn', '∩'], ['vv', '∨'], ['^^', '∧'],
  ])('%s é o operador %s', (pFonte, pSimbolo) => {
    expect(am(pFonte)).toBe(`<mo>${pSimbolo}</mo>`);
  });

  it.each([
    ['oo', '∞'], ['del', '∂'], ['grad', '∇'], ['not', '¬'], ['AA', '∀'], ['EE', '∃'], ['TT', '⊤'],
    ['RR', 'ℝ'], ['NN', 'ℕ'], ['ZZ', 'ℤ'], ['QQ', 'ℚ'], ['CC', 'ℂ'],
  ])('%s é o identificador %s', (pFonte, pSimbolo) => {
    expect(am(pFonte)).toBe(`<mi mathvariant="normal">${pSimbolo}</mi>`);
  });

  it('as palavras de ligação são texto com espaço', () => {
    expect(am('and')).toBe('<mtext>\u00a0and\u00a0</mtext>');
    expect(am('or')).toBe('<mtext>\u00a0or\u00a0</mtext>');
    expect(am('if')).toBe('<mtext>\u00a0if\u00a0</mtext>');
  });

  it('letras gregas e operadores n-ários', () => {
    expect(am('alpha+beta')).toBe('<mrow><mi>α</mi><mo>+</mo><mi>β</mi></mrow>');
    expect(am('uuu')).toContain('largeop="true"');
    expect(am('nnn')).toContain('largeop="true"');
    expect(am('vvv')).toContain('largeop="true"');
    expect(am('^^^')).toContain('largeop="true"');
  });

  it('nome desconhecido se lê letra a letra, e o que tiver sentido vale', () => {
    expect(am('abc')).toBe('<mrow><mi>a</mi><mi>b</mi><mi>c</mi></mrow>');
  });

  it('todo o vocabulário usual renderiza sem erro', () => {
    const vocabulario = [
      'cdots', 'ldots', 'vdots', 'ddots', ':.', ":'", '/_', '~~', '-=', 'prop', 'ox', 'o+', 'o.',
      'min', 'max', 'gcd', 'lcm', 'det', 'dim', 'mod', 'lub', 'glb', 'exp', 'ln', 'sec', 'csc', 'cot', 'tan', 'cos',
      'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'f(x)=x^2+1', 'e^(i pi)', 'tilde x', 'overline(ab)', 'quad', 'qquad',
      'dot x', 'ddot x', 'bar x', 'vec x',
    ];
    expect(problemas(vocabulario, 'asciimath', false)).toEqual([]);
  });
});

describe('AsciiMath: fontes malformadas', () => {
  it.each([
    ['(', '`(` não fechou.'],
    ['[x', '`[` não fechou.'],
    [')', 'Fechamento inesperado `)`.'],
  ])('%s avisa, sem lançar', (pFonte, pAviso) => {
    expect(avisos(pFonte, 'asciimath')[0]).toBe(pAviso);
  });

  it.each(['', ' ', 'a/', '/a', '^2', '_2', 'sqrt', 'root', 'root(3)', 'frac(a)', 'color(red)', 'text(', '"oi', 'hat', 'x^', 'x_'])(
    'fonte incompleta %j não lança', (pFonte) => {
      expect(() => renderizarFormula(pFonte, { notacao: 'asciimath', bloco: false })).not.toThrow();
    });

  it('a anotação identifica a notação', () => {
    expect(renderizarFormula('x', { notacao: 'asciimath', bloco: true }).mathml)
      .toContain('<annotation encoding="text/x-asciimath">x</annotation>');
  });
});
