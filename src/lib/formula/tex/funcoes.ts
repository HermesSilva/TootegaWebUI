/**
 * REGISTRO DE FUNÇÕES do TeX: cada sequência de controle que recebe argumentos (`\frac`, `\sqrt`, `\mathbf`,
 * `\text`, `\left`-família, acentos, operadores, espaçamento, cercaduras, setas, classes, etiquetas…). O recorte
 * segue o dos módulos `functions/` do KaTeX, para quem for comparar; o código é da casa.
 *
 * Tipos de argumento: `math` (grupo matemático), `text` (grupo em modo texto), `resto` (o resto do grupo corrente,
 * para `\rm`, `\displaystyle`, `\color`), `size` (medida), `color`, `raw` (texto cru), `url`, `primitive` (delimitador).
 */

import { desembrulhar, erro, grupo, simbolo, type ClasseDeAtomo, type EspecieDeCercadura, type EstiloMatematico, type FonteDeTexto, type FonteMatematica, type Medida, type No, type Operador } from '../ast';
import type { Token } from './lexer';
import { delimitadorDoTexto } from './delimitadores';
import { medidaEm, medidaMu } from './medidas';
import type { Parser } from './parser';

export type TipoDeArgumento = 'math' | 'text' | 'resto' | 'size' | 'color' | 'raw' | 'url' | 'primitive';

export type ArgumentoLido = No | string | Medida;

export interface ContextoDaFuncao {
  parser: Parser;
  token: Token;
  argumentos: ArgumentoLido[];
  opcionais: (ArgumentoLido | null)[];
  /** `\operatorname*`: havia `*` logo depois do nome. */
  estrela: boolean;
}

export interface Funcao {
  args: number;
  opcionais?: number;
  tipos?: TipoDeArgumento[];
  permitidoEmTexto?: boolean;
  somenteTexto?: boolean;
  /** Aceita `*` colado ao nome, lido ANTES dos argumentos. */
  aceitaEstrela?: boolean;
  tratador: (pContexto: ContextoDaFuncao) => No;
}

export const FUNCOES: Record<string, Funcao> = {};

function definir(pNomes: string | string[], pFuncao: Funcao): void {
  for (const nome of Array.isArray(pNomes) ? pNomes : [pNomes])
    FUNCOES[nome] = pFuncao;
}

function no(pArgumento: ArgumentoLido): No {
  return pArgumento as No;
}

function texto(pArgumento: ArgumentoLido): string {
  return pArgumento as string;
}

function medida(pArgumento: ArgumentoLido): Medida {
  return pArgumento as Medida;
}

function filhos(pNo: No): No[] {
  return pNo.tipo === 'grupo' ? pNo.filhos : [pNo];
}

/** Aplica uma fonte matemática a todos os símbolos de um subárvore (sem entrar em `\text`). */
export function aplicarFonte(pNo: No, pFonte: FonteMatematica): No {
  switch (pNo.tipo) {
    case 'simbolo':
      return pNo.modo === 'math' ? { ...pNo, fonte: pFonte } : pNo;
    case 'grupo':
      return { ...pNo, filhos: pNo.filhos.map((pF) => aplicarFonte(pF, pFonte)) };
    case 'supsub': {
      const saida = { ...pNo, base: pNo.base ? aplicarFonte(pNo.base, pFonte) : null };
      if (pNo.sup)
        saida.sup = aplicarFonte(pNo.sup, pFonte);
      if (pNo.sub)
        saida.sub = aplicarFonte(pNo.sub, pFonte);
      return saida;
    }
    case 'fracao':
      return { ...pNo, numerador: aplicarFonte(pNo.numerador, pFonte), denominador: aplicarFonte(pNo.denominador, pFonte) };
    case 'raiz': {
      const saida = { ...pNo, radicando: aplicarFonte(pNo.radicando, pFonte) };
      if (pNo.indice)
        saida.indice = aplicarFonte(pNo.indice, pFonte);
      return saida;
    }
    case 'acento':
      return { ...pNo, base: aplicarFonte(pNo.base, pFonte) };
    case 'delimitado':
    case 'estilo':
    case 'tamanho':
    case 'cor':
    case 'fantasma':
    case 'esmagar':
    case 'sobreposicao':
    case 'elevar':
    case 'cercadura':
    case 'linha':
    case 'chave':
    case 'classe':
    case 'envoltorio':
      return { ...pNo, corpo: (pNo as { corpo: No[] }).corpo.map((pF) => aplicarFonte(pF, pFonte)) } as No;
    case 'operador':
      return pNo.nome ? { ...pNo, nome: pNo.nome.map((pF) => aplicarFonte(pF, pFonte)) } : pNo;
    default:
      return pNo;
  }
}

