/**
 * Geometria das JANELAS MÓVEIS do App (a janela do documento de apoio): arrastar e redimensionar dentro da
 * ÁREA DO APP, podendo ENCOSTAR nas bordas — `left = 0`, `right = 0`, topo e base (dono, 2026-10-22). Sem
 * margem: a janela alinha ao limite do App. Funções puras, em pixels relativos ao canto superior esquerdo
 * da área.
 */

/** Posição e tamanho da janela, relativos à área do App. */
export interface QuadroDaJanela {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** O tamanho da área do App. */
export interface AreaDaJanela {
  largura: number;
  altura: number;
}

export const LARGURA_MINIMA_DA_JANELA = 320;
export const ALTURA_MINIMA_DA_JANELA = 240;

function entre(pValor: number, pMinimo: number, pMaximo: number): number {
  return Math.min(Math.max(pValor, pMinimo), Math.max(pMinimo, pMaximo));
}

/** O quadro inicial: coluna da direita encostada na borda, metade da área (de 480 a 1000 px), altura inteira. */
export function quadroInicialDaJanela(pArea: AreaDaJanela): QuadroDaJanela {
  const width = Math.min(pArea.largura, entre(pArea.largura * 0.5, 480, 1000));
  return { left: pArea.largura - width, top: 0, width, height: pArea.altura };
}

/** Traz o quadro para dentro da área: tamanho entre o mínimo e o que cabe, posição sem sair por nenhum lado. */
export function limitarQuadroDaJanela(pQuadro: QuadroDaJanela, pArea: AreaDaJanela): QuadroDaJanela {
  const width = Math.min(pArea.largura, Math.max(LARGURA_MINIMA_DA_JANELA, pQuadro.width));
  const height = Math.min(pArea.altura, Math.max(ALTURA_MINIMA_DA_JANELA, pQuadro.height));
  return {
    left: entre(pQuadro.left, 0, pArea.largura - width),
    top: entre(pQuadro.top, 0, pArea.altura - height),
    width,
    height,
  };
}

/** Arrasto: a janela anda e para exatamente na borda da área. */
export function moverQuadroDaJanela(pInicio: QuadroDaJanela, pDX: number, pDY: number, pArea: AreaDaJanela): QuadroDaJanela {
  return limitarQuadroDaJanela({ ...pInicio, left: pInicio.left + pDX, top: pInicio.top + pDY }, pArea);
}

/** Redimensionar pelo canto inferior direito: a aresta vai até a borda da área, nunca abaixo do mínimo. */
export function redimensionarQuadroDaJanela(pInicio: QuadroDaJanela, pDX: number, pDY: number, pArea: AreaDaJanela): QuadroDaJanela {
  const width = entre(pInicio.width + pDX, LARGURA_MINIMA_DA_JANELA, pArea.largura - pInicio.left);
  const height = entre(pInicio.height + pDY, ALTURA_MINIMA_DA_JANELA, pArea.altura - pInicio.top);
  return { ...pInicio, width, height };
}
