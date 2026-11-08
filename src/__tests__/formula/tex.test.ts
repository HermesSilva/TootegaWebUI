import { describe, expect, it } from 'vitest';
import { renderizarFormula } from '@core/lib/formula';
import { avisos, corpo } from './apoio';

const tex = (pFonte: string, pBloco = false) => corpo(pFonte, 'latexmath', pBloco);
const avisosTeX = (pFonte: string, pBloco = false) => avisos(pFonte, 'latexmath', pBloco);

describe('estrutura', () => {
  it.each([
    ['x^2_i', '<msubsup><mi>x</mi><mi>i</mi><mn>2</mn></msubsup>'],
    ['\\frac{a}{b}', '<mfrac><mi>a</mi><mi>b</mi></mfrac>'],
    ['\\frac12', '<mfrac><mn>1</mn><mn>2</mn></mfrac>'],
    ['a\\over b', '<mfrac><mi>a</mi><mi>b</mi></mfrac>'],
    ['\\sqrt{x}', '<msqrt><mi>x</mi></msqrt>'],
    ['\\sqrt[3]{x}', '<mroot><mi>x</mi><mn>3</mn></mroot>'],
    ['\\phantom{x}', '<mphantom><mi>x</mi></mphantom>'],
    ['\\text{oi mundo}', '<mtext>oi\u00a0mundo</mtext>'],
    ['\\quad', '<mspace width="1em"/>'],
    ['\\hspace{2em}', '<mspace width="2em"/>'],
    ['\\color{red}{x}', '<mstyle mathcolor="red"><mi>x</mi></mstyle>'],
    ['\\textcolor{blue}{y}', '<mstyle mathcolor="blue"><mi>y</mi></mstyle>'],
    ['\\Large x', '<mstyle mathsize="1.44em"><mi>x</mi></mstyle>'],
    ['\\displaystyle x', '<mstyle displaystyle="true" scriptlevel="0"><mi>x</mi></mstyle>'],
    ['\\scriptstyle x', '<mstyle displaystyle="false" scriptlevel="1"><mi>x</mi></mstyle>'],
    ['\\hat{x}', '<mover accent="true"><mi>x</mi><mo stretchy="false">^</mo></mover>'],
    ['\\underline{ab}', '<munder accentunder="true"><mrow><mi>a</mi><mi>b</mi></mrow><mo stretchy="true">‾</mo></munder>'],
    ['\\underbrace{a}_{c}', '<munder><munder accentunder="true"><mi>a</mi><mo stretchy="true">⏟</mo></munder><mi>c</mi></munder>'],
    ['\\overbrace{a}^{c}', '<mover><mover accent="true"><mi>a</mi><mo stretchy="true">⏞</mo></mover><mi>c</mi></mover>'],
  ])('%s', (pFonte, pEsperado) => {
    expect(tex(pFonte)).toBe(pEsperado);
    expect(avisosTeX(pFonte)).toEqual([]);
  });

  it('dfrac e tfrac forçam o estilo; genfrac escolhe delimitador, espessura e estilo', () => {
    expect(tex('\\dfrac12')).toContain('displaystyle="true"');
    expect(tex('\\tfrac12')).toContain('displaystyle="false"');
    expect(tex('\\genfrac{(}{)}{0pt}{0}{a}{b}')).toContain('linethickness="0"');
    expect(tex('\\genfrac{(}{)}{0pt}{0}{a}{b}')).toContain('fence="true">(</mo>');
    expect(tex('\\genfrac{}{}{1pt}{1}{a}{b}')).toContain('linethickness="0.1em"');
    expect(tex('\\genfrac{[}{]}{}{2}{a}{b}')).toContain('scriptlevel="1"');
    expect(avisosTeX('\\genfrac{.}{.}{a}{9}{a}{b}')).toEqual(['Espessura inválida em \\genfrac: `a`.']);
  });

  it('binom e choose são fração sem barra entre parênteses', () => {
    for (const fonte of ['\\binom{n}{k}', 'n\\choose k']) {
      expect(tex(fonte)).toContain('<mfrac linethickness="0"><mi>n</mi><mi>k</mi></mfrac>');
      expect(tex(fonte)).toContain('fence="true">(</mo>');
    }
    expect(tex('a\\atop b')).toContain('<mfrac linethickness="0">');
    expect(tex('a\\above 1pt b')).toContain('<mfrac linethickness="0.1em">');
    expect(tex('a\\brace b')).toContain('fence="true">{</mo>');
    expect(tex('a\\brack b')).toContain('fence="true">[</mo>');
  });

  it('operador grande vai ao lado na linha e usa limites por \\limits, \\nolimits e em bloco', () => {
    expect(tex('\\sum_{i=1}^n i')).toContain('<msubsup><mo largeop="true" movablelimits="false">∑</mo>');
    expect(tex('\\sum_a', true)).toContain('<munder>');
    expect(tex('\\lim\\limits_a')).toContain('<munder>');
    expect(tex('\\lim\\nolimits_a')).toContain('<msub>');
    expect(tex('\\mathop{x}\\limits_a')).toContain('<munder>');
    expect(tex('\\operatorname*{foo}_a')).toContain('<munder>');
    expect(tex('\\operatorname{foo} x')).toContain('<mi>foo</mi>');
    expect(tex('\\sin x')).toBe('<mrow><mi>sin</mi><mo>\u2061</mo><mi>x</mi></mrow>');
    expect(tex('\\lim\\limits_a x')).not.toContain('merror');
  });

  it('delimitadores: \\left e \\right esticam; \\big tem tamanho fixo; \\middle fica entre os dois', () => {
    const delimitado = tex('\\left(\\frac{a}{b}\\right)');
    expect(delimitado).toContain('class="adc-f-delimitado"');
    expect(delimitado).toContain('form="prefix" fence="true">(</mo>');
    expect(delimitado).toContain('form="postfix" fence="true">)</mo>');
    expect(tex('\\left.x\\right|')).not.toContain('fence="true">.</mo>');
    expect(tex('\\left(a\\middle|b\\right)')).toContain('|</mo>');
    expect(tex('\\big(x\\big)')).toContain('minsize="1.2em"');
    expect(tex('\\Big[')).not.toBe(tex('\\big['));
    expect(tex('\\left\\lfloor x\\right\\rfloor')).toContain('⌊');
    expect(tex('\\left<x\\right>')).toContain('⟨');
    expect(avisosTeX('\\bigg\\{')).toEqual([]);
  });

  it('primos viram sobrescrito e somam com o expoente', () => {
    expect(tex("f'")).toContain('′');
    expect(tex("f'''")).toContain('‴');
    expect(tex("x'^2")).toContain('<mn>2</mn>');
    expect(tex('{}^2')).toContain('<msup>');
  });

  it('cercaduras e pilhas', () => {
    expect(tex('\\boxed{x}')).toContain('adc-f-cerc-boxed');
    expect(tex('\\fbox{x}')).toContain('adc-f-cerc');
    expect(tex('\\cancel{x}')).toContain('adc-f-cerc-cancel');
    expect(tex('\\bcancel{x}')).toContain('adc-f-cerc-bcancel');
    expect(tex('\\xcancel{x}')).toContain('adc-f-cerc-xcancel');
    expect(tex('\\colorbox{yellow}{z}')).toContain('mathbackground="yellow"');
    expect(tex('\\fcolorbox{red}{blue}{z}')).toContain('mathbackground="blue"');
    expect(tex('\\xrightarrow{f}')).toContain('adc-f-rotulo-seta');
    expect(tex('\\xrightarrow[g]{f}')).toContain('<mi>g</mi>');
    expect(tex('\\overset{a}{b}')).toContain('<mover>');
    expect(tex('\\underset{a}{b}')).toContain('<munder>');
    expect(tex('\\stackrel{a}{b}')).toContain('adc-f-classe-rel');
    expect(tex('\\substack{a\\\\b}')).toContain('adc-f-subarray');
  });

  it('medidas: as válidas viram CSS; a inválida e a de unidade errada avisam', () => {
    expect(tex('\\mkern18mu')).toContain('width="1em"');
    expect(tex('\\kern1em')).toContain('width="1em"');
    expect(tex('\\rule{1em}{2pt}')).toContain('adc-f');
    expect(avisosTeX('\\mkern3em')).toEqual(['`\\mkern` pede unidade mu; veio em.']);
    expect(avisosTeX('\\hspace{x}')[0]).toContain('Medida inválida');
    expect(avisosTeX('\\hspace{1zz}')[0]).toContain('Medida inválida');
  });
});

