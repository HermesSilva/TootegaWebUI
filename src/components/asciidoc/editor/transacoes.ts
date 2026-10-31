/**
 * TRANSAÇÕES — toda edição do modelo é uma função pura `(documento, …) → { documento, selecao }`. O documento de
 * entrada nunca é alterado: os blocos que não mudaram são os MESMOS objetos no documento de saída (compartilhamento
 * estrutural), o que torna o histórico barato e a re-renderização do React cirúrgica (memo por bloco).
 */

import {
  atomo,
  atomoNaPosicao,
  comprimentoInline,
  concatenarInline,
  fatiarInline,
  folhaPorID,
  folhasDoDocumento,
  marcasNaPosicao,
  normalizarInline,
  novoID,
  texto as trecho,
  type FolhaEmContexto,
} from '../modelo/documento';
import type {
  AlinhamentoDeCelula,
  Atomo,
  Bloco,
  Celula,
  Documento,
  EspecieDeAdmonicao,
  EspecieDeContainer,
  EstiloDeLista,
  Inline,
  ItemDeLista,
  Lista,
  Marca,
  Paragrafo,
  Tabela,
  TipoDeMarca,
  Titulo,
} from '../modelo/tipos';
import { ordenarSelecao, posicao, selecaoColapsada, type Selecao } from './selecao';

export interface Resultado {
  documento: Documento;
  selecao: Selecao | null;
}

type Visitante = (pBloco: Bloco) => Bloco | Bloco[] | null;

// ============================================================================
// Percurso imutável
// ============================================================================

function mapearFilhos(pBloco: Bloco, pFn: Visitante): Bloco {
  switch (pBloco.tipo) {
    case 'lista':
    case 'descricao': {
      let mudou = false;
      const itens = pBloco.itens.map((pItem) => {
        const filhos = mapearBlocos(pItem.filhos, pFn);
        if (filhos === pItem.filhos)
          return pItem;
        mudou = true;
        return { ...pItem, filhos };
      });
      return mudou ? ({ ...pBloco, itens } as Bloco) : pBloco;
    }
    case 'admonicao':
    case 'container': {
      const filhos = mapearBlocos(pBloco.filhos, pFn);
      return filhos === pBloco.filhos ? pBloco : { ...pBloco, filhos };
    }
    default:
      return pBloco;
  }
}

/** Visita cada bloco (filhos antes do pai); o visitante devolve o bloco, outro, vários ou nenhum. */
export function mapearBlocos(pBlocos: Bloco[], pFn: Visitante): Bloco[] {
  let mudou = false;
  const saida: Bloco[] = [];
  for (const bloco of pBlocos) {
    const comFilhos = mapearFilhos(bloco, pFn);
    const resultado = pFn(comFilhos);
    if (resultado !== bloco)
      mudou = true;
    if (resultado === null)
      continue;
    if (Array.isArray(resultado))
      saida.push(...resultado);
    else
      saida.push(resultado);
  }
  return mudou ? saida : pBlocos;
}

function comBlocos(pDocumento: Documento, pBlocos: Bloco[]): Documento {
  return pBlocos === pDocumento.blocos ? pDocumento : { ...pDocumento, blocos: pBlocos };
}

/** Substitui o conteúdo inline da folha `pID`, seja ela bloco, item, célula ou chamada. */
export function mapearConteudoDaFolha(pDocumento: Documento, pID: string, pFn: (pConteudo: Inline[]) => Inline[]): Documento {
  const blocos = mapearBlocos(pDocumento.blocos, (pBloco) => {
    switch (pBloco.tipo) {
      case 'paragrafo':
      case 'titulo':
        return pBloco.id === pID ? { ...pBloco, conteudo: normalizarInline(pFn(pBloco.conteudo)) } : pBloco;
      case 'lista':
      case 'descricao':
      case 'chamadas': {
        const indice = pBloco.itens.findIndex((pItem) => pItem.id === pID);
        if (indice === -1)
          return pBloco;
        const itens = [...pBloco.itens] as typeof pBloco.itens;
        itens[indice] = { ...itens[indice], conteudo: normalizarInline(pFn(itens[indice].conteudo)) } as never;
        return { ...pBloco, itens } as Bloco;
      }
      case 'tabela': {
        let mudou = false;
        const linhas = pBloco.linhas.map((pLinha) => {
          const indice = pLinha.celulas.findIndex((pCelula) => pCelula.id === pID);
          if (indice === -1)
            return pLinha;
          mudou = true;
          const celulas = [...pLinha.celulas];
          celulas[indice] = { ...celulas[indice], conteudo: normalizarInline(pFn(celulas[indice].conteudo)) };
          return { ...pLinha, celulas };
        });
        return mudou ? { ...pBloco, linhas } : pBloco;
      }
      default:
        return pBloco;
    }
  });
  return comBlocos(pDocumento, blocos);
}

/** Remove a folha: bloco some; item sai da lista (lista vazia some); célula só esvazia. */
export function removerFolha(pDocumento: Documento, pID: string): Documento {
  const blocos = mapearBlocos(pDocumento.blocos, (pBloco) => {
    switch (pBloco.tipo) {
      case 'paragrafo':
      case 'titulo':
        return pBloco.id === pID ? null : pBloco;
      case 'lista':
      case 'descricao':
      case 'chamadas': {
        if (!pBloco.itens.some((pItem) => pItem.id === pID))
          return pBloco;
        const itens = pBloco.itens.filter((pItem) => pItem.id !== pID);
        return itens.length === 0 ? null : ({ ...pBloco, itens } as Bloco);
      }
      case 'tabela':
        return pBloco.linhas.some((pLinha) => pLinha.celulas.some((pCelula) => pCelula.id === pID))
          ? mapearConteudoDaFolha({ blocos: [pBloco] }, pID, () => []).blocos[0]
          : pBloco;
      default:
        return pBloco;
    }
  });
  return comBlocos(pDocumento, blocos);
}

