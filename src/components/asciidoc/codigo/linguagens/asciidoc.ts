/**
 * Realce do próprio AsciiDoc (o modo Código do editor). Estado entre linhas: `''` normal; `d:<delimitador>` dentro
 * de bloco delimitado (listagem, literal, comentário, passagem); `t` dentro de tabela.
 */

import { ColetorDeTokens, type Linguagem, type LinhaTokenizada, type TipoDeToken } from '../tokens';

const DELIMITADOR = /^(-{4,}|\.{4,}|\+{4,}|\/{4,}|`{3,})\s*$/;
const DELIMITADOR_COMPOSTO = /^(={4,}|\*{4,}|_{4,}|--)\s*$/;

const INLINE = new RegExp(
  [
    String.raw`(\\.)`, // 1 escape
    String.raw`(\*\*[^*]+\*\*|(?<![\p{L}\p{N}_])\*(?!\s)[^*\n]*?(?<!\s)\*(?![\p{L}\p{N}_]))`, // 2 negrito
    String.raw`(__[^_]+__|(?<![\p{L}\p{N}_])_(?!\s)[^_\n]*?(?<!\s)_(?![\p{L}\p{N}_]))`, // 3 itálico
    String.raw`(\x60\x60[^\x60]+\x60\x60|(?<![\p{L}\p{N}_])\x60(?!\s)[^\x60\n]*?(?<!\s)\x60(?![\p{L}\p{N}_]))`, // 4 mono
    String.raw`(##[^#]+##|(?<![\p{L}\p{N}_])#(?!\s)[^#\n]*?(?<!\s)#(?![\p{L}\p{N}_]))`, // 5 realce
    String.raw`(\[[^\]]+\]#)`, // 6 papel
    String.raw`((?:image|link|xref|mailto|footnote|kbd|btn|menu|pass|anchor|icon|include|stem|latexmath|asciimath):[^\[\s]*\[[^\]]*\])`, // 7 macro
    String.raw`((?:https?|ftp|irc|file):\/\/[^\s\[\]<>]+(?:\[[^\]]*\])?)`, // 8 url
    String.raw`(<<[^>]+>>|\[\[[^\]]+\]\])`, // 9 referência/âncora
    String.raw`(\{[A-Za-z0-9_][A-Za-z0-9_-]*\})`, // 10 atributo
    String.raw`(\^[^\s^]+\^|~[^\s~]+~)`, // 11 sobre/subscrito
    String.raw`( \+$)`, // 12 quebra forçada
  ].join('|'),
  'gu',
);

const TIPO_POR_GRUPO: TipoDeToken[] = ['normal', 'escape', 'forte', 'enfase', 'texto', 'atributo', 'atributo', 'macro', 'link', 'link', 'variavel', 'enfase', 'escape'];

function realcarInline(pLinha: string, pDe: number, pColetor: ColetorDeTokens): void {
  INLINE.lastIndex = 0;
  const trecho = pLinha.slice(pDe);
  let m: RegExpExecArray | null;
  while ((m = INLINE.exec(trecho)) !== null) {
    let grupo = 1;
    while (grupo < m.length && m[grupo] === undefined)
      grupo += 1;
    pColetor.adicionar(pDe + m.index, pDe + m.index + m[0].length, TIPO_POR_GRUPO[grupo] ?? 'normal');
    if (m[0].length === 0)
      INLINE.lastIndex += 1;
  }
}