describe('fontes', () => {
  it.each([
    ['\\mathbf{A}', '𝐀'], ['\\mathbb{R}', 'ℝ'], ['\\mathcal{L}', 'ℒ'], ['\\mathfrak{g}', '𝔤'],
    ['\\mathsf{A}', '𝖠'], ['\\mathtt{A}', '𝙰'], ['\\boldsymbol{\\alpha}', '𝜶'], ['\\mathbf{1}', '𝟏'],
  ])('%s usa o caractere matemático do Unicode', (pFonte, pCaractere) => {
    expect(tex(pFonte)).toBe(`<mi>${pCaractere}</mi>`.replace('<mi>𝟏</mi>', '<mn>𝟏</mn>'));
  });

  it('\\mathrm é vertical; fonte vale em cada letra de um grupo', () => {
    expect(tex('\\mathrm{d}')).toBe('<mi mathvariant="normal">d</mi>');
    expect(tex('\\mathbf{ab}')).toContain('𝐚');
    expect(tex('\\mathbf{ab}')).toContain('𝐛');
    expect(tex('\\rm x')).not.toContain('merror');
    expect(tex('\\bf x')).toContain('𝐱');
    expect(tex('\\cal X')).toContain('𝒳');
  });

  it('as variantes de texto viram classe no mtext', () => {
    expect(tex('\\textbf{oi}')).toBe('<mtext class="adc-f-texto-negrito">oi</mtext>');
    expect(tex('\\textit{oi}')).toBe('<mtext class="adc-f-texto-italico">oi</mtext>');
    expect(tex('\\texttt{oi}')).toBe('<mtext class="adc-f-texto-mono">oi</mtext>');
    expect(tex('\\textsf{oi}')).toBe('<mtext class="adc-f-texto-semSerifa">oi</mtext>');
    expect(tex('\\mbox{oi}')).toBe('<mtext>oi</mtext>');
  });
});

