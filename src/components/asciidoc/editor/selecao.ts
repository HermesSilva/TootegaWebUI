/**
 * SELEÇÃO do editor visual: um par de posições (folha, deslocamento). O deslocamento conta caracteres do conteúdo
 * inline da folha, com cada átomo valendo 1 — nunca índice global do documento, para a edição de um bloco não
 * mexer nas posições dos outros.
 */

import { comprimentoInline, folhasDoDocumento, indiceDaFolha } from '../modelo/documento';
import type { Documento } from '../modelo/tipos';

export interface Posicao {
  folha: string;
  deslocamento: number;
}

export interface Selecao {
  ancora: Posicao;
  foco: Posicao;
}

export function posicao(pFolha: string, pDeslocamento: number): Posicao {
  return { folha: pFolha, deslocamento: pDeslocamento };
}

export function selecaoColapsada(pFolha: string, pDeslocamento: number): Selecao {
  const p = posicao(pFolha, pDeslocamento);
  return { ancora: p, foco: p };
}

export function estaColapsada(pSelecao: Selecao): boolean {
  return pSelecao.ancora.folha === pSelecao.foco.folha && pSelecao.ancora.deslocamento === pSelecao.foco.deslocamento;
}

export function posicoesIguais(pA: Posicao, pB: Posicao): boolean {
  return pA.folha === pB.folha && pA.deslocamento === pB.deslocamento;
}

export function selecoesIguais(pA: Selecao | null, pB: Selecao | null): boolean {
  if (pA === null || pB === null)
    return pA === pB;
  return posicoesIguais(pA.ancora, pB.ancora) && posicoesIguais(pA.foco, pB.foco);
}

/** Compara duas posições na ordem do documento: negativo se `pA` vem antes. */
export function compararPosicoes(pDocumento: Documento, pA: Posicao, pB: Posicao): number {
  if (pA.folha === pB.folha)
    return pA.deslocamento - pB.deslocamento;
  return indiceDaFolha(pDocumento, pA.folha) - indiceDaFolha(pDocumento, pB.folha);
}

/** A seleção em ordem de documento (`inicio` antes de `fim`). */
export function ordenarSelecao(pDocumento: Documento, pSelecao: Selecao): { inicio: Posicao; fim: Posicao } {
  return compararPosicoes(pDocumento, pSelecao.ancora, pSelecao.foco) <= 0
    ? { inicio: pSelecao.ancora, fim: pSelecao.foco }
    : { inicio: pSelecao.foco, fim: pSelecao.ancora };
}

/** Garante que a seleção aponta para folhas que existem no documento; senão, cai na folha mais próxima. */
export function ajustarSelecao(pDocumento: Documento, pSelecao: Selecao | null): Selecao | null {
  if (pSelecao === null)
    return null;
  const folhas = folhasDoDocumento(pDocumento);
  if (folhas.length === 0)
    return null;
  const ajustar = (pP: Posicao): Posicao => {
    const folha = folhas.find((pF) => pF.folha.id === pP.folha);
    if (!folha)
      return posicao(folhas[0].folha.id, 0);
    const maximo = comprimentoInline(folha.folha.conteudo);
    return pP.deslocamento > maximo ? posicao(pP.folha, maximo) : pP;
  };
  return { ancora: ajustar(pSelecao.ancora), foco: ajustar(pSelecao.foco) };
}

/** Os ids das folhas tocadas pela seleção, em ordem. */
export function folhasDaSelecao(pDocumento: Documento, pSelecao: Selecao): string[] {
  const { inicio, fim } = ordenarSelecao(pDocumento, pSelecao);
  const folhas = folhasDoDocumento(pDocumento);
  const de = folhas.findIndex((pF) => pF.folha.id === inicio.folha);
  const ate = folhas.findIndex((pF) => pF.folha.id === fim.folha);
  if (de === -1 || ate === -1)
    return [];
  return folhas.slice(de, ate + 1).map((pF) => pF.folha.id);
}
