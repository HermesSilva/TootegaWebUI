/**
 * PARSER do TeX matemático: descida recursiva com um token de antecipação sobre o expansor de macros, no desenho do
 * KaTeX (estudado como referência). Expressão → átomos (grupo + `^`/`_`/`'`) → grupo (`{…}`, função, símbolo).
 * Infixos (`\over`, `\choose`, `\atop`, `\above`…) são resolvidos no fim da expressão. Erros de leitura viram nós
 * `erro` e avisos com posição: a fórmula sempre renderiza, e quem errou vê o quê e onde.
 */

import { desembrulhar, erro, grupo, simbolo, type AvisoDaFormula, type ClasseDeAtomo, type Medida, type No, type Simbolo } from '../ast';
import { AMBIENTES } from './ambientes';
import { DELIMITADORES } from './delimitadores';
import { FUNCOES, type ArgumentoLido, type Funcao } from './funcoes';
import { Expansor } from './macros';
import type { Token } from './lexer';
import { lerMedida } from './medidas';
import { simboloMath, simboloText, simboloUnicode } from './simbolos';

export interface OpcoesDoParser {
  /** Fórmula em bloco (display) ou na linha. */
  display: boolean;
  /** Limite de nós, para fonte hostil (padrão 20000). */
  limiteDeNos?: number;
}

/** Tokens em que uma expressão para (quem os espera os consome). */
const PARADAS = new Set(['}', '\\end', '\\right', '&', '\\\\', '\\cr', '\\endgroup']);

const INFIXOS = new Set(['\\over', '\\choose', '\\atop', '\\brace', '\\brack', '\\above']);

const PRIMOS = ['′', '″', '‴', '⁗'];


export class Parser {
  readonly expansor: Expansor;
  readonly display: boolean;
  readonly avisos: AvisoDaFormula[] = [];
  modo: 'math' | 'text' = 'math';
  /** Dentro de `\begin{…}`: `\tag`/`\notag` escrevem aqui a etiqueta da linha corrente. */
  etiquetaDaLinha: { rotulo: No[] | null; crua: boolean } | undefined | null = undefined;
  profundidadeDeArranjo = 0;
  private nos = 0;
  private readonly limiteDeNos: number;

  constructor(pFonte: string, pOpcoes: OpcoesDoParser) {
    this.expansor = new Expansor(pFonte);
    this.display = pOpcoes.display;
    this.limiteDeNos = pOpcoes.limiteDeNos ?? 20000;
  }

  // ---------------------------------------------------------------- tokens

  proximo(): Token {
    this.expansor.modo = this.modo;
    return this.expansor.proximo();
  }

  espiar(): Token {
    this.expansor.modo = this.modo;
    return this.expansor.espiar();
  }

  devolver(pToken: Token): void {
    this.expansor.devolver(pToken);
  }

  /** Pula espaços (em matemática eles não significam nada). */
  pularEspacos(): void {
    while (this.espiar().tipo === 'espaco')
      this.proximo();
  }

  /** Consome o token esperado ou registra erro (sem consumir). */
  esperar(pTexto: string): boolean {
    const t = this.espiar();
    if (t.texto === pTexto) {
      this.proximo();
      return true;
    }
    this.aviso(`Esperava \`${pTexto}\`, veio \`${t.tipo === 'fim' ? 'fim da fórmula' : t.texto}\`.`, t.posicao);
    return false;
  }

  aviso(pTexto: string, pPosicao: number): void {
    this.avisos.push({ posicao: Math.max(0, pPosicao), texto: pTexto });
  }

  private contarNo(): void {
    this.nos += 1;
    if (this.nos > this.limiteDeNos)
      throw new Error(`Fórmula grande demais (mais de ${this.limiteDeNos} nós).`);
  }

  // ---------------------------------------------------------------- topo