describe('modo texto', () => {
  it('aceita símbolo próprio, matemática embutida e acentos', () => {
    expect(tex('\\text{\\textbar}')).toBe('<mtext>|</mtext>');
    expect(tex('\\text{\\%}')).toBe('<mtext>%</mtext>');
    expect(tex('\\text{\\ss}')).toBe('<mtext>ß</mtext>');
    expect(tex('\\text{a\\ b}')).toBe('<mtext>a\u00a0b</mtext>');
    expect(tex('\\text{a$x$b}')).toContain('<mi>x</mi>');
    expect(tex('\\text{a\\(x\\)b}')).toContain('<mi>x</mi>');
    expect(tex("\\text{\\'e}")).toContain('é');
    expect(tex('\\text{\\~a}')).toContain('ã');
    expect(tex('\\text{ç}')).toContain('ç');
  });

  it('o que não existe em texto avisa com o nome', () => {
    expect(avisosTeX('\\text{\\frac{a}{b}}')[0]).toContain('\\frac');
    expect(avisosTeX('\\text{\\naoexiste}')[0]).toContain('\\naoexiste');
    expect(avisosTeX("\\'{a}")[0]).toContain('só vale em modo texto');
  });
});

describe('ambientes', () => {
  it('matrizes têm uma linha por \\\\ e o delimitador do ambiente', () => {
    const matriz = tex('\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}');
    expect(matriz.match(/<mtr>/g)).toHaveLength(2);
    expect(matriz.match(/<mtd/g)).toHaveLength(4);
    expect(matriz).toContain('fence="true">(</mo>');
    expect(tex('\\begin{bmatrix}1\\end{bmatrix}')).toContain('fence="true">[</mo>');
    expect(tex('\\begin{Bmatrix}1\\end{Bmatrix}')).toContain('fence="true">{</mo>');
    expect(tex('\\begin{vmatrix}1\\end{vmatrix}')).toContain('fence="true">|</mo>');
    expect(tex('\\begin{Vmatrix}1\\end{Vmatrix}')).toContain('fence="true">‖</mo>');
    expect(tex('\\begin{matrix}1\\end{matrix}')).not.toContain('fence="true"');
  });

  it('matrix* alinha pela opção; a quebra de linha com medida vira espaçamento', () => {
    expect(tex('\\begin{matrix*}[r]a\\end{matrix*}')).toContain('adc-f-col-d');
    expect(tex('\\begin{matrix}a\\\\[1ex]b\\end{matrix}')).toContain('padding-bottom:0.431em');
  });

  it('cases: chave à esquerda; rcases: à direita; limite de 2 colunas', () => {
    expect(tex('\\begin{cases}a&b\\end{cases}')).toContain('form="prefix" fence="true">{</mo>');
    expect(tex('\\begin{rcases}a&b\\end{rcases}')).toContain('form="postfix"');
    expect(tex('\\begin{dcases}a&b\\end{dcases}')).toContain('displaystyle="true"');
    expect(avisosTeX('\\begin{cases}a&b&c\\end{cases}')).toEqual(['`cases` aceita no máximo 2 colunas por linha.']);
  });

  it('array lê a especificação: alinhamento, repetição, bordas e fios', () => {
    const bordas = tex('\\begin{array}{|l|c|r|}\\hline a&b&c\\\\\\hline\\end{array}');
    expect(bordas).toContain('adc-f-col-e adc-f-borda-esq adc-f-borda-topo adc-f-borda-base');
    expect(tex('\\begin{array}{l:c}a&b\\\\\\hdashline c&d\\end{array}')).toContain('adc-f-borda-esq-tracejada');
    expect(tex('\\begin{array}{l:c}a&b\\\\\\hdashline c&d\\end{array}')).toContain('adc-f-borda-topo-tracej');
    expect(tex('\\begin{array}{*{2}c}a&b\\end{array}').match(/adc-f-col-c/g)).toHaveLength(2);
    expect(tex('\\begin{array}{@{}c@{}}a\\end{array}')).toContain('adc-f-col-c');
    expect(avisosTeX('\\begin{array}{x}a\\end{array}')).toEqual(['`array` precisa da especificação das colunas ({c|r}…).']);
  });

  it('align alterna direita e esquerda, e numera as linhas; a etiqueta manda', () => {
    const alinhado = tex('\\begin{align}a&=b\\\\c&=d\\notag\\end{align}', true);
    expect(alinhado).toContain('adc-f-col-d');
    expect(alinhado).toContain('adc-f-etiquetada');
    expect(alinhado).toContain('<mtext>(1)</mtext>');
    expect(alinhado).not.toContain('(2)');
    expect(tex('\\begin{align}a&=b\\tag{7}\\end{align}', true)).toContain('<mn>7</mn>');
    expect(tex('\\begin{align*}a&=b\\end{align*}', true)).not.toContain('(1)');
    expect(tex('\\begin{alignat}{2}a&=b&c&=d\\end{alignat}', true)).toContain('adc-f-alignat');
    expect(tex('\\begin{aligned}a&=b\\end{aligned}')).toContain('adc-f-aligned');
    expect(tex('\\begin{gathered}a\\\\b\\end{gathered}')).toContain('adc-f-gathered');
    expect(tex('\\begin{split}a&=b\\end{split}', true)).toContain('adc-f-split');
  });

  it('o ambiente de bloco, na linha, sai como a variante de linha e avisa', () => {
    expect(avisosTeX('\\begin{align}a\\end{align}')).toEqual(['O ambiente `align` é de fórmula em bloco; na linha ele sai como `aligned`.']);
    expect(avisosTeX('\\begin{equation}a\\end{equation}')).toEqual(['O ambiente `equation` é de fórmula em bloco; na linha ele sai como `gathered`.']);
    expect(avisosTeX('\\begin{equation}a\\\\b\\end{equation}', true)).toEqual(['`equation` tem uma linha só; use `gather` ou `align` para várias.']);
    expect(avisosTeX('\\begin{split}a&=b&c\\end{split}', true)).toEqual(['`split` aceita no máximo 2 colunas por linha.']);
    expect(avisosTeX('\\begin{gather}a&b\\end{gather}', true)).toEqual(['`gather` aceita no máximo 1 colunas por linha.']);
  });

  it('CD monta o diagrama com as setas', () => {
    const diagrama = tex('\\begin{CD}A @>a>> B\\\\@VVV @AAA\\\\C @<<< D\\end{CD}', true);
    expect(diagrama).toContain('adc-f-CD');
    expect(diagrama).toContain('→');
    expect(diagrama).toContain('←');
    expect(diagrama).toContain('↓');
    expect(diagrama).toContain('↑');
    expect(avisosTeX('\\begin{CD}A @>a>> B\\end{CD}', true)).toEqual([]);
  });

  it('o que não fecha, ou fecha errado, avisa dizendo qual', () => {
    expect(avisosTeX('\\begin{foo}x\\end{foo}')[0]).toBe('Ambiente desconhecido: `foo`.');
    expect(avisosTeX('\\begin{matrix}a\\end{pmatrix}')).toEqual(['`\\begin{matrix}` fechado por `\\end{pmatrix}`.']);
    expect(avisosTeX('\\begin{matrix}a')[0]).toBe('`\\begin{matrix}` sem `\\end{matrix}`.');
    expect(avisosTeX('\\end{matrix}')[0]).toBe('`\\end` sem `\\begin`.');
    expect(avisosTeX('a&b')[0]).toContain('`&` só vale dentro de um ambiente');
  });
});