export function substituirBloco(pDocumento: Documento, pID: string, pFn: (pBloco: Bloco) => Bloco | Bloco[] | null): Documento {
  return comBlocos(pDocumento, mapearBlocos(pDocumento.blocos, (pBloco) => (pBloco.id === pID ? pFn(pBloco) : pBloco)));
}

export function atualizarBloco<T extends Bloco>(pDocumento: Documento, pID: string, pMudanca: Partial<T>): Documento {
  return substituirBloco(pDocumento, pID, (pBloco) => ({ ...pBloco, ...pMudanca }) as Bloco);
}

export function removerBloco(pDocumento: Documento, pID: string): Documento {
  return garantirEditavel(substituirBloco(pDocumento, pID, () => null));
}

/** Insere blocos logo depois do bloco `pID` (no mesmo nível). */
export function inserirBlocosApos(pDocumento: Documento, pID: string, pNovos: Bloco[]): Documento {
  return substituirBloco(pDocumento, pID, (pBloco) => [pBloco, ...pNovos]);
}

export function inserirBlocosAntes(pDocumento: Documento, pID: string, pNovos: Bloco[]): Documento {
  return substituirBloco(pDocumento, pID, (pBloco) => [...pNovos, pBloco]);
}

/** O bloco "âncora" da folha para inserções de bloco: o próprio bloco, ou a lista/tabela que contém o item/célula. */
export function blocoDaFolha(pFolha: FolhaEmContexto): Bloco {
  return pFolha.cadeia[pFolha.cadeia.length - 1];
}

/** Todo container tem ao menos um parágrafo, e o documento também: sempre há onde escrever. */
export function garantirEditavel(pDocumento: Documento): Documento {
  let documento = comBlocos(
    pDocumento,
    mapearBlocos(pDocumento.blocos, (pBloco) => {
      if ((pBloco.tipo === 'admonicao' || pBloco.tipo === 'container') && pBloco.filhos.length === 0)
        return { ...pBloco, filhos: [paragrafoVazio()] };
      if ((pBloco.tipo === 'lista' || pBloco.tipo === 'descricao' || pBloco.tipo === 'chamadas') && pBloco.itens.length === 0)
        return null;
      return pBloco;
    }),
  );
  if (documento.blocos.length === 0)
    documento = { ...documento, blocos: [paragrafoVazio()] };
  return documento;
}

export function paragrafoVazio(pConteudo: Inline[] = []): Paragrafo {
  return { id: novoID(), tipo: 'paragrafo', conteudo: pConteudo };
}

// ============================================================================
// Texto
// ============================================================================

function marcasParaInserir(pFolha: FolhaEmContexto, pDeslocamento: number, pPendentes?: Marca[]): Marca[] {
  if (pPendentes)
    return pPendentes;
  const marcas = marcasNaPosicao(pFolha.folha.conteudo, pDeslocamento);
  // Link não se estende ao que se digita depois dele.
  return pDeslocamento === comprimentoInline(pFolha.folha.conteudo) ? marcas.filter((pM) => pM.tipo !== 'link') : marcas;
}

export function inserirTexto(pDocumento: Documento, pSelecao: Selecao, pTexto: string, pMarcasPendentes?: Marca[]): Resultado {
  const apagado = apagarIntervalo(pDocumento, pSelecao);
  const ponto = apagado.selecao?.ancora;
  if (!ponto)
    return apagado;
  const folha = folhaPorID(apagado.documento, ponto.folha);
  if (!folha)
    return apagado;
  const marcas = marcasParaInserir(folha, ponto.deslocamento, pMarcasPendentes);
  const documento = mapearConteudoDaFolha(apagado.documento, ponto.folha, (pConteudo) =>
    concatenarInline(fatiarInline(pConteudo, 0, ponto.deslocamento), [trecho(pTexto, marcas)], fatiarInline(pConteudo, ponto.deslocamento, comprimentoInline(pConteudo))),
  );
  return { documento, selecao: selecaoColapsada(ponto.folha, ponto.deslocamento + pTexto.length) };
}

export function inserirAtomo(pDocumento: Documento, pSelecao: Selecao, pAtomo: Atomo): Resultado {
  const apagado = apagarIntervalo(pDocumento, pSelecao);
  const ponto = apagado.selecao?.ancora;
  if (!ponto)
    return apagado;
  const documento = mapearConteudoDaFolha(apagado.documento, ponto.folha, (pConteudo) =>
    concatenarInline(fatiarInline(pConteudo, 0, ponto.deslocamento), [pAtomo], fatiarInline(pConteudo, ponto.deslocamento, comprimentoInline(pConteudo))),
  );
  return { documento, selecao: selecaoColapsada(ponto.folha, ponto.deslocamento + 1) };
}

/** Substitui o conteúdo inteiro de uma folha (usado na leitura de volta do DOM após composição/correção). */
export function substituirConteudo(pDocumento: Documento, pID: string, pConteudo: Inline[], pDeslocamento: number): Resultado {
  const documento = mapearConteudoDaFolha(pDocumento, pID, () => pConteudo);
  return { documento, selecao: selecaoColapsada(pID, Math.min(pDeslocamento, comprimentoInline(pConteudo))) };
}