  /** A fórmula inteira. Nunca lança por erro de sintaxe: devolve nós `erro` e avisos. */
  analisar(): No[] {
    try {
      const saida: No[] = [];
      for (;;) {
        saida.push(...this.parseExpressao(false));
        const t = this.espiar();
        if (t.tipo === 'fim')
          break;
        this.proximo();
        if (t.texto === '\\\\' || t.texto === '\\cr') {
          const espaco = this.parseMedidaOpcional();
          saida.push(espaco ? { tipo: 'quebra', espaco } : { tipo: 'quebra' });
          continue;
        }
        if (t.texto === '}')
          saida.push(this.erroEm(t, '`}` sem `{` correspondente.'));
        else if (t.texto === '&')
          saida.push(this.erroEm(t, '`&` só vale dentro de um ambiente (matrix, align, cases…).'));
        else if (t.texto === '\\end')
          saida.push(this.erroEm(t, '`\\end` sem `\\begin`.'));
        else if (t.texto === '\\right')
          saida.push(this.erroEm(t, '`\\right` sem `\\left`.'));
        else
          saida.push(this.erroEm(t, `Token inesperado \`${t.texto}\`.`));
      }
      return anexarEtiqueta(saida);
    } catch (pErro) {
      const mensagem = pErro instanceof Error ? pErro.message : String(pErro);
      this.aviso(mensagem, this.expansor.espiarCru().posicao);
      return [erro(this.expansor.fonte, mensagem)];
    }
  }

  private erroEm(pToken: Token, pMensagem: string): No {
    this.aviso(pMensagem, pToken.posicao);
    return erro(pToken.texto, pMensagem);
  }

  // ---------------------------------------------------------------- expressão

  /**
   * Lê átomos até uma parada (`}`, `\end`, `\right`, `&`, `\\`) ou até o infixo quando `pPararEmInfixo`. A parada
   * não é consumida. Resolve `\over` e família.
   */
  parseExpressao(pPararEmInfixo: boolean, pParadaExtra?: string): No[] {
    const corpo: No[] = [];
    let infixo: { token: Token; medida?: Medida; indice: number } | null = null;
    for (;;) {
      if (this.modo === 'math')
        this.pularEspacos();
      const t = this.espiar();
      if (t.tipo === 'fim' || PARADAS.has(t.texto) || t.texto === pParadaExtra)
        break;
      if (t.tipo === 'controle' && INFIXOS.has(t.texto)) {
        if (pPararEmInfixo)
          break;
        this.proximo();
        if (infixo) {
          corpo.push(this.erroEm(t, 'Só um infixo (`\\over`, `\\choose`…) por grupo.'));
          continue;
        }
        const medida = t.texto === '\\above' ? this.parseMedida() : undefined;
        infixo = medida ? { token: t, medida, indice: corpo.length } : { token: t, indice: corpo.length };
        continue;
      }
      const atomo = this.parseAtomo(pParadaExtra);
      if (atomo === null)
        break;
      corpo.push(atomo);
    }
    if (!infixo)
      return corpo;
    const numerador = grupo(corpo.slice(0, infixo.indice));
    const denominador = grupo(corpo.slice(infixo.indice));
    switch (infixo.token.texto) {
      case '\\over':
        return [{ tipo: 'fracao', numerador, denominador, barra: true }];
      case '\\atop':
        return [{ tipo: 'fracao', numerador, denominador, barra: false }];
      case '\\choose':
        return [{ tipo: 'fracao', numerador, denominador, barra: false, delimitadorEsquerdo: '(', delimitadorDireito: ')' }];
      case '\\brace':
        return [{ tipo: 'fracao', numerador, denominador, barra: false, delimitadorEsquerdo: '{', delimitadorDireito: '}' }];
      case '\\brack':
        return [{ tipo: 'fracao', numerador, denominador, barra: false, delimitadorEsquerdo: '[', delimitadorDireito: ']' }];
      default:
        return [{ tipo: 'fracao', numerador, denominador, barra: infixo.medida ?? true }];
    }
  }

