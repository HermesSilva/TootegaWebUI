/**
 * PARSER de AsciiMath (asciimath.org) para a mesma árvore do TeX. Gramática do site:
 *   S ::= c | lEr | uS | bSS | "texto"      I ::= S_S | S^S | S_S^S | S      E ::= IE | I/I
 * Tokens por casamento mais longo na tabela de símbolos; números; letras (uma por token); `"…"` e `text(…)`.
 * `[[a,b],[c,d]]` vira matriz; `(…)/(…)` vira fração sem os parênteses; `_`/`^` perdem os parênteses externos.
 */

import { grupo, simbolo, type AvisoDaFormula, type ClasseDeAtomo, type FonteMatematica, type No } from '../ast';
import { medidaEm } from '../tex/medidas';

type Especie = 'const' | 'unary' | 'binary' | 'infix' | 'left' | 'right' | 'leftright' | 'text' | 'font' | 'space' | 'op';

interface SimboloAM {
  texto: string;
  classe: ClasseDeAtomo;
  especie: Especie;
  /** Unários: o que fazem com o argumento. */
  acao?: 'sqrt' | 'root' | 'frac' | 'stackrel' | 'overset' | 'underset' | 'color' | 'acento' | 'acentoBaixo' | 'cancel' | 'texto' | 'fonte' | 'abs' | 'floor' | 'ceil' | 'norm' | 'sobrelinha' | 'sublinha' | 'ubrace' | 'obrace';
  acento?: string;
  fonte?: FonteMatematica;
  /** Função nomeada (`sin`): vira operador com argumento. */
  funcao?: boolean;
  limites?: boolean;
}

const S = new Map<string, SimboloAM>();

function c(pNome: string, pTexto: string, pClasse: ClasseDeAtomo = 'textord', pEspecie: Especie = 'const'): void {
  S.set(pNome, { texto: pTexto, classe: pClasse, especie: pEspecie });
}

