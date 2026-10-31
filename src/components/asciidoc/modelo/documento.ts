/**
 * Utilitários IMUTÁVEIS sobre o modelo: identidade, conteúdo inline (medir, fatiar, concatenar, normalizar) e o
 * percurso das FOLHAS — os nós editáveis — em ordem de leitura, com o caminho até cada um.
 */

import type {
  Atomo,
  Bloco,
  Celula,
  Documento,
  EspecieDeFolha,
  Folha,
  Inline,
  ItemDeChamada,
  ItemDeDescricao,
  ItemDeLista,
  Marca,
  TrechoDeTexto,
} from './tipos';

// ============================================================================
// Identidade
// ============================================================================

let contador = 0;

/** Id curto e único na sessão — só serve de chave do React e de endereço da seleção; nunca é persistido. */
export function novoID(): string {
  contador += 1;
  return `b${contador.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

// ============================================================================
// Inline
// ============================================================================

export function texto(pTexto: string, pMarcas: Marca[] = []): TrechoDeTexto {
  return { tipo: 'texto', texto: pTexto, marcas: pMarcas };
}

export function atomo(pEspecie: Atomo['especie'], pDados: Record<string, string> = {}): Atomo {
  return { tipo: 'atomo', especie: pEspecie, dados: pDados };
}

export function comprimentoInline(pConteudo: Inline[]): number {
  let total = 0;
  for (const parte of pConteudo)
    total += parte.tipo === 'texto' ? parte.texto.length : 1;
  return total;
}

/** O texto puro de uma folha; átomo vira um caractere de objeto (U+FFFC), para as posições baterem. */
export function textoPuro(pConteudo: Inline[]): string {
  let saida = '';
  for (const parte of pConteudo)
    saida += parte.tipo === 'texto' ? parte.texto : '￼';
  return saida;
}

export function marcasIguais(pA: Marca[], pB: Marca[]): boolean {
  if (pA.length !== pB.length)
    return false;
  for (const marca of pA)
    if (!pB.some((pM) => pM.tipo === marca.tipo && pM.valor === marca.valor))
      return false;
  return true;
}

export function temMarca(pMarcas: Marca[], pTipo: Marca['tipo']): Marca | undefined {
  return pMarcas.find((pM) => pM.tipo === pTipo);
}

/** Funde trechos vizinhos com as mesmas marcas e descarta trechos vazios. */
export function normalizarInline(pConteudo: Inline[]): Inline[] {
  const saida: Inline[] = [];
  for (const parte of pConteudo) {
    if (parte.tipo === 'texto' && parte.texto.length === 0)
      continue;
    const ultimo = saida[saida.length - 1];
    if (parte.tipo === 'texto' && ultimo && ultimo.tipo === 'texto' && marcasIguais(ultimo.marcas, parte.marcas))
      saida[saida.length - 1] = { ...ultimo, texto: ultimo.texto + parte.texto };
    else
      saida.push(parte);
  }
  return saida;
}

/** O pedaço [pIni, pFim) do conteúdo, cortando trechos de texto onde for preciso. */
export function fatiarInline(pConteudo: Inline[], pIni: number, pFim: number): Inline[] {
  const saida: Inline[] = [];
  let posicao = 0;
  for (const parte of pConteudo) {
    const tamanho = parte.tipo === 'texto' ? parte.texto.length : 1;
    const inicio = posicao;
    const final = posicao + tamanho;
    posicao = final;
    if (final <= pIni || inicio >= pFim)
      continue;
    if (parte.tipo === 'atomo') {
      saida.push(parte);
      continue;
    }
    const de = Math.max(pIni, inicio) - inicio;
    const ate = Math.min(pFim, final) - inicio;
    saida.push({ ...parte, texto: parte.texto.slice(de, ate) });
  }
  return normalizarInline(saida);
}

export function concatenarInline(...pPartes: Inline[][]): Inline[] {
  return normalizarInline(pPartes.flat());
}

/** As marcas vigentes na posição (as do caractere anterior; no início, as do primeiro). */
export function marcasNaPosicao(pConteudo: Inline[], pPosicao: number): Marca[] {
  let posicao = 0;
  let anterior: Inline | undefined;
  for (const parte of pConteudo) {
    const tamanho = parte.tipo === 'texto' ? parte.texto.length : 1;
    if (pPosicao > posicao && pPosicao <= posicao + tamanho)
      return parte.tipo === 'texto' ? parte.marcas : [];
    if (pPosicao === posicao && posicao === 0)
      return parte.tipo === 'texto' ? parte.marcas : [];
    posicao += tamanho;
    anterior = parte;
  }
  return anterior && anterior.tipo === 'texto' ? anterior.marcas : [];
}

/** O átomo que ocupa a posição, se houver. */
export function atomoNaPosicao(pConteudo: Inline[], pPosicao: number): Atomo | undefined {
  let posicao = 0;
  for (const parte of pConteudo) {
    const tamanho = parte.tipo === 'texto' ? parte.texto.length : 1;
    if (parte.tipo === 'atomo' && posicao === pPosicao)
      return parte;
    posicao += tamanho;
  }
  return undefined;
}

// ============================================================================
// Folhas em ordem de leitura
// ============================================================================

/** Onde a folha está: o nó, a espécie e a cadeia de blocos até ela (do documento para dentro). */
export interface FolhaEmContexto {
  folha: Folha;
  especie: EspecieDeFolha;
  /** Os blocos ancestrais, do mais externo ao bloco que contém a folha (inclusive). */
  cadeia: Bloco[];
  /** O item de lista/descrição que é a folha ou que a contém diretamente, quando houver. */
  item?: ItemDeLista | ItemDeDescricao | ItemDeChamada | Celula;
}

const cacheDeFolhas = new WeakMap<Documento, FolhaEmContexto[]>();

function percorrerBlocos(pBlocos: Bloco[], pCadeia: Bloco[], pSaida: FolhaEmContexto[]): void {
  for (const bloco of pBlocos) {
    const cadeia = [...pCadeia, bloco];
    switch (bloco.tipo) {
      case 'paragrafo':
        pSaida.push({ folha: bloco, especie: 'paragrafo', cadeia });
        break;
      case 'titulo':
        pSaida.push({ folha: bloco, especie: 'titulo', cadeia });
        break;
      case 'lista':
        for (const item of bloco.itens) {
          pSaida.push({ folha: item, especie: 'item', cadeia, item });
          percorrerBlocos(item.filhos, cadeia, pSaida);
        }
        break;
      case 'descricao':
        for (const item of bloco.itens) {
          pSaida.push({ folha: item, especie: 'termo', cadeia, item });
          percorrerBlocos(item.filhos, cadeia, pSaida);
        }
        break;
      case 'chamadas':
        for (const item of bloco.itens)
          pSaida.push({ folha: item, especie: 'chamada', cadeia, item });
        break;
      case 'admonicao':
      case 'container':
        percorrerBlocos(bloco.filhos, cadeia, pSaida);
        break;
      case 'tabela':
        for (const linha of bloco.linhas)
          for (const celula of linha.celulas)
            pSaida.push({ folha: celula, especie: 'celula', cadeia, item: celula });
        break;
      default:
        break;
    }
  }
}

/** Todas as folhas do documento, em ordem de leitura. Memoizado por documento (imutável). */
export function folhasDoDocumento(pDocumento: Documento): FolhaEmContexto[] {
  const guardado = cacheDeFolhas.get(pDocumento);
  if (guardado)
    return guardado;
  const saida: FolhaEmContexto[] = [];
  percorrerBlocos(pDocumento.blocos, [], saida);
  cacheDeFolhas.set(pDocumento, saida);
  return saida;
}

export function folhaPorID(pDocumento: Documento, pID: string): FolhaEmContexto | undefined {
  return folhasDoDocumento(pDocumento).find((pF) => pF.folha.id === pID);
}

export function indiceDaFolha(pDocumento: Documento, pID: string): number {
  return folhasDoDocumento(pDocumento).findIndex((pF) => pF.folha.id === pID);
}

/** A primeira folha do documento (ou `undefined` num documento sem texto). */
export function primeiraFolha(pDocumento: Documento): FolhaEmContexto | undefined {
  return folhasDoDocumento(pDocumento)[0];
}

// ============================================================================
// Blocos
// ============================================================================

export function encontrarBloco(pBlocos: Bloco[], pID: string): Bloco | undefined {
  for (const bloco of pBlocos) {
    if (bloco.id === pID)
      return bloco;
    const filhos = filhosDoBloco(bloco);
    for (const grupo of filhos) {
      const achado = encontrarBloco(grupo, pID);
      if (achado)
        return achado;
    }
  }
  return undefined;
}

/** Os grupos de blocos filhos de um bloco (lista de itens ⇒ um grupo por item). */
export function filhosDoBloco(pBloco: Bloco): Bloco[][] {
  switch (pBloco.tipo) {
    case 'lista':
    case 'descricao':
      return pBloco.itens.map((pItem) => pItem.filhos);
    case 'admonicao':
    case 'container':
      return [pBloco.filhos];
    default:
      return [];
  }
}

/** Todo o texto do documento, para contagem de palavras. */
export function textoDoDocumento(pDocumento: Documento): string {
  const partes: string[] = [];
  if (pDocumento.cabecalho?.titulo)
    partes.push(textoPuro(pDocumento.cabecalho.titulo));
  for (const folha of folhasDoDocumento(pDocumento))
    partes.push(textoPuro(folha.folha.conteudo));
  const codigos: string[] = [];
  const coletar = (pBlocos: Bloco[]): void => {
    for (const bloco of pBlocos) {
      if (bloco.tipo === 'codigo')
        codigos.push(bloco.codigo);
      for (const grupo of filhosDoBloco(bloco))
        coletar(grupo);
    }
  };
  coletar(pDocumento.blocos);
  return [...partes, ...codigos].join('\n');
}