  /** O resto do grupo corrente (para `\rm`, `\displaystyle`, `\color`, `\tiny`…). */
  parseRestoDoGrupo(pParadaExtra?: string): No[] {
    return this.parseExpressao(false, pParadaExtra);
  }

  // ---------------------------------------------------------------- átomo

  private parseAtomo(pParadaExtra?: string): No | null {
    const base = this.parseGrupo(pParadaExtra);
    if (base === null)
      return null;
    if (this.modo === 'text')
      return base;
    let sup: No | undefined;
    let sub: No | undefined;
    let limites: boolean | undefined;
    const primos: string[] = [];
    for (;;) {
      this.pularEspacos();
      const t = this.espiar();
      if (t.texto === '\\limits' || t.texto === '\\nolimits') {
        this.proximo();
        if (desembrulhar(base).tipo !== 'operador')
          this.aviso(`\`${t.texto}\` só vale depois de um operador.`, t.posicao);
        limites = t.texto === '\\limits';
        continue;
      }
      if (t.texto === '^' || t.texto === '_') {
        this.proximo();
        const argumento = this.parseArgumentoDeScript();
        if (t.texto === '^') {
          if (sup !== undefined)
            return this.comScripts(base, sup, sub, limites, primos, this.erroEm(t, 'Dois sobrescritos (`^`) no mesmo átomo.'));
          sup = argumento;
        } else {
          if (sub !== undefined)
            return this.comScripts(base, sup, sub, limites, primos, this.erroEm(t, 'Dois subscritos (`_`) no mesmo átomo.'));
          sub = argumento;
        }
        continue;
      }
      if (t.tipo === 'caractere' && t.texto === '\'') {
        this.proximo();
        if (sup !== undefined) {
          this.aviso('`\'` depois de `^`: escreva o primo dentro do sobrescrito.', t.posicao);
          continue;
        }
        primos.push('′');
        continue;
      }
      break;
    }
    return this.comScripts(base, sup, sub, limites, primos);
  }

  private comScripts(pBase: No, pSup: No | undefined, pSub: No | undefined, pLimites: boolean | undefined, pPrimos: string[], pErro?: No): No {
    let sup = pSup;
    if (pPrimos.length > 0) {
      const texto = pPrimos.length <= PRIMOS.length ? PRIMOS[pPrimos.length - 1] : PRIMOS[0].repeat(pPrimos.length);
      const primo = simbolo('textord', texto);
      sup = sup ? grupo([primo, sup]) : primo;
    }
    if (sup === undefined && pSub === undefined && pLimites === undefined)
      return pErro ? grupo([pBase, pErro]) : pBase;
    const no: No = { tipo: 'supsub', base: pBase };
    if (sup !== undefined)
      no.sup = sup;
    if (pSub !== undefined)
      no.sub = pSub;
    if (pLimites !== undefined)
      no.limites = pLimites;
    this.contarNo();
    return pErro ? grupo([no, pErro]) : no;
  }

  /** O argumento de `^`/`_`: um grupo `{…}`, uma função com seus argumentos ou um símbolo. */
  private parseArgumentoDeScript(): No {
    this.pularEspacos();
    const t = this.espiar();
    if (t.tipo === 'fim')
      return this.erroEm(t, 'Faltou o argumento de `^`/`_` no fim da fórmula.');
    if (t.texto === '^' || t.texto === '_' || PARADAS.has(t.texto))
      return this.erroEm(t, `Faltou o argumento de \`^\`/\`_\` antes de \`${t.texto}\`.`);
    const g = this.parseGrupo();
    return g ?? this.erroEm(t, 'Faltou o argumento de `^`/`_`.');
  }

  // ---------------------------------------------------------------- grupo

