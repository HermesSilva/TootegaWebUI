/**
 * EXPANSOR DE MACROS do TeX. Fica entre o lexer e o parser: o parser pede tokens já expandidos; o expansor conhece
 * as macros embutidas (a mesma lista que o KaTeX publica em `macros.ts`, reescrita aqui) e as que o usuário define
 * com `\def`, `\gdef`, `\edef`, `\xdef`, `\let`, `\futurelet`, `\newcommand`, `\renewcommand`, `\providecommand`,
 * com parâmetros `#1`…`#9` (inclusive delimitados). Também responde pelas primitivas de expansão: `\relax`,
 * `\noexpand`, `\expandafter`, `\@ifstar`, `\@ifnextchar`, `\@firstoftwo`, `\@secondoftwo`, `\TextOrMath`, `\char`.
 */

import { Lexer, token, type Token } from './lexer';

export interface DefinicaoDeMacro {
  /** O corpo, já tokenizado (os `#n` são tokens `parametro`). */
  corpo: Token[];
  numArgs: number;
  /** Texto que delimita cada parâmetro (`\def\a#1.#2;{…}`): `delimitadores[i]` segue o parâmetro `i`. */
  delimitadores?: Token[][];
  /** `\newcommand{\x}[2][padrao]`: o primeiro argumento é opcional. */
  padraoDoPrimeiro?: Token[];
}

/** Macro embutida: texto re-tokenizado, ou função que recebe o expansor e devolve o texto. */
export type MacroEmbutida = string | ((pExpansor: Expansor) => string | Token[]);

const LIMITE_DE_EXPANSOES = 10000;
const LIMITE_DE_PILHA = 10000;