// Operadores
c('+', '+', 'bin'); c('-', '−', 'bin'); c('*', '⋅', 'bin'); c('**', '∗', 'bin'); c('***', '⋆', 'bin'); c('//', '/', 'bin');
c('\\\\', '\\', 'bin'); c('setminus', '\\', 'bin'); c('xx', '×', 'bin'); c('|><', '⋉', 'bin'); c('><|', '⋊', 'bin'); c('|><|', '⋈', 'bin');
c('-:', '÷', 'bin'); c('divide', '÷', 'bin'); c('@', '∘', 'bin'); c('o+', '⊕', 'bin'); c('ox', '⊗', 'bin'); c('o.', '⊙', 'bin');
c('sum', '∑', 'op'); c('prod', '∏', 'op'); c('^^', '∧', 'bin'); c('^^^', '⋀', 'op'); c('vv', '∨', 'bin'); c('vvv', '⋁', 'op');
c('nn', '∩', 'bin'); c('nnn', '⋂', 'op'); c('uu', '∪', 'bin'); c('uuu', '⋃', 'op');
// Relações
c('=', '=', 'rel'); c('!=', '≠', 'rel'); c('ne', '≠', 'rel'); c(':=', '≔', 'rel'); c('<', '<', 'rel'); c('lt', '<', 'rel'); c('>', '>', 'rel'); c('gt', '>', 'rel');
c('<=', '≤', 'rel'); c('le', '≤', 'rel'); c('>=', '≥', 'rel'); c('ge', '≥', 'rel'); c('mlt', '≪', 'rel'); c('mgt', '≫', 'rel'); c('-<', '≺', 'rel'); c('-lt', '≺', 'rel');
c('>-', '≻', 'rel'); c('-<=', '⪯', 'rel'); c('>-=', '⪰', 'rel'); c('in', '∈', 'rel'); c('!in', '∉', 'rel'); c('sub', '⊂', 'rel'); c('sup', '⊃', 'rel');
c('sube', '⊆', 'rel'); c('supe', '⊇', 'rel'); c('-=', '≡', 'rel'); c('~=', '≅', 'rel'); c('~~', '≈', 'rel'); c('~', '∼', 'rel'); c('prop', '∝', 'rel');
// Lógica
c('and', 'and', 'textord', 'text'); c('or', 'or', 'textord', 'text'); c('not', '¬'); c('=>', '⇒', 'rel'); c('implies', '⇒', 'rel'); c('if', 'if', 'textord', 'text');
c('<=>', '⇔', 'rel'); c('iff', '⇔', 'rel'); c('AA', '∀'); c('EE', '∃'); c('_|_', '⊥'); c('TT', '⊤'); c('|--', '⊢', 'rel'); c('|==', '⊨', 'rel');
// Diversos
c('int', '∫', 'op'); c('oint', '∮', 'op'); c('del', '∂'); c('grad', '∇'); c('+-', '±', 'bin'); c('-+', '∓', 'bin'); c('O/', '∅'); c('oo', '∞');
c('aleph', 'ℵ'); c(':.', '∴', 'rel'); c(":'", '∵', 'rel'); c('/_', '∠'); c('/_\\', '△'); c('\'', '′'); c('tilde', '~');
c('\\ ', ' ', 'textord', 'space'); c('quad', '  ', 'textord', 'space'); c('qquad', '    ', 'textord', 'space');
c('cdots', '⋯'); c('vdots', '⋮'); c('ddots', '⋱'); c('...', '…'); c('ldots', '…'); c('|\\ |', '|'); c('|quad|', '|  |');
c('diamond', '⋄'); c('square', '□'); c('|__', '⌊', 'open'); c('__|', '⌋', 'close'); c('|~', '⌈', 'open'); c('~|', '⌉', 'close');
c('CC', 'ℂ'); c('NN', 'ℕ'); c('QQ', 'ℚ'); c('RR', 'ℝ'); c('ZZ', 'ℤ'); c('f', 'f', 'mathord'); c('g', 'g', 'mathord');
// Setas
c('uarr', '↑', 'rel'); c('darr', '↓', 'rel'); c('rarr', '→', 'rel'); c('->', '→', 'rel'); c('>->', '↣', 'rel'); c('->>', '↠', 'rel'); c('>->>', '⤖', 'rel');
c('|->', '↦', 'rel'); c('larr', '←', 'rel'); c('harr', '↔', 'rel'); c('rArr', '⇒', 'rel'); c('lArr', '⇐', 'rel'); c('hArr', '⇔', 'rel');
// Gregas
const GREGAS: [string, string][] = [
  ['alpha', 'α'], ['beta', 'β'], ['gamma', 'γ'], ['Gamma', 'Γ'], ['delta', 'δ'], ['Delta', 'Δ'], ['epsi', 'ε'], ['epsilon', 'ε'], ['varepsilon', 'ϵ'],
  ['zeta', 'ζ'], ['eta', 'η'], ['theta', 'θ'], ['Theta', 'Θ'], ['vartheta', 'ϑ'], ['iota', 'ι'], ['kappa', 'κ'], ['lambda', 'λ'], ['Lambda', 'Λ'],
  ['mu', 'μ'], ['nu', 'ν'], ['xi', 'ξ'], ['Xi', 'Ξ'], ['pi', 'π'], ['Pi', 'Π'], ['rho', 'ρ'], ['sigma', 'σ'], ['Sigma', 'Σ'], ['tau', 'τ'],
  ['upsilon', 'υ'], ['phi', 'ϕ'], ['Phi', 'Φ'], ['varphi', 'φ'], ['chi', 'χ'], ['psi', 'ψ'], ['Psi', 'Ψ'], ['omega', 'ω'], ['Omega', 'Ω'],
];
for (const [nome, texto] of GREGAS)
  c(nome, texto, /[α-ωϵϑφ]/.test(texto) ? 'mathord' : 'textord');
