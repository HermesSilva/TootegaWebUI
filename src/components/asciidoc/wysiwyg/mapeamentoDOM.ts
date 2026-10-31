/**
 * MAPEAMENTO DOM ↔ MODELO da vista visual.
 *
 * Toda folha é um elemento `[data-folha=id]`; dentro dele, cada trecho de texto é um `<span data-ini=N>` (ou `<a>`)
 * com UM nó de texto, e cada átomo é um `[data-atomo]` não editável que vale UMA posição. Com isso, converter o ponto
 * do DOM (nó, deslocamento) em posição do modelo é contar texto até o ponto — e o inverso, andar até o nó certo.
 *
 * `lerConteudoDoDOM` é a rede de segurança: quando o navegador muda o DOM sem avisar o que fez (composição IME,
 * correção ortográfica sem `data`), relemos a folha e inferimos as marcas pelo trecho de origem.
 */

import { normalizarInline } from '../modelo/documento';
import type { Inline, Marca } from '../modelo/tipos';

export interface PontoDoDOM {
  no: Node;
  deslocamento: number;
}

export function elementoDaFolha(pNo: Node | null): HTMLElement | null {
  if (!pNo)
    return null;
  const elemento = pNo.nodeType === Node.ELEMENT_NODE ? (pNo as HTMLElement) : pNo.parentElement;
  return elemento?.closest('[data-folha]') ?? null;
}

export function elementoDaFolhaPorID(pRaiz: HTMLElement, pID: string): HTMLElement | null {
  return pRaiz.querySelector(`[data-folha="${pID}"]`);
}

function ehAtomo(pNo: Node): boolean {
  return pNo.nodeType === Node.ELEMENT_NODE && (pNo as HTMLElement).hasAttribute('data-atomo');
}

/** Converte (nó, deslocamento) do DOM em deslocamento do modelo dentro da folha. */
export function deslocamentoNoDOM(pFolha: HTMLElement, pNo: Node, pDeslocamento: number): number {
  // Normaliza o ponto para "antes do nó X" ou "dentro do texto T".
  let alvo: Node | null = pNo;
  let dentroDeTexto = pNo.nodeType === Node.TEXT_NODE;
  let depoisDeTudo = false;
  if (!dentroDeTexto) {
    const filhos = pNo.childNodes;
    if (pDeslocamento < filhos.length)
      alvo = filhos[pDeslocamento];
    else {
      // Fim do elemento: conta tudo o que há nele.
      alvo = pNo;
      depoisDeTudo = true;
    }
  }

  let posicao = 0;
  let achou = false;

  const visitar = (pElemento: Node): boolean => {
    for (const filho of Array.from(pElemento.childNodes)) {
      if (!depoisDeTudo && filho === alvo) {
        if (dentroDeTexto)
          posicao += pDeslocamento;
        achou = true;
        return true;
      }
      if (ehAtomo(filho)) {
        if (filho.contains(alvo as Node) && !depoisDeTudo) {
          posicao += 1;
          achou = true;
          return true;
        }
        posicao += 1;
        continue;
      }
      if (filho.nodeType === Node.TEXT_NODE) {
        posicao += (filho.textContent ?? '').length;
        continue;
      }
      if (filho.nodeName === 'BR')
        continue;
      if (visitar(filho))
        return true;
      if (depoisDeTudo && filho === alvo) {
        achou = true;
        return true;
      }
    }
    return false;
  };

  if (depoisDeTudo && alvo === pFolha) {
    visitar(pFolha);
    return posicao;
  }
  visitar(pFolha);
  return achou ? posicao : posicao;
}

