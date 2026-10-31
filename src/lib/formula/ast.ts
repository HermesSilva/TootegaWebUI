/**
 * ÁRVORE de uma fórmula (motor de fórmulas da casa, 2026-10-31 — plano `Docs/PLAN-formulas.md` da extensão).
 *
 * É o que os parsers (TeX e AsciiMath) produzem e o que o construtor de MathML consome. O recorte segue o do KaTeX
 * (estudado como referência, nunca dependência): classes de átomo do TeX, grupos, scripts, frações, raízes,
 * delimitadores, acentos, operadores, texto, estilo, tamanho, cor, espaços, fantasmas, cercaduras, arranjos e
 * etiquetas. Nada aqui conhece o DOM.
 */

/** Classe de átomo do TeX — decide o espaçamento e o elemento MathML (`mi`, `mn`, `mo`). */
export type ClasseDeAtomo = 'mathord' | 'textord' | 'op' | 'bin' | 'rel' | 'open' | 'close' | 'punct' | 'inner';

/** Fonte matemática (`\mathbf`…): vira caractere alfanumérico matemático do Unicode no MathML. */
export type FonteMatematica =
  | 'normal'
  | 'negrito'
  | 'italico'
  | 'negritoItalico'
  | 'caligrafico'
  | 'caligraficoNegrito'
  | 'fraktur'
  | 'frakturNegrito'
  | 'duplo'
  | 'semSerifa'
  | 'semSerifaNegrito'
  | 'semSerifaItalico'
  | 'semSerifaNegritoItalico'
  | 'mono';

/** Fonte de texto (`\textbf`, `\textit`…): vira classe CSS no `mtext`. */
export type FonteDeTexto = 'normal' | 'negrito' | 'italico' | 'mono' | 'semSerifa';

export type EstiloMatematico = 'display' | 'text' | 'script' | 'scriptscript';

/** Medida com unidade do TeX (`em`, `ex`, `pt`, `mu`…) — vem de `\hspace{2em}`, `\rule`, `\\[1ex]`. */
export interface Medida {
  numero: number;
  unidade: string;
}

export interface Simbolo {
  tipo: 'simbolo';
  classe: ClasseDeAtomo;
  /** O(s) caractere(s) Unicode. */
  texto: string;
  /** Modo em que foi lido: em texto não há itálico automático. */
  modo: 'math' | 'text';
  fonte?: FonteMatematica;
  /** `\not` aplicado: o construtor sobrepõe U+0338. */
  negado?: boolean;
}

export interface Grupo {
  tipo: 'grupo';
  filhos: No[];
}

export interface SupSub {
  tipo: 'supsub';
  base: No | null;
  sup?: No;
  sub?: No;
  /** `\limits`/`\nolimits` explícitos; `undefined` = regra do operador. */
  limites?: boolean;
}

export interface Fracao {
  tipo: 'fracao';
  numerador: No;
  denominador: No;
  /** `true` = barra padrão; `false` = sem barra (`\binom`, `\atop`); número = espessura em `em` (`\above`). */
  barra: boolean | Medida;
  delimitadorEsquerdo?: string;
  delimitadorDireito?: string;
  /** `\dfrac`/`\tfrac`/`\genfrac` com estilo forçado. */
  estilo?: EstiloMatematico;
}

export interface Raiz {
  tipo: 'raiz';
  radicando: No;
  indice?: No;
}

/** `\left … \middle … \right`. Delimitador `.` = invisível. */
export interface Delimitado {
  tipo: 'delimitado';
  esquerda: string;
  direita: string;
  corpo: No[];
}

/** `\middle x` dentro de `\left … \right`. */
export interface DelimitadorDoMeio {
  tipo: 'meio';
  delimitador: string;
}

/** `\big(`, `\Bigl[`… com tamanho fixo (1..4). */
export interface DelimitadorComTamanho {
  tipo: 'delimitadorComTamanho';
  delimitador: string;
  tamanho: 1 | 2 | 3 | 4;
  classe: 'open' | 'close' | 'rel' | 'mathord';
}

