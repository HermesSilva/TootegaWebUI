/**
 * CACHE INCREMENTAL de tokenização por linha.
 *
 * Cada linha guarda (texto, estado inicial, tokens, estado final). Ao mudar o texto, o cache é realinhado pelo
 * prefixo e sufixo comuns das linhas (as linhas de fora da edição são as mesmas), a tokenização recomeça na
 * primeira linha tocada e PARA assim que encontra uma linha cujo texto e estado inicial coincidem com o cacheado —
 * o resto já está certo. É a técnica dos "line states" (CodeMirror 5, Monaco): custo proporcional à edição, não ao
 * documento.
 *
 * A tokenização é PREGUIÇOSA: `tokensDaLinha(i)` garante só até `i`; quem rola até o fim paga uma vez.
 */

import type { Linguagem, Token } from './tokens';

interface Entrada {
  texto: string;
  estadoInicial: string;
  estadoFinal: string;
  tokens: Token[];
}

export class CacheDeTokens {
  private linguagem: Linguagem;
  private linhas: string[] = [];
  private entradas: (Entrada | undefined)[] = [];
  /** Até esta linha (inclusive) as entradas são válidas na cadeia de estados. */
  private validoAte = -1;

  constructor(pLinguagem: Linguagem) {
    this.linguagem = pLinguagem;
  }

  definirLinguagem(pLinguagem: Linguagem): void {
    if (pLinguagem === this.linguagem)
      return;
    this.linguagem = pLinguagem;
    this.entradas = [];
    this.validoAte = -1;
  }

  /** Recebe as linhas novas e realinha o cache pelo prefixo/sufixo comuns. */
  definirLinhas(pLinhas: string[]): void {
    const antigas = this.linhas;
    if (antigas === pLinhas)
      return;
    let prefixo = 0;
    const limite = Math.min(antigas.length, pLinhas.length);
    while (prefixo < limite && antigas[prefixo] === pLinhas[prefixo])
      prefixo += 1;
    let sufixo = 0;
    while (sufixo < limite - prefixo && antigas[antigas.length - 1 - sufixo] === pLinhas[pLinhas.length - 1 - sufixo])
      sufixo += 1;
    const entradas: (Entrada | undefined)[] = new Array(pLinhas.length);
    for (let i = 0; i < prefixo; i++)
      entradas[i] = this.entradas[i];
    for (let i = 0; i < sufixo; i++)
      entradas[pLinhas.length - 1 - i] = this.entradas[antigas.length - 1 - i];
    this.entradas = entradas;
    this.linhas = pLinhas;
    this.validoAte = Math.min(this.validoAte, prefixo - 1);
  }

  get total(): number {
    return this.linhas.length;
  }

  /** Garante a cadeia de estados até a linha `pAte`. */
  garantirAte(pAte: number): void {
    const fim = Math.min(pAte, this.linhas.length - 1);
    let estado = this.validoAte >= 0 ? (this.entradas[this.validoAte] as Entrada).estadoFinal : '';
    for (let i = this.validoAte + 1; i <= fim; i++) {
      const existente = this.entradas[i];
      const texto = this.linhas[i];
      if (existente && existente.texto === texto && existente.estadoInicial === estado) {
        // Convergiu: daqui em diante, o que já está cacheado continua certo — até a próxima entrada ausente.
        let j = i;
        while (j + 1 <= fim && this.entradas[j + 1] !== undefined && (this.entradas[j + 1] as Entrada).estadoInicial === (this.entradas[j] as Entrada).estadoFinal && (this.entradas[j + 1] as Entrada).texto === this.linhas[j + 1])
          j += 1;
        estado = (this.entradas[j] as Entrada).estadoFinal;
        this.validoAte = j;
        i = j;
        continue;
      }
      const resultado = this.linguagem.tokenizarLinha(texto, estado);
      this.entradas[i] = { texto, estadoInicial: estado, estadoFinal: resultado.estadoFinal, tokens: resultado.tokens };
      estado = resultado.estadoFinal;
      this.validoAte = i;
    }
  }

  tokensDaLinha(pIndice: number): Token[] {
    if (pIndice < 0 || pIndice >= this.linhas.length)
      return [];
    if (pIndice > this.validoAte)
      this.garantirAte(pIndice);
    return (this.entradas[pIndice] as Entrada).tokens;
  }
}