/** As macros embutidas (ver cabeçalho): o que não é primitiva do parser e se escreve com outras sequências. */
export const MACROS_EMBUTIDAS: Record<string, MacroEmbutida> = {
  '\\lparen': '(',
  '\\rparen': ')',
  '\\aa': '\\r a',
  '\\AA': '\\r A',
  '\\Reals': '\\mathbb{R}',
  '\\TeX': '\\textrm{T\\kern-.1667em\\raisebox{-.5ex}{E}\\kern-.125emX}',
  '\\LaTeX': '\\textrm{L\\kern-.36em\\raisebox{.205em}{\\scriptstyle A}\\kern-.15em\\TeX}',
  '\\KaTeX': '\\textrm{K\\kern-.17em\\raisebox{.205em}{\\scriptstyle A}\\kern-.15em\\TeX}',
  '\\ordinarycolon': ':',
  '\\vcentcolon': '\\mathrel{\\mathop\\ordinarycolon}',
  '\\Coloneqq': '\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}=}',
  '\\coloneq': '\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}',
  '\\Coloneq': '\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\mathrel{-}}',
  '\\Eqqcolon': '\\mathrel{=\\mathrel{\\mkern-1.2mu}\\dblcolon}',
  '\\eqcolon': '\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\vcentcolon}',
  '\\Eqcolon': '\\mathrel{\\mathrel{-}\\mathrel{\\mkern-1.2mu}\\dblcolon}',
  '\\colonapprox': '\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\approx}',
  '\\Colonapprox': '\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\approx}',
  '\\colonsim': '\\mathrel{\\vcentcolon\\mathrel{\\mkern-1.2mu}\\sim}',
  '\\Colonsim': '\\mathrel{\\dblcolon\\mathrel{\\mkern-1.2mu}\\sim}',
  '\\ratio': '\\vcentcolon',
  '\\coloncolon': '\\dblcolon',
  '\\colonequals': '\\coloneqq',
  '\\coloncolonequals': '\\Coloneqq',
  '\\equalscolon': '\\eqqcolon',
  '\\equalscoloncolon': '\\Eqqcolon',
  '\\colonminus': '\\coloneq',
  '\\coloncolonminus': '\\Coloneq',
  '\\minuscolon': '\\eqcolon',
  '\\minuscoloncolon': '\\Eqcolon',
  '\\coloncolonapprox': '\\Colonapprox',
  '\\coloncolonsim': '\\Colonsim',
  '\\simcolon': '\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\vcentcolon}',
  '\\simcoloncolon': '\\mathrel{\\sim\\mathrel{\\mkern-1.2mu}\\dblcolon}',
  '\\approxcolon': '\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\vcentcolon}',
  '\\approxcoloncolon': '\\mathrel{\\approx\\mathrel{\\mkern-1.2mu}\\dblcolon}',
  '\\limsup': '\\operatorname*{lim\\,sup}',
  '\\liminf': '\\operatorname*{lim\\,inf}',
  '\\injlim': '\\operatorname*{inj\\,lim}',
  '\\projlim': '\\operatorname*{proj\\,lim}',
  '\\varlimsup': '\\operatorname*{\\overline{lim}}',
  '\\varliminf': '\\operatorname*{\\underline{lim}}',
  '\\varinjlim': '\\operatorname*{\\underrightarrow{lim}}',
  '\\varprojlim': '\\operatorname*{\\underleftarrow{lim}}',
  '\\argmin': '\\operatorname*{arg\\,min}',
  '\\argmax': '\\operatorname*{arg\\,max}',
  '\\plim': '\\operatorname*{plim}',
  '\\dotso': '\\ldots',
  '\\dotsc': '\\ldots',
  '\\dotsb': '\\cdots',
  '\\dotsm': '\\cdots',
  '\\dotsi': '\\!\\cdots',
  '\\dotsx': '\\ldots\\,',
  '\\DOTSI': '',
  '\\DOTSB': '',
  '\\DOTSX': '',
  '\\thinspace': '\\,',
  '\\medspace': '\\:',
  '\\thickspace': '\\;',
  '\\negthinspace': '\\!',
  '\\negmedspace': '\\mkern-4mu',
  '\\negthickspace': '\\mkern-5mu',
  '\\enspace': '\\kern.5em',
  '\\enskip': '\\hskip.5em\\relax',
  '\\quad': '\\hskip1em\\relax',
  '\\qquad': '\\hskip2em\\relax',
  '\\bmod': '\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}\\mathbin{\\rm mod}\\mathchoice{\\mskip1mu}{\\mskip1mu}{\\mskip5mu}{\\mskip5mu}',
  '\\pod': '\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern8mu}{\\mkern8mu}{\\mkern8mu}(#1)',
  '\\pmod': '\\pod{{\\rm mod}\\mkern6mu#1}',
  '\\mod': '\\allowbreak\\mathchoice{\\mkern18mu}{\\mkern12mu}{\\mkern12mu}{\\mkern12mu}{\\rm mod}\\,\\,#1',
  '\\newline': '\\\\',
  '\\cr': '\\\\',
  '\\llap': '\\mathllap{\\textrm{#1}}',
  '\\rlap': '\\mathrlap{\\textrm{#1}}',
  '\\clap': '\\mathclap{\\textrm{#1}}',
  '\\bra': '\\mathinner{\\langle{#1}|}',
  '\\ket': '\\mathinner{|{#1}\\rangle}',
  '\\braket': '\\mathinner{\\langle{#1}\\rangle}',
  '\\Bra': '\\left\\langle#1\\right|',
  '\\Ket': '\\left|#1\\right\\rangle',
  '\\Braket': '\\left\\langle#1\\right\\rangle',
  '\\set': '\\left\\{\\,#1\\,\\right\\}',
  '\\Set': '\\left\\{\\:#1\\:\\right\\}',
  '\\varGamma': '\\mathit{\\Gamma}',
  '\\varDelta': '\\mathit{\\Delta}',
  '\\varTheta': '\\mathit{\\Theta}',
  '\\varLambda': '\\mathit{\\Lambda}',
  '\\varXi': '\\mathit{\\Xi}',
  '\\varPi': '\\mathit{\\Pi}',
  '\\varSigma': '\\mathit{\\Sigma}',
  '\\varUpsilon': '\\mathit{\\Upsilon}',
  '\\varPhi': '\\mathit{\\Phi}',
  '\\varPsi': '\\mathit{\\Psi}',
  '\\varOmega': '\\mathit{\\Omega}',
  '\\substack': '\\begin{subarray}{c}#1\\end{subarray}',
  '\\iff': '\\;\\Longleftrightarrow\\;',
  '\\implies': '\\;\\Longrightarrow\\;',
  '\\impliedby': '\\;\\Longleftarrow\\;',
  '\\mathstrut': '\\vphantom{(}',
  '\\underbar': '\\underline{\\text{#1}}',
  '\\stackrel': '\\mathrel{\\mathop{#2}\\limits^{#1}}',
  '\\overset': '\\mathop{#2}\\limits^{#1}',
  '\\underset': '\\mathop{#2}\\limits_{#1}',
  '\\nonumber': '\\notag',
  '\\bold': '\\mathbf{#1}',
  '\\boldsymbol': '\\bm{#1}',
  '\\frak': '\\mathfrak{#1}',
  '\\Bbb': '\\mathbb{#1}',
  '\\mathscr': '\\mathcal{#1}',
  '\\hspace': '\\@ifstar\\@hspacer\\@hspace',
  '\\@hspace': '\\hskip #1\\relax',
  '\\@hspacer': '\\rule{0pt}{0pt}\\hskip #1\\relax',
  '\\tag': '\\@ifstar\\tag@literal\\tag@paren',
  '\\tag@paren': '\\tag@literal{({#1})}',
  '\\textcircled': '\\mathord{\\bigcirc}',
  '\\textsc': '\\text{#1}',
  '\\sc': '',
  '\\red': '\\textcolor{##df0030}{#1}',
  '\\blue': '\\textcolor{##0c7f99}{#1}',
  '\\green': '\\textcolor{##1fab54}{#1}',
  '\\gray': '\\textcolor{##616161}{#1}',
  '\\orange': '\\textcolor{##ff9c39}{#1}',
  '\\purple': '\\textcolor{##9059ff}{#1}',
  '\\pink': '\\textcolor{##ff92c6}{#1}',
  '\\teal': '\\textcolor{##01a995}{#1}',
  '\\maroon': '\\textcolor{##9e034e}{#1}',
};