export interface Acento {
  tipo: 'acento';
  /** O caractere do acento (U+0302 `^`, U+20D7 `→`…). */
  acento: string;
  base: No;
  /** `true` = embaixo (`\underrightarrow`, `\utilde`). */
  embaixo?: boolean;
  /** Estica sobre a base (`\widehat`, `\overrightarrow`). */
  largo?: boolean;
  /** Acento de texto (`\'e`): aplicado como caractere combinante. */
  emTexto?: boolean;
}

/** Operador grande (`\sum`) ou função nomeada (`\sin`, `\operatorname{…}`). */
export interface Operador {
  tipo: 'operador';
  /** O símbolo (∑) ou, para função nomeada, o nome (`sin`). */
  simbolo?: string;
  nome?: No[];
  /** Grande (`\sum`, `\int`): `largeop` e limites acima/abaixo em display. */
  grande: boolean;
  /** Limites acima/abaixo quando em display (`\lim`, `\sum`); `false` = sempre ao lado (`\int`, `\sin`). */
  limites: boolean;
  /** `\operatorname*`: limites acima/abaixo. */
  estrela?: boolean;
}

export interface Texto {
  tipo: 'texto';
  filhos: No[];
  fonte?: FonteDeTexto;
}

export interface Estilo {
  tipo: 'estilo';
  estilo: EstiloMatematico;
  filhos: No[];
}

/** `\tiny` … `\Huge` (1..11, 6 = normal). */
export interface Tamanho {
  tipo: 'tamanho';
  tamanho: number;
  filhos: No[];
}

export interface Cor {
  tipo: 'cor';
  cor: string;
  filhos: No[];
}

export interface Espaco {
  tipo: 'espaco';
  /** Largura; negativa para `\!`. */
  largura: Medida;
  /** `~`, `\nobreakspace`: espaço de texto. */
  texto?: boolean;
}

export interface Fantasma {
  tipo: 'fantasma';
  corpo: No[];
  /** `\hphantom` = só largura; `\vphantom` = só altura. */
  somente?: 'horizontal' | 'vertical';
}

export interface Esmagar {
  tipo: 'esmagar';
  corpo: No[];
  acima: boolean;
  abaixo: boolean;
}

export interface Sobreposicao {
  tipo: 'sobreposicao';
  alinhamento: 'esquerda' | 'direita' | 'centro';
  corpo: No[];
}

export interface Elevar {
  tipo: 'elevar';
  deslocamento: Medida;
  corpo: No[];
}

export type EspecieDeCercadura = 'cancel' | 'bcancel' | 'xcancel' | 'sout' | 'boxed' | 'fbox' | 'colorbox' | 'fcolorbox' | 'angl' | 'phase';

export interface Cercadura {
  tipo: 'cercadura';
  especie: EspecieDeCercadura;
  corpo: No[];
  corDaBorda?: string;
  corDoFundo?: string;
}

/** `\overline` / `\underline`. */
export interface Linha {
  tipo: 'linha';
  posicao: 'acima' | 'abaixo';
  corpo: No[];
}

/** `\overbrace` / `\underbrace` (o rótulo vem do `^`/`_` que o segue). */
export interface Chave {
  tipo: 'chave';
  acima: boolean;
  corpo: No[];
}

/** `\xrightarrow[abaixo]{acima}` e família. */
export interface SetaExtensivel {
  tipo: 'seta';
  seta: string;
  acima: No[];
  abaixo?: No[];
}

export type AlinhamentoDeColuna = 'esquerda' | 'centro' | 'direita';

export interface ColunaDoArranjo {
  alinhamento: AlinhamentoDeColuna;
  /** Linhas verticais antes desta coluna (`|` em `array{c|c}`); `2` para `||`. */
  linhasAntes: number;
  /** Linhas tracejadas antes da coluna (`:`). */
  tracejadasAntes: number;
  /** Separação zero (ambientes `aligned`): a coluna cola na anterior. */
  colada?: boolean;
}

export interface LinhaDoArranjo {
  celulas: No[][];
  /** `\hline` antes desta linha (contagem); `\hdashline` conta em `tracejadas`. */
  linhasAntes: number;
  tracejadasAntes: number;
  /** `\\[1ex]`. */
  espacoDepois?: Medida;
  /** `\tag{…}`/`\tag*{…}` ou número automático em `align`/`gather`/`equation`; `null` = `\notag`. */
  etiqueta?: No[] | null;
  /** `\tag*`: sem parênteses. */
  etiquetaCrua?: boolean;
}

