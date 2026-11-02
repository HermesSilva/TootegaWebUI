/**
 * LEXER do TeX matemático. Produz tokens: sequência de controle (`\alpha`, `\,`), caractere, espaço (só importa em
 * modo texto), parâmetro de macro (`#1`), fim. Comentários `%` vão até o fim da linha. Um caractere seguido de
 * marcas combinantes (U+0300–U+036F) é UM token, como no KaTeX, para `é` digitado direto não virar duas coisas.
 */

export type TipoDeToken = 'controle' | 'caractere' | 'espaco' | 'parametro' | 'fim';

export interface Token {
  tipo: TipoDeToken;
  /** `\alpha` com a barra; o caractere; `#1`. */
  texto: string;
  /** Posição 0-based na fonte. */
  posicao: number;
  /** Token vindo de expansão de macro: não aponta para a fonte do usuário. */
  expandido?: boolean;
}

const COMBINANTE = /[\u0300-\u036f]/;

export function token(pTipo: TipoDeToken, pTexto: string, pPosicao: number, pExpandido = false): Token {
  const saida: Token = { tipo: pTipo, texto: pTexto, posicao: pPosicao };
  if (pExpandido)
    saida.expandido = true;
  return saida;
}

export class Lexer {
  readonly fonte: string;
  private pos = 0;

  constructor(pFonte: string) {
    this.fonte = pFonte;
  }

  get posicao(): number {
    return this.pos;
  }

  /** Lê o resto da linha corrente a partir da posição (para `\verb` e argumentos crus). */
  lerAte(pPredicado: (pC: string) => boolean): string {
    const inicio = this.pos;
    while (this.pos < this.fonte.length && !pPredicado(this.fonte[this.pos]))
      this.pos += 1;
    return this.fonte.slice(inicio, this.pos);
  }

  /** `\verb|x|` / `\verb*|x|`: o argumento cru. `null` se não fecha. */
  lerVerbatim(): { texto: string; estrela: boolean } | null {
    const s = this.fonte;
    let p = this.pos;
    let estrela = false;
    if (s[p] === '*') {
      estrela = true;
      p += 1;
    }
    const delimitador = s[p];
    if (delimitador === undefined || delimitador === ' ' || delimitador === '\n' || /[a-zA-Z*]/.test(delimitador))
      return null;
    const fecha = s.indexOf(delimitador, p + 1);
    if (fecha === -1 || s.slice(p + 1, fecha).includes('\n'))
      return null;
    this.pos = fecha + 1;
    return { texto: s.slice(p + 1, fecha), estrela };
  }

  proximo(): Token {
    const s = this.fonte;
    while (this.pos < s.length && s[this.pos] === '%') {
      while (this.pos < s.length && s[this.pos] !== '\n')
        this.pos += 1;
    }
    if (this.pos >= s.length)
      return token('fim', '', this.pos);
    const inicio = this.pos;
    const c = s[this.pos];

    if (/\s/.test(c)) {
      while (this.pos < s.length && /\s/.test(s[this.pos]))
        this.pos += 1;
      // `%` depois de espaço: o comentário come o espaço também.
      if (s[this.pos] === '%')
        return this.proximo();
      return token('espaco', ' ', inicio);
    }

    if (c === '\\') {
      this.pos += 1;
      if (this.pos >= s.length)
        return token('caractere', '\\', inicio);
      const d = s[this.pos];
      if (/[a-zA-Z@]/.test(d)) {
        while (this.pos < s.length && /[a-zA-Z@]/.test(s[this.pos]))
          this.pos += 1;
        const nome = s.slice(inicio, this.pos);
        // Espaço depois de palavra de controle é absorvido (regra do TeX).
        while (this.pos < s.length && /[ \t]/.test(s[this.pos]))
          this.pos += 1;
        return token('controle', nome, inicio);
      }
      // `\` + quebra de linha vale `\ `? No TeX é fim de linha; no KaTeX vira espaço. Aqui: `\` + espaço.
      if (/\s/.test(d)) {
        while (this.pos < s.length && /\s/.test(s[this.pos]))
          this.pos += 1;
        return token('controle', '\\ ', inicio);
      }
      const ponto = s.codePointAt(this.pos) as number;
      this.pos += ponto > 0xffff ? 2 : 1;
      return token('controle', `\\${String.fromCodePoint(ponto)}`, inicio);
    }

    if (c === '#') {
      const d = s[this.pos + 1];
      if (d !== undefined && /[1-9]/.test(d)) {
        this.pos += 2;
        return token('parametro', `#${d}`, inicio);
      }
      if (d === '#') {
        this.pos += 2;
        return token('parametro', '##', inicio);
      }
      this.pos += 1;
      return token('caractere', '#', inicio);
    }

    const ponto = s.codePointAt(this.pos) as number;
    this.pos += ponto > 0xffff ? 2 : 1;
    let texto = String.fromCodePoint(ponto);
    while (this.pos < s.length && COMBINANTE.test(s[this.pos])) {
      texto += s[this.pos];
      this.pos += 1;
    }
    return token('caractere', texto, inicio);
  }

  /** Tokeniza a fonte inteira (sem expansão). */
  static tokenizar(pFonte: string): Token[] {
    const lexer = new Lexer(pFonte);
    const saida: Token[] = [];
    for (;;) {
      const t = lexer.proximo();
      saida.push(t);
      if (t.tipo === 'fim')
        return saida;
    }
  }
}