// ============================================================================
// Fontes
// ============================================================================

const FONTES: Record<string, FonteMatematica> = {
  '\\mathrm': 'normal',
  '\\mathit': 'italico',
  '\\mathbf': 'negrito',
  '\\mathnormal': 'italico',
  '\\mathbb': 'duplo',
  '\\mathcal': 'caligrafico',
  '\\mathfrak': 'fraktur',
  '\\mathsf': 'semSerifa',
  '\\mathtt': 'mono',
  '\\bm': 'negritoItalico',
  '\\mathsfit': 'semSerifaItalico',
};
for (const [nome, fonte] of Object.entries(FONTES))
  definir(nome, { args: 1, tratador: (pC) => grupo([aplicarFonte(no(pC.argumentos[0]), fonte)]) });

// Fontes "antigas" valem até o fim do grupo: `{\rm abc}`.
const FONTES_ANTIGAS: Record<string, FonteMatematica> = { '\\rm': 'normal', '\\it': 'italico', '\\bf': 'negrito', '\\sf': 'semSerifa', '\\tt': 'mono', '\\cal': 'caligrafico' };
for (const [nome, fonte] of Object.entries(FONTES_ANTIGAS))
  definir(nome, { args: 1, tipos: ['resto'], tratador: (pC) => grupo([aplicarFonte(no(pC.argumentos[0]), fonte)]) });

// ============================================================================
// Texto
// ============================================================================

const FONTES_DE_TEXTO: Record<string, FonteDeTexto | undefined> = {
  '\\text': undefined,
  '\\textrm': 'normal',
  '\\textnormal': 'normal',
  '\\textup': 'normal',
  '\\textmd': 'normal',
  '\\textit': 'italico',
  '\\emph': 'italico',
  '\\textbf': 'negrito',
  '\\texttt': 'mono',
  '\\textsf': 'semSerifa',
  '\\mbox': undefined,
  '\\hbox': undefined,
};
for (const [nome, fonte] of Object.entries(FONTES_DE_TEXTO))
  definir(nome, {
    args: 1,
    tipos: ['text'],
    permitidoEmTexto: true,
    tratador: (pC) => {
      const saida: No = { tipo: 'texto', filhos: filhos(no(pC.argumentos[0])) };
      if (fonte)
        saida.fonte = fonte;
      return saida;
    },
  });

// ============================================================================
// Estilo, tamanho, cor
// ============================================================================

const ESTILOS: Record<string, EstiloMatematico> = { '\\displaystyle': 'display', '\\textstyle': 'text', '\\scriptstyle': 'script', '\\scriptscriptstyle': 'scriptscript' };
for (const [nome, estilo] of Object.entries(ESTILOS))
  definir(nome, { args: 1, tipos: ['resto'], permitidoEmTexto: true, tratador: (pC) => ({ tipo: 'estilo', estilo, filhos: filhos(no(pC.argumentos[0])) }) });

const TAMANHOS: Record<string, number> = {
  '\\tiny': 1, '\\sixptsize': 2, '\\scriptsize': 3, '\\footnotesize': 4, '\\small': 5, '\\normalsize': 6, '\\large': 7, '\\Large': 8, '\\LARGE': 9, '\\huge': 10, '\\Huge': 11,
};
for (const [nome, tamanho] of Object.entries(TAMANHOS))
  definir(nome, { args: 1, tipos: ['resto'], permitidoEmTexto: true, tratador: (pC) => ({ tipo: 'tamanho', tamanho, filhos: filhos(no(pC.argumentos[0])) }) });