/** `\dots`: reticências no meio da linha (`\ldots`) ou centradas depois de operador/relação (`\cdots`). */
MACROS_EMBUTIDAS['\\dots'] = (pExpansor) => {
  const proximo = pExpansor.espiarCru();
  const centradas = new Set(['+', '-', '=', '<', '>', '\\cdot', '\\times', '\\pm', '\\mp', '\\cup', '\\cap', '\\vee', '\\wedge', '\\oplus', '\\otimes', '\\sum', '\\prod', '\\int', '\\bigcap', '\\bigcup', '\\leq', '\\geq', '\\equiv', '\\sim', '\\approx', '\\to', '\\rightarrow', '\\leftarrow', '\\Rightarrow', '\\DOTSB', '\\DOTSI']);
  const fecha = new Set([')', ']', '\\rbrack', '\\}', '\\rbrace', '\\rangle', '\\rceil', '\\rfloor', '\\rgroup', '\\rmoustache', '\\right', '\\bigr', '\\biggr', '\\Bigr', '\\Biggr', '\\DOTSX']);
  if (proximo.tipo === 'fim')
    return '\\dotso';
  if (centradas.has(proximo.texto))
    return '\\dotsb';
  if (fecha.has(proximo.texto))
    return '\\dotsx';
  return '\\dotso';
};

export class Expansor {
  private readonly lexer: Lexer;
  /** Tokens devolvidos ou gerados por expansão; o topo é o fim do vetor. */
  private pilha: Token[] = [];
  private readonly macros = new Map<string, DefinicaoDeMacro>();
  private readonly pilhaDeGrupos: Map<string, DefinicaoDeMacro | null>[] = [];
  private expansoes = 0;
  /** O parser mantém isto para `\TextOrMath`. */
  modo: 'math' | 'text' = 'math';
  readonly avisos: string[] = [];

  constructor(pFonte: string) {
    this.lexer = new Lexer(pFonte);
  }

  get fonte(): string {
    return this.lexer.fonte;
  }

  // ------------------------------------------------------------ grupos (escopo de \def)

  iniciarGrupo(): void {
    this.pilhaDeGrupos.push(new Map());
  }