export interface Arranjo {
  tipo: 'arranjo';
  ambiente: string;
  linhas: LinhaDoArranjo[];
  colunas: ColunaDoArranjo[];
  /** Linhas verticais depois da última coluna. */
  linhasDepois: number;
  tracejadasDepois: number;
  /** `\hline` no fim. */
  linhasNoFim: number;
  tracejadasNoFim: number;
  delimitadorEsquerdo?: string;
  delimitadorDireito?: string;
  /** Espaçamento entre linhas (`\arraystretch`, `smallmatrix` compacto). */
  compacto?: boolean;
  /** `substack`, `smallmatrix`: em estilo texto/script. */
  estilo?: EstiloMatematico;
  /** Ambiente numerado (`equation`, `align`, `gather`): as linhas sem `\notag` recebem etiqueta. */
  numerado?: boolean;
}

export interface Etiqueta {
  tipo: 'etiqueta';
  corpo: No[];
  rotulo: No[];
  crua: boolean;
}

export interface Regra {
  tipo: 'regra';
  largura: Medida;
  altura: Medida;
  deslocamento?: Medida;
}

export interface Verbatim {
  tipo: 'verbatim';
  texto: string;
}

/** Erro de leitura: sai como `merror` com o texto; a fórmula não some. */
export interface Erro {
  tipo: 'erro';
  texto: string;
  mensagem: string;
}

/** Classe forçada (`\mathrel{…}`, `\mathbin{…}`): muda o espaçamento do que envolve. */
export interface ClasseForcada {
  tipo: 'classe';
  classe: ClasseDeAtomo;
  corpo: No[];
}

/** `\mathchoice{D}{T}{S}{SS}`: o construtor escolhe pelo estilo corrente. */
export interface Escolha {
  tipo: 'escolha';
  display: No[];
  text: No[];
  script: No[];
  scriptscript: No[];
}

/** `\\` fora de arranjo (quebra de linha em display). */
export interface Quebra {
  tipo: 'quebra';
  espaco?: Medida;
}

/** `\vcenter`, `\pmb`, `\reflectbox`, `\mathstrut`: envoltórios simples. */
export interface Envoltorio {
  tipo: 'envoltorio';
  especie: 'vcenter' | 'pmb' | 'reflectbox' | 'strut';
  corpo: No[];
}

/** `\href`, `\url`, `\includegraphics`, `\html*`: representados como texto, com aviso (fora do escopo). */
export interface Externo {
  tipo: 'externo';
  especie: 'href' | 'url' | 'imagem' | 'html';
  alvo: string;
  corpo: No[];
}

export type No =
  | Simbolo
  | Grupo
  | SupSub
  | Fracao
  | Raiz
  | Delimitado
  | DelimitadorDoMeio
  | DelimitadorComTamanho
  | Acento
  | Operador
  | Texto
  | Estilo
  | Tamanho
  | Cor
  | Espaco
  | Fantasma
  | Esmagar
  | Sobreposicao
  | Elevar
  | Cercadura
  | Linha
  | Chave
  | SetaExtensivel
  | Arranjo
  | Etiqueta
  | Regra
  | Verbatim
  | Erro
  | ClasseForcada
  | Escolha
  | Quebra
  | Envoltorio
  | Externo;

/** Aviso de leitura, com a posição (0-based) na fonte da fórmula. */
export interface AvisoDaFormula {
  posicao: number;
  texto: string;
}

export function grupo(pFilhos: No[]): Grupo {
  return { tipo: 'grupo', filhos: pFilhos };
}

export function simbolo(pClasse: ClasseDeAtomo, pTexto: string, pModo: 'math' | 'text' = 'math', pFonte?: FonteMatematica): Simbolo {
  const saida: Simbolo = { tipo: 'simbolo', classe: pClasse, texto: pTexto, modo: pModo };
  if (pFonte)
    saida.fonte = pFonte;
  return saida;
}

export function erro(pTexto: string, pMensagem: string): Erro {
  return { tipo: 'erro', texto: pTexto, mensagem: pMensagem };
}

/** Um grupo de um filho só é o próprio filho. */
export function desembrulhar(pNo: No): No {
  return pNo.tipo === 'grupo' && pNo.filhos.length === 1 ? desembrulhar(pNo.filhos[0]) : pNo;
}