definir('\\textcolor', { args: 2, tipos: ['color', 'math'], permitidoEmTexto: true, tratador: (pC) => ({ tipo: 'cor', cor: texto(pC.argumentos[0]), filhos: filhos(no(pC.argumentos[1])) }) });
definir('\\color', { args: 2, tipos: ['color', 'resto'], permitidoEmTexto: true, tratador: (pC) => ({ tipo: 'cor', cor: texto(pC.argumentos[0]), filhos: filhos(no(pC.argumentos[1])) }) });

// ============================================================================
// Frações e binomiais
// ============================================================================

function fracao(pC: ContextoDaFuncao, pBarra: boolean, pEstilo?: EstiloMatematico, pEsq?: string, pDir?: string): No {
  const saida: No = { tipo: 'fracao', numerador: no(pC.argumentos[0]), denominador: no(pC.argumentos[1]), barra: pBarra };
  if (pEstilo)
    saida.estilo = pEstilo;
  if (pEsq !== undefined)
    saida.delimitadorEsquerdo = pEsq;
  if (pDir !== undefined)
    saida.delimitadorDireito = pDir;
  return saida;
}

definir(['\\frac', '\\dfrac', '\\tfrac', '\\cfrac'], {
  args: 2,
  tratador: (pC) => fracao(pC, true, pC.token.texto === '\\dfrac' || pC.token.texto === '\\cfrac' ? 'display' : pC.token.texto === '\\tfrac' ? 'text' : undefined),
});
definir(['\\binom', '\\dbinom', '\\tbinom'], {
  args: 2,
  tratador: (pC) => fracao(pC, false, pC.token.texto === '\\dbinom' ? 'display' : pC.token.texto === '\\tbinom' ? 'text' : undefined, '(', ')'),
});
definir('\\genfrac', {
  args: 6,
  tipos: ['raw', 'raw', 'raw', 'raw', 'math', 'math'],
  tratador: (pC) => {
    const delimitador = (pArgumento: ArgumentoLido): string | undefined => {
      const lido = delimitadorDoTexto(texto(pArgumento));
      if (lido === null)
        throw new Error(`Delimitador inválido em \\genfrac: \`${texto(pArgumento)}\`.`);
      return lido === '' ? undefined : lido;
    };
    const espessura = texto(pC.argumentos[2]).trim();
    const estiloTexto = texto(pC.argumentos[3]).trim();
    const estilos: EstiloMatematico[] = ['display', 'text', 'script', 'scriptscript'];
    const saida: No = {
      tipo: 'fracao',
      numerador: no(pC.argumentos[4]),
      denominador: no(pC.argumentos[5]),
      barra: espessura === '' ? true : /^0(pt|em|mu)?$/.test(espessura) ? false : (lerMedidaOuErro(espessura) as Medida),
    };
    const esq = delimitador(pC.argumentos[0]);
    const dir = delimitador(pC.argumentos[1]);
    if (esq !== undefined)
      saida.delimitadorEsquerdo = esq;
    if (dir !== undefined)
      saida.delimitadorDireito = dir;
    if (/^[0-3]$/.test(estiloTexto))
      saida.estilo = estilos[Number(estiloTexto)];
    return saida;
  },
});

function lerMedidaOuErro(pTexto: string): Medida {
  const m = /^\s*([-+]?(?:\d+\.?\d*|\.\d+))\s*([a-z]{2})\s*$/i.exec(pTexto);
  if (!m)
    throw new Error(`Espessura inválida em \\genfrac: \`${pTexto}\`.`);
  return { numero: Number(m[1]), unidade: m[2].toLowerCase() };
}

// ============================================================================
// Raiz
// ============================================================================