// Parênteses
c('(', '(', 'open', 'left'); c(')', ')', 'close', 'right'); c('[', '[', 'open', 'left'); c(']', ']', 'close', 'right'); c('{', '{', 'open', 'left'); c('}', '}', 'close', 'right');
c('(:', '⟨', 'open', 'left'); c(':)', '⟩', 'close', 'right'); c('<<', '⟨', 'open', 'left'); c('>>', '⟩', 'close', 'right'); c('{:', '', 'open', 'left'); c(':}', '', 'close', 'right');
c('|', '|', 'textord', 'leftright');
// Funções
for (const nome of ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'coth', 'sech', 'csch', 'exp', 'log', 'ln', 'det', 'dim', 'mod', 'gcd', 'lcm', 'lub', 'glb'])
  S.set(nome, { texto: nome, classe: 'op', especie: 'unary', funcao: true });
for (const nome of ['lim', 'Lim', 'min', 'max'])
  S.set(nome, { texto: nome === 'Lim' ? 'Lim' : nome, classe: 'op', especie: 'unary', funcao: true, limites: true });
// Unários
S.set('sqrt', { texto: 'sqrt', classe: 'mathord', especie: 'unary', acao: 'sqrt' });
S.set('root', { texto: 'root', classe: 'mathord', especie: 'binary', acao: 'root' });
S.set('frac', { texto: 'frac', classe: 'mathord', especie: 'binary', acao: 'frac' });
S.set('stackrel', { texto: 'stackrel', classe: 'mathord', especie: 'binary', acao: 'stackrel' });
S.set('overset', { texto: 'overset', classe: 'mathord', especie: 'binary', acao: 'overset' });
S.set('underset', { texto: 'underset', classe: 'mathord', especie: 'binary', acao: 'underset' });
S.set('color', { texto: 'color', classe: 'mathord', especie: 'binary', acao: 'color' });
S.set('/', { texto: '/', classe: 'bin', especie: 'infix' });
S.set('_', { texto: '_', classe: 'bin', especie: 'infix' });
S.set('^', { texto: '^', classe: 'bin', especie: 'infix' });
const ACENTOS: [string, string, 'acento' | 'acentoBaixo'][] = [['hat', '^', 'acento'], ['bar', '¯', 'acento'], ['overline', '¯', 'acento'], ['vec', '\u20d7', 'acento'], ['dot', '˙', 'acento'], ['ddot', '¨', 'acento'], ['overarc', '⏜', 'acento'], ['ul', '_', 'acentoBaixo'], ['underline', '_', 'acentoBaixo'], ['tilde', '~', 'acento']];
for (const [nome, acento, acao] of ACENTOS)
  S.set(nome, { texto: nome, classe: 'mathord', especie: 'unary', acao, acento });
S.set('ubrace', { texto: 'ubrace', classe: 'mathord', especie: 'unary', acao: 'ubrace' });
S.set('underbrace', { texto: 'underbrace', classe: 'mathord', especie: 'unary', acao: 'ubrace' });
S.set('obrace', { texto: 'obrace', classe: 'mathord', especie: 'unary', acao: 'obrace' });
S.set('overbrace', { texto: 'overbrace', classe: 'mathord', especie: 'unary', acao: 'obrace' });
S.set('cancel', { texto: 'cancel', classe: 'mathord', especie: 'unary', acao: 'cancel' });
S.set('abs', { texto: 'abs', classe: 'mathord', especie: 'unary', acao: 'abs' });
S.set('floor', { texto: 'floor', classe: 'mathord', especie: 'unary', acao: 'floor' });
S.set('ceil', { texto: 'ceil', classe: 'mathord', especie: 'unary', acao: 'ceil' });
S.set('norm', { texto: 'norm', classe: 'mathord', especie: 'unary', acao: 'norm' });
S.set('text', { texto: 'text', classe: 'mathord', especie: 'unary', acao: 'texto' });
S.set('mbox', { texto: 'mbox', classe: 'mathord', especie: 'unary', acao: 'texto' });
const FONTES: [string, FonteMatematica][] = [['bb', 'negrito'], ['mathbf', 'negrito'], ['bbb', 'duplo'], ['mathbb', 'duplo'], ['cc', 'caligrafico'], ['mathcal', 'caligrafico'], ['tt', 'mono'], ['mathtt', 'mono'], ['fr', 'fraktur'], ['mathfrak', 'fraktur'], ['sf', 'semSerifa'], ['mathsf', 'semSerifa'], ['bf', 'negrito'], ['it', 'italico'], ['mathit', 'italico']];
for (const [nome, fonte] of FONTES)
  S.set(nome, { texto: nome, classe: 'mathord', especie: 'unary', acao: 'fonte', fonte });

