/**
 * Tokenizador GENÉRICO para linguagens de sintaxe "C-like" e afins: palavras-chave, tipos, constantes, strings
 * (com escape e, opcionalmente, multilinha), comentários de linha e de bloco, números, operadores, pontuação,
 * chamada de função (identificador seguido de `(`) e ganchos por linguagem. O estado entre linhas é um texto:
 * `''` normal, `c:<fecha>` dentro de comentário de bloco, `s:<fecha>:<escape>` dentro de string multilinha.
 */

import { ColetorDeTokens, type Linguagem, type LinhaTokenizada, type TipoDeToken } from '../tokens';

export interface DefinicaoDeString {
  abre: string;
  fecha: string;
  /** Caractere de escape dentro da string (`\\`); vazio ⇒ sem escape. */
  escape?: string;
  multilinha?: boolean;
  /** Tipo do token (`texto` por padrão). */
  tipo?: TipoDeToken;
}

export interface Gancho {
  /** Tenta reconhecer algo em `pLinha[pPos]`; devolve o fim (exclusive) e o tipo, ou `null`. */
  (pLinha: string, pPos: number, pAnteriorNaoBranco: string): { fim: number; tipo: TipoDeToken } | null;
}

export interface DefinicaoGenerica {
  nome: string;
  apelidos: string[];
  rotulo: string;
  palavrasChave?: string[];
  tipos?: string[];
  constantes?: string[];
  embutidas?: string[];
  comentarioDeLinha?: string[];
  comentarioDeBloco?: [string, string][];
  strings?: DefinicaoDeString[];
  /** Regex de identificador (sem `g`), aplicada no início do trecho. */
  identificador?: RegExp;
  /** Regex de número, aplicada no início do trecho. */
  numero?: RegExp;
  operadores?: string;
  ignorarCaixa?: boolean;
  /** Prefixo de "pré-processador" (`#` do C#) que colore a linha inteira. */
  preprocessador?: string;
  ganchos?: Gancho[];
  /** `$nome` e afins viram variável (shell, PHP). */
  variavel?: RegExp;
}

const IDENTIFICADOR = /^[A-Za-z_$][A-Za-z0-9_$]*/;
const NUMERO = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?[a-zA-Z]*)/;
const OPERADORES = '+-*/%=<>!&|^~?:.';