definir('\\sqrt', {
  args: 1,
  opcionais: 1,
  tratador: (pC) => {
    const saida: No = { tipo: 'raiz', radicando: no(pC.argumentos[0]) };
    if (pC.opcionais[0])
      saida.indice = no(pC.opcionais[0]);
    return saida;
  },
});

// ============================================================================
// Delimitadores com tamanho
// ============================================================================

const TAMANHOS_DE_DELIMITADOR: [string, 1 | 2 | 3 | 4][] = [['big', 1], ['Big', 2], ['bigg', 3], ['Bigg', 4]];
for (const [nome, tamanho] of TAMANHOS_DE_DELIMITADOR) {
  const classes: Record<string, 'open' | 'close' | 'rel' | 'mathord'> = { '': 'mathord', l: 'open', r: 'close', m: 'rel' };
  for (const [sufixo, classe] of Object.entries(classes))
    definir(`\\${nome}${sufixo}`, {
      args: 1,
      tipos: ['primitive'],
      tratador: (pC) => ({ tipo: 'delimitadorComTamanho', delimitador: texto(pC.argumentos[0]), tamanho, classe }),
    });
}

// ============================================================================
// Acentos
// ============================================================================

const ACENTOS: Record<string, { acento: string; largo?: boolean; embaixo?: boolean }> = {
  '\\acute': { acento: '\u0301' },
  '\\grave': { acento: '\u0300' },
  '\\ddot': { acento: '\u0308' },
  '\\dddot': { acento: '\u20db' },
  '\\ddddot': { acento: '\u20dc' },
  '\\tilde': { acento: '\u0303' },
  '\\bar': { acento: '\u0304' },
  '\\breve': { acento: '\u0306' },
  '\\check': { acento: '\u030c' },
  '\\hat': { acento: '\u0302' },
  '\\vec': { acento: '\u20d7' },
  '\\dot': { acento: '\u0307' },
  '\\mathring': { acento: '\u030a' },
  '\\widecheck': { acento: 'ˇ', largo: true },
  '\\widehat': { acento: '^', largo: true },
  '\\widetilde': { acento: '~', largo: true },
  '\\overrightarrow': { acento: '→', largo: true },
  '\\overleftarrow': { acento: '←', largo: true },
  '\\Overrightarrow': { acento: '⇒', largo: true },
  '\\overleftrightarrow': { acento: '↔', largo: true },
  '\\overgroup': { acento: '⏠', largo: true },
  '\\overlinesegment': { acento: '⎴', largo: true },
  '\\overleftharpoon': { acento: '↼', largo: true },
  '\\overrightharpoon': { acento: '⇀', largo: true },
  '\\underleftarrow': { acento: '←', largo: true, embaixo: true },
  '\\underrightarrow': { acento: '→', largo: true, embaixo: true },
  '\\underleftrightarrow': { acento: '↔', largo: true, embaixo: true },
  '\\undergroup': { acento: '⏡', largo: true, embaixo: true },
  '\\underlinesegment': { acento: '⎵', largo: true, embaixo: true },
  '\\utilde': { acento: '~', largo: true, embaixo: true },
};
for (const [nome, dados] of Object.entries(ACENTOS))
  definir(nome, {
    args: 1,
    tratador: (pC) => {
      const saida: No = { tipo: 'acento', acento: dados.acento, base: no(pC.argumentos[0]) };
      if (dados.largo)
        saida.largo = true;
      if (dados.embaixo)
        saida.embaixo = true;
      return saida;
    },
  });

// Acentos de texto: `\'e` → é (caractere combinante).
const ACENTOS_DE_TEXTO: Record<string, string> = {
  '\\\'': '\u0301', '\\`': '\u0300', '\\^': '\u0302', '\\~': '\u0303', '\\=': '\u0304', '\\u': '\u0306', '\\.': '\u0307', '\\"': '\u0308', '\\r': '\u030a', '\\H': '\u030b', '\\v': '\u030c',
};
for (const [nome, acento] of Object.entries(ACENTOS_DE_TEXTO))
  definir(nome, {
    args: 1,
    tipos: ['text'],
    permitidoEmTexto: true,
    somenteTexto: true,
    tratador: (pC) => ({ tipo: 'acento', acento, base: no(pC.argumentos[0]), emTexto: true }),
  });