/** Apaga o intervalo selecionado; colapsada, não faz nada. */
export function apagarIntervalo(pDocumento: Documento, pSelecao: Selecao): Resultado {
  const { inicio, fim } = ordenarSelecao(pDocumento, pSelecao);
  if (inicio.folha === fim.folha) {
    if (inicio.deslocamento === fim.deslocamento)
      return { documento: pDocumento, selecao: selecaoColapsada(inicio.folha, inicio.deslocamento) };
    const documento = mapearConteudoDaFolha(pDocumento, inicio.folha, (pConteudo) =>
      concatenarInline(fatiarInline(pConteudo, 0, inicio.deslocamento), fatiarInline(pConteudo, fim.deslocamento, comprimentoInline(pConteudo))),
    );
    return { documento, selecao: selecaoColapsada(inicio.folha, inicio.deslocamento) };
  }

  const folhas = folhasDoDocumento(pDocumento);
  const de = folhas.findIndex((pF) => pF.folha.id === inicio.folha);
  const ate = folhas.findIndex((pF) => pF.folha.id === fim.folha);
  if (de === -1 || ate === -1)
    return { documento: pDocumento, selecao: pSelecao };
  const primeira = folhas[de];
  const ultima = folhas[ate];
  const atravessaCelula = primeira.especie === 'celula' || ultima.especie === 'celula';

  let documento = pDocumento;
  // Cabeça da primeira folha.
  const cauda = atravessaCelula ? [] : fatiarInline(ultima.folha.conteudo, fim.deslocamento, comprimentoInline(ultima.folha.conteudo));
  documento = mapearConteudoDaFolha(documento, primeira.folha.id, (pConteudo) => concatenarInline(fatiarInline(pConteudo, 0, inicio.deslocamento), cauda));
  // As do meio somem (célula só esvazia).
  for (let i = de + 1; i < ate; i++)
    documento = removerFolha(documento, folhas[i].folha.id);
  // A última: some (foi fundida) ou, atravessando célula, perde só a cabeça.
  if (atravessaCelula)
    documento = mapearConteudoDaFolha(documento, ultima.folha.id, (pConteudo) => fatiarInline(pConteudo, fim.deslocamento, comprimentoInline(pConteudo)));
  else
    documento = removerFolha(documento, ultima.folha.id);
  return { documento: garantirEditavel(documento), selecao: selecaoColapsada(primeira.folha.id, inicio.deslocamento) };
}

/** Backspace com seleção colapsada. */
export function apagarParaTras(pDocumento: Documento, pSelecao: Selecao): Resultado {
  const ponto = pSelecao.ancora;
  const folha = folhaPorID(pDocumento, ponto.folha);
  if (!folha)
    return { documento: pDocumento, selecao: pSelecao };
  if (ponto.deslocamento > 0)
    return apagarIntervalo(pDocumento, { ancora: posicao(ponto.folha, ponto.deslocamento - 1), foco: ponto });
  return unirComAnterior(pDocumento, folha);
}

/** Delete com seleção colapsada. */
export function apagarParaFrente(pDocumento: Documento, pSelecao: Selecao): Resultado {
  const ponto = pSelecao.ancora;
  const folha = folhaPorID(pDocumento, ponto.folha);
  if (!folha)
    return { documento: pDocumento, selecao: pSelecao };
  const tamanho = comprimentoInline(folha.folha.conteudo);
  if (ponto.deslocamento < tamanho)
    return apagarIntervalo(pDocumento, { ancora: ponto, foco: posicao(ponto.folha, ponto.deslocamento + 1) });
  const folhas = folhasDoDocumento(pDocumento);
  const indice = folhas.findIndex((pF) => pF.folha.id === ponto.folha);
  const proxima = folhas[indice + 1];
  if (!proxima || proxima.especie === 'celula' || folha.especie === 'celula')
    return { documento: pDocumento, selecao: pSelecao };
  return apagarIntervalo(pDocumento, { ancora: ponto, foco: posicao(proxima.folha.id, 0) });
}

function unirComAnterior(pDocumento: Documento, pFolha: FolhaEmContexto): Resultado {
  const folhas = folhasDoDocumento(pDocumento);
  const indice = folhas.findIndex((pF) => pF.folha.id === pFolha.folha.id);
  const anterior = indice > 0 ? folhas[indice - 1] : undefined;
  const bloco = blocoDaFolha(pFolha);
  const selecaoAtual = selecaoColapsada(pFolha.folha.id, 0);

  switch (pFolha.especie) {
    case 'titulo':
      return { documento: substituirBloco(pDocumento, bloco.id, (pB) => paragrafoDe(pB as Titulo)), selecao: selecaoAtual };
    case 'item': {
      const listas = pFolha.cadeia.filter((pB) => pB.tipo === 'lista');
      if (listas.length > 1)
        return recuarItem(pDocumento, pFolha, -1);
      return elevarItemAParagrafo(pDocumento, pFolha);
    }
    case 'celula':
    case 'termo':
    case 'chamada': {
      if (pFolha.especie !== 'celula' && comprimentoInline(pFolha.folha.conteudo) === 0 && (pFolha.especie === 'chamada' || (pFolha.item as { filhos?: Bloco[] }).filhos?.length === 0)) {
        const documento = garantirEditavel(removerFolha(pDocumento, pFolha.folha.id));
        return { documento, selecao: anterior ? selecaoColapsada(anterior.folha.id, comprimentoInline(anterior.folha.conteudo)) : null };
      }
      return { documento: pDocumento, selecao: anterior ? selecaoColapsada(anterior.folha.id, comprimentoInline(anterior.folha.conteudo)) : selecaoAtual };
    }
    default:
      break;
  }

  // Parágrafo: primeiro filho de um container ⇒ sai dele; senão, funde com a folha anterior.
  const pai = pFolha.cadeia[pFolha.cadeia.length - 2];
  if (pai && (pai.tipo === 'admonicao' || pai.tipo === 'container') && pai.filhos[0]?.id === pFolha.folha.id) {
    const documento = substituirBloco(pDocumento, pai.id, (pB) => {
      const container = pB as Bloco & { filhos: Bloco[] };
      const resto = container.filhos.slice(1);
      return resto.length === 0 ? [container.filhos[0]] : [container.filhos[0], { ...container, filhos: resto } as Bloco];
    });
    return { documento, selecao: selecaoAtual };
  }
  if (!anterior)
    return { documento: pDocumento, selecao: selecaoAtual };
  if (anterior.especie === 'celula' || anterior.especie === 'termo' || anterior.especie === 'chamada')
    return { documento: pDocumento, selecao: selecaoColapsada(anterior.folha.id, comprimentoInline(anterior.folha.conteudo)) };
  const destino = comprimentoInline(anterior.folha.conteudo);
  return apagarIntervalo(pDocumento, { ancora: posicao(anterior.folha.id, destino), foco: posicao(pFolha.folha.id, 0) });
}