export function linguagemGenerica(pDef: DefinicaoGenerica): Linguagem {
  const chaves = new Set((pDef.palavrasChave ?? []).map((pP) => (pDef.ignorarCaixa ? pP.toLowerCase() : pP)));
  const tipos = new Set((pDef.tipos ?? []).map((pP) => (pDef.ignorarCaixa ? pP.toLowerCase() : pP)));
  const constantes = new Set((pDef.constantes ?? []).map((pP) => (pDef.ignorarCaixa ? pP.toLowerCase() : pP)));
  const embutidas = new Set((pDef.embutidas ?? []).map((pP) => (pDef.ignorarCaixa ? pP.toLowerCase() : pP)));
  const identificador = pDef.identificador ?? IDENTIFICADOR;
  const numero = pDef.numero ?? NUMERO;
  const operadores = pDef.operadores ?? OPERADORES;
  const comentariosDeLinha = pDef.comentarioDeLinha ?? [];
  const comentariosDeBloco = pDef.comentarioDeBloco ?? [];
  const strings = pDef.strings ?? [];

  function tokenizarLinha(pLinha: string, pEstado: string): LinhaTokenizada {
    const coletor = new ColetorDeTokens();
    let pos = 0;
    let estado = pEstado;
    let anteriorNaoBranco = '';

    // Continuação de estado da linha anterior.
    if (estado.startsWith('c:')) {
      const fecha = estado.slice(2);
      const fim = pLinha.indexOf(fecha);
      if (fim === -1) {
        coletor.adicionar(0, pLinha.length, 'comentario');
        return { tokens: coletor.tokens, estadoFinal: estado };
      }
      coletor.adicionar(0, fim + fecha.length, 'comentario');
      pos = fim + fecha.length;
      estado = '';
    } else if (estado.startsWith('s:')) {
      const [, fecha, escape, tipo] = estado.split(':');
      const resultado = lerString(pLinha, 0, fecha, escape, true);
      coletor.adicionar(0, resultado.fim, (tipo as TipoDeToken) || 'texto');
      pos = resultado.fim;
      estado = resultado.fechou ? '' : estado;
      if (!resultado.fechou)
        return { tokens: coletor.tokens, estadoFinal: estado };
    }

    while (pos < pLinha.length) {
      const c = pLinha[pos];
      if (/\s/.test(c)) {
        pos += 1;
        continue;
      }
      const resto = pLinha.slice(pos);

      if (pDef.preprocessador && pos === pLinha.search(/\S/) && resto.startsWith(pDef.preprocessador)) {
        coletor.adicionar(pos, pLinha.length, 'macro');
        break;
      }

      let tratado = false;
      for (const abre of comentariosDeLinha)
        if (resto.startsWith(abre)) {
          coletor.adicionar(pos, pLinha.length, 'comentario');
          pos = pLinha.length;
          tratado = true;
          break;
        }
      if (tratado)
        break;

      for (const [abre, fecha] of comentariosDeBloco)
        if (resto.startsWith(abre)) {
          const fim = pLinha.indexOf(fecha, pos + abre.length);
          if (fim === -1) {
            coletor.adicionar(pos, pLinha.length, 'comentario');
            return { tokens: coletor.tokens, estadoFinal: `c:${fecha}` };
          }
          coletor.adicionar(pos, fim + fecha.length, 'comentario');
          pos = fim + fecha.length;
          tratado = true;
          break;
        }
      if (tratado)
        continue;

      for (const s of strings)
        if (resto.startsWith(s.abre)) {
          const resultado = lerString(pLinha, pos + s.abre.length, s.fecha, s.escape ?? '', Boolean(s.multilinha));
          coletor.adicionar(pos, resultado.fim, s.tipo ?? 'texto');
          pos = resultado.fim;
          if (!resultado.fechou && s.multilinha)
            return { tokens: coletor.tokens, estadoFinal: `s:${s.fecha}:${s.escape ?? ''}:${s.tipo ?? 'texto'}` };
          tratado = true;
          break;
        }
      if (tratado)
        continue;

      for (const gancho of pDef.ganchos ?? []) {
        const achado = gancho(pLinha, pos, anteriorNaoBranco);
        if (achado) {
          coletor.adicionar(pos, achado.fim, achado.tipo);
          anteriorNaoBranco = pLinha.slice(pos, achado.fim);
          pos = achado.fim;
          tratado = true;
          break;
        }
      }
      if (tratado)
        continue;

      if (pDef.variavel) {
        const v = pDef.variavel.exec(resto);
        if (v) {
          coletor.adicionar(pos, pos + v[0].length, 'variavel');
          anteriorNaoBranco = v[0];
          pos += v[0].length;
          continue;
        }
      }

      const n = numero.exec(resto);
      if (n && n[0].length > 0 && !/[A-Za-z_]/.test(pLinha[pos - 1] ?? '')) {
        coletor.adicionar(pos, pos + n[0].length, 'numero');
        anteriorNaoBranco = n[0];
        pos += n[0].length;
        continue;
      }

      const id = identificador.exec(resto);
      if (id && id[0].length > 0) {
        const palavra = pDef.ignorarCaixa ? id[0].toLowerCase() : id[0];
        const depois = pLinha.slice(pos + id[0].length).search(/\S/);
        const proximo = depois === -1 ? '' : pLinha[pos + id[0].length + depois];
        let tipo: TipoDeToken = 'normal';
        if (chaves.has(palavra))
          tipo = 'palavraChave';
        else if (tipos.has(palavra))
          tipo = 'tipo';
        else if (constantes.has(palavra))
          tipo = 'constante';
        else if (embutidas.has(palavra))
          tipo = 'funcao';
        else if (proximo === '(')
          tipo = 'funcao';
        else if (anteriorNaoBranco === '.' && pDef.nome !== 'sql')
          tipo = 'propriedade';
        coletor.adicionar(pos, pos + id[0].length, tipo);
        anteriorNaoBranco = id[0];
        pos += id[0].length;
        continue;
      }

      if (operadores.includes(c)) {
        coletor.adicionar(pos, pos + 1, 'operador');
        anteriorNaoBranco = c;
        pos += 1;
        continue;
      }
      if ('()[]{};,'.includes(c)) {
        coletor.adicionar(pos, pos + 1, 'pontuacao');
        anteriorNaoBranco = c;
        pos += 1;
        continue;
      }
      coletor.adicionar(pos, pos + 1, 'normal');
      anteriorNaoBranco = c;
      pos += 1;
    }
    return { tokens: coletor.tokens, estadoFinal: estado };
  }

  const linguagem: Linguagem = { nome: pDef.nome, apelidos: pDef.apelidos, rotulo: pDef.rotulo, tokenizarLinha };
  if (comentariosDeLinha[0])
    linguagem.comentarioDeLinha = comentariosDeLinha[0];
  return linguagem;
}

/** Lê o corpo de uma string a partir de `pDe` até `pFecha`; devolve o fim (inclusive o fechamento) e se fechou. */
export function lerString(pLinha: string, pDe: number, pFecha: string, pEscape: string, pMultilinha: boolean): { fim: number; fechou: boolean } {
  let i = pDe;
  while (i < pLinha.length) {
    if (pEscape && pLinha.startsWith(pEscape, i)) {
      i += pEscape.length + 1;
      continue;
    }
    if (pLinha.startsWith(pFecha, i))
      return { fim: i + pFecha.length, fechou: true };
    i += 1;
  }
  return { fim: pLinha.length, fechou: !pMultilinha ? true : false };
}