// ============================================================================
// Operadores
// ============================================================================

function operadorNomeado(pNome: string, pLimites: boolean): Operador {
  return { tipo: 'operador', nome: pNome.split('').map((pC) => simbolo('textord', pC, 'text')), grande: false, limites: pLimites };
}

const FUNCOES_SEM_LIMITES = ['arcsin', 'arccos', 'arctan', 'arctg', 'arcctg', 'arg', 'ch', 'cos', 'cosec', 'cosh', 'cot', 'cotg', 'coth', 'csc', 'ctg', 'cth', 'deg', 'dim', 'exp', 'hom', 'ker', 'lg', 'ln', 'log', 'sec', 'sin', 'sinh', 'sh', 'tan', 'tanh', 'tg', 'th'];
for (const nome of FUNCOES_SEM_LIMITES)
  definir(`\\${nome}`, { args: 0, tratador: () => operadorNomeado(nome, false) });
const FUNCOES_COM_LIMITES = ['det', 'gcd', 'inf', 'lim', 'max', 'min', 'Pr', 'sup'];
for (const nome of FUNCOES_COM_LIMITES)
  definir(`\\${nome}`, { args: 0, tratador: () => operadorNomeado(nome, true) });

definir(['\\operatorname', '\\operatornamewithlimits'], {
  args: 1,
  aceitaEstrela: true,
  tratador: (pC) => {
    const estrela = pC.estrela || pC.token.texto === '\\operatornamewithlimits';
    const nome = filhos(no(pC.argumentos[0])).map((pF) => (pF.tipo === 'simbolo' && pF.modo === 'math' && /^[A-Za-z]$/.test(pF.texto) ? { ...pF, modo: 'text' as const } : pF));
    const saida: Operador = { tipo: 'operador', nome, grande: false, limites: estrela };
    if (estrela)
      saida.estrela = true;
    return saida;
  },
});

definir('\\mathop', {
  args: 1,
  tratador: (pC) => {
    const corpo = desembrulhar(no(pC.argumentos[0]));
    if (corpo.tipo === 'simbolo')
      return { tipo: 'operador', simbolo: corpo.texto, grande: corpo.classe === 'op', limites: true };
    return { tipo: 'operador', nome: filhos(corpo), grande: false, limites: true };
  },
});

// Símbolos de operador grande já estão na tabela de símbolos (classe `op`); o construtor os trata.

// ============================================================================
// Espaçamento
// ============================================================================

const ESPACOS: Record<string, Medida> = {
  '\\,': medidaMu(3),
  '\\:': medidaMu(4),
  '\\>': medidaMu(4),
  '\\;': medidaMu(5),
  '\\!': medidaMu(-3),
  '\\ ': medidaEm(0.3333),
  '\\nobreakspace': medidaEm(0.3333),
  '\\space': medidaEm(0.3333),
};
for (const [nome, largura] of Object.entries(ESPACOS))
  definir(nome, { args: 0, permitidoEmTexto: true, tratador: () => ({ tipo: 'espaco', largura, texto: nome === '\\ ' || nome === '\\nobreakspace' || nome === '\\space' }) });

definir(['\\kern', '\\mkern', '\\mskip', '\\hskip'], {
  args: 1,
  tipos: ['size'],
  permitidoEmTexto: true,
  tratador: (pC) => {
    const m = medida(pC.argumentos[0]);
    if ((pC.token.texto === '\\mkern' || pC.token.texto === '\\mskip') && m.unidade !== 'mu')
      pC.parser.aviso(`\`${pC.token.texto}\` pede unidade mu; veio ${m.unidade}.`, pC.token.posicao);
    if (pC.token.texto === '\\kern' && m.unidade === 'mu')
      pC.parser.aviso('`\\kern` não aceita mu; use `\\mkern`.', pC.token.posicao);
    return { tipo: 'espaco', largura: m };
  },
});
definir(['\\allowbreak', '\\nobreak'], { args: 0, permitidoEmTexto: true, tratador: () => grupo([]) });