function paragrafoDe(pTitulo: Titulo): Paragrafo {
  const paragrafo: Paragrafo = { id: pTitulo.id, tipo: 'paragrafo', conteudo: pTitulo.conteudo };
  if (pTitulo.titulo !== undefined)
    paragrafo.titulo = pTitulo.titulo;
  if (pTitulo.ancora !== undefined)
    paragrafo.ancora = pTitulo.ancora;
  return paragrafo;
}

// ============================================================================
// Dividir (Enter)
// ============================================================================

export function dividirBloco(pDocumento: Documento, pSelecao: Selecao): Resultado {
  const apagado = apagarIntervalo(pDocumento, pSelecao);
  const ponto = apagado.selecao?.ancora;
  if (!ponto)
    return apagado;
  const documento = apagado.documento;
  const folha = folhaPorID(documento, ponto.folha);
  if (!folha)
    return apagado;
  const conteudo = folha.folha.conteudo;
  const tamanho = comprimentoInline(conteudo);
  const cabeca = fatiarInline(conteudo, 0, ponto.deslocamento);
  const cauda = fatiarInline(conteudo, ponto.deslocamento, tamanho);
  const bloco = blocoDaFolha(folha);

  switch (folha.especie) {
    case 'paragrafo':
    case 'titulo': {
      const novo = paragrafoVazio(cauda);
      const resultado = substituirBloco(documento, bloco.id, (pB) => [{ ...pB, conteudo: cabeca } as Bloco, novo]);
      return { documento: resultado, selecao: selecaoColapsada(novo.id, 0) };
    }
    case 'item': {
      const item = folha.item as ItemDeLista;
      if (tamanho === 0 && item.filhos.length === 0) {
        const listas = folha.cadeia.filter((pB) => pB.tipo === 'lista');
        return listas.length > 1 ? recuarItem(documento, folha, -1) : elevarItemAParagrafo(documento, folha);
      }
      const novo: ItemDeLista = { id: novoID(), conteudo: cauda, filhos: [] };
      if (item.marcado !== undefined)
        novo.marcado = false;
      const resultado = substituirBloco(documento, bloco.id, (pB) => {
        const lista = pB as Lista;
        const indice = lista.itens.findIndex((pI) => pI.id === item.id);
        const itens = [...lista.itens];
        itens[indice] = { ...itens[indice], conteudo: cabeca };
        itens.splice(indice + 1, 0, novo);
        return { ...lista, itens };
      });
      return { documento: resultado, selecao: selecaoColapsada(novo.id, 0) };
    }
    case 'termo': {
      // Enter no termo vai para a descrição (criando o parágrafo quando não há).
      const item = folha.item as { id: string; filhos: Bloco[] };
      const primeiro = item.filhos[0];
      if (primeiro && (primeiro.tipo === 'paragrafo' || primeiro.tipo === 'titulo'))
        return { documento, selecao: selecaoColapsada(primeiro.id, 0) };
      const novo = paragrafoVazio();
      const resultado = substituirBloco(documento, bloco.id, (pB) => {
        const lista = pB as Bloco & { itens: { id: string; filhos: Bloco[] }[] };
        const itens = lista.itens.map((pI) => (pI.id === item.id ? { ...pI, filhos: [novo, ...pI.filhos] } : pI));
        return { ...lista, itens } as Bloco;
      });
      return { documento: resultado, selecao: selecaoColapsada(novo.id, 0) };
    }
    case 'chamada': {
      const chamadas = bloco as Bloco & { tipo: 'chamadas' };
      const atual = chamadas.itens.find((pI) => pI.id === folha.folha.id);
      const novo = { id: novoID(), numero: (atual?.numero ?? 0) + 1, conteudo: cauda };
      const resultado = substituirBloco(documento, bloco.id, (pB) => {
        const lista = pB as Bloco & { tipo: 'chamadas' };
        const indice = lista.itens.findIndex((pI) => pI.id === folha.folha.id);
        const itens = [...lista.itens];
        itens[indice] = { ...itens[indice], conteudo: cabeca };
        itens.splice(indice + 1, 0, novo);
        return { ...lista, itens };
      });
      return { documento: resultado, selecao: selecaoColapsada(novo.id, 0) };
    }
    case 'celula':
    default:
      return inserirAtomo(documento, selecaoColapsada(ponto.folha, ponto.deslocamento), atomo('quebraDeLinha'));
  }
}

