/**
 * Linguagens de MARCAÇÃO e configuração com tokenizador próprio: XML/HTML, CSS, YAML e Markdown (simples).
 */

import { ColetorDeTokens, type Linguagem, type LinhaTokenizada } from '../tokens';

// ============================================================================
// XML / HTML
// ============================================================================

function tokenizarXML(pLinha: string, pEstado: string): LinhaTokenizada {
  const coletor = new ColetorDeTokens();
  let pos = 0;
  let estado = pEstado;

  while (pos < pLinha.length) {
    if (estado === 'comentario') {
      const fim = pLinha.indexOf('-->', pos);
      if (fim === -1) {
        coletor.adicionar(pos, pLinha.length, 'comentario');
        return { tokens: coletor.tokens, estadoFinal: 'comentario' };
      }
      coletor.adicionar(pos, fim + 3, 'comentario');
      pos = fim + 3;
      estado = '';
      continue;
    }
    if (estado === 'cdata') {
      const fim = pLinha.indexOf(']]>', pos);
      if (fim === -1) {
        coletor.adicionar(pos, pLinha.length, 'texto');
        return { tokens: coletor.tokens, estadoFinal: 'cdata' };
      }
      coletor.adicionar(pos, fim + 3, 'texto');
      pos = fim + 3;
      estado = '';
      continue;
    }
    if (estado === 'etiqueta') {
      // Dentro de `<nome … >`: atributos e valores.
      const c = pLinha[pos];
      if (/\s/.test(c)) {
        pos += 1;
        continue;
      }
      if (c === '>' || (c === '/' && pLinha[pos + 1] === '>') || (c === '?' && pLinha[pos + 1] === '>')) {
        const tamanho = c === '>' ? 1 : 2;
        coletor.adicionar(pos, pos + tamanho, 'etiqueta');
        pos += tamanho;
        estado = '';
        continue;
      }
      if (c === '"' || c === "'") {
        const fim = pLinha.indexOf(c, pos + 1);
        const ate = fim === -1 ? pLinha.length : fim + 1;
        coletor.adicionar(pos, ate, 'texto');
        pos = ate;
        continue;
      }
      if (c === '=') {
        coletor.adicionar(pos, pos + 1, 'operador');
        pos += 1;
        continue;
      }
      const m = /^[A-Za-z_:][A-Za-z0-9_:.-]*/.exec(pLinha.slice(pos));
      if (m) {
        coletor.adicionar(pos, pos + m[0].length, 'atributo');
        pos += m[0].length;
        continue;
      }
      coletor.adicionar(pos, pos + 1, 'normal');
      pos += 1;
      continue;
    }

    const resto = pLinha.slice(pos);
    if (resto.startsWith('<!--')) {
      estado = 'comentario';
      continue;
    }
    if (resto.startsWith('<![CDATA[')) {
      coletor.adicionar(pos, pos + 9, 'macro');
      pos += 9;
      estado = 'cdata';
      continue;
    }
    if (resto.startsWith('<!')) {
      const fim = pLinha.indexOf('>', pos);
      const ate = fim === -1 ? pLinha.length : fim + 1;
      coletor.adicionar(pos, ate, 'macro');
      pos = ate;
      continue;
    }
    const abre = /^<\/?[A-Za-z_:?][A-Za-z0-9_:.-]*/.exec(resto);
    if (abre) {
      coletor.adicionar(pos, pos + abre[0].length, 'etiqueta');
      pos += abre[0].length;
      estado = 'etiqueta';
      continue;
    }
    const entidade = /^&[A-Za-z0-9#]+;/.exec(resto);
    if (entidade) {
      coletor.adicionar(pos, pos + entidade[0].length, 'escape');
      pos += entidade[0].length;
      continue;
    }
    const proximo = pLinha.indexOf('<', pos + 1);
    const ate = proximo === -1 ? pLinha.length : proximo;
    coletor.adicionar(pos, ate, 'normal');
    pos = ate;
  }
  return { tokens: coletor.tokens, estadoFinal: estado };
}

export const XML: Linguagem = { nome: 'xml', apelidos: ['html', 'xhtml', 'svg', 'xaml', 'csproj', 'xsl'], rotulo: 'XML / HTML', tokenizarLinha: tokenizarXML };

// ============================================================================
// CSS
// ============================================================================

function tokenizarCSS(pLinha: string, pEstado: string): LinhaTokenizada {
  const coletor = new ColetorDeTokens();
  let pos = 0;
  let estado = pEstado; // '' = seletor; 'bloco' = dentro de { }; 'comentario'
  while (pos < pLinha.length) {
    const resto = pLinha.slice(pos);
    if (estado === 'comentario') {
      const fim = pLinha.indexOf('*/', pos);
      if (fim === -1) {
        coletor.adicionar(pos, pLinha.length, 'comentario');
        return { tokens: coletor.tokens, estadoFinal: 'comentario' };
      }
      coletor.adicionar(pos, fim + 2, 'comentario');
      pos = fim + 2;
      estado = 'bloco:volta';
      continue;
    }
    if (estado === 'bloco:volta')
      estado = pLinha.slice(0, pos).includes('{') && !pLinha.slice(0, pos).includes('}') ? 'bloco' : '';
    if (/\s/.test(pLinha[pos])) {
      pos += 1;
      continue;
    }
    if (resto.startsWith('/*')) {
      const anterior = estado;
      estado = 'comentario';
      const fim = pLinha.indexOf('*/', pos + 2);
      if (fim === -1) {
        coletor.adicionar(pos, pLinha.length, 'comentario');
        return { tokens: coletor.tokens, estadoFinal: 'comentario' };
      }
      coletor.adicionar(pos, fim + 2, 'comentario');
      pos = fim + 2;
      estado = anterior;
      continue;
    }
    const c = pLinha[pos];
    if (c === '{') {
      coletor.adicionar(pos, pos + 1, 'pontuacao');
      pos += 1;
      estado = 'bloco';
      continue;
    }
    if (c === '}') {
      coletor.adicionar(pos, pos + 1, 'pontuacao');
      pos += 1;
      estado = '';
      continue;
    }
    if (c === '"' || c === "'") {
      const fim = pLinha.indexOf(c, pos + 1);
      const ate = fim === -1 ? pLinha.length : fim + 1;
      coletor.adicionar(pos, ate, 'texto');
      pos = ate;
      continue;
    }
    if (estado === 'bloco') {
      const propriedade = /^(--)?[A-Za-z-]+(?=\s*:)/.exec(resto);
      if (propriedade) {
        coletor.adicionar(pos, pos + propriedade[0].length, 'propriedade');
        pos += propriedade[0].length;
        continue;
      }
      const numero = /^-?\d*\.?\d+(%|[a-z]+)?/.exec(resto);
      if (numero) {
        coletor.adicionar(pos, pos + numero[0].length, 'numero');
        pos += numero[0].length;
        continue;
      }
      const cor = /^#[0-9a-fA-F]{3,8}\b/.exec(resto);
      if (cor) {
        coletor.adicionar(pos, pos + cor[0].length, 'constante');
        pos += cor[0].length;
        continue;
      }
      const funcao = /^[A-Za-z-]+(?=\()/.exec(resto);
      if (funcao) {
        coletor.adicionar(pos, pos + funcao[0].length, 'funcao');
        pos += funcao[0].length;
        continue;
      }
      const importante = /^!important/.exec(resto);
      if (importante) {
        coletor.adicionar(pos, pos + importante[0].length, 'palavraChave');
        pos += importante[0].length;
        continue;
      }
      const palavra = /^[A-Za-z-]+/.exec(resto);
      if (palavra) {
        coletor.adicionar(pos, pos + palavra[0].length, 'normal');
        pos += palavra[0].length;
        continue;
      }
      coletor.adicionar(pos, pos + 1, ':;,'.includes(c) ? 'pontuacao' : 'operador');
      pos += 1;
      continue;
    }
    // Seletores.
    const regra = /^@[A-Za-z-]+/.exec(resto);
    if (regra) {
      coletor.adicionar(pos, pos + regra[0].length, 'palavraChave');
      pos += regra[0].length;
      continue;
    }
    const seletor = /^[.#]?[A-Za-z_-][A-Za-z0-9_-]*/.exec(resto);
    if (seletor) {
      coletor.adicionar(pos, pos + seletor[0].length, seletor[0].startsWith('.') ? 'atributo' : seletor[0].startsWith('#') ? 'constante' : 'etiqueta');
      pos += seletor[0].length;
      continue;
    }
    const pseudo = /^::?[A-Za-z-]+/.exec(resto);
    if (pseudo) {
      coletor.adicionar(pos, pos + pseudo[0].length, 'tipo');
      pos += pseudo[0].length;
      continue;
    }
    coletor.adicionar(pos, pos + 1, 'operador');
    pos += 1;
  }
  return { tokens: coletor.tokens, estadoFinal: estado === 'bloco:volta' ? '' : estado };
}

export const CSS: Linguagem = { nome: 'css', apelidos: ['scss', 'less'], rotulo: 'CSS', tokenizarLinha: tokenizarCSS };

// ============================================================================
// YAML
// ============================================================================

function tokenizarYAML(pLinha: string): LinhaTokenizada {
  const coletor = new ColetorDeTokens();
  const comentario = pLinha.search(/(^|\s)#/);
  const util = comentario === -1 ? pLinha : pLinha.slice(0, comentario + (pLinha[comentario] === '#' ? 0 : 1));
  if (comentario !== -1)
    coletor.adicionar(comentario + (pLinha[comentario] === '#' ? 0 : 1), pLinha.length, 'comentario');
  const chave = /^(\s*-?\s*)([^\s:#][^:#]*?)(\s*:)(\s|$)/.exec(util);
  let pos = 0;
  if (/^\s*-\s/.test(util) || /^\s*-$/.test(util)) {
    const traco = util.indexOf('-');
    coletor.adicionar(traco, traco + 1, 'pontuacao');
  }
  if (chave) {
    const ini = chave[1].length;
    coletor.adicionar(ini, ini + chave[2].length, 'propriedade');
    coletor.adicionar(ini + chave[2].length, ini + chave[2].length + chave[3].length, 'pontuacao');
    pos = chave[0].length;
  } else if (/^\s*-\s/.test(util))
    pos = util.indexOf('-') + 1;
  const valor = util.slice(pos).trim();
  const iniValor = pos + (util.slice(pos).length - util.slice(pos).trimStart().length);
  if (valor.length > 0) {
    let tipo: 'texto' | 'numero' | 'constante' | 'normal' | 'macro' = 'normal';
    if (/^["']/.test(valor))
      tipo = 'texto';
    else if (/^-?\d+(\.\d+)?$/.test(valor))
      tipo = 'numero';
    else if (/^(true|false|null|~|yes|no|on|off)$/i.test(valor))
      tipo = 'constante';
    else if (/^[|>][-+]?$/.test(valor) || /^[&*!][A-Za-z0-9_]+/.test(valor))
      tipo = 'macro';
    coletor.adicionar(iniValor, iniValor + valor.length, tipo);
  }
  if (/^---$|^\.\.\.$/.test(util.trim()))
    coletor.adicionar(0, util.length, 'delimitador');
  coletor.tokens.sort((pA, pB) => pA.ini - pB.ini);
  return { tokens: coletor.tokens, estadoFinal: '' };
}

export const YAML: Linguagem = { nome: 'yaml', apelidos: ['yml'], rotulo: 'YAML', tokenizarLinha: (pLinha) => tokenizarYAML(pLinha), comentarioDeLinha: '#' };

// ============================================================================
// Markdown (simples)
// ============================================================================

function tokenizarMarkdown(pLinha: string, pEstado: string): LinhaTokenizada {
  const coletor = new ColetorDeTokens();
  if (pEstado === 'cerca') {
    if (/^```/.test(pLinha)) {
      coletor.adicionar(0, pLinha.length, 'delimitador');
      return { tokens: coletor.tokens, estadoFinal: '' };
    }
    coletor.adicionar(0, pLinha.length, 'texto');
    return { tokens: coletor.tokens, estadoFinal: 'cerca' };
  }
  if (/^```/.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'delimitador');
    return { tokens: coletor.tokens, estadoFinal: 'cerca' };
  }
  if (/^#{1,6}\s/.test(pLinha)) {
    coletor.adicionar(0, pLinha.length, 'titulo');
    return { tokens: coletor.tokens, estadoFinal: '' };
  }
  const marcador = /^\s*([-*+]|\d+\.)\s/.exec(pLinha);
  if (marcador)
    coletor.adicionar(0, marcador[0].length, 'pontuacao');
  if (/^>/.test(pLinha))
    coletor.adicionar(0, 1, 'pontuacao');
  const padrao = /(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*]+\*|_[^_]+_)|(`[^`]+`)|(!?\[[^\]]*\]\([^)]*\))/g;
  let m: RegExpExecArray | null;
  while ((m = padrao.exec(pLinha)) !== null) {
    const tipo = m[1] ? 'forte' : m[2] ? 'enfase' : m[3] ? 'texto' : 'link';
    coletor.adicionar(m.index, m.index + m[0].length, tipo);
  }
  coletor.tokens.sort((pA, pB) => pA.ini - pB.ini);
  return { tokens: coletor.tokens, estadoFinal: '' };
}

export const MARKDOWN: Linguagem = { nome: 'markdown', apelidos: ['md'], rotulo: 'Markdown', tokenizarLinha: tokenizarMarkdown };