  /** `{…}`, `\begingroup…\endgroup`, função com argumentos, ambiente ou símbolo. `null` numa parada. */
  parseGrupo(pParadaExtra?: string): No | null {
    if (this.modo === 'math')
      this.pularEspacos();
    const t = this.espiar();
    if (t.tipo === 'fim' || PARADAS.has(t.texto) || t.texto === pParadaExtra || INFIXOS.has(t.texto))
      return null;
    this.proximo();
    this.contarNo();

    if (t.tipo === 'caractere' && t.texto === '{') {
      this.expansor.iniciarGrupo();
      const filhos = this.parseExpressao(false);
      this.expansor.encerrarGrupo();
      if (!this.esperar('}'))
        filhos.push(erro('', 'Faltou `}`.'));
      return grupo(filhos);
    }
    if (t.texto === '\\begingroup') {
      this.expansor.iniciarGrupo();
      const filhos = this.parseExpressao(false);
      this.expansor.encerrarGrupo();
      this.esperar('\\endgroup');
      return grupo(filhos);
    }
    if (t.texto === '\\begin')
      return this.parseAmbiente(t);
    if (t.texto === '\\left')
      return this.parseLeftRight(t);
    if (t.texto === '\\middle') {
      const delimitador = this.parseDelimitador(t);
      return { tipo: 'meio', delimitador: delimitador ?? '' };
    }
    if (t.tipo === 'controle') {
      const funcao = FUNCOES[t.texto];
      if (funcao)
        return this.parseFuncao(t, funcao, pParadaExtra);
    }
    if (t.tipo === 'espaco')
      return simbolo('textord', ' ', 'text');
    if (t.tipo === 'parametro')
      return this.erroEm(t, `\`${t.texto}\` fora de definição de macro.`);
    return this.parseSimbolo(t);
  }

  // ---------------------------------------------------------------- símbolo

  private parseSimbolo(pToken: Token): No {
    const texto = pToken.texto;
    if (this.modo === 'text') {
      if (pToken.tipo === 'controle') {
        const entrada = simboloText(texto);
        if (entrada)
          return simbolo('textord', entrada.texto, 'text');
        if (texto === '\\(' || texto === '$')
          return this.parseMatematicaEmTexto(pToken);
        return this.erroEm(pToken, `Comando desconhecido em texto: \`${texto}\`.`);
      }
      if (texto === '$')
        return this.parseMatematicaEmTexto(pToken);
      return simbolo('textord', texto, 'text');
    }
    if (pToken.tipo === 'controle') {
      const entrada = simboloMath(texto);
      if (entrada)
        return this.simboloDe(entrada.classe, entrada.texto);
      return this.erroEm(pToken, `Comando desconhecido: \`${texto}\`.`);
    }
    if (texto === '$')
      return this.erroEm(pToken, '`$` não vale dentro da fórmula (ela já é matemática).');
    if (texto === '~')
      return { tipo: 'espaco', largura: { numero: 0.3333, unidade: 'em' }, texto: true };
    const entrada = simboloMath(texto) ?? simboloUnicode(texto);
    if (entrada)
      return this.simboloDe(entrada.classe, entrada.texto);
    // Caractere de palavra desconhecido (CJK, símbolos não tabelados): entra como ordinário.
    if (/^[\p{L}\p{N}]/u.test(texto))
      return simbolo('mathord', texto);
    if (/^[\p{S}\p{P}]/u.test(texto))
      return simbolo('textord', texto);
    return this.erroEm(pToken, `Caractere inesperado \`${texto}\`.`);
  }

  private simboloDe(pClasse: ClasseDeAtomo, pTexto: string): Simbolo {
    return simbolo(pClasse, pTexto);
  }

  /** `\text{a $x$ b}`: matemática embutida no texto. */
  private parseMatematicaEmTexto(pAbre: Token): No {
    const fecha = pAbre.texto === '\\(' ? '\\)' : '$';
    const modoAnterior = this.modo;
    this.modo = 'math';
    const filhos = this.parseExpressao(false, fecha);
    this.modo = modoAnterior;
    if (this.espiar().texto === fecha)
      this.proximo();
    else
      filhos.push(this.erroEm(pAbre, `Matemática aberta com \`${pAbre.texto}\` não fechou.`));
    return grupo(filhos);
  }