const NOMES_ORDENADOS = [...S.keys()].sort((pA, pB) => pB.length - pA.length);

interface TokenAM {
  texto: string;
  simbolo?: SimboloAM;
  /** Número, letra, texto entre aspas. */
  tipo: 'simbolo' | 'numero' | 'letra' | 'texto' | 'fim';
  posicao: number;
}

class Lexer {
  private pos = 0;

  constructor(private readonly fonte: string) {}

  proximo(): TokenAM {
    const s = this.fonte;
    while (this.pos < s.length && /\s/.test(s[this.pos]) && !(s[this.pos] === ' ' && s[this.pos - 1] === '\\'))
      this.pos += 1;
    if (this.pos >= s.length)
      return { texto: '', tipo: 'fim', posicao: this.pos };
    const inicio = this.pos;
    if (s[this.pos] === '"') {
      const fecha = s.indexOf('"', this.pos + 1);
      const fim = fecha === -1 ? s.length : fecha;
      this.pos = fim + 1;
      return { texto: s.slice(inicio + 1, fim), tipo: 'texto', posicao: inicio };
    }
    const numero = /^\d+(\.\d+)?/.exec(s.slice(this.pos));
    if (numero) {
      this.pos += numero[0].length;
      return { texto: numero[0], tipo: 'numero', posicao: inicio };
    }
    for (const nome of NOMES_ORDENADOS) {
      if (s.startsWith(nome, this.pos)) {
        // Palavra inteira: `sin` não casa no meio de `sinh`… (os nomes maiores vêm antes, então basta avançar).
        this.pos += nome.length;
        return { texto: nome, simbolo: S.get(nome), tipo: 'simbolo', posicao: inicio };
      }
    }
    const ponto = s.codePointAt(this.pos) as number;
    this.pos += ponto > 0xffff ? 2 : 1;
    return { texto: String.fromCodePoint(ponto), tipo: 'letra', posicao: inicio };
  }
}

export class ParserAsciiMath {
  private readonly lexer: Lexer;
  private olhado: TokenAM | null = null;
  readonly avisos: AvisoDaFormula[] = [];
  private nos = 0;

  constructor(pFonte: string) {
    this.lexer = new Lexer(pFonte);
  }

  private espiar(): TokenAM {
    if (!this.olhado)
      this.olhado = this.lexer.proximo();
    return this.olhado;
  }

  private proximo(): TokenAM {
    const t = this.espiar();
    this.olhado = null;
    this.nos += 1;
    if (this.nos > 20000)
      throw new Error('Fórmula grande demais.');
    return t;
  }

  analisar(): No[] {
    try {
      const saida = this.expressao(false);
      const t = this.espiar();
      if (t.tipo !== 'fim') {
        this.avisos.push({ posicao: t.posicao, texto: `Fechamento inesperado \`${t.texto}\`.` });
        saida.push({ tipo: 'erro', texto: t.texto, mensagem: 'Fechamento sem abertura.' });
        this.proximo();
        saida.push(...this.analisar());
      }
      return saida;
    } catch (pErro) {
      const mensagem = pErro instanceof Error ? pErro.message : String(pErro);
      this.avisos.push({ posicao: 0, texto: mensagem });
      return [{ tipo: 'erro', texto: '', mensagem }];
    }
  }

