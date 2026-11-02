/**
 * REAPROVEITAR BLOCOS na reanálise (2026-11-02). O parser dá ids novos a cada análise, e o id é a `key` do React: sem
 * este passo, cada pausa da digitação no código desmonta e remonta a vista inteira (1,5 s medidos num documento de
 * 549 KB). Aqui o resultado da análise é alinhado com o documento anterior: o bloco igual volta a ser o MESMO objeto,
 * que o `memo` da vista nem visita, e o bloco que mudou fica com o id antigo, que o React só atualiza.
 *
 * O alinhamento é por prefixo e sufixo comuns, ignorando `id` e `linha`: uma edição mexe num trecho só, e inserir uma
 * linha no meio desloca a numeração dos blocos seguintes sem que eles tenham mudado.
 */

import type { Bloco } from '../modelo/tipos';

/** As chaves que não dizem nada sobre o conteúdo. */
function ehMetadado(pChave: string): boolean {
  return pChave === 'id' || pChave === 'linha';
}

function ehObjeto(pValor: unknown): pValor is Record<string, unknown> {
  return typeof pValor === 'object' && pValor !== null;
}

/** Mesmo conteúdo, ignorando `id` e `linha` em qualquer nível. */
function mesmoConteudo(pA: unknown, pB: unknown): boolean {
  if (pA === pB)
    return true;
  if (!ehObjeto(pA) || !ehObjeto(pB) || Array.isArray(pA) !== Array.isArray(pB))
    return false;
  if (Array.isArray(pA)) {
    const b = pB as unknown as unknown[];
    if (pA.length !== b.length)
      return false;
    for (let i = 0; i < pA.length; i++)
      if (!mesmoConteudo(pA[i], b[i]))
        return false;
    return true;
  }
  for (const chave of Object.keys(pA))
    if (!ehMetadado(chave) && !mesmoConteudo(pA[chave], pB[chave]))
      return false;
  for (const chave of Object.keys(pB))
    if (!ehMetadado(chave) && !(chave in pA) && pB[chave] !== undefined)
      return false;
  return true;
}

/**
 * O valor novo aproveitando o antigo: devolve o próprio `pAntigo` quando nada mudou (nem a `linha`), e senão um objeto
 * com os valores novos, o `id` antigo e os pedaços iguais compartilhados.
 */
function fundir(pAntigo: unknown, pNovo: unknown): unknown {
  if (pAntigo === pNovo || !ehObjeto(pAntigo) || !ehObjeto(pNovo) || Array.isArray(pAntigo) !== Array.isArray(pNovo))
    return pNovo;
  if (Array.isArray(pAntigo)) {
    const novo = pNovo as unknown as unknown[];
    if (pAntigo.length !== novo.length)
      return pNovo;
    let igual = true;
    const saida = novo.map((pItem, pIndice) => {
      const item = fundir(pAntigo[pIndice], pItem);
      if (item !== pAntigo[pIndice])
        igual = false;
      return item;
    });
    return igual ? pAntigo : saida;
  }
  // Tipo diferente é outra coisa: não herda o id.
  if (pAntigo.tipo !== pNovo.tipo || pAntigo.especie !== pNovo.especie)
    return pNovo;
  const saida: Record<string, unknown> = {};
  let igual = Object.keys(pAntigo).length === Object.keys(pNovo).length;
  for (const chave of Object.keys(pNovo)) {
    const valor = chave === 'id' && pAntigo.id !== undefined ? pAntigo.id : fundir(pAntigo[chave], pNovo[chave]);
    saida[chave] = valor;
    if (valor !== pAntigo[chave])
      igual = false;
  }
  return igual ? pAntigo : saida;
}

/** Os blocos de `pNovos`, reaproveitando de `pAnteriores` tudo o que for igual. */
export function reaproveitarBlocos(pAnteriores: Bloco[], pNovos: Bloco[]): Bloco[] {
  const limite = Math.min(pAnteriores.length, pNovos.length);
  let prefixo = 0;
  while (prefixo < limite && mesmoConteudo(pAnteriores[prefixo], pNovos[prefixo]))
    prefixo += 1;
  let sufixo = 0;
  while (sufixo < limite - prefixo && mesmoConteudo(pAnteriores[pAnteriores.length - 1 - sufixo], pNovos[pNovos.length - 1 - sufixo]))
    sufixo += 1;
  const deslocamento = pAnteriores.length - pNovos.length;
  return pNovos.map((pBloco, pIndice) => {
    if (pIndice < prefixo)
      return fundir(pAnteriores[pIndice], pBloco) as Bloco;
    if (pIndice >= pNovos.length - sufixo)
      return fundir(pAnteriores[pIndice + deslocamento], pBloco) as Bloco;
    // O trecho editado: só herda o id se ocupa o mesmo lugar, e `fundir` recusa quando o tipo mudou.
    const antigo = pIndice < pAnteriores.length - sufixo ? pAnteriores[pIndice] : undefined;
    return antigo ? (fundir(antigo, pBloco) as Bloco) : pBloco;
  });
}