definir(['\\phantom', '\\hphantom', '\\vphantom'], {
  args: 1,
  permitidoEmTexto: true,
  tratador: (pC) => {
    const saida: No = { tipo: 'fantasma', corpo: filhos(no(pC.argumentos[0])) };
    if (pC.token.texto === '\\hphantom')
      saida.somente = 'horizontal';
    else if (pC.token.texto === '\\vphantom')
      saida.somente = 'vertical';
    return saida;
  },
});
definir('\\smash', {
  args: 1,
  opcionais: 1,
  tipos: ['raw', 'math'],
  permitidoEmTexto: true,
  tratador: (pC) => {
    const opcao = pC.opcionais[0] === null ? '' : texto(pC.opcionais[0]);
    const acima = opcao === '' || opcao.includes('t');
    const abaixo = opcao === '' || opcao.includes('b');
    return { tipo: 'esmagar', corpo: filhos(no(pC.argumentos[0])), acima, abaixo };
  },
});
definir(['\\mathllap', '\\mathrlap', '\\mathclap'], {
  args: 1,
  permitidoEmTexto: true,
  tratador: (pC) => ({ tipo: 'sobreposicao', alinhamento: pC.token.texto === '\\mathllap' ? 'esquerda' : pC.token.texto === '\\mathrlap' ? 'direita' : 'centro', corpo: filhos(no(pC.argumentos[0])) }),
});
definir('\\raisebox', {
  args: 2,
  tipos: ['size', 'text'],
  permitidoEmTexto: true,
  tratador: (pC) => ({ tipo: 'elevar', deslocamento: medida(pC.argumentos[0]), corpo: [{ tipo: 'texto', filhos: filhos(no(pC.argumentos[1])) }] }),
});
definir('\\rule', {
  args: 2,
  opcionais: 1,
  tipos: ['size', 'size', 'size'],
  permitidoEmTexto: true,
  tratador: (pC) => {
    const saida: No = { tipo: 'regra', largura: medida(pC.argumentos[0]), altura: medida(pC.argumentos[1]) };
    if (pC.opcionais[0])
      saida.deslocamento = medida(pC.opcionais[0]);
    return saida;
  },
});

// ============================================================================
// Cercaduras, linhas, chaves
// ============================================================================

const CERCADURAS: Record<string, EspecieDeCercadura> = { '\\cancel': 'cancel', '\\bcancel': 'bcancel', '\\xcancel': 'xcancel', '\\sout': 'sout', '\\boxed': 'boxed', '\\angl': 'angl', '\\phase': 'phase' };
for (const [nome, especie] of Object.entries(CERCADURAS))
  definir(nome, { args: 1, permitidoEmTexto: true, tratador: (pC) => ({ tipo: 'cercadura', especie, corpo: filhos(no(pC.argumentos[0])) }) });
definir('\\angln', { args: 0, tratador: () => ({ tipo: 'cercadura', especie: 'angl', corpo: [simbolo('mathord', 'n')] }) });
definir('\\fbox', { args: 1, tipos: ['text'], permitidoEmTexto: true, tratador: (pC) => ({ tipo: 'cercadura', especie: 'fbox', corpo: [{ tipo: 'texto', filhos: filhos(no(pC.argumentos[0])) }] }) });
definir('\\colorbox', {
  args: 2,
  tipos: ['color', 'text'],
  permitidoEmTexto: true,
  tratador: (pC) => ({ tipo: 'cercadura', especie: 'colorbox', corDoFundo: texto(pC.argumentos[0]), corpo: [{ tipo: 'texto', filhos: filhos(no(pC.argumentos[1])) }] }),
});
definir('\\fcolorbox', {
  args: 3,
  tipos: ['color', 'color', 'text'],
  permitidoEmTexto: true,
  tratador: (pC) => ({ tipo: 'cercadura', especie: 'fcolorbox', corDaBorda: texto(pC.argumentos[0]), corDoFundo: texto(pC.argumentos[1]), corpo: [{ tipo: 'texto', filhos: filhos(no(pC.argumentos[2])) }] }),
});