// ============================================================================
// Marcas
// ============================================================================

function aplicarMarcaNoConteudo(pConteudo: Inline[], pIni: number, pFim: number, pMarca: Marca, pAdicionar: boolean): Inline[] {
  const antes = fatiarInline(pConteudo, 0, pIni);
  const meio = fatiarInline(pConteudo, pIni, pFim).map((pParte) => {
    if (pParte.tipo !== 'texto')
      return pParte;
    const semEla = pParte.marcas.filter((pM) => pM.tipo !== pMarca.tipo);
    return { ...pParte, marcas: pAdicionar ? [...semEla, pMarca] : semEla };
  });
  const depois = fatiarInline(pConteudo, pFim, comprimentoInline(pConteudo));
  return concatenarInline(antes, meio, depois);
}

/** A seleção inteira já tem a marca? (só conta texto; átomos são neutros). */
export function selecaoTemMarca(pDocumento: Documento, pSelecao: Selecao, pTipo: TipoDeMarca): boolean {
  const { inicio, fim } = ordenarSelecao(pDocumento, pSelecao);
  const folhas = folhasDoDocumento(pDocumento);
  const de = folhas.findIndex((pF) => pF.folha.id === inicio.folha);
  const ate = folhas.findIndex((pF) => pF.folha.id === fim.folha);
  if (de === -1 || ate === -1)
    return false;
  let algumTexto = false;
  for (let i = de; i <= ate; i++) {
    const conteudo = folhas[i].folha.conteudo;
    const a = i === de ? inicio.deslocamento : 0;
    const b = i === ate ? fim.deslocamento : comprimentoInline(conteudo);
    for (const parte of fatiarInline(conteudo, a, b)) {
      if (parte.tipo !== 'texto')
        continue;
      algumTexto = true;
      if (!parte.marcas.some((pM) => pM.tipo === pTipo))
        return false;
    }
  }
  return algumTexto;
}

/** Liga ou desliga a marca na seleção; com `pForcar`, aplica exatamente esse estado (link com valor novo). */
export function alternarMarca(pDocumento: Documento, pSelecao: Selecao, pMarca: Marca, pForcar?: boolean): Resultado {
  const adicionar = pForcar ?? !selecaoTemMarca(pDocumento, pSelecao, pMarca.tipo);
  const { inicio, fim } = ordenarSelecao(pDocumento, pSelecao);
  const folhas = folhasDoDocumento(pDocumento);
  const de = folhas.findIndex((pF) => pF.folha.id === inicio.folha);
  const ate = folhas.findIndex((pF) => pF.folha.id === fim.folha);
  let documento = pDocumento;
  for (let i = de; i <= ate; i++) {
    const folha = folhas[i];
    const a = i === de ? inicio.deslocamento : 0;
    const b = i === ate ? fim.deslocamento : comprimentoInline(folha.folha.conteudo);
    if (a === b)
      continue;
    documento = mapearConteudoDaFolha(documento, folha.folha.id, (pConteudo) => aplicarMarcaNoConteudo(pConteudo, a, b, pMarca, adicionar));
  }
  return { documento, selecao: pSelecao };
}

export function limparMarcas(pDocumento: Documento, pSelecao: Selecao): Resultado {
  const { inicio, fim } = ordenarSelecao(pDocumento, pSelecao);
  const folhas = folhasDoDocumento(pDocumento);
  const de = folhas.findIndex((pF) => pF.folha.id === inicio.folha);
  const ate = folhas.findIndex((pF) => pF.folha.id === fim.folha);
  let documento = pDocumento;
  for (let i = de; i <= ate; i++) {
    const folha = folhas[i];
    const a = i === de ? inicio.deslocamento : 0;
    const b = i === ate ? fim.deslocamento : comprimentoInline(folha.folha.conteudo);
    documento = mapearConteudoDaFolha(documento, folha.folha.id, (pConteudo) =>
      concatenarInline(
        fatiarInline(pConteudo, 0, a),
        fatiarInline(pConteudo, a, b).map((pP) => (pP.tipo === 'texto' ? { ...pP, marcas: [] } : pP)),
        fatiarInline(pConteudo, b, comprimentoInline(pConteudo)),
      ),
    );
  }
  return { documento, selecao: pSelecao };
}

// ============================================================================
// Tipo de bloco
// ============================================================================

export type TipoDeBlocoDeTexto = 'paragrafo' | 'titulo1' | 'titulo2' | 'titulo3' | 'titulo4' | 'titulo5' | 'literal' | 'citacao' | 'codigo';