  encerrarGrupo(): void {
    const alteracoes = this.pilhaDeGrupos.pop();
    if (!alteracoes)
      return;
    for (const [nome, anterior] of alteracoes) {
      if (anterior === null)
        this.macros.delete(nome);
      else
        this.macros.set(nome, anterior);
    }
  }

  private definir(pNome: string, pDefinicao: DefinicaoDeMacro | null, pGlobal: boolean): void {
    if (pGlobal) {
      for (const grupo of this.pilhaDeGrupos)
        grupo.delete(pNome);
    } else {
      const grupo = this.pilhaDeGrupos[this.pilhaDeGrupos.length - 1];
      if (grupo && !grupo.has(pNome))
        grupo.set(pNome, this.macros.get(pNome) ?? null);
    }
    if (pDefinicao === null)
      this.macros.delete(pNome);
    else
      this.macros.set(pNome, pDefinicao);
  }

  temMacro(pNome: string): boolean {
    return this.macros.has(pNome) || pNome in MACROS_EMBUTIDAS;
  }

  // ------------------------------------------------------------ tokens crus

  /** Próximo token SEM expandir. */
  proximoCru(): Token {
    if (this.pilha.length > 0)
      return this.pilha.pop() as Token;
    return this.lexer.proximo();
  }

  espiarCru(): Token {
    const t = this.proximoCru();
    this.devolver(t);
    return t;
  }

  devolver(pToken: Token): void {
    if (this.pilha.length > LIMITE_DE_PILHA)
      throw new Error('Expansão de macro sem fim (pilha estourou).');
    this.pilha.push(pToken);
  }

  devolverTodos(pTokens: Token[]): void {
    for (let i = pTokens.length - 1; i >= 0; i--)
      this.devolver(pTokens[i]);
  }

  /** Pula espaços (modo matemático). */
  pularEspacos(): void {
    for (;;) {
      const t = this.proximoCru();
      if (t.tipo !== 'espaco') {
        this.devolver(t);
        return;
      }
    }
  }

  // ------------------------------------------------------------ argumentos

  /** Um argumento: grupo `{…}` (sem as chaves) ou um token só. Espaços antes são pulados. */
  lerArgumento(pPermitirFim = false): Token[] {
    this.pularEspacos();
    const t = this.proximoCru();
    if (t.tipo === 'fim') {
      if (pPermitirFim)
        return [];
      throw new Error('Faltou argumento no fim da fórmula.');
    }
    if (t.tipo === 'caractere' && t.texto === '{')
      return this.lerAteFecharGrupo(t);
    return [t];
  }

  /** Tokens até o `}` que fecha o `{` já consumido (`pAbre`), com aninhamento; as chaves externas ficam de fora. */
  private lerAteFecharGrupo(pAbre: Token): Token[] {
    const saida: Token[] = [];
    let nivel = 1;
    for (;;) {
      const t = this.proximoCru();
      if (t.tipo === 'fim')
        throw new Error(`Grupo aberto em ${pAbre.posicao} não fechou.`);
      if (t.tipo === 'caractere' && t.texto === '{')
        nivel += 1;
      else if (t.tipo === 'caractere' && t.texto === '}') {
        nivel -= 1;
        if (nivel === 0)
          return saida;
      }
      saida.push(t);
    }
  }

  /** Argumento delimitado: tudo até a sequência `pDelimitador` (consumida), respeitando grupos. */
  private lerArgumentoDelimitado(pDelimitador: Token[]): Token[] {
    const saida: Token[] = [];
    let nivel = 0;
    for (;;) {
      if (nivel === 0 && this.casaDelimitador(pDelimitador))
        break;
      const t = this.proximoCru();
      if (t.tipo === 'fim')
        throw new Error('Argumento delimitado não terminou.');
      if (t.tipo === 'caractere' && t.texto === '{')
        nivel += 1;
      else if (t.tipo === 'caractere' && t.texto === '}')
        nivel -= 1;
      saida.push(t);
    }
    // `{…}` inteiro como argumento delimitado perde as chaves externas (regra do TeX).
    if (saida.length >= 2 && saida[0].texto === '{' && saida[saida.length - 1].texto === '}' && this.chavesExternasCasam(saida))
      return saida.slice(1, -1);
    return saida;
  }