/** O ponto do DOM que corresponde ao deslocamento do modelo na folha. */
export function pontoDoModelo(pFolha: HTMLElement, pDeslocamento: number): PontoDoDOM {
  let posicao = 0;
  let ultimoTexto: Text | null = null;

  const visitar = (pElemento: Node): PontoDoDOM | null => {
    for (const filho of Array.from(pElemento.childNodes)) {
      if (ehAtomo(filho)) {
        if (pDeslocamento === posicao) {
          const pai = filho.parentNode as Node;
          return { no: pai, deslocamento: Array.from(pai.childNodes).indexOf(filho as ChildNode) };
        }
        posicao += 1;
        if (pDeslocamento === posicao) {
          const pai = filho.parentNode as Node;
          return { no: pai, deslocamento: Array.from(pai.childNodes).indexOf(filho as ChildNode) + 1 };
        }
        continue;
      }
      if (filho.nodeType === Node.TEXT_NODE) {
        const texto = filho as Text;
        const tamanho = texto.data.length;
        if (pDeslocamento <= posicao + tamanho)
          return { no: texto, deslocamento: pDeslocamento - posicao };
        posicao += tamanho;
        ultimoTexto = texto;
        continue;
      }
      if (filho.nodeName === 'BR')
        continue;
      const achado = visitar(filho);
      if (achado)
        return achado;
    }
    return null;
  };

  const achado = visitar(pFolha);
  if (achado)
    return achado;
  if (ultimoTexto)
    return { no: ultimoTexto, deslocamento: (ultimoTexto as Text).data.length };
  return { no: pFolha, deslocamento: pFolha.childNodes.length > 0 && pFolha.lastChild?.nodeName === 'BR' ? 0 : pFolha.childNodes.length };
}

/** As marcas do trecho do modelo que cobre a posição (para herdar nas leituras de volta). */
function marcasNoModelo(pConteudo: Inline[], pPosicao: number): Marca[] {
  let posicao = 0;
  let ultimas: Marca[] = [];
  for (const parte of pConteudo) {
    const tamanho = parte.tipo === 'texto' ? parte.texto.length : 1;
    if (parte.tipo === 'texto') {
      if (pPosicao >= posicao && pPosicao < posicao + tamanho)
        return parte.marcas;
      ultimas = parte.marcas;
    }
    posicao += tamanho;
  }
  return ultimas;
}

/**
 * Relê a folha do DOM e devolve o conteúdo inline novo. Texto dentro de um `[data-ini]` herda as marcas do trecho
 * de origem; texto solto herda as do trecho anterior; átomos vêm do modelo pelo `data-ini`.
 */
export function lerConteudoDoDOM(pFolha: HTMLElement, pConteudoAnterior: Inline[]): Inline[] {
  const saida: Inline[] = [];
  let ultimasMarcas: Marca[] = [];
  const atomosPorPosicao = new Map<number, Inline>();
  let posicao = 0;
  for (const parte of pConteudoAnterior) {
    if (parte.tipo === 'atomo')
      atomosPorPosicao.set(posicao, parte);
    posicao += parte.tipo === 'texto' ? parte.texto.length : 1;
  }

  const visitar = (pElemento: Node, pMarcas: Marca[] | null): void => {
    for (const filho of Array.from(pElemento.childNodes)) {
      if (ehAtomo(filho)) {
        const ini = Number((filho as HTMLElement).getAttribute('data-ini'));
        const atomo = atomosPorPosicao.get(ini);
        if (atomo)
          saida.push(atomo);
        continue;
      }
      if (filho.nodeType === Node.TEXT_NODE) {
        const texto = (filho as Text).data.replace(/​/g, '');
        if (texto.length > 0)
          saida.push({ tipo: 'texto', texto, marcas: pMarcas ?? ultimasMarcas });
        continue;
      }
      if (filho.nodeName === 'BR')
        continue;
      const elemento = filho as HTMLElement;
      const ini = elemento.getAttribute('data-ini');
      if (ini !== null) {
        const marcas = marcasNoModelo(pConteudoAnterior, Number(ini));
        ultimasMarcas = marcas;
        visitar(filho, marcas);
        continue;
      }
      // Elemento que o navegador criou (b, i, span sem data): texto solto com as marcas correntes.
      visitar(filho, pMarcas);
    }
  };
  visitar(pFolha, null);
  return normalizarInline(saida);
}