definir('\\overline', { args: 1, tratador: (pC) => ({ tipo: 'linha', posicao: 'acima', corpo: filhos(no(pC.argumentos[0])) }) });
definir('\\underline', { args: 1, permitidoEmTexto: true, tratador: (pC) => ({ tipo: 'linha', posicao: 'abaixo', corpo: filhos(no(pC.argumentos[0])) }) });
definir('\\overbrace', { args: 1, tratador: (pC) => ({ tipo: 'chave', acima: true, corpo: filhos(no(pC.argumentos[0])) }) });
definir('\\underbrace', { args: 1, tratador: (pC) => ({ tipo: 'chave', acima: false, corpo: filhos(no(pC.argumentos[0])) }) });

// ============================================================================
// Setas extensíveis
// ============================================================================

const SETAS: Record<string, string> = {
  '\\xleftarrow': '←', '\\xrightarrow': '→', '\\xLeftarrow': '⇐', '\\xRightarrow': '⇒', '\\xleftrightarrow': '↔', '\\xLeftrightarrow': '⇔',
  '\\xhookleftarrow': '↩', '\\xhookrightarrow': '↪', '\\xmapsto': '↦', '\\xrightharpoondown': '⇁', '\\xrightharpoonup': '⇀',
  '\\xleftharpoondown': '↽', '\\xleftharpoonup': '↼', '\\xrightleftharpoons': '⇌', '\\xleftrightharpoons': '⇋', '\\xlongequal': '=',
  '\\xtwoheadrightarrow': '↠', '\\xtwoheadleftarrow': '↞', '\\xtofrom': '⇄', '\\xrightleftarrows': '⇄', '\\xrightequilibrium': '⇌',
  '\\xleftequilibrium': '⇋', '\\\\cdrightarrow': '→', '\\\\cdleftarrow': '←', '\\\\cdlongequal': '=',
};
for (const [nome, seta] of Object.entries(SETAS))
  definir(nome, {
    args: 1,
    opcionais: 1,
    tratador: (pC) => {
      const saida: No = { tipo: 'seta', seta, acima: filhos(no(pC.argumentos[0])) };
      if (pC.opcionais[0])
        saida.abaixo = filhos(no(pC.opcionais[0]));
      return saida;
    },
  });

// ============================================================================
// Classes
// ============================================================================

const CLASSES: Record<string, ClasseDeAtomo> = { '\\mathord': 'mathord', '\\mathbin': 'bin', '\\mathrel': 'rel', '\\mathopen': 'open', '\\mathclose': 'close', '\\mathpunct': 'punct', '\\mathinner': 'inner' };
for (const [nome, classe] of Object.entries(CLASSES))
  definir(nome, {
    args: 1,
    tratador: (pC) => {
      const corpo = desembrulhar(no(pC.argumentos[0]));
      if (corpo.tipo === 'simbolo')
        return { ...corpo, classe };
      return { tipo: 'classe', classe, corpo: filhos(corpo) };
    },
  });

// ============================================================================
// Diversos
// ============================================================================

definir('\\not', {
  args: 1,
  tratador: (pC) => {
    const corpo = desembrulhar(no(pC.argumentos[0]));
    if (corpo.tipo === 'simbolo')
      return { ...corpo, negado: true, classe: corpo.classe === 'mathord' || corpo.classe === 'textord' ? 'rel' : corpo.classe };
    return grupo([simbolo('rel', '\u0338'), corpo]);
  },
});

definir('\\mathchoice', {
  args: 4,
  tratador: (pC) => ({ tipo: 'escolha', display: filhos(no(pC.argumentos[0])), text: filhos(no(pC.argumentos[1])), script: filhos(no(pC.argumentos[2])), scriptscript: filhos(no(pC.argumentos[3])) }),
});