  private chavesExternasCasam(pTokens: Token[]): boolean {
    let nivel = 0;
    for (let i = 0; i < pTokens.length; i++) {
      const t = pTokens[i];
      if (t.tipo === 'caractere' && t.texto === '{')
        nivel += 1;
      else if (t.tipo === 'caractere' && t.texto === '}') {
        nivel -= 1;
        if (nivel === 0 && i < pTokens.length - 1)
          return false;
      }
    }
    return true;
  }

  private casaDelimitador(pDelimitador: Token[]): boolean {
    const lidos: Token[] = [];
    for (const esperado of pDelimitador) {
      const t = this.proximoCru();
      lidos.push(t);
      if (t.tipo !== esperado.tipo || t.texto !== esperado.texto) {
        this.devolverTodos(lidos);
        return false;
      }
    }
    return true;
  }

  // ------------------------------------------------------------ expansão

  /**
   * Expande UMA vez o próximo token, se for macro; devolve `true` se expandiu. Tokens não expansíveis voltam à pilha.
   */
  expandirUmaVez(): boolean {
    const t = this.proximoCru();
    if (t.tipo !== 'controle') {
      this.devolver(t);
      return false;
    }
    const nome = t.texto;
    const usuario = this.macros.get(nome);
    const embutida = usuario ? undefined : MACROS_EMBUTIDAS[nome];
    if (!usuario && embutida === undefined) {
      this.devolver(t);
      return false;
    }
    this.expansoes += 1;
    if (this.expansoes > LIMITE_DE_EXPANSOES)
      throw new Error(`Expansão de macro sem fim em \`${nome}\`.`);

    let definicao: DefinicaoDeMacro;
    if (usuario)
      definicao = usuario;
    else if (typeof embutida === 'string')
      definicao = definicaoDeTexto(embutida);
    else {
      const resultado = (embutida as (pE: Expansor) => string | Token[])(this);
      definicao = typeof resultado === 'string' ? definicaoDeTexto(resultado) : { corpo: resultado, numArgs: 0 };
    }

    const argumentos: Token[][] = [];
    if (definicao.numArgs > 0) {
      for (let i = 0; i < definicao.numArgs; i++) {
        const delimitador = definicao.delimitadores?.[i];
        if (i === 0 && definicao.padraoDoPrimeiro) {
          this.pularEspacos();
          const abre = this.proximoCru();
          if (abre.tipo === 'caractere' && abre.texto === '[') {
            argumentos.push(this.lerAteFecharColchete());
          } else {
            this.devolver(abre);
            argumentos.push(definicao.padraoDoPrimeiro);
          }
          continue;
        }
        argumentos.push(delimitador && delimitador.length > 0 ? this.lerArgumentoDelimitado(delimitador) : this.lerArgumento());
      }
    }
    const expandido: Token[] = [];
    for (const c of definicao.corpo) {
      if (c.tipo === 'parametro') {
        if (c.texto === '##') {
          expandido.push(token('caractere', '#', t.posicao, true));
          continue;
        }
        const indice = Number(c.texto[1]) - 1;
        const argumento = argumentos[indice];
        if (argumento)
          for (const a of argumento)
            expandido.push({ ...a, posicao: t.posicao, expandido: true });
        continue;
      }
      expandido.push({ ...c, posicao: t.posicao, expandido: true });
    }
    this.devolverTodos(expandido);
    return true;
  }

  private lerAteFecharColchete(): Token[] {
    const saida: Token[] = [];
    let nivel = 0;
    for (;;) {
      const t = this.proximoCru();
      if (t.tipo === 'fim')
        throw new Error('Argumento opcional `[` não fechou.');
      if (t.tipo === 'caractere' && t.texto === '{')
        nivel += 1;
      else if (t.tipo === 'caractere' && t.texto === '}')
        nivel -= 1;
      else if (nivel === 0 && t.tipo === 'caractere' && t.texto === ']')
        return saida;
      saida.push(t);
    }
  }