  /** E ::= IE | I/I — até um fechamento (não consumido) ou o fim. */
  private expressao(pDentroDeParenteses: boolean): No[] {
    const saida: No[] = [];
    for (;;) {
      const t = this.espiar();
      if (t.tipo === 'fim')
        break;
      if (t.simbolo?.especie === 'right' || (pDentroDeParenteses && t.simbolo?.especie === 'leftright' && saida.length > 0))
        break;
      if (t.tipo === 'letra' && t.texto === ',' && pDentroDeParenteses)
        break;
      const i = this.intermediario();
      if (i === null)
        break;
      const proximo = this.espiar();
      if (proximo.simbolo?.especie === 'infix' && proximo.texto === '/') {
        this.proximo();
        const denominador = this.intermediario() ?? grupo([]);
        saida.push({ tipo: 'fracao', numerador: semParenteses(i), denominador: semParenteses(denominador), barra: true });
        continue;
      }
      saida.push(i);
    }
    return saida;
  }

  /** I ::= S_S | S^S | S_S^S | S */
  private intermediario(): No | null {
    const s = this.simples();
    if (s === null)
      return null;
    let sub: No | undefined;
    let sup: No | undefined;
    for (;;) {
      const t = this.espiar();
      if (t.simbolo?.especie === 'infix' && t.texto === '_' && sub === undefined) {
        this.proximo();
        sub = semParenteses(this.simples() ?? grupo([]));
        continue;
      }
      if (t.simbolo?.especie === 'infix' && t.texto === '^' && sup === undefined) {
        this.proximo();
        sup = semParenteses(this.simples() ?? grupo([]));
        continue;
      }
      break;
    }
    if (sub === undefined && sup === undefined)
      return s;
    const no: No = { tipo: 'supsub', base: s };
    if (sub)
      no.sub = sub;
    if (sup)
      no.sup = sup;
    return no;
  }

  /** S ::= c | lEr | uS | bSS | "texto" */
  private simples(): No | null {
    const t = this.espiar();
    if (t.tipo === 'fim')
      return null;
    if (t.simbolo?.especie === 'right')
      return null;
    this.proximo();
    switch (t.tipo) {
      case 'numero':
        return grupo([...t.texto].map((pC) => simbolo('textord', pC)));
      case 'texto':
        return { tipo: 'texto', filhos: [...t.texto].map((pC) => simbolo('textord', pC, 'text')) };
      case 'letra':
        if (/\p{L}/u.test(t.texto))
          return simbolo('mathord', t.texto);
        if (t.texto === ',')
          return simbolo('punct', ',');
        if (t.texto === ';' || t.texto === ':')
          return simbolo('punct', t.texto);
        if (t.texto === '!' || t.texto === '?')
          return simbolo('close', t.texto);
        return simbolo('textord', t.texto);
      default:
        break;
    }
    const sim = t.simbolo as SimboloAM;
    switch (sim.especie) {
      case 'const':
        return simbolo(sim.classe, sim.texto);
      case 'op':
        return simbolo('op', sim.texto);
      case 'text':
        return { tipo: 'texto', filhos: [simbolo('textord', ' ', 'text'), ...[...sim.texto].map((pC) => simbolo('textord', pC, 'text')), simbolo('textord', ' ', 'text')] };
      case 'space':
        return { tipo: 'espaco', largura: medidaEm(sim.texto.length * 0.3333), texto: true };
      case 'left':
        return this.delimitado(sim);
      case 'leftright':
        return this.barras();
      case 'unary':
        return this.unario(sim, t);
      case 'binary':
        return this.binario(sim);
      case 'infix':
        // `/`, `_`, `^` soltos: saem como símbolo.
        return simbolo('bin', t.texto === '/' ? '/' : t.texto);
      default:
        return simbolo('textord', sim.texto);
    }
  }