function tokenizarAsciiDoc(pLinha: string, pEstado: string): LinhaTokenizada {
  const coletor = new ColetorDeTokens();

  if (pEstado.startsWith('d:')) {
    const delimitador = pEstado.slice(2);
    if (pLinha.trim() === delimitador) {
      coletor.adicionar(0, pLinha.length, 'delimitador');
      return { tokens: coletor.tokens, estadoFinal: '' };
    }
    const tipo: TipoDeToken = delimitador.startsWith('/') ? 'comentario' : 'texto';
    coletor.adicionar(0, pLinha.length, tipo);
    const chamada = /<\d+>\s*$/.exec(pLinha);
    if (chamada && tipo === 'texto')
      coletor.tokens.push({ ini: chamada.index, fim: chamada.index + chamada[0].length, tipo: 'constante' });
    return { tokens: coletor.tokens, estadoFinal: pEstado };
  }

  if (pEstado === 't') {
    if (/^[|,:]===\s*$/.test(pLinha)) {
      coletor.adicionar(0, pLinha.length, 'delimitador');
      return { tokens: coletor.tokens, estadoFinal: '' };
    }
    const barras = /(^|\s)((?:\d+(?:\.\d+)?|\.\d+)?\+?[<^>]?(?:\.[<^>])?[aehlmsdv]?)\|/g;
    let m: RegExpExecArray | null;
    while ((m = barras.exec(pLinha)) !== null)
      coletor.adicionar(m.index + m[1].length, m.index + m[0].length, 'pontuacao');
    realcarInline(pLinha, 0, coletor);
    coletor.tokens.sort((pA, pB) => pA.ini - pB.ini);
    return { tokens: coletor.tokens, estadoFinal: 't' };
  }

  const delimitador = DELIMITADOR.exec(pLinha);
  if (delimitador) {
    coletor.adicionar(0, pLinha.length, 'delimitador');
    const fecha = delimitador[1].startsWith('`') ? '```' : delimitador[1];
    return { tokens: coletor.tokens, estadoFinal: `d:${fecha}` };
  }
  if (DELIMITADOR_COMPOSTO.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'delimitador');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  if (/^[|,:]===\s*$/.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'delimitador');
    return { tokens: coletor.tokens, estadoFinal: 't' };
  }
  if (/^(={1,6}|#{1,6})\s+\S/.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'titulo');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  if (/^\/\//.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'comentario');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  const atributo = /^:([A-Za-z0-9_][A-Za-z0-9_-]*!?):(.*)$/.exec(pLinha);
  if (atributo) {
    coletor.adicionar(0, atributo[1].length + 2, 'propriedade');
    coletor.adicionar(atributo[1].length + 2, pLinha.length, 'texto');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  if (/^\[.*\]\s*$/.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'atributo');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  if (/^\.[^\s.]/.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'tipo');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  const macroDeBloco = /^[a-z]+::[^\[]*\[.*\]\s*$/.exec(pLinha);
  if (macroDeBloco) {
    coletor.adicionar(0, pLinha.length, 'macro');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  if (/^(<<<|'''|---|\*\*\*)\s*$/.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'delimitador');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  const admonicao = /^(NOTE|TIP|IMPORTANT|WARNING|CAUTION):\s/.exec(pLinha);
  let de = 0;
  if (admonicao) {
    coletor.adicionar(0, admonicao[0].length - 1, 'palavraChave');
    de = admonicao[0].length;
  }
  const marcador = /^(\s*)(\*{1,5}|-|\.{1,5}|\d+\.)\s+(\[[ x*]\]\s+)?/.exec(pLinha);
  if (marcador) {
    coletor.adicionar(marcador[1].length, marcador[0].length, 'pontuacao');
    de = marcador[0].length;
  } else {
    const descricao = /^(\S.*?)(::{1,4})(\s|$)/.exec(pLinha);
    if (descricao && !/^https?:/.test(pLinha)) {
      coletor.adicionar(0, descricao[1].length, 'forte');
      coletor.adicionar(descricao[1].length, descricao[1].length + descricao[2].length, 'pontuacao');
      de = descricao[0].length;
    }
    const chamada = /^<(\d+|\.)>\s/.exec(pLinha);
    if (chamada) {
      coletor.adicionar(0, chamada[0].length - 1, 'constante');
      de = chamada[0].length;
    }
    if (pLinha === '+') {
      coletor.adicionar(0, 1, 'pontuacao');
      return { tokens: coletor.tokens, estadoFinal: '' };
    }
  }
  realcarInline(pLinha, de, coletor);
  coletor.tokens.sort((pA, pB) => pA.ini - pB.ini);
  return { tokens: coletor.tokens, estadoFinal: '' };
}

export const ASCIIDOC: Linguagem = { nome: 'asciidoc', apelidos: ['adoc', 'asc'], rotulo: 'AsciiDoc', tokenizarLinha: tokenizarAsciiDoc, comentarioDeLinha: '//' };
