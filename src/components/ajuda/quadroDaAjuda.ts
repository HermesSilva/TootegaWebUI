/**
 * A geometria do painel de ajuda "?" (dono, 2026-10-21): arrastável pelo cabeçalho e redimensionável por qualquer
 * aresta ou canto — sempre DENTRO da área do App que o abriu (diretiva de contenção: nunca cobre a casca nem as
 * abas). Funções puras, em pixels relativos à área: o painel mede a área e aplica o que estas devolvem.
 */

/** Posição e tamanho do painel, relativos ao canto superior esquerdo da área do App. */
export interface QuadroDaAjuda {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** O tamanho da área do App em que o painel vive. */
export interface AreaDaAjuda {
  largura: number;
  altura: number;
}

/** Direção de uma alça de redimensionar: as quatro arestas e os quatro cantos. */
export type DirecaoDaAlca = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Folga entre o painel e a borda da área — é o que deixa o brilho visível. */
export const MARGEM_DA_AJUDA = 8;
export const LARGURA_MINIMA_DA_AJUDA = 320;
export const ALTURA_MINIMA_DA_AJUDA = 240;
const LARGURA_INICIAL_MINIMA = 480;
const LARGURA_INICIAL_MAXIMA = 1000;
const FRACAO_INICIAL = 0.55;

function entre(pValor: number, pMinimo: number, pMaximo: number): number {
  return Math.min(Math.max(pValor, pMinimo), Math.max(pMinimo, pMaximo));
}

/** O quadro de quem nunca mexeu: coluna à direita, 55% da área (de 480 a 1000 px), altura inteira. */
export function quadroInicialDaAjuda(pArea: AreaDaAjuda): QuadroDaAjuda {
  const livre = Math.max(0, pArea.largura - 2 * MARGEM_DA_AJUDA);
  const width = Math.min(livre, entre(pArea.largura * FRACAO_INICIAL, LARGURA_INICIAL_MINIMA, LARGURA_INICIAL_MAXIMA));
  const height = Math.max(0, pArea.altura - 2 * MARGEM_DA_AJUDA);
  return { left: pArea.largura - width - MARGEM_DA_AJUDA, top: MARGEM_DA_AJUDA, width, height };
}

/**
 * Traz o quadro para dentro da área: tamanho entre o mínimo e o que cabe, posição sem sair por nenhum lado. É o
 * que vale para o quadro guardado no perfil, que pode vir de uma janela maior que a atual.
 */
export function limitarQuadroDaAjuda(pQuadro: QuadroDaAjuda, pArea: AreaDaAjuda): QuadroDaAjuda {
  const larguraMaxima = Math.max(0, pArea.largura - 2 * MARGEM_DA_AJUDA);
  const alturaMaxima = Math.max(0, pArea.altura - 2 * MARGEM_DA_AJUDA);
  const width = Math.min(larguraMaxima, Math.max(LARGURA_MINIMA_DA_AJUDA, pQuadro.width));
  const height = Math.min(alturaMaxima, Math.max(ALTURA_MINIMA_DA_AJUDA, pQuadro.height));
  return {
    left: entre(pQuadro.left, MARGEM_DA_AJUDA, pArea.largura - width - MARGEM_DA_AJUDA),
    top: entre(pQuadro.top, MARGEM_DA_AJUDA, pArea.altura - height - MARGEM_DA_AJUDA),
    width,
    height,
  };
}

/** Arrasto pelo cabeçalho: o quadro anda e para na borda da área. */
export function moverQuadroDaAjuda(pInicio: QuadroDaAjuda, pDX: number, pDY: number, pArea: AreaDaAjuda): QuadroDaAjuda {
  return limitarQuadroDaAjuda({ ...pInicio, left: pInicio.left + pDX, top: pInicio.top + pDY }, pArea);
}

/**
 * Redimensionar por uma alça: só as arestas da direção se movem, a oposta fica parada — puxar a aresta esquerda
 * não empurra a direita. Nenhuma aresta passa da borda da área nem encolhe o painel abaixo do mínimo.
 */
export function redimensionarQuadroDaAjuda(
  pInicio: QuadroDaAjuda, pDirecao: DirecaoDaAlca, pDX: number, pDY: number, pArea: AreaDaAjuda,
): QuadroDaAjuda {
  let esquerda = pInicio.left;
  let direita = pInicio.left + pInicio.width;
  let topo = pInicio.top;
  let base = pInicio.top + pInicio.height;

  if (pDirecao.includes('w'))
    esquerda = entre(esquerda + pDX, MARGEM_DA_AJUDA, direita - LARGURA_MINIMA_DA_AJUDA);
  if (pDirecao.includes('e'))
    direita = entre(direita + pDX, esquerda + LARGURA_MINIMA_DA_AJUDA, pArea.largura - MARGEM_DA_AJUDA);
  if (pDirecao.includes('n'))
    topo = entre(topo + pDY, MARGEM_DA_AJUDA, base - ALTURA_MINIMA_DA_AJUDA);
  if (pDirecao.includes('s'))
    base = entre(base + pDY, topo + ALTURA_MINIMA_DA_AJUDA, pArea.altura - MARGEM_DA_AJUDA);

  return { left: esquerda, top: topo, width: direita - esquerda, height: base - topo };
}