  /** Próximo token totalmente expandido (as primitivas de expansão são resolvidas aqui). */
  proximo(): Token {
    for (;;) {
      const primitiva = this.primitivaDeExpansao();
      if (primitiva)
        continue;
      if (!this.expandirUmaVez())
        return this.proximoCru();
    }
  }

  espiar(): Token {
    const t = this.proximo();
    this.devolver(t);
    return t;
  }

  /** Lê um argumento e o expande por completo (para `\edef`, `\operatorname`, tamanhos). */
  lerArgumentoExpandido(): Token[] {
    const tokens = this.lerArgumento();
    return this.expandirTokens(tokens);
  }

  expandirTokens(pTokens: Token[]): Token[] {
    const marcador = token('controle', '\\@fimDaExpansao', -1);
    this.devolver(marcador);
    this.devolverTodos(pTokens);
    const saida: Token[] = [];
    for (;;) {
      const t = this.proximo();
      if (t === marcador || (t.texto === '\\@fimDaExpansao' && t.posicao === -1))
        return saida;
      if (t.tipo === 'fim') {
        // Marcador perdido (não deveria acontecer): restaura e devolve o que leu.
        return saida;
      }
      saida.push(t);
    }
  }

  /** Texto cru de um argumento, sem expansão (cor, URL, tamanho, `\verb`-like). */
  lerArgumentoCru(pOpcional = false): string | null {
    this.pularEspacos();
    const t = this.proximoCru();
    if (pOpcional) {
      if (t.tipo === 'caractere' && t.texto === '[')
        return this.lerAteFecharColchete().map((pT) => pT.texto).join('');
      this.devolver(t);
      return null;
    }
    if (t.tipo === 'fim')
      throw new Error('Faltou argumento no fim da fórmula.');
    if (t.tipo === 'caractere' && t.texto === '{')
      return this.lerAteFecharGrupo(t).map((pT) => pT.texto).join('');
    return t.texto;
  }

  /** `\verb`: delega ao lexer (só vale quando o próximo token vem do lexer, não da pilha). */
  lerVerbatim(): { texto: string; estrela: boolean } | null {
    if (this.pilha.length > 0)
      return null;
    return this.lexer.lerVerbatim();
  }

  // ------------------------------------------------------------ primitivas

  private primitivaDeExpansao(): boolean {
    const t = this.proximoCru();
    if (t.tipo !== 'controle') {
      this.devolver(t);
      return false;
    }
    switch (t.texto) {
      case '\\relax':
        return true;
      case '\\noexpand': {
        const proximo = this.proximoCru();
        // O próximo token sai sem expandir: marcamos como caractere de controle "congelado".
        this.devolver({ ...proximo, tipo: proximo.tipo === 'controle' && this.temMacro(proximo.texto) ? 'caractere' : proximo.tipo });
        return false;
      }
      case '\\expandafter': {
        const primeiro = this.proximoCru();
        this.expandirUmaVez();
        this.devolver(primeiro);
        return true;
      }
      case '\\@firstoftwo': {
        const a = this.lerArgumento();
        this.lerArgumento();
        this.devolverTodos(a);
        return true;
      }
      case '\\@secondoftwo': {
        this.lerArgumento();
        const b = this.lerArgumento();
        this.devolverTodos(b);
        return true;
      }
      case '\\@ifnextchar': {
        const esperado = this.lerArgumento();
        const sim = this.lerArgumento();
        const nao = this.lerArgumento();
        this.pularEspacos();
        const proximo = this.espiarCru();
        this.devolverTodos(esperado.length === 1 && proximo.texto === esperado[0].texto ? sim : nao);
        return true;
      }
      case '\\@ifstar': {
        const sim = this.lerArgumento();
        const nao = this.lerArgumento();
        this.pularEspacos();
        const proximo = this.proximoCru();
        if (proximo.tipo === 'caractere' && proximo.texto === '*')
          this.devolverTodos(sim);
        else {
          this.devolver(proximo);
          this.devolverTodos(nao);
        }
        return true;
      }
      case '\\TextOrMath': {
        const texto = this.lerArgumento();
        const matematica = this.lerArgumento();
        this.devolverTodos(this.modo === 'text' ? texto : matematica);
        return true;
      }
      case '\\char': {
        const codigo = this.lerCodigoDeCaractere();
        this.devolver(token('caractere', String.fromCodePoint(codigo), t.posicao, true));
        return true;
      }
      case '\\def':
      case '\\gdef':
      case '\\edef':
      case '\\xdef':
        this.lerDef(t.texto === '\\gdef' || t.texto === '\\xdef', t.texto === '\\edef' || t.texto === '\\xdef');
        return true;
      case '\\global': {
        const proximo = this.proximoCru();
        if (proximo.texto === '\\def' || proximo.texto === '\\edef') {
          this.lerDef(true, proximo.texto === '\\edef');
          return true;
        }
        if (proximo.texto === '\\let') {
          this.lerLet(true);
          return true;
        }
        this.devolver(proximo);
        return true;
      }
      case '\\long':
        return true;
      case '\\let':
        this.lerLet(false);
        return true;
      case '\\futurelet': {
        this.pularEspacos();
        const nome = this.proximoCru();
        const seguinte = this.proximoCru();
        const futuro = this.proximoCru();
        this.devolver(futuro);
        this.devolver(seguinte);
        this.definirComoToken(nome.texto, futuro, false);
        return true;
      }
      case '\\newcommand':
      case '\\renewcommand':
      case '\\providecommand':
        this.lerNewcommand(t.texto);
        return true;
      default:
        this.devolver(t);
        return false;
    }
  }

