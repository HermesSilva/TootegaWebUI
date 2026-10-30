/**
 * useMolduraDeModal — o que TODO cartão de diálogo tem em comum, num lugar só (dono, 2026-10-25):
 *
 * - **redimensionar** por qualquer aresta ou canto (oito alças invisíveis na borda do cartão);
 * - **arrastar** pelo cabeçalho, quando o diálogo o pede;
 * - os dois em **tempo real**: o gesto não passa pelo React — tamanho e deslocamento vão direto ao
 *   `style` do cartão, no máximo uma vez por quadro (requestAnimationFrame). Um setState por evento de
 *   ponteiro re-renderizava o diálogo e o deixava "atrasado" atrás do ponteiro;
 * - **contido**: nem o arrasto nem o redimensionar levam o cartão para fora da ÁREA DO APP
 *   (`[data-app-area]`), ou do quadro que o contém quando não há área marcada (diretiva de contenção).
 *
 * A aparência (borda de 2px um pouco mais clara que o fundo e o brilho discreto) é a classe
 * `x-moldura-modal` do CSS do Core; quem usa o hook a põe no cartão junto com o `ref`.
 *
 * Geometria: o cartão é posicionado pelo seu contêiner — CENTRADO (o caso de todo modal: o contêiner o
 * centraliza com flex) ou ANCORADO pelo canto superior esquerdo (o painel da lupa, posto em top/left).
 * Crescer um cartão centrado o expande para os DOIS lados; para a aresta acompanhar o ponteiro e a oposta
 * ficar parada, o deslocamento corrige metade do crescimento. No ancorado, só a aresta esquerda/superior
 * desloca o cartão.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, type JSX, type PointerEvent as ReactPointerEvent } from 'react';

type Direcao = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Onde o usuário deixou o cartão: deslocamento a partir da posição natural e, se redimensionou, o tamanho. */
export interface QuadroDeModal {
  x: number;
  y: number;
  largura?: number;
  altura?: number;
}

/**
 * A chave da preferência (perfil do usuário) que guarda o quadro de um formulário. O servidor aceita até
 * 80 caracteres em `[A-Za-z0-9._-]`: o nome do formulário é saneado para caber.
 */
export function chaveDoQuadroDoFormulario(pNome: string): string {
  const saneado = pNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[^A-Za-z0-9]+/, '');
  return `form.${saneado || 'sem-nome'}`.slice(0, 80);
}

export interface OpcoesMolduraDeModal {
  /** O cartão se arrasta pelo cabeçalho (`alca`). */
  arrastavel?: boolean;
  /** O cartão se redimensiona pelas arestas e cantos. Padrão: sim. */
  redimensionavel?: boolean;
  /** Como o contêiner posiciona o cartão. Padrão: centrado. */
  posicionamento?: 'centrado' | 'ancorado';
  /** Menor tamanho a que o redimensionar pode reduzir o cartão, em px. */
  larguraMinima?: number;
  alturaMinima?: number;
  /** Ref que o cartão JÁ usa (para se posicionar, por exemplo). Ausente ⇒ o hook cria o seu. */
  ref?: React.RefObject<HTMLDivElement | null>;
  /**
   * Quadro GUARDADO (a preferência do usuário): aplicado ao abrir e sempre que muda, enquanto o usuário
   * ainda não mexeu no cartão nesta abertura. Ajustado para caber na área, se ela encolheu desde então.
   */
  quadroSalvo?: QuadroDeModal | null;
  /** Chamado ao fim de cada arrasto ou redimensionar, com o quadro novo — para guardá-lo. */
  aoMudarQuadro?: (pQuadro: QuadroDeModal) => void;
  /**
   * O diálogo está aberto. Para quem fica MONTADO enquanto fechado (os formulários das Apps): cada nova
   * abertura é um cartão novo no DOM, e o quadro guardado se reaplica nele. Padrão: sim.
   */
  aberto?: boolean;
}