/** Converte o bloco da folha corrente (item vira parágrafo antes). */
export function definirTipoDeBloco(pDocumento: Documento, pSelecao: Selecao, pTipo: TipoDeBlocoDeTexto): Resultado {
  let folha = folhaPorID(pDocumento, pSelecao.foco.folha);
  if (!folha)
    return { documento: pDocumento, selecao: pSelecao };
  let documento = pDocumento;
  if (folha.especie === 'item') {
    const elevado = elevarItemAParagrafo(documento, folha);
    documento = elevado.documento;
    folha = elevado.selecao ? folhaPorID(documento, elevado.selecao.foco.folha) : undefined;
    if (!folha)
      return elevado;
  }
  if (folha.especie !== 'paragrafo' && folha.especie !== 'titulo')
    return { documento, selecao: pSelecao };
  const bloco = blocoDaFolha(folha) as Paragrafo | Titulo;
  const base = { id: bloco.id, titulo: bloco.titulo, ancora: bloco.ancora, papeis: bloco.papeis, atributosBrutos: bloco.atributosBrutos };
  const limpo = Object.fromEntries(Object.entries(base).filter(([, pV]) => pV !== undefined)) as { id: string };
  const selecao = selecaoColapsada(bloco.id, Math.min(pSelecao.foco.deslocamento, comprimentoInline(bloco.conteudo)));
  switch (pTipo) {
    case 'paragrafo':
      return { documento: substituirBloco(documento, bloco.id, () => ({ ...limpo, tipo: 'paragrafo', conteudo: bloco.conteudo })), selecao };
    case 'literal':
      return { documento: substituirBloco(documento, bloco.id, () => ({ ...limpo, tipo: 'paragrafo', conteudo: bloco.conteudo, estilo: 'literal' })), selecao };
    case 'citacao': {
      const paragrafo: Paragrafo = { ...limpo, tipo: 'paragrafo', conteudo: bloco.conteudo };
      return { documento: substituirBloco(documento, bloco.id, () => ({ id: novoID(), tipo: 'container', especie: 'citacao', filhos: [paragrafo] })), selecao };
    }
    case 'codigo': {
      const codigo: Bloco = { ...limpo, tipo: 'codigo', estilo: 'fonte', codigo: textoDoConteudo(bloco.conteudo) };
      return { documento: substituirBloco(documento, bloco.id, () => codigo), selecao: null };
    }
    default: {
      const nivel = Number(pTipo.slice(-1)) as 1 | 2 | 3 | 4 | 5;
      return { documento: substituirBloco(documento, bloco.id, () => ({ ...limpo, tipo: 'titulo', nivel, conteudo: bloco.conteudo })), selecao };
    }
  }
}

function textoDoConteudo(pConteudo: Inline[]): string {
  return pConteudo.map((pP) => (pP.tipo === 'texto' ? pP.texto : pP.especie === 'quebraDeLinha' ? '\n' : '')).join('');
}

/** Embrulha o bloco da folha num container (admonição, exemplo, barra lateral…). */
export function embrulharEmContainer(pDocumento: Documento, pSelecao: Selecao, pContainer: { tipo: 'admonicao'; especie: EspecieDeAdmonicao } | { tipo: 'container'; especie: EspecieDeContainer }): Resultado {
  const folha = folhaPorID(pDocumento, pSelecao.foco.folha);
  if (!folha)
    return { documento: pDocumento, selecao: pSelecao };
  const bloco = blocoDaFolha(folha);
  const documento = substituirBloco(pDocumento, bloco.id, (pB) =>
    pContainer.tipo === 'admonicao'
      ? { id: novoID(), tipo: 'admonicao', especie: pContainer.especie, filhos: [pB] }
      : { id: novoID(), tipo: 'container', especie: pContainer.especie, filhos: [pB] },
  );
  return { documento, selecao: pSelecao };
}

// ============================================================================
// Listas
// ============================================================================

function fundirListasVizinhas(pBlocos: Bloco[]): Bloco[] {
  const saida: Bloco[] = [];
  for (const bloco of pBlocos) {
    const anterior = saida[saida.length - 1];
    if (bloco.tipo === 'lista' && anterior && anterior.tipo === 'lista' && anterior.estilo === bloco.estilo && !bloco.titulo && !bloco.ancora) {
      saida[saida.length - 1] = { ...anterior, itens: [...anterior.itens, ...bloco.itens] };
      continue;
    }
    saida.push(bloco);
  }
  return saida;
}

function fundirListasEmTodaParte(pDocumento: Documento): Documento {
  const blocos = mapearBlocos(pDocumento.blocos, (pBloco) => {
    switch (pBloco.tipo) {
      case 'admonicao':
      case 'container':
        return { ...pBloco, filhos: fundirListasVizinhas(pBloco.filhos) };
      case 'lista':
      case 'descricao':
        return { ...pBloco, itens: pBloco.itens.map((pI) => ({ ...pI, filhos: fundirListasVizinhas(pI.filhos) })) } as Bloco;
      default:
        return pBloco;
    }
  });
  return { ...pDocumento, blocos: fundirListasVizinhas(blocos) };
}

/** Parágrafo vira item; item de outra lista muda o estilo da lista; item da mesma volta a parágrafo. */
export function alternarLista(pDocumento: Documento, pSelecao: Selecao, pEstilo: EstiloDeLista): Resultado {
  const folha = folhaPorID(pDocumento, pSelecao.foco.folha);
  if (!folha)
    return { documento: pDocumento, selecao: pSelecao };
  if (folha.especie === 'item') {
    const lista = blocoDaFolha(folha) as Lista;
    if (lista.estilo === pEstilo)
      return elevarItemAParagrafo(pDocumento, folha);
    const documento = substituirBloco(pDocumento, lista.id, (pB) => ({
      ...(pB as Lista),
      estilo: pEstilo,
      itens: (pB as Lista).itens.map((pI) => (pEstilo === 'tarefas' ? { ...pI, marcado: pI.marcado ?? false } : pI)),
    }));
    return { documento, selecao: pSelecao };
  }
  if (folha.especie !== 'paragrafo' && folha.especie !== 'titulo')
    return { documento: pDocumento, selecao: pSelecao };
  const bloco = blocoDaFolha(folha) as Paragrafo | Titulo;
  const item: ItemDeLista = { id: bloco.id, conteudo: bloco.conteudo, filhos: [] };
  if (pEstilo === 'tarefas')
    item.marcado = false;
  const lista: Lista = { id: novoID(), tipo: 'lista', estilo: pEstilo, itens: [item] };
  const documento = fundirListasEmTodaParte(substituirBloco(pDocumento, bloco.id, () => lista));
  return { documento, selecao: pSelecao };
}