  private lerCodigoDeCaractere(): number {
    this.pularEspacos();
    let t = this.proximoCru();
    let base = 10;
    let digitos = '';
    if (t.texto === '\'')
      base = 8;
    else if (t.texto === '"')
      base = 16;
    else if (t.texto === '`') {
      const c = this.proximoCru();
      const texto = c.tipo === 'controle' ? c.texto.slice(1) : c.texto;
      return texto.codePointAt(0) ?? 0;
    } else
      digitos = t.texto;
    for (;;) {
      t = this.proximoCru();
      if (t.tipo === 'caractere' && /^[0-9a-fA-F]$/.test(t.texto) && Number.parseInt(t.texto, base) >= 0 && !Number.isNaN(Number.parseInt(t.texto, base)))
        digitos += t.texto;
      else {
        if (t.tipo !== 'espaco')
          this.devolver(t);
        break;
      }
    }
    const numero = Number.parseInt(digitos, base);
    if (Number.isNaN(numero))
      throw new Error('`\\char` sem número válido.');
    return numero;
  }

  private lerDef(pGlobal: boolean, pExpandirCorpo: boolean): void {
    this.pularEspacos();
    const nome = this.proximoCru();
    if (nome.tipo !== 'controle')
      throw new Error(`\`\\def\` espera uma sequência de controle, veio \`${nome.texto}\`.`);
    // Parâmetros e delimitadores até o `{`.
    const delimitadores: Token[][] = [[]];
    let numArgs = 0;
    for (;;) {
      const t = this.proximoCru();
      if (t.tipo === 'fim')
        throw new Error(`\`\\def${nome.texto}\` sem corpo.`);
      if (t.tipo === 'caractere' && t.texto === '{')
        break;
      if (t.tipo === 'parametro') {
        const n = Number(t.texto[1]);
        if (n !== numArgs + 1)
          throw new Error(`Parâmetros de \`${nome.texto}\` fora de ordem (#${n}).`);
        numArgs = n;
        delimitadores.push([]);
        continue;
      }
      delimitadores[delimitadores.length - 1].push(t);
    }
    let corpo = this.lerAteFecharGrupo(token('caractere', '{', nome.posicao));
    if (pExpandirCorpo)
      corpo = this.expandirTokensPreservandoParametros(corpo);
    const definicao: DefinicaoDeMacro = { corpo, numArgs };
    // delimitadores[0] é o que vem antes de #1 (ignorado); delimitadores[i] segue o parâmetro i.
    const seguintes = delimitadores.slice(1);
    if (seguintes.some((pD) => pD.length > 0))
      definicao.delimitadores = seguintes;
    this.definir(nome.texto, definicao, pGlobal);
  }