  /** `(…)`, `[…]`, `{…}`, `(: :)`, `{: :}` — com matriz quando `[[a,b],[c,d]]`. */
  private delimitado(pAbre: SimboloAM): No {
    const celulas: No[][] = [];
    let corpo: No[] = [];
    for (;;) {
      corpo.push(...this.expressao(true));
      const t = this.espiar();
      if (t.tipo === 'letra' && t.texto === ',') {
        this.proximo();
        celulas.push(corpo);
        corpo = [];
        continue;
      }
      break;
    }
    celulas.push(corpo);
    const fecha = this.espiar();
    let direita = '';
    if (fecha.simbolo?.especie === 'right') {
      this.proximo();
      direita = fecha.simbolo.texto;
    } else if (fecha.tipo === 'fim')
      this.avisos.push({ posicao: fecha.posicao, texto: `\`${pAbre.texto}\` não fechou.` });
    // Matriz: todas as células são, elas próprias, parênteses com vírgulas (`[a,b]`).
    const matriz = celulas.length > 1 || (celulas.length === 1 && celulas[0].length > 1 && celulas[0].every(ehLinhaDeMatriz));
    if (matriz && celulas.every((pL) => pL.length === 1 && ehLinhaDeMatriz(pL[0]))) {
      const linhas = celulas.map((pL) => (pL[0] as No & { tipo: 'delimitado' }).corpo);
      const colunas = Math.max(...linhas.map((pL) => contarColunas(pL)));
      return {
        tipo: 'arranjo',
        ambiente: 'matrix',
        linhas: linhas.map((pL) => ({ celulas: dividirPorVirgula(pL), linhasAntes: 0, tracejadasAntes: 0 })),
        colunas: Array.from({ length: colunas }, () => ({ alinhamento: 'centro' as const, linhasAntes: 0, tracejadasAntes: 0 })),
        linhasDepois: 0,
        tracejadasDepois: 0,
        linhasNoFim: 0,
        tracejadasNoFim: 0,
        delimitadorEsquerdo: pAbre.texto || undefined,
        delimitadorDireito: direita || undefined,
      };
    }
    const filhos: No[] = [];
    celulas.forEach((pC, pI) => {
      if (pI > 0)
        filhos.push(simbolo('punct', ','));
      filhos.push(...pC);
    });
    return { tipo: 'delimitado', esquerda: pAbre.texto, direita, corpo: filhos };
  }

  /** `|x|`: a primeira barra abre, a próxima fecha. */
  private barras(): No {
    const corpo = this.expressao(true);
    const t = this.espiar();
    if (t.simbolo?.especie === 'leftright') {
      this.proximo();
      return { tipo: 'delimitado', esquerda: '|', direita: '|', corpo };
    }
    // Sem par: barra solta seguida do que veio.
    return grupo([simbolo('textord', '|'), ...corpo]);
  }

  private unario(pSim: SimboloAM, pToken: TokenAM): No {
    if (pSim.funcao) {
      const op: No = { tipo: 'operador', nome: [...pSim.texto].map((pC) => simbolo('textord', pC, 'text')), grande: false, limites: Boolean(pSim.limites) };
      return op;
    }
    const argumento = this.simples() ?? grupo([]);
    const limpo = semParenteses(argumento);
    switch (pSim.acao) {
      case 'sqrt':
        return { tipo: 'raiz', radicando: limpo };
      case 'texto': {
        const texto = textoDe(argumento);
        return { tipo: 'texto', filhos: [...texto].map((pC) => simbolo('textord', pC, 'text')) };
      }
      case 'fonte':
        return aplicarFonteAM(limpo, pSim.fonte as FonteMatematica);
      case 'acento':
        return { tipo: 'acento', acento: pSim.acento as string, base: limpo, largo: pSim.texto === 'overarc' || pSim.texto === 'overline' || pSim.texto === 'bar' && false };
      case 'acentoBaixo':
        return { tipo: 'linha', posicao: 'abaixo', corpo: [limpo] };
      case 'ubrace':
        return { tipo: 'chave', acima: false, corpo: [limpo] };
      case 'obrace':
        return { tipo: 'chave', acima: true, corpo: [limpo] };
      case 'cancel':
        return { tipo: 'cercadura', especie: 'cancel', corpo: [limpo] };
      case 'abs':
        return { tipo: 'delimitado', esquerda: '|', direita: '|', corpo: [limpo] };
      case 'norm':
        return { tipo: 'delimitado', esquerda: '‖', direita: '‖', corpo: [limpo] };
      case 'floor':
        return { tipo: 'delimitado', esquerda: '⌊', direita: '⌋', corpo: [limpo] };
      case 'ceil':
        return { tipo: 'delimitado', esquerda: '⌈', direita: '⌉', corpo: [limpo] };
      default:
        this.avisos.push({ posicao: pToken.posicao, texto: `Unário desconhecido \`${pSim.texto}\`.` });
        return limpo;
    }
  }