/** O item vira parágrafo no nível da lista, partindo a lista em duas quando preciso; os filhos vêm junto. */
export function elevarItemAParagrafo(pDocumento: Documento, pFolha: FolhaEmContexto): Resultado {
  const lista = blocoDaFolha(pFolha) as Lista;
  const item = pFolha.item as ItemDeLista;
  const documento = substituirBloco(pDocumento, lista.id, (pB) => {
    const l = pB as Lista;
    const indice = l.itens.findIndex((pI) => pI.id === item.id);
    const antes = l.itens.slice(0, indice);
    const depois = l.itens.slice(indice + 1);
    const saida: Bloco[] = [];
    if (antes.length > 0)
      saida.push({ ...l, itens: antes });
    saida.push({ id: item.id, tipo: 'paragrafo', conteudo: item.conteudo }, ...item.filhos);
    if (depois.length > 0)
      saida.push({ ...l, id: novoID(), itens: depois, titulo: undefined, ancora: undefined } as Lista);
    return saida;
  });
  return { documento: garantirEditavel(documento), selecao: selecaoColapsada(item.id, 0) };
}

/** Recua (+1) ou avança (-1) o item na hierarquia da lista. */
export function recuarItem(pDocumento: Documento, pFolha: FolhaEmContexto, pDirecao: 1 | -1): Resultado {
  if (pFolha.especie !== 'item')
    return { documento: pDocumento, selecao: selecaoColapsada(pFolha.folha.id, 0) };
  const lista = blocoDaFolha(pFolha) as Lista;
  const item = pFolha.item as ItemDeLista;
  const selecao = selecaoColapsada(item.id, 0);

  if (pDirecao === 1) {
    const indice = lista.itens.findIndex((pI) => pI.id === item.id);
    if (indice === 0)
      return { documento: pDocumento, selecao };
    const documento = substituirBloco(pDocumento, lista.id, (pB) => {
      const l = pB as Lista;
      const itens = [...l.itens];
      const anterior = itens[indice - 1];
      const ultimoFilho = anterior.filhos[anterior.filhos.length - 1];
      const filhos =
        ultimoFilho && ultimoFilho.tipo === 'lista' && ultimoFilho.estilo === l.estilo
          ? [...anterior.filhos.slice(0, -1), { ...ultimoFilho, itens: [...ultimoFilho.itens, item] }]
          : [...anterior.filhos, { id: novoID(), tipo: 'lista', estilo: l.estilo, itens: [item] } as Lista];
      itens[indice - 1] = { ...anterior, filhos };
      itens.splice(indice, 1);
      return { ...l, itens };
    });
    return { documento, selecao };
  }

  // Avançar: o item sobe para a lista-mãe, logo depois do item que o continha; os irmãos seguintes viram filhos dele.
  const listas = pFolha.cadeia.filter((pB) => pB.tipo === 'lista') as Lista[];
  const mae = listas[listas.length - 2];
  if (!mae)
    return { documento: pDocumento, selecao };
  const documento = substituirBloco(pDocumento, mae.id, (pB) => {
    const m = pB as Lista;
    const indiceMae = m.itens.findIndex((pI) => pI.filhos.some((pF) => pF.id === lista.id));
    if (indiceMae === -1)
      return m;
    const itemMae = m.itens[indiceMae];
    const filha = itemMae.filhos.find((pF) => pF.id === lista.id) as Lista;
    const indice = filha.itens.findIndex((pI) => pI.id === item.id);
    const antes = filha.itens.slice(0, indice);
    const depois = filha.itens.slice(indice + 1);
    const filhosDaMae = itemMae.filhos.flatMap((pF) => (pF.id === lista.id ? (antes.length > 0 ? [{ ...filha, itens: antes }] : []) : [pF]));
    const promovido: ItemDeLista = { ...item, filhos: depois.length > 0 ? [...item.filhos, { ...filha, id: novoID(), itens: depois }] : item.filhos };
    const itens = [...m.itens];
    itens[indiceMae] = { ...itemMae, filhos: filhosDaMae };
    itens.splice(indiceMae + 1, 0, promovido);
    return { ...m, itens };
  });
  return { documento, selecao };
}

export function alternarTarefa(pDocumento: Documento, pItemID: string): Documento {
  return comBlocos(
    pDocumento,
    mapearBlocos(pDocumento.blocos, (pBloco) => {
      if (pBloco.tipo !== 'lista' || !pBloco.itens.some((pI) => pI.id === pItemID))
        return pBloco;
      return { ...pBloco, itens: pBloco.itens.map((pI) => (pI.id === pItemID ? { ...pI, marcado: !pI.marcado } : pI)) };
    }),
  );
}

// ============================================================================
// Tabela
// ============================================================================

function celulaVazia(): Celula {
  return { id: novoID(), conteudo: [] };
}

export function novaTabela(pLinhas: number, pColunas: number, pCabecalho: boolean): Tabela {
  const linhas = Array.from({ length: pLinhas }, () => ({ id: novoID(), celulas: Array.from({ length: pColunas }, celulaVazia) }));
  return { id: novoID(), tipo: 'tabela', numeroDeColunas: pColunas, cabecalho: pCabecalho, rodape: false, linhas };
}

export function inserirLinhaNaTabela(pDocumento: Documento, pTabelaID: string, pIndice: number): Resultado {
  let primeira: string | null = null;
  const documento = substituirBloco(pDocumento, pTabelaID, (pB) => {
    const t = pB as Tabela;
    const linha = { id: novoID(), celulas: Array.from({ length: t.numeroDeColunas }, celulaVazia) };
    primeira = linha.celulas[0].id;
    const linhas = [...t.linhas];
    linhas.splice(Math.max(0, Math.min(pIndice, linhas.length)), 0, linha);
    return { ...t, linhas };
  });
  return { documento, selecao: primeira ? selecaoColapsada(primeira, 0) : null };
}