  // ---------------------------------------------------------------- funções

  private parseFuncao(pToken: Token, pFuncao: Funcao, pParadaExtra?: string): No {
    if (this.modo === 'text' && !pFuncao.permitidoEmTexto)
      return this.erroEm(pToken, `\`${pToken.texto}\` não vale em modo texto.`);
    if (this.modo === 'math' && pFuncao.somenteTexto)
      return this.erroEm(pToken, `\`${pToken.texto}\` só vale em modo texto (\\text{…}).`);
    let estrela = false;
    if (pFuncao.aceitaEstrela) {
      this.pularEspacos();
      const t = this.espiar();
      if (t.tipo === 'caractere' && t.texto === '*') {
        this.proximo();
        estrela = true;
      }
    }
    const opcionais: (ArgumentoLido | null)[] = [];
    const tipos = pFuncao.tipos ?? [];
    const numOpcionais = pFuncao.opcionais ?? 0;
    for (let i = 0; i < numOpcionais; i++)
      opcionais.push(this.parseArgumentoOpcional(tipos[i] ?? 'math'));
    const argumentos: ArgumentoLido[] = [];
    for (let i = 0; i < pFuncao.args; i++) {
      const tipo = tipos[numOpcionais + i] ?? 'math';
      const lido = this.parseArgumento(tipo, pToken, pParadaExtra);
      if (lido === null)
        return this.erroEm(pToken, `\`${pToken.texto}\` espera ${pFuncao.args} argumento(s).`);
      argumentos.push(lido);
    }
    try {
      return pFuncao.tratador({ parser: this, token: pToken, argumentos, opcionais, estrela });
    } catch (pErro) {
      const mensagem = pErro instanceof Error ? pErro.message : String(pErro);
      return this.erroEm(pToken, mensagem);
    }
  }

  private parseArgumento(pTipo: string, pToken: Token, pParadaExtra?: string): ArgumentoLido | null {
    switch (pTipo) {
      case 'math':
        return this.parseArgumentoMath();
      case 'text':
        return this.parseArgumentoTexto();
      case 'resto':
        return grupo(this.parseRestoDoGrupo(pParadaExtra));
      case 'size': {
        const medida = this.parseMedida();
        return medida ?? null;
      }
      case 'color':
        return this.parseCor(pToken);
      case 'raw':
        return this.expansor.lerArgumentoCru() ?? '';
      case 'url':
        return this.parseURL();
      case 'primitive': {
        const delimitador = this.parseDelimitador(pToken);
        return delimitador ?? null;
      }
      default:
        return this.parseArgumentoMath();
    }
  }

  private parseArgumentoOpcional(pTipo: string): ArgumentoLido | null {
    this.pularEspacos();
    const t = this.espiar();
    if (!(t.tipo === 'caractere' && t.texto === '['))
      return null;
    if (pTipo === 'size') {
      const texto = this.expansor.lerArgumentoCru(true);
      if (texto === null)
        return null;
      const medida = lerMedida(texto);
      if (!medida)
        throw new Error(`Medida inválida: \`${texto}\`.`);
      return medida;
    }
    if (pTipo === 'raw' || pTipo === 'color' || pTipo === 'url')
      return this.expansor.lerArgumentoCru(true) ?? '';
    this.proximo();
    const modoAnterior = this.modo;
    if (pTipo === 'text')
      this.modo = 'text';
    const filhos = this.parseExpressao(false, ']');
    this.modo = modoAnterior;
    this.esperar(']');
    return grupo(filhos);
  }