describe('macros do autor', () => {
  it('\\newcommand com parâmetros e com argumento opcional', () => {
    expect(tex('\\newcommand{\\foo}[2]{#1+#2}\\foo{a}{b}')).toBe('<mrow><mi>a</mi><mo>+</mo><mi>b</mi></mrow>');
    expect(tex('\\newcommand{\\foo}[1][z]{#1}\\foo\\foo[b]')).toBe('<mrow><mi>z</mi><mi>b</mi></mrow>');
    expect(tex('\\providecommand{\\foo}{a}\\foo')).toBe('<mi>a</mi>');
    expect(tex('\\newcommand{\\foo}{a}\\renewcommand{\\foo}{b}\\foo')).toBe('<mi>b</mi>');
  });

  it('\\def, \\gdef e \\let', () => {
    expect(tex('\\def\\foo#1{[#1]}\\foo{a}')).toContain('<mi>a</mi>');
    expect(tex('\\gdef\\foo{a}\\foo')).toBe('<mi>a</mi>');
    expect(tex('\\let\\foo=\\alpha\\foo')).toBe('<mi>α</mi>');
  });

  it('recusa definição duplicada, inexistente, fora de ordem e a expansão sem fim', () => {
    expect(avisosTeX('\\newcommand\\foo{a}\\newcommand\\foo{b}')).toEqual(['`\\foo` já existe; use \\renewcommand.']);
    expect(avisosTeX('\\renewcommand{\\naoha}{a}')).toEqual(['`\\naoha` não existe; use \\newcommand.']);
    expect(avisosTeX('\\def\\x#1#1{a}')).toEqual(['Parâmetros de `\\x` fora de ordem (#1).']);
    expect(avisosTeX('\\newcommand{\\foo}{\\foo}\\foo')).toEqual(['Expansão de macro sem fim em `\\foo`.']);
  });
});

