/**
 * controleRemoto — a parte PURA do controle da aba no suporte remoto: o vocabulário dos gestos que o
 * atendente envia e a conta que leva um ponto do vídeo a um ponto da tela de quem chamou.
 *
 * O navegador não entrega o controle de uma aba a outra pessoa. O que existe é isto: o atendente age
 * sobre o VÍDEO da tela, cada gesto viaja pelo canal de dados do WebRTC como uma mensagem pequena, e o
 * front de quem chamou o reproduz dentro da própria página (`reproducaoDeGesto`). As coordenadas vão
 * NORMALIZADAS (0 a 1) para não depender do tamanho em que o vídeo aparece do lado do atendente.
 *
 * Tudo o que chega pelo canal é conferido por `lerGesto` antes de virar ação: a outra ponta é um
 * atendente autenticado, mas mensagem que vai mexer na tela de alguém não entra sem conferência.
 */

export type GestoRemoto =
  | { t: 'mover'; x: number; y: number }
  | { t: 'pressionar'; x: number; y: number; b: number }
  | { t: 'soltar'; x: number; y: number; b: number }
  | { t: 'rolar'; x: number; y: number; dx: number; dy: number }
  | { t: 'tecla'; k: string; ctrl: boolean; shift: boolean; alt: boolean };

/** Aviso de quem chamou para o atendente: o gesto não foi aplicado, e por quê. */
export type AvisoDeControle = { t: 'bloqueio'; motivo: 'senha' | 'usuario' };