  /** Um argumento em modo matemático: `{…}` ou um grupo único (função com argumentos, símbolo). */
  parseArgumentoMath(): No {
    const modoAnterior = this.modo;
    this.modo = 'math';
    const g = this.parseGrupo();
    this.modo = modoAnterior;
    if (g === null) {
      const t = this.espiar();
      return this.erroEm(t, t.tipo === 'fim' ? 'Faltou argumento no fim da fórmula.' : `Faltou argumento antes de \`${t.texto}\`.`);
    }
    return g;
  }

  /** Um argumento em modo texto (`\text{…}`): espaços valem, letras ficam retas. */
  parseArgumentoTexto(): No {
    this.pularEspacos();
    const modoAnterior = this.modo;
    this.modo = 'text';
    const g = this.parseGrupo();
    this.modo = modoAnterior;
    if (g === null) {
      const t = this.espiar();
      return this.erroEm(t, 'Faltou o argumento de texto.');
    }
    return g;
  }

  /** Medida obrigatória (`{2em}` ou `2em` solta). */
  parseMedida(): Medida | undefined {
    this.pularEspacos();
    const t = this.espiar();
    let texto: string;
    if (t.tipo === 'caractere' && t.texto === '{')
      texto = this.expansor.lerArgumentoCru() ?? '';
    else {
      // Medida sem chaves: `\kern-.1667em`, `\mkern5mu`, `\hskip 1em`.
      texto = '';
      for (;;) {
        const c = this.expansor.proximoCru();
        if (c.tipo === 'fim') {
          break;
        }
        if (c.tipo === 'espaco') {
          if (texto === '' || /^[-+]?$/.test(texto.trim()))
            continue;
          if (/^[-+]?\s*(?:\d+\.?\d*|\.\d+)$/.test(texto))
            continue;   // espaço entre número e unidade
          this.devolver(c);
          break;
        }
        if (c.tipo === 'caractere' && /^[-+.\d]$/.test(c.texto) && !/[a-zA-Z]/.test(texto)) {
          texto += c.texto;
          continue;
        }
        if (c.tipo === 'caractere' && /^[a-zA-Z]$/.test(c.texto) && /\d/.test(texto) && (texto.match(/[a-zA-Z]/g) ?? []).length < 2) {
          texto += c.texto;
          if ((texto.match(/[a-zA-Z]/g) ?? []).length === 2)
            break;
          continue;
        }
        this.devolver(c);
        break;
      }
    }
    const medida = lerMedida(texto);
    if (!medida)
      throw new Error(`Medida inválida: \`${texto.trim()}\` (use número e unidade: 2em, 3mu, 10pt…).`);
    return medida;
  }

  /** `\\[1ex]`: medida opcional entre colchetes. */
  parseMedidaOpcional(): Medida | undefined {
    this.pularEspacos();
    const t = this.espiar();
    if (!(t.tipo === 'caractere' && t.texto === '['))
      return undefined;
    const texto = this.expansor.lerArgumentoCru(true);
    if (texto === null)
      return undefined;
    const medida = lerMedida(texto);
    if (!medida) {
      this.aviso(`Medida inválida: \`${texto}\`.`, t.posicao);
      return undefined;
    }
    return medida;
  }

  parseCor(pToken: Token): string {
    const texto = (this.expansor.lerArgumentoCru() ?? '').trim().replace(/^##/, '#');
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(texto) || /^[a-zA-Z]+$/.test(texto))
      return texto;
    if (/^[0-9a-fA-F]{6}$/.test(texto))
      return `#${texto}`;
    throw new Error(`Cor inválida em \`${pToken.texto}\`: \`${texto}\` (use um nome CSS ou #rrggbb).`);
  }

  private parseURL(): string {
    return (this.expansor.lerArgumentoCru() ?? '').trim();
  }