  private binario(pSim: SimboloAM): No {
    const a = semParenteses(this.simples() ?? grupo([]));
    const b = semParenteses(this.simples() ?? grupo([]));
    switch (pSim.acao) {
      case 'frac':
        return { tipo: 'fracao', numerador: a, denominador: b, barra: true };
      case 'root':
        return { tipo: 'raiz', radicando: b, indice: a };
      case 'stackrel':
      case 'overset':
        return { tipo: 'supsub', base: { tipo: 'operador', nome: [b], grande: false, limites: true }, sup: a, limites: true };
      case 'underset':
        return { tipo: 'supsub', base: { tipo: 'operador', nome: [b], grande: false, limites: true }, sub: a, limites: true };
      case 'color':
        return { tipo: 'cor', cor: textoDe(a).trim() || 'black', filhos: [b] };
      default:
        return grupo([a, b]);
    }
  }
}

function ehLinhaDeMatriz(pNo: No): boolean {
  return pNo.tipo === 'delimitado' && (pNo.esquerda === '(' || pNo.esquerda === '[') && pNo.corpo.some((pF) => pF.tipo === 'simbolo' && pF.classe === 'punct' && pF.texto === ',');
}

function dividirPorVirgula(pNos: No[]): No[][] {
  const saida: No[][] = [[]];
  for (const no of pNos) {
    if (no.tipo === 'simbolo' && no.classe === 'punct' && no.texto === ',')
      saida.push([]);
    else
      saida[saida.length - 1].push(no);
  }
  return saida;
}

function contarColunas(pNos: No[]): number {
  return dividirPorVirgula(pNos).length;
}

/** `(x)` → `x` em frações, scripts e argumentos de unários (regra do AsciiMath). */
function semParenteses(pNo: No): No {
  if (pNo.tipo === 'delimitado' && ((pNo.esquerda === '(' && pNo.direita === ')') || (pNo.esquerda === '[' && pNo.direita === ']') || (pNo.esquerda === '{' && pNo.direita === '}') || (pNo.esquerda === '' && pNo.direita === '')))
    return grupo(pNo.corpo);
  return pNo;
}

function textoDe(pNo: No): string {
  switch (pNo.tipo) {
    case 'simbolo':
      return pNo.texto;
    case 'grupo':
      return pNo.filhos.map(textoDe).join('');
    case 'texto':
      return pNo.filhos.map(textoDe).join('');
    case 'delimitado':
      return pNo.corpo.map(textoDe).join('');
    default:
      return '';
  }
}

function aplicarFonteAM(pNo: No, pFonte: FonteMatematica): No {
  if (pNo.tipo === 'simbolo')
    return { ...pNo, fonte: pFonte };
  if (pNo.tipo === 'grupo')
    return grupo(pNo.filhos.map((pF) => aplicarFonteAM(pF, pFonte)));
  if (pNo.tipo === 'texto')
    return { ...pNo, filhos: pNo.filhos.map((pF) => (pF.tipo === 'simbolo' ? { ...pF, modo: 'math' as const, fonte: pFonte } : pF)) };
  return pNo;
}

export function analisarAsciiMath(pFonte: string): { nos: No[]; avisos: AvisoDaFormula[] } {
  const parser = new ParserAsciiMath(pFonte);
  const nos = parser.analisar();
  return { nos, avisos: parser.avisos };
}
