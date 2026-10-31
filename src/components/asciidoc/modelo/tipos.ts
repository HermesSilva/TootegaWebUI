/**
 * MODELO do editor AsciiDoc — a árvore semântica do documento (dono, 2026-10-28).
 *
 * O documento é uma árvore de BLOCOS. Todo bloco que carrega texto editável ("folha") tem `id` e `conteudo`: uma
 * sequência PLANA de trechos de texto com marcas e de átomos (imagem inline, referência, nota…). A posição dentro de
 * uma folha é um deslocamento de caractere, em que cada átomo conta 1 — a mesma ideia do ProseMirror, que torna
 * inserir, apagar e marcar operações sobre um vetor, e não sobre uma árvore de HTML.
 *
 * Tudo aqui é IMUTÁVEL: uma transação devolve um documento novo, compartilhando os blocos que não mudaram.
 */

// ============================================================================
// Inline
// ============================================================================

export type TipoDeMarca =
  | 'negrito'
  | 'italico'
  | 'mono'
  | 'realce'
  | 'sobrescrito'
  | 'subscrito'
  | 'sublinhado'
  | 'tachado'
  | 'link'
  | 'papel';

export interface Marca {
  tipo: TipoDeMarca;
  /** `link`: o destino; `papel`: o nome do papel (`[.papel]#texto#`). */
  valor?: string;
}

export interface TrechoDeTexto {
  tipo: 'texto';
  texto: string;
  marcas: Marca[];
}

export type EspecieDeAtomo =
  | 'imagem'
  | 'referencia'
  | 'ancora'
  | 'notaDeRodape'
  | 'tecla'
  | 'botao'
  | 'menu'
  | 'atributo'
  | 'quebraDeLinha'
  | 'passagem'
  | 'bruto';

/** Elemento inline indivisível: ocupa UMA posição e não tem texto editável por dentro. */
export interface Atomo {
  tipo: 'atomo';
  especie: EspecieDeAtomo;
  /** Os dados da espécie (`alvo`, `texto`, `id`, `alt`…). */
  dados: Record<string, string>;
}

export type Inline = TrechoDeTexto | Atomo;

// ============================================================================
// Blocos
// ============================================================================

interface BlocoBase {
  id: string;
  /** `.Título` acima do bloco. */
  titulo?: string;
  /** `[[id]]` ou `[#id]` acima do bloco. */
  ancora?: string;
  /** Papéis (`[.papel]`). */
  papeis?: string[];
  /** Linhas de atributo que o modelo não interpreta, guardadas como vieram (`[%opts, cols=…]`). */
  atributosBrutos?: string[];
}

export interface Paragrafo extends BlocoBase {
  tipo: 'paragrafo';
  conteudo: Inline[];
  /** `literal` = parágrafo indentado ou `[literal]`; `lead` = `[.lead]`. */
  estilo?: 'literal' | 'lead';
}

export interface Titulo extends BlocoBase {
  tipo: 'titulo';
  /** 1 = `==` (o `=` é o título do documento, no cabeçalho). */
  nivel: 1 | 2 | 3 | 4 | 5;
  conteudo: Inline[];
  discreto?: boolean;
}

export type EstiloDeLista = 'marcadores' | 'numerada' | 'tarefas';

export interface ItemDeLista {
  id: string;
  conteudo: Inline[];
  /** Só na lista de tarefas. */
  marcado?: boolean;
  /** Blocos anexados ao item (sublistas e continuações `+`). */
  filhos: Bloco[];
}

export interface Lista extends BlocoBase {
  tipo: 'lista';
  estilo: EstiloDeLista;
  itens: ItemDeLista[];
}

export interface ItemDeDescricao {
  id: string;
  /** O termo (antes do `::`). */
  conteudo: Inline[];
  /** A descrição: blocos. */
  filhos: Bloco[];
}

export interface ListaDeDescricao extends BlocoBase {
  tipo: 'descricao';
  itens: ItemDeDescricao[];
}

export interface ItemDeChamada {
  id: string;
  numero: number;
  conteudo: Inline[];
}

/** A lista de chamadas (`<1> explicação`) que segue um bloco de código. */
export interface ListaDeChamadas extends BlocoBase {
  tipo: 'chamadas';
  itens: ItemDeChamada[];
}