  private expandirTokensPreservandoParametros(pTokens: Token[]): Token[] {
    // `\edef`: expande o corpo agora, mas `#n` fica.
    const saida: Token[] = [];
    let lote: Token[] = [];
    const despejar = (): void => {
      if (lote.length > 0) {
        saida.push(...this.expandirTokens(lote));
        lote = [];
      }
    };
    for (const t of pTokens) {
      if (t.tipo === 'parametro') {
        despejar();
        saida.push(t);
      } else
        lote.push(t);
    }
    despejar();
    return saida;
  }

  private lerLet(pGlobal: boolean): void {
    this.pularEspacos();
    const nome = this.proximoCru();
    this.pularEspacos();
    let alvo = this.proximoCru();
    if (alvo.tipo === 'caractere' && alvo.texto === '=') {
      this.pularEspacos();
      alvo = this.proximoCru();
    }
    this.definirComoToken(nome.texto, alvo, pGlobal);
  }

  private definirComoToken(pNome: string, pAlvo: Token, pGlobal: boolean): void {
    const usuario = this.macros.get(pAlvo.texto);
    if (usuario) {
      this.definir(pNome, usuario, pGlobal);
      return;
    }
    const embutida = MACROS_EMBUTIDAS[pAlvo.texto];
    if (typeof embutida === 'string') {
      this.definir(pNome, definicaoDeTexto(embutida), pGlobal);
      return;
    }
    this.definir(pNome, { corpo: [{ ...pAlvo, expandido: true }], numArgs: 0 }, pGlobal);
  }

  private lerNewcommand(pQual: string): void {
    this.pularEspacos();
    let nome = this.proximoCru();
    if (nome.tipo === 'caractere' && nome.texto === '{') {
      const dentro = this.lerAteFecharGrupo(nome).filter((pT) => pT.tipo !== 'espaco');
      if (dentro.length !== 1)
        throw new Error(`\`${pQual}\` espera o nome da macro entre chaves.`);
      nome = dentro[0];
    }
    if (nome.tipo !== 'controle')
      throw new Error(`\`${pQual}\` espera uma sequência de controle, veio \`${nome.texto}\`.`);
    const existe = this.macros.has(nome.texto) || nome.texto in MACROS_EMBUTIDAS;
    if (pQual === '\\newcommand' && existe)
      throw new Error(`\`${nome.texto}\` já existe; use \\renewcommand.`);
    if (pQual === '\\renewcommand' && !existe)
      throw new Error(`\`${nome.texto}\` não existe; use \\newcommand.`);
    let numArgs = 0;
    let padrao: Token[] | undefined;
    this.pularEspacos();
    let t = this.proximoCru();
    if (t.tipo === 'caractere' && t.texto === '[') {
      const n = this.lerAteFecharColchete().map((pT) => pT.texto).join('').trim();
      if (!/^\d$/.test(n))
        throw new Error(`\`${pQual}${nome.texto}\`: número de argumentos inválido (${n}).`);
      numArgs = Number(n);
      this.pularEspacos();
      t = this.proximoCru();
      if (t.tipo === 'caractere' && t.texto === '[') {
        padrao = this.lerAteFecharColchete();
        this.pularEspacos();
        t = this.proximoCru();
      }
    }
    if (!(t.tipo === 'caractere' && t.texto === '{'))
      throw new Error(`\`${pQual}${nome.texto}\` sem corpo entre chaves.`);
    const corpo = this.lerAteFecharGrupo(t);
    if (pQual === '\\providecommand' && existe)
      return;
    const definicao: DefinicaoDeMacro = { corpo, numArgs };
    if (padrao)
      definicao.padraoDoPrimeiro = padrao;
    this.definir(nome.texto, definicao, false);
  }
}

function definicaoDeTexto(pTexto: string): DefinicaoDeMacro {
  const corpo = Lexer.tokenizar(pTexto).filter((pT) => pT.tipo !== 'fim');
  let numArgs = 0;
  for (const t of corpo)
    if (t.tipo === 'parametro' && t.texto !== '##')
      numArgs = Math.max(numArgs, Number(t.texto[1]));
  return { corpo, numArgs };
}