describe('fontes malformadas: nunca lança, e o aviso diz o que e onde', () => {
  it.each([
    ['\\naoexiste x', 'Comando desconhecido: `\\naoexiste`.'],
    ['x^2^3', 'Dois sobrescritos (`^`) no mesmo átomo.'],
    ['x_1_2', 'Dois subscritos (`_`) no mesmo átomo.'],
    ['}', '`}` sem `{` correspondente.'],
    ['{', 'Esperava `}`, veio `fim da fórmula`.'],
    ['\\frac', 'Faltou argumento no fim da fórmula.'],
    ['\\right)', '`\\right` sem `\\left`.'],
  ])('%s', (pFonte, pAviso) => {
    expect(avisosTeX(pFonte)[0]).toBe(pAviso);
    expect(tex(pFonte)).toContain('<merror class="adc-f-erro">');
  });

  it('o aviso traz a posição na fonte', () => {
    const { avisos: lista } = renderizarFormula('ab\\naoexiste', { notacao: 'latexmath', bloco: false, anotar: false });
    expect(lista[0].posicao).toBe(2);
  });

  it.each(['\\frac a', '\\sqrt', '\\sqrt[', '\\sqrt[3', '\\left', '\\left(', '\\left x', '\\big', '\\big x', 'x^', 'x_', 'x^{', '\\begin', '\\begin{', '\\end', '\\verb', '\\verb|a', '\\color', '\\textcolor{red}', '\\text{$x', '$', '\\newcommand', '\\def'])(
    'fonte incompleta %s avisa, sem lançar', (pFonte) => {
      expect(() => tex(pFonte)).not.toThrow();
      expect(avisosTeX(pFonte).length).toBeGreaterThan(0);
    });

  it.each(['\\middle|', '#', '\\let', '\\(x\\)'])('%s não lança', (pFonte) => {
    expect(() => tex(pFonte)).not.toThrow();
  });

  it('fora do escopo do motor sai como texto e avisa', () => {
    for (const comando of ['\\href{http://a}{x}', '\\url{http://a}', '\\includegraphics{a}', '\\htmlClass{a}{x}', '\\htmlId{a}{x}', '\\htmlStyle{a}{x}', '\\htmlData{a}{x}'])
      expect(avisosTeX(comando)[0]).toContain('fora do escopo do motor');
  });

  it('\\verb preserva o que está dentro', () => {
    expect(tex('\\verb|a b|')).toContain('a');
    expect(avisosTeX('\\verb|a b|')).toEqual([]);
  });

  it.each(['', ' ', '  a  ', '%comentario\nx', 'a~b', '\\ ', '\\,', '\\:', '\\>', '\\!', '\\qquad', 'é', 'α', '≤', '→', '∞', '1,5', '1.5.2', '.5', '5.', '12345'])(
    'fonte válida %j não avisa', (pFonte) => {
      expect(avisosTeX(pFonte)).toEqual([]);
    });
});