export interface Caixa {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Ponto {
  x: number;
  y: number;
}

/** Maior nome de tecla aceito (`ArrowRight`, `Backspace`, `F12`…); acima disso não é tecla. */
const TAMANHO_MAXIMO_DA_TECLA = 24;

/** Rolagem máxima por gesto, em pixels: um giro de roda, não um salto para o fim da página. */
const ROLAGEM_MAXIMA = 2000;

/**
 * O ponto do vídeo (0 a 1 em cada eixo) sob o ponteiro, ou `null` quando o ponteiro está sobre a faixa
 * preta que sobra em volta da imagem.
 *
 * O elemento de vídeo mostra a imagem inteira, centrada, sem cortar (`object-contain`): quando a proporção
 * da tela de quem chamou difere da caixa do vídeo, sobram faixas em cima e embaixo ou dos lados. A conta
 * desconta essas faixas — sem isso o clique cairia deslocado, e tanto mais quanto mais diferentes as proporções.
 */
export function pontoNoVideo(
  pClienteX: number,
  pClienteY: number,
  pCaixa: Caixa,
  pLarguraDoVideo: number,
  pAlturaDoVideo: number
): Ponto | null {
  if (pCaixa.width <= 0 || pCaixa.height <= 0 || pLarguraDoVideo <= 0 || pAlturaDoVideo <= 0)
    return null;

  const escala = Math.min(pCaixa.width / pLarguraDoVideo, pCaixa.height / pAlturaDoVideo);
  const largura = pLarguraDoVideo * escala;
  const altura = pAlturaDoVideo * escala;
  const esquerda = pCaixa.left + (pCaixa.width - largura) / 2;
  const topo = pCaixa.top + (pCaixa.height - altura) / 2;

  const x = (pClienteX - esquerda) / largura;
  const y = (pClienteY - topo) / altura;

  if (x < 0 || x > 1 || y < 0 || y > 1)
    return null;

  return { x, y };
}

/** O ponto normalizado, em pixels da janela de quem chamou. Fica sempre dentro dela. */
export function pontoNaJanela(pPonto: Ponto, pLargura: number, pAltura: number): Ponto {
  return {
    x: Math.min(Math.max(0, pLargura - 1), Math.max(0, Math.round(pPonto.x * pLargura))),
    y: Math.min(Math.max(0, pAltura - 1), Math.max(0, Math.round(pPonto.y * pAltura))),
  };
}

export function serializarGesto(pGesto: GestoRemoto | AvisoDeControle): string {
  return JSON.stringify(pGesto);
}

const unidade = (pValor: unknown): pValor is number =>
  typeof pValor === 'number' && Number.isFinite(pValor) && pValor >= 0 && pValor <= 1;

const botao = (pValor: unknown): pValor is number => pValor === 0 || pValor === 1 || pValor === 2;

const limitado = (pValor: unknown): number | null =>
  typeof pValor === 'number' && Number.isFinite(pValor)
    ? Math.min(ROLAGEM_MAXIMA, Math.max(-ROLAGEM_MAXIMA, pValor))
    : null;

/**
 * Lê um gesto recebido pelo canal de dados. Devolve `null` para tudo o que não for um gesto bem formado:
 * texto que não é JSON, tipo desconhecido, coordenada fora de 0 a 1, tecla sem nome.
 */
export function lerGesto(pTexto: string): GestoRemoto | null {
  let bruto: unknown;

  try {
    bruto = JSON.parse(pTexto);
  } catch {
    return null;
  }

  if (typeof bruto !== 'object' || bruto === null)
    return null;

  const gesto = bruto as Record<string, unknown>;

  switch (gesto.t) {
    case 'mover':
      return unidade(gesto.x) && unidade(gesto.y) ? { t: 'mover', x: gesto.x, y: gesto.y } : null;

    case 'pressionar':
    case 'soltar':
      return unidade(gesto.x) && unidade(gesto.y) && botao(gesto.b)
        ? { t: gesto.t, x: gesto.x, y: gesto.y, b: gesto.b }
        : null;

    case 'rolar': {
      const dx = limitado(gesto.dx);
      const dy = limitado(gesto.dy);

      return unidade(gesto.x) && unidade(gesto.y) && dx !== null && dy !== null
        ? { t: 'rolar', x: gesto.x, y: gesto.y, dx, dy }
        : null;
    }

    case 'tecla':
      return typeof gesto.k === 'string' && gesto.k.length > 0 && gesto.k.length <= TAMANHO_MAXIMO_DA_TECLA
        ? { t: 'tecla', k: gesto.k, ctrl: gesto.ctrl === true, shift: gesto.shift === true, alt: gesto.alt === true }
        : null;

    default:
      return null;
  }
}

/** Lê um aviso de bloqueio vindo de quem chamou. `null` para qualquer outra coisa. */
export function lerAviso(pTexto: string): AvisoDeControle | null {
  try {
    const bruto = JSON.parse(pTexto) as Record<string, unknown> | null;

    return bruto && bruto.t === 'bloqueio' && (bruto.motivo === 'senha' || bruto.motivo === 'usuario')
      ? { t: 'bloqueio', motivo: bruto.motivo }
      : null;
  } catch {
    return null;
  }
}

/** A tecla escreve um caractere (letra, número, sinal, espaço), em vez de comandar (Enter, setas…). */
export function teclaEscreve(pGesto: { k: string; ctrl: boolean; alt: boolean }): boolean {
  return [...pGesto.k].length === 1 && !pGesto.ctrl && !pGesto.alt;
}

/**
 * Texto de um campo depois de uma tecla, com a posição em que o cursor fica. Cobre o que se digita num
 * campo de texto: caractere, Backspace e Delete, com ou sem trecho selecionado. `null` = a tecla não
 * muda o texto (seta, Enter, Tab…), e quem chama decide o que ela faz.
 */
export function textoAposTecla(
  pTexto: string,
  pInicio: number,
  pFim: number,
  pGesto: { k: string; ctrl: boolean; alt: boolean }
): { texto: string; cursor: number } | null {
  const inicio = Math.max(0, Math.min(pInicio, pFim, pTexto.length));
  const fim = Math.max(inicio, Math.min(Math.max(pInicio, pFim), pTexto.length));
  const selecionado = fim > inicio;

  if (teclaEscreve(pGesto))
    return { texto: pTexto.slice(0, inicio) + pGesto.k + pTexto.slice(fim), cursor: inicio + pGesto.k.length };

  if (pGesto.ctrl || pGesto.alt)
    return null;

  if (pGesto.k === 'Backspace') {
    if (selecionado)
      return { texto: pTexto.slice(0, inicio) + pTexto.slice(fim), cursor: inicio };

    return inicio === 0 ? null : { texto: pTexto.slice(0, inicio - 1) + pTexto.slice(inicio), cursor: inicio - 1 };
  }

  if (pGesto.k === 'Delete') {
    if (selecionado)
      return { texto: pTexto.slice(0, inicio) + pTexto.slice(fim), cursor: inicio };

    return inicio >= pTexto.length ? null : { texto: pTexto.slice(0, inicio) + pTexto.slice(inicio + 1), cursor: inicio };
  }

  return null;
}
