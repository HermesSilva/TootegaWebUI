/**
 * TOKENS do realce de código. Uma linguagem é um tokenizador de LINHA com ESTADO: recebe a linha e o estado com
 * que ela começa (texto; `''` = normal) e devolve os tokens e o estado com que termina. É o que permite comentário
 * de bloco e string multilinha atravessarem linhas — e é o que torna a tokenização incremental (ver `cache.ts`).
 */

export type TipoDeToken =
  | 'palavraChave'
  | 'tipo'
  | 'constante'
  | 'texto'
  | 'numero'
  | 'comentario'
  | 'operador'
  | 'pontuacao'
  | 'funcao'
  | 'variavel'
  | 'etiqueta'
  | 'atributo'
  | 'propriedade'
  | 'titulo'
  | 'enfase'
  | 'forte'
  | 'link'
  | 'macro'
  | 'delimitador'
  | 'escape'
  | 'normal';

export interface Token {
  /** Início na linha (inclusive). */
  ini: number;
  /** Fim na linha (exclusive). */
  fim: number;
  tipo: TipoDeToken;
}

export interface LinhaTokenizada {
  tokens: Token[];
  /** O estado com que a PRÓXIMA linha começa. */
  estadoFinal: string;
}

export interface Linguagem {
  /** O identificador (`typescript`, `csharp`…). */
  nome: string;
  /** Apelidos aceitos no `[source,x]` (`ts`, `js`, `cs`…). */
  apelidos: string[];
  /** Rótulo para a interface. */
  rotulo: string;
  tokenizarLinha(pLinha: string, pEstado: string): LinhaTokenizada;
  /** Prefixo de comentário de linha (para o Ctrl+/); ausente ⇒ sem comentário de linha. */
  comentarioDeLinha?: string;
}

/** Tokeniza acumulando: junta tokens vizinhos do mesmo tipo (menos DOM). */
export class ColetorDeTokens {
  readonly tokens: Token[] = [];

  adicionar(pIni: number, pFim: number, pTipo: TipoDeToken): void {
    if (pFim <= pIni)
      return;
    const ultimo = this.tokens[this.tokens.length - 1];
    if (ultimo && ultimo.fim === pIni && ultimo.tipo === pTipo) {
      ultimo.fim = pFim;
      return;
    }
    this.tokens.push({ ini: pIni, fim: pFim, tipo: pTipo });
  }
}