  /** Um delimitador para `\left`, `\right`, `\middle`, `\big`…: devolve o caractere (`''` para `.`) ou `null`. */
  parseDelimitador(pToken: Token): string | null {
    this.pularEspacos();
    const t = this.proximo();
    const delimitador = DELIMITADORES.get(t.texto);
    if (delimitador === undefined) {
      if (t.tipo === 'caractere' && t.texto === '{') {
        // `\left\{` já tratado; `\left{` é erro comum.
        this.devolver(t);
      } else if (t.tipo !== 'fim')
        this.devolver(t);
      this.aviso(`\`${pToken.texto}\` espera um delimitador, veio \`${t.tipo === 'fim' ? 'fim da fórmula' : t.texto}\`.`, t.posicao);
      return null;
    }
    return delimitador;
  }

  // ---------------------------------------------------------------- \left … \right

  private parseLeftRight(pToken: Token): No {
    const esquerda = this.parseDelimitador(pToken);
    const corpo = this.parseExpressao(false);
    const fecha = this.espiar();
    if (fecha.texto !== '\\right') {
      corpo.push(this.erroEm(fecha, fecha.tipo === 'fim' ? '`\\left` sem `\\right`.' : `\`\\left\` esperava \`\\right\`, veio \`${fecha.texto}\`.`));
      return { tipo: 'delimitado', esquerda: esquerda ?? '', direita: '', corpo };
    }
    this.proximo();
    const direita = this.parseDelimitador(fecha);
    return { tipo: 'delimitado', esquerda: esquerda ?? '', direita: direita ?? '', corpo };
  }

  // ---------------------------------------------------------------- ambientes

  /** `\begin{nome}` já consumido. */
  private parseAmbiente(pToken: Token): No {
    const nome = (this.expansor.lerArgumentoCru() ?? '').trim();
    const ambiente = AMBIENTES[nome];
    if (!ambiente)
      return this.erroEm(pToken, `Ambiente desconhecido: \`${nome}\`.`);
    if (ambiente.somenteDisplay && !this.display)
      this.aviso(`O ambiente \`${nome}\` é de fórmula em bloco; na linha ele sai como \`${ambiente.somenteDisplay}\`.`, pToken.posicao);
    const argumentos: string[] = [];
    for (let i = 0; i < (ambiente.args ?? 0); i++)
      argumentos.push((this.expansor.lerArgumentoCru() ?? '').trim());
    const opcional = ambiente.opcional ? this.expansor.lerArgumentoCru(true) : null;
    this.profundidadeDeArranjo += 1;
    const no = ambiente.tratador({ parser: this, nome, argumentos, opcional });
    this.profundidadeDeArranjo -= 1;
    const fim = this.espiar();
    if (fim.texto !== '\\end') {
      this.aviso(`\`\\begin{${nome}}\` sem \`\\end{${nome}}\`.`, pToken.posicao);
      return no;
    }
    this.proximo();
    const nomeDoFim = (this.expansor.lerArgumentoCru() ?? '').trim();
    if (nomeDoFim !== nome)
      this.aviso(`\`\\begin{${nome}}\` fechado por \`\\end{${nomeDoFim}}\`.`, fim.posicao);
    return no;
  }
}

/** `\tag{…}` solto no nível de cima etiqueta a fórmula inteira (as outras partes viram o corpo). */
function anexarEtiqueta(pNos: No[]): No[] {
  const indice = pNos.findIndex((pN) => pN.tipo === 'etiqueta' && pN.corpo.length === 0);
  if (indice === -1 || pNos.length === 1)
    return pNos;
  const etiqueta = pNos[indice] as No & { tipo: 'etiqueta' };
  const corpo = pNos.filter((pN, pI) => pI !== indice && pN.tipo !== 'quebra');
  return [{ ...etiqueta, corpo }];
}

/** Lê uma fórmula TeX inteira. */
export function analisarTeX(pFonte: string, pOpcoes: OpcoesDoParser): { nos: No[]; avisos: AvisoDaFormula[] } {
  const parser = new Parser(pFonte, pOpcoes);
  const nos = parser.analisar();
  return { nos, avisos: parser.avisos };
}