export interface Codigo extends BlocoBase {
  tipo: 'codigo';
  /** `fonte` = `[source]`/cercado; `listagem` = `----` sem linguagem; `literal` = `....` ou indentado. */
  estilo: 'fonte' | 'listagem' | 'literal';
  linguagem?: string;
  codigo: string;
}

export type EspecieDeAdmonicao = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

export interface Admonicao extends BlocoBase {
  tipo: 'admonicao';
  especie: EspecieDeAdmonicao;
  filhos: Bloco[];
}

export type EspecieDeContainer = 'exemplo' | 'barraLateral' | 'citacao' | 'verso' | 'aberto';

export interface Container extends BlocoBase {
  tipo: 'container';
  especie: EspecieDeContainer;
  /** Citação/verso: `[quote, autor, fonte]`. */
  autor?: string;
  fonte?: string;
  filhos: Bloco[];
}

export type AlinhamentoDeCelula = 'esquerda' | 'centro' | 'direita';

export interface Celula {
  id: string;
  conteudo: Inline[];
  colunas?: number;
  linhas?: number;
  alinhamento?: AlinhamentoDeCelula;
  /** `e` ênfase, `m` mono, `s` forte, `h` cabeçalho, `a` AsciiDoc, `l` literal. */
  estilo?: string;
}

export interface LinhaDaTabela {
  id: string;
  celulas: Celula[];
}

export interface Tabela extends BlocoBase {
  tipo: 'tabela';
  /** O valor de `cols=`, como veio (`"1,2,3"`, `"3*"`). */
  colunas?: string;
  numeroDeColunas: number;
  cabecalho: boolean;
  rodape: boolean;
  linhas: LinhaDaTabela[];
  /** Demais atributos da linha `[...]` (largura, opções), guardados para o round-trip. */
  outrosAtributos?: string;
}

export interface Imagem extends BlocoBase {
  tipo: 'imagem';
  alvo: string;
  alt?: string;
  largura?: string;
  altura?: string;
  /** Atributos além de alt, largura e altura, como vieram. */
  outrosAtributos?: string;
}

export interface Midia extends BlocoBase {
  tipo: 'midia';
  especie: 'video' | 'audio';
  alvo: string;
  atributos?: string;
}

export interface QuebraTematica extends BlocoBase {
  tipo: 'quebraTematica';
}

export interface QuebraDePagina extends BlocoBase {
  tipo: 'quebraDePagina';
}

export interface Sumario extends BlocoBase {
  tipo: 'sumario';
}

export interface Comentario extends BlocoBase {
  tipo: 'comentario';
  texto: string;
  /** `////` (bloco) ou `//` (linhas). */
  emBloco: boolean;
}

export interface Passagem extends BlocoBase {
  tipo: 'passagem';
  texto: string;
}

export interface AtributoDoDocumento extends BlocoBase {
  tipo: 'atributo';
  nome: string;
  valor: string;
}

/** O que o parser não reconhece — guardado linha a linha, como veio, para nada se perder. */
export interface Bruto extends BlocoBase {
  tipo: 'bruto';
  texto: string;
}

export type Bloco =
  | Paragrafo
  | Titulo
  | Lista
  | ListaDeDescricao
  | ListaDeChamadas
  | Codigo
  | Admonicao
  | Container
  | Tabela
  | Imagem
  | Midia
  | QuebraTematica
  | QuebraDePagina
  | Sumario
  | Comentario
  | Passagem
  | AtributoDoDocumento
  | Bruto;

// ============================================================================
// Documento
// ============================================================================

export interface CabecalhoDoDocumento {
  titulo?: Inline[];
  autores?: string;
  revisao?: string;
  atributos: { nome: string; valor: string }[];
}

export interface Documento {
  cabecalho?: CabecalhoDoDocumento;
  blocos: Bloco[];
}

/** Aviso do parser: algo foi lido de forma degradada (linha 1-based). */
export interface AvisoDoParser {
  linha: number;
  texto: string;
}

// ============================================================================
// Folhas (o que se edita)
// ============================================================================

/** Qualquer nó com `id` e `conteudo` — parágrafo, título, item, termo, célula, chamada. */
export interface Folha {
  id: string;
  conteudo: Inline[];
}

export type EspecieDeFolha = 'paragrafo' | 'titulo' | 'item' | 'termo' | 'celula' | 'chamada';

export const MARCAS_SIMPLES: readonly TipoDeMarca[] = ['negrito', 'italico', 'mono', 'realce', 'sublinhado', 'tachado', 'sobrescrito', 'subscrito'];