describe('o invólucro <math>', () => {
  it('bloco marca display; a fonte vai na anotação, escapada; anotar:false a tira', () => {
    const bloco = renderizarFormula('a<b', { notacao: 'latexmath', bloco: true });
    expect(bloco.mathml).toContain('display="block"');
    expect(bloco.mathml).toContain('<annotation encoding="application/x-tex">a&lt;b</annotation>');
    expect(renderizarFormula('a', { notacao: 'latexmath', bloco: false }).mathml).not.toContain('display="block"');
    expect(renderizarFormula('a', { notacao: 'latexmath', bloco: false, anotar: false }).mathml).not.toContain('annotation');
  });

  it('devolve também a árvore semântica', () => {
    const { nos, arvore } = renderizarFormula('x', { notacao: 'latexmath', bloco: false });
    expect(nos[0]).toMatchObject({ tipo: 'simbolo', texto: 'x' });
    expect(arvore.nome).toBe('math');
  });
});

/**
 * DEFEITOS CONHECIDOS: `it.fails` passa enquanto o defeito existir e reprova quando for corrigido, obrigando a
 * trocar por `it`. Não é teste do comportamento desejado sendo ignorado: é o desejado, escrito, à espera do conserto.
 */
describe('defeitos conhecidos do motor', () => {
  it.fails('\\limits depois de operador grande não deveria avisar', () => {
    expect(avisosTeX('\\sum\\limits_a')).toEqual([]);
  });

  it.fails('\\nolimits depois de operador grande não deveria avisar', () => {
    expect(avisosTeX('\\sum\\nolimits_a')).toEqual([]);
  });

  it.fails('\\renewcommand de um símbolo que existe não deveria dizer que ele não existe', () => {
    expect(avisosTeX('\\renewcommand{\\alpha}{a}\\alpha')).toEqual([]);
  });
});