export interface MolduraDeModal {
  /** Vai no cartão. */
  ref: React.RefObject<HTMLDivElement | null>;
  /** Vão no cabeçalho, quando arrastável. Vazio quando não é. */
  alca: {
    onPointerDown?: (pEvento: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove?: (pEvento: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp?: (pEvento: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel?: (pEvento: ReactPointerEvent<HTMLElement>) => void;
  };
  /** As oito alças de redimensionar; renderize-as DENTRO do cartão. Nulo quando não redimensiona. */
  alcasDeRedimensionar: JSX.Element | null;
}

const ALCAS: { direcao: Direcao; classe: string }[] = [
  { direcao: 'n', classe: 'top-0 left-3 right-3 h-1.5 cursor-ns-resize' },
  { direcao: 's', classe: 'bottom-0 left-3 right-3 h-1.5 cursor-ns-resize' },
  { direcao: 'w', classe: 'left-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
  { direcao: 'e', classe: 'right-0 top-3 bottom-3 w-1.5 cursor-ew-resize' },
  { direcao: 'nw', classe: 'top-0 left-0 w-3 h-3 cursor-nwse-resize' },
  { direcao: 'se', classe: 'bottom-0 right-0 w-3 h-3 cursor-nwse-resize' },
  { direcao: 'ne', classe: 'top-0 right-0 w-3 h-3 cursor-nesw-resize' },
  { direcao: 'sw', classe: 'bottom-0 left-0 w-3 h-3 cursor-nesw-resize' },
];

interface Gesto {
  modo: 'mover' | Direcao;
  x: number;
  y: number;
  base: { x: number; y: number };
  limites: DOMRect;
  cartao: DOMRect;
}

const limitar = (pValor: number, pMinimo: number, pMaximo: number): number =>
  Math.min(Math.max(pValor, pMinimo), Math.max(pMinimo, pMaximo));

export function useMolduraDeModal({
  arrastavel = false,
  redimensionavel = true,
  posicionamento = 'centrado',
  larguraMinima = 280,
  alturaMinima = 160,
  ref: refExterno,
  quadroSalvo,
  aoMudarQuadro,
  aberto = true,
}: OpcoesMolduraDeModal = {}): MolduraDeModal {
  const refProprio = useRef<HTMLDivElement>(null);
  const ref = refExterno ?? refProprio;
  const deslocamento = useRef({ x: 0, y: 0 });
  const tamanho = useRef<{ largura: number; altura: number } | null>(null);
  const gesto = useRef<Gesto | null>(null);
  const quadro = useRef<number | null>(null);
  // O usuário já arrastou ou redimensionou NESTA abertura: daí em diante a preferência que chegar do
  // servidor não o tira do lugar.
  const mexido = useRef(false);
  const aoMudar = useRef(aoMudarQuadro);
  aoMudar.current = aoMudarQuadro;

  useEffect(() => () => {
    if (quadro.current !== null)
      cancelAnimationFrame(quadro.current);
  }, []);

  // Aplica o que o gesto calculou, uma vez por quadro.
  const pintar = useCallback(() => {
    if (quadro.current !== null)
      return;
    quadro.current = requestAnimationFrame(() => {
      quadro.current = null;
      const cartao = ref.current;
      if (!cartao)
        return;
      cartao.style.transform = `translate(${deslocamento.current.x}px, ${deslocamento.current.y}px)`;
      if (tamanho.current) {
        cartao.style.width = `${tamanho.current.largura}px`;
        cartao.style.height = `${tamanho.current.altura}px`;
        // Com tamanho dado pelo usuário, o corpo deixa a altura calculada e ROLA (CSS `x-moldura-modal`).
        cartao.dataset.redimensionado = 'true';
      }
    });
  }, [ref]);

  // Aplica o quadro guardado, ajustando-o à área: tamanho no máximo o da área, posição de modo que o
  // cartão não saia dela. Medido na hora, antes de pintar, para o cartão não "pular" diante do usuário.
  useLayoutEffect(() => {
    // Fechado: a próxima abertura parte do zero (cartão novo, sem o gesto desta).
    if (!aberto) {
      mexido.current = false;
      deslocamento.current = { x: 0, y: 0 };
      tamanho.current = null;
      return;
    }
    const cartao = ref.current;
    if (!quadroSalvo || mexido.current || !cartao)
      return;
    const area = (cartao.closest('[data-app-area]') as HTMLElement | null) ?? cartao.parentElement;
    if (!area)
      return;
    const limites = area.getBoundingClientRect();

    if (quadroSalvo.largura && quadroSalvo.altura) {
      cartao.style.minWidth = '0';
      cartao.style.maxWidth = 'none';
      cartao.style.minHeight = '0';
      cartao.style.maxHeight = 'none';
      cartao.style.width = `${Math.min(quadroSalvo.largura, limites.width)}px`;
      cartao.style.height = `${Math.min(quadroSalvo.altura, limites.height)}px`;
      tamanho.current = { largura: Math.min(quadroSalvo.largura, limites.width), altura: Math.min(quadroSalvo.altura, limites.height) };
      cartao.dataset.redimensionado = 'true';
    }

    // Posição: parte da natural (sem deslocamento), soma o guardado e recua o que passar da área.
    cartao.style.transform = 'translate(0px, 0px)';
    const natural = cartao.getBoundingClientRect();
    const x = limitar(quadroSalvo.x, limites.left - natural.left, limites.right - natural.right);
    const y = limitar(quadroSalvo.y, limites.top - natural.top, limites.bottom - natural.bottom);
    deslocamento.current = { x, y };
    cartao.style.transform = `translate(${x}px, ${y}px)`;
  }, [quadroSalvo, ref, aberto]);

  const iniciar = useCallback((pModo: Gesto['modo']) => (pEvento: ReactPointerEvent<HTMLElement>) => {
    const cartao = ref.current;
    // O limite é a ÁREA DO APP; sem área marcada, o quadro que contém o cartão.
    const area = (cartao?.closest('[data-app-area]') as HTMLElement | null) ?? cartao?.parentElement;
    // Botão do cabeçalho (fechar, extras) não arrasta: capturar o ponteiro ali engoliria o clique.
    if (!cartao || !area || pEvento.button !== 0 || (pModo === 'mover' && (pEvento.target as HTMLElement).closest('button')))
      return;

    if (pModo !== 'mover') {
      pEvento.preventDefault();
      pEvento.stopPropagation();
      // Redimensionado à mão, o cartão deixa de obedecer aos pisos e tetos das classes (min-w, max-w,
      // max-h em %): quem limita agora é a área, no cálculo abaixo.
      cartao.style.minWidth = '0';
      cartao.style.maxWidth = 'none';
      cartao.style.minHeight = '0';
      cartao.style.maxHeight = 'none';
    }

    gesto.current = {
      modo: pModo, x: pEvento.clientX, y: pEvento.clientY, base: { ...deslocamento.current },
      limites: area.getBoundingClientRect(), cartao: cartao.getBoundingClientRect(),
    };
    pEvento.currentTarget.setPointerCapture(pEvento.pointerId);
  }, [ref]);

  const mover = useCallback((pEvento: ReactPointerEvent<HTMLElement>) => {
    const g = gesto.current;
    if (!g)
      return;
    const { limites: a, cartao: c, base } = g;
    let dx = pEvento.clientX - g.x;
    let dy = pEvento.clientY - g.y;

    if (g.modo === 'mover') {
      dx = limitar(dx, a.left - c.left, a.right - c.right);
      dy = limitar(dy, a.top - c.top, a.bottom - c.bottom);
      deslocamento.current = { x: base.x + dx, y: base.y + dy };
      pintar();
      return;
    }

    const centrado = posicionamento === 'centrado';
    let largura = c.width;
    let altura = c.height;
    let x = base.x;
    let y = base.y;

    if (g.modo.includes('e')) {
      dx = limitar(dx, larguraMinima - c.width, a.right - c.right);
      largura = c.width + dx;
      x = base.x + (centrado ? dx / 2 : 0);
    } else if (g.modo.includes('w')) {
      dx = limitar(dx, a.left - c.left, c.width - larguraMinima);
      largura = c.width - dx;
      x = base.x + (centrado ? dx / 2 : dx);
    }

    if (g.modo.includes('s')) {
      dy = limitar(dy, alturaMinima - c.height, a.bottom - c.bottom);
      altura = c.height + dy;
      y = base.y + (centrado ? dy / 2 : 0);
    } else if (g.modo.includes('n')) {
      dy = limitar(dy, a.top - c.top, c.height - alturaMinima);
      altura = c.height - dy;
      y = base.y + (centrado ? dy / 2 : dy);
    }

    tamanho.current = { largura, altura };
    deslocamento.current = { x, y };
    pintar();
  }, [alturaMinima, larguraMinima, pintar, posicionamento, ref]);

  const terminar = useCallback((pEvento: ReactPointerEvent<HTMLElement>) => {
    if (gesto.current) {
      mexido.current = true;
      aoMudar.current?.({ ...deslocamento.current, ...(tamanho.current ?? {}) });
    }
    gesto.current = null;
    if (pEvento.currentTarget.hasPointerCapture(pEvento.pointerId))
      pEvento.currentTarget.releasePointerCapture(pEvento.pointerId);
  }, []);

  const alca = arrastavel
    ? { onPointerDown: iniciar('mover'), onPointerMove: mover, onPointerUp: terminar, onPointerCancel: terminar }
    : {};

  const alcasDeRedimensionar = redimensionavel
    ? (
      <>
        {ALCAS.map((pAlca) => (
          <div
            key={pAlca.direcao}
            aria-hidden="true"
            data-testid={`moldura-redimensionar-${pAlca.direcao}`}
            className={`absolute z-20 touch-none ${pAlca.classe}`}
            onPointerDown={iniciar(pAlca.direcao)}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
          />
        ))}
      </>
    )
    : null;

  return { ref, alca, alcasDeRedimensionar };
}