export function removerLinhaDaTabela(pDocumento: Documento, pTabelaID: string, pIndice: number): Resultado {
  const documento = substituirBloco(pDocumento, pTabelaID, (pB) => {
    const t = pB as Tabela;
    if (t.linhas.length <= 1)
      return null;
    return { ...t, linhas: t.linhas.filter((_, pI) => pI !== pIndice) };
  });
  return { documento: garantirEditavel(documento), selecao: null };
}

export function inserirColunaNaTabela(pDocumento: Documento, pTabelaID: string, pIndice: number): Resultado {
  const documento = substituirBloco(pDocumento, pTabelaID, (pB) => {
    const t = pB as Tabela;
    const linhas = t.linhas.map((pLinha) => {
      const celulas = [...pLinha.celulas];
      celulas.splice(Math.max(0, Math.min(pIndice, celulas.length)), 0, celulaVazia());
      return { ...pLinha, celulas };
    });
    return { ...t, numeroDeColunas: t.numeroDeColunas + 1, colunas: undefined, linhas } as Tabela;
  });
  return { documento, selecao: null };
}

export function removerColunaDaTabela(pDocumento: Documento, pTabelaID: string, pIndice: number): Resultado {
  const documento = substituirBloco(pDocumento, pTabelaID, (pB) => {
    const t = pB as Tabela;
    if (t.numeroDeColunas <= 1)
      return null;
    const linhas = t.linhas.map((pLinha) => ({ ...pLinha, celulas: pLinha.celulas.filter((_, pI) => pI !== pIndice) }));
    return { ...t, numeroDeColunas: t.numeroDeColunas - 1, colunas: undefined, linhas } as Tabela;
  });
  return { documento: garantirEditavel(documento), selecao: null };
}

/** Alinha a coluna inteira (cabeçalho inclusive); `undefined` volta ao padrão (esquerda, sem marca no texto). */
export function alinharColunaDaTabela(pDocumento: Documento, pTabelaID: string, pColuna: number, pAlinhamento: AlinhamentoDeCelula | undefined): Documento {
  return substituirBloco(pDocumento, pTabelaID, (pB) => {
    const t = pB as Tabela;
    const linhas = t.linhas.map((pLinha) => ({
      ...pLinha,
      celulas: pLinha.celulas.map((pCelula, pIndice) => {
        if (pIndice !== pColuna)
          return pCelula;
        const { alinhamento: _anterior, ...resto } = pCelula;
        return pAlinhamento ? { ...resto, alinhamento: pAlinhamento } : resto;
      }),
    }));
    return { ...t, linhas };
  });
}

// ============================================================================
// Inserção de blocos a partir da seleção
// ============================================================================

/** Insere blocos depois do bloco da folha corrente e põe o cursor na primeira folha nova (quando há). */
export function inserirBlocosNaSelecao(pDocumento: Documento, pSelecao: Selecao, pBlocos: Bloco[]): Resultado {
  const folha = folhaPorID(pDocumento, pSelecao.foco.folha);
  if (!folha)
    return { documento: { ...pDocumento, blocos: [...pDocumento.blocos, ...pBlocos] }, selecao: pSelecao };
  const bloco = blocoDaFolha(folha);
  // Parágrafo vazio é substituído, não empurrado.
  const vazio = folha.especie === 'paragrafo' && comprimentoInline(folha.folha.conteudo) === 0 && bloco.tipo === 'paragrafo';
  const documento = vazio ? substituirBloco(pDocumento, bloco.id, () => pBlocos) : inserirBlocosApos(pDocumento, bloco.id, pBlocos);
  const primeiraNova = folhasDoDocumento({ blocos: pBlocos })[0];
  return { documento: garantirEditavel(documento), selecao: primeiraNova ? selecaoColapsada(primeiraNova.folha.id, 0) : pSelecao };
}

/** Cola: um parágrafo só entra inline; mais de um bloco parte a folha e entra no meio. */
export function colarBlocos(pDocumento: Documento, pSelecao: Selecao, pBlocos: Bloco[]): Resultado {
  if (pBlocos.length === 1 && pBlocos[0].tipo === 'paragrafo') {
    const conteudo = pBlocos[0].conteudo;
    const apagado = apagarIntervalo(pDocumento, pSelecao);
    const ponto = apagado.selecao?.ancora;
    if (!ponto)
      return apagado;
    const documento = mapearConteudoDaFolha(apagado.documento, ponto.folha, (pConteudo) =>
      concatenarInline(fatiarInline(pConteudo, 0, ponto.deslocamento), conteudo, fatiarInline(pConteudo, ponto.deslocamento, comprimentoInline(pConteudo))),
    );
    return { documento, selecao: selecaoColapsada(ponto.folha, ponto.deslocamento + comprimentoInline(conteudo)) };
  }
  const dividido = dividirBloco(pDocumento, pSelecao);
  const ponto = dividido.selecao?.ancora;
  if (!ponto)
    return dividido;
  const folha = folhaPorID(dividido.documento, ponto.folha);
  if (!folha)
    return dividido;
  const bloco = blocoDaFolha(folha);
  const documento = inserirBlocosAntes(dividido.documento, bloco.id, pBlocos);
  return { documento: garantirEditavel(documento), selecao: dividido.selecao };
}

export { atomoNaPosicao };
