/**
 * usePosicaoFlutuante — mantém um painel flutuante (lista de lookup, picker) no lugar certo enquanto
 * ele está aberto: abaixo, acima, à direita ou à esquerda do campo, nessa ordem (`posicaoFlutuante`).
 *
 * Mede o PRÓPRIO painel, e não um tamanho chutado: a lista de três opções cabe abaixo onde a de
 * trinta não cabe, e só a medida real decide isso. Reposiciona ao abrir, quando o painel muda de
 * tamanho (o resultado da busca chegou) e quando o campo se move (rolagem de qualquer ancestral,
 * redimensionamento da janela).
 */

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { posicaoFlutuante, type PosicaoFlutuante } from '@core/lib/posicaoFlutuante';

export interface OpcoesUsePosicaoFlutuante {
  /**
   * Teto da altura de uma LISTA que rola por dentro. Presente ⇒ a altura desejada é o conteúdo
   * (`scrollHeight`) limitado a este teto; ausente ⇒ é a altura do painel como ele está.
   */
  alturaMaxima?: number;
  /** Largura imposta pelo chamador (o picker). Ausente ⇒ a medida do painel, nunca menor que o campo. */
  largura?: (pCampo: DOMRect) => number;
  /** Desliga o acompanhamento (o usuário arrastou o painel para onde quis). */
  desligado?: boolean;
}

export interface PosicaoFlutuanteMedida extends PosicaoFlutuante {
  /** Largura do campo — piso da largura da lista. */
  larguraCampo: number;
  /** Largura imposta (quando `opcoes.largura` existe). */
  largura?: number;
  /** Já foi medido ao menos uma vez — antes disso o painel fica invisível, para não piscar no canto. */
  medido: boolean;
}

const INICIAL: PosicaoFlutuanteMedida = { lado: 'abaixo', top: 0, left: 0, maxHeight: 300, larguraCampo: 0, medido: false };

function igual(pA: PosicaoFlutuanteMedida, pB: PosicaoFlutuanteMedida): boolean {
  return pA.lado === pB.lado && pA.top === pB.top && pA.bottom === pB.bottom && pA.left === pB.left
    && pA.maxHeight === pB.maxHeight && pA.larguraCampo === pB.larguraCampo && pA.largura === pB.largura
    && pA.medido === pB.medido;
}

export function usePosicaoFlutuante(
  pAberto: boolean,
  pCampoRef: RefObject<HTMLElement | null>,
  pPainelRef: RefObject<HTMLElement | null>,
  pOpcoes: OpcoesUsePosicaoFlutuante = {},
): { posicao: PosicaoFlutuanteMedida; reposicionar: () => void } {
  const { alturaMaxima, largura, desligado = false } = pOpcoes;
  const [posicao, setPosicao] = useState<PosicaoFlutuanteMedida>(INICIAL);
  const observadorRef = useRef<ResizeObserver | null>(null);
  const observadoRef = useRef<HTMLElement | null>(null);

  const reposicionar = useCallback(() => {
    const campo = pCampoRef.current;
    if (!campo)
      return;

    const r = campo.getBoundingClientRect();
    const painel = pPainelRef.current;
    const larguraImposta = largura?.(r);
    const larguraPainel = larguraImposta ?? Math.max(painel?.offsetWidth ?? 0, r.width);

    // Lista: o conteúdo inteiro, até o teto. Painel: como ele está. Sem medida ainda, um palpite
    // modesto — a segunda passada (o painel já desenhado) corrige.
    // O conteúdo (`scrollHeight`), e não a caixa: encolhido num lado apertado, o painel ainda quer a
    // altura inteira, e é ela que decide se outro lado o comporta.
    const alturaPainel = !painel
      ? Math.min(220, alturaMaxima ?? 400)
      : alturaMaxima !== undefined
        ? Math.min(painel.scrollHeight || 220, alturaMaxima)
        : painel.scrollHeight + (painel.offsetHeight - painel.clientHeight);

    const nova: PosicaoFlutuanteMedida = {
      ...posicaoFlutuante(r, { largura: larguraPainel, altura: alturaPainel }),
      larguraCampo: r.width,
      largura: larguraImposta,
      medido: !!painel,
    };
    setPosicao((pAtual) => (igual(pAtual, nova) ? pAtual : nova));
  }, [pCampoRef, pPainelRef, alturaMaxima, largura]);

  // Antes da pintura: com useEffect o painel apareceria por um quadro fora do lugar e "saltaria".
  useLayoutEffect(() => {
    if (!pAberto || desligado)
      return;

    reposicionar();
    // Segunda passada no próximo quadro: o painel acabou de entrar no portal e só agora tem medida.
    const quadro = requestAnimationFrame(reposicionar);

    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);

    observadorRef.current = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => reposicionar()) : null;

    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
      observadorRef.current?.disconnect();
      observadorRef.current = null;
      observadoRef.current = null;
    };
  }, [pAberto, desligado, reposicionar]);

  // O painel pode entrar no DOM DEPOIS de aberto (a lista do lookup só aparece quando há itens) e
  // pode ser trocado: a cada render confere-se se o elemento é outro, e o observador passa a ele.
  useLayoutEffect(() => {
    if (!pAberto || desligado)
      return;

    const painel = pPainelRef.current;
    if (painel === observadoRef.current)
      return;

    observadorRef.current?.disconnect();
    if (painel)
      observadorRef.current?.observe(painel);
    observadoRef.current = painel;
    reposicionar();
  });

  return { posicao, reposicionar };
}
