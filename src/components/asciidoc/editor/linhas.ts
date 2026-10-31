/**
 * CARIMBO DE LINHAS (modo dividido, 2026-10-31). O parser grava em cada bloco a linha do código em que ele começa;
 * um bloco criado ou alterado no visual não tem linha, e as dos vizinhos ficam velhas assim que o texto serializado
 * muda. Como o texto emitido pelo visual é exatamente `serializarDocumento(documento)`, reanalisá-lo devolve a mesma
 * estrutura com as linhas certas: este módulo copia essas linhas para os blocos do modelo, posição a posição,
 * SEM trocar os objetos (os ids e a seleção ficam; `linha` é metadado que o serializador ignora e a vista só lê).
 *
 * É o que faz o cursor virtual valer nos dois sentidos depois de qualquer edição: código → visual
 * (`cursorVirtualDoCodigo`) e visual → código (`posicaoNoCodigo`) dependem de `linha`.
 */

import { filhosDoBloco } from '../modelo/documento';
import type { Bloco, Documento } from '../modelo/tipos';
import { analisarAsciiDoc } from '../parser/blocos';

function copiarLinhas(pDestino: Bloco[], pOrigem: Bloco[]): boolean {
  if (pDestino.length !== pOrigem.length)
    return false;
  for (let i = 0; i < pDestino.length; i++) {
    const destino = pDestino[i];
    const origem = pOrigem[i];
    if (destino.tipo !== origem.tipo)
      return false;
    if (origem.linha !== undefined)
      destino.linha = origem.linha;
    else
      delete destino.linha;
    const filhosDestino = filhosDoBloco(destino);
    const filhosOrigem = filhosDoBloco(origem);
    if (filhosDestino.length !== filhosOrigem.length)
      return false;
    for (let g = 0; g < filhosDestino.length; g++)
      if (!copiarLinhas(filhosDestino[g], filhosOrigem[g]))
        return false;
  }
  return true;
}

/**
 * Carimba em `pDocumento` as linhas que `pTexto` (a sua serialização) tem para cada bloco. Devolve `false` quando a
 * estrutura reanalisada não bate com o modelo (não deveria acontecer; aí as linhas antigas ficam como estão).
 */
export function carimbarLinhas(pDocumento: Documento, pTexto: string): boolean {
  const analise = analisarAsciiDoc(pTexto);
  return copiarLinhas(pDocumento.blocos, analise.documento.blocos);
}