definir('\\pmb', { args: 1, tratador: (pC) => ({ tipo: 'envoltorio', especie: 'pmb', corpo: filhos(no(pC.argumentos[0])) }) });
definir('\\vcenter', { args: 1, tratador: (pC) => ({ tipo: 'envoltorio', especie: 'vcenter', corpo: filhos(no(pC.argumentos[0])) }) });
definir('\\reflectbox', { args: 1, tipos: ['text'], permitidoEmTexto: true, tratador: (pC) => ({ tipo: 'envoltorio', especie: 'reflectbox', corpo: [{ tipo: 'texto', filhos: filhos(no(pC.argumentos[0])) }] }) });

definir('\\verb', {
  args: 0,
  permitidoEmTexto: true,
  tratador: (pC) => {
    const lido = pC.parser.expansor.lerVerbatim();
    if (!lido)
      throw new Error('`\\verb` precisa de um delimitador e fechar na mesma linha: \\verb|texto|.');
    return { tipo: 'verbatim', texto: lido.estrela ? lido.texto.replace(/ /g, '␣') : lido.texto };
  },
});

definir('\\tag@literal', {
  args: 1,
  tratador: (pC) => {
    const rotulo = filhos(no(pC.argumentos[0]));
    // `\tag{(x)}` vindo de `\tag@paren`: já veio com parênteses, então é "cru" para o construtor.
    if (pC.parser.profundidadeDeArranjo > 0) {
      pC.parser.etiquetaDaLinha = { rotulo, crua: true };
      return grupo([]);
    }
    return { tipo: 'etiqueta', corpo: [], rotulo, crua: true };
  },
});
definir('\\notag', {
  args: 0,
  tratador: (pC) => {
    if (pC.parser.profundidadeDeArranjo > 0)
      pC.parser.etiquetaDaLinha = { rotulo: null, crua: false };
    return grupo([]);
  },
});

definir('\\href', { args: 2, tipos: ['url', 'math'], permitidoEmTexto: true, tratador: (pC) => externo(pC, 'href', texto(pC.argumentos[0]), filhos(no(pC.argumentos[1]))) });
definir('\\url', { args: 1, tipos: ['url'], permitidoEmTexto: true, tratador: (pC) => externo(pC, 'url', texto(pC.argumentos[0]), texto(pC.argumentos[0]).split('').map((pX) => simbolo('textord', pX, 'text'))) });
definir('\\includegraphics', { args: 1, opcionais: 1, tipos: ['raw', 'raw'], tratador: (pC) => externo(pC, 'imagem', texto(pC.argumentos[0]), []) });
definir(['\\htmlClass', '\\htmlId', '\\htmlStyle', '\\htmlData'], { args: 2, tipos: ['raw', 'math'], permitidoEmTexto: true, tratador: (pC) => externo(pC, 'html', texto(pC.argumentos[0]), filhos(no(pC.argumentos[1]))) });

function externo(pC: ContextoDaFuncao, pEspecie: 'href' | 'url' | 'imagem' | 'html', pAlvo: string, pCorpo: No[]): No {
  pC.parser.aviso(`\`${pC.token.texto}\` está fora do escopo do motor (sai como texto).`, pC.token.posicao);
  return { tipo: 'externo', especie: pEspecie, alvo: pAlvo, corpo: pCorpo };
}

// `\hline`, `\hdashline` fora de arranjo: erro amigável (dentro, o ambiente os consome antes).
definir(['\\hline', '\\hdashline'], { args: 0, tratador: (pC) => erro(pC.token.texto, `\`${pC.token.texto}\` só vale no começo de uma linha de array/matrix.`) });

// `\limits`/`\nolimits` soltos (sem base): o parser os trata depois de um átomo; aqui só para não serem "desconhecidos".
definir(['\\limits', '\\nolimits'], { args: 0, tratador: (pC) => erro(pC.token.texto, `\`${pC.token.texto}\` precisa vir depois de um operador.`) });
