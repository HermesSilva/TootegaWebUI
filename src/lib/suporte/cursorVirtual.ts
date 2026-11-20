/**
 * cursorVirtual — onde está o cursor de texto de um campo, em pixels da janela, para desenhar o CURSOR VIRTUAL
 * do suporte remoto (dono, 2026-11-19).
 *
 * <b>Por que virtual.</b> O cursor de texto do navegador só pisca na janela que está em foco. Quando o atendente
 * opera a aba de quem chamou, a janela de quem chamou quase nunca está em foco (quem chamou está olhando, não
 * mexendo): o campo recebe o foco e o texto, mas ninguém vê ONDE o atendente está escrevendo. O suporte desenha
 * então um traço piscando no lugar do cursor; com a janela em foco, vale o do navegador, e o virtual some.
 *
 * <b>Como se mede.</b> O navegador não diz em que pixel está o cursor de um `input`. Mede-se num ESPELHO: um
 * elemento invisível com a mesma fonte, os mesmos espaçamentos e o texto até o cursor; a largura desse texto é a
 * posição do cursor, descontada a rolagem do campo.
 */

/** Campo em que se escreve: `input` de texto (não caixa, botão, arquivo…) ou `textarea`. */
export type CampoDeEscrita = HTMLInputElement | HTMLTextAreaElement;

const TIPOS_DE_INPUT_SEM_CURSOR = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image', 'hidden'];

/** As propriedades de estilo que mudam onde o texto cai: o espelho as copia do campo. */
const PROPRIEDADES_DO_TEXTO = [
  'boxSizing', 'width', 'borderLeftWidth', 'borderRightWidth', 'borderTopWidth', 'borderBottomWidth',
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'fontVariant', 'fontStretch', 'letterSpacing', 'wordSpacing', 'textTransform', 'textIndent', 'lineHeight', 'tabSize',
] as const;

export function ehCampoDeEscrita(pElemento: Element | null): pElemento is CampoDeEscrita {
  return pElemento instanceof HTMLTextAreaElement
    || (pElemento instanceof HTMLInputElement && !TIPOS_DE_INPUT_SEM_CURSOR.includes(pElemento.type));
}

/** O cursor de texto: o ponto de cima do traço e a altura dele, em pixels da janela. */
export interface PosicaoDoCursor {
  x: number;
  y: number;
  altura: number;
}

/**
 * Onde está o cursor de texto do campo, ou `null` quando o campo não tem cursor medível (campo sem seleção,
 * como `email` e `number` em alguns navegadores, ou cursor fora da parte visível do campo).
 */
export function posicaoDoCursor(pCampo: CampoDeEscrita): PosicaoDoCursor | null {
  let inicio: number | null;

  try {
    inicio = pCampo.selectionStart;
  } catch {
    return null;
  }

  if (inicio === null)
    return null;

  const documento = pCampo.ownerDocument;
  const janela = documento.defaultView;
  if (!janela)
    return null;

  const estilo = janela.getComputedStyle(pCampo);
  const espelho = documento.createElement('div');
  const ehArea = pCampo instanceof HTMLTextAreaElement;

  for (const propriedade of PROPRIEDADES_DO_TEXTO)
    espelho.style[propriedade] = estilo[propriedade];

  espelho.style.position = 'absolute';
  espelho.style.visibility = 'hidden';
  espelho.style.top = '0';
  espelho.style.left = '-9999px';
  espelho.style.overflow = 'hidden';
  espelho.style.whiteSpace = ehArea ? 'pre-wrap' : 'pre';
  espelho.style.wordWrap = ehArea ? 'break-word' : 'normal';
  if (!ehArea)
    espelho.style.width = 'auto';

  // Senha aparece como bolinhas: a medida tem de ser a das bolinhas, não a do texto.
  const valor = pCampo instanceof HTMLInputElement && pCampo.type === 'password' ? '•'.repeat(pCampo.value.length) : pCampo.value;

  espelho.textContent = valor.slice(0, inicio);

  const marcador = documento.createElement('span');
  // O marcador precisa de conteúdo para ter altura; o resto do texto mantém a quebra de linha da textarea.
  marcador.textContent = valor.slice(inicio) || '.';
  espelho.appendChild(marcador);
  documento.body.appendChild(espelho);

  try {
    const caixa = pCampo.getBoundingClientRect();
    const alturaDaLinha = Number.parseFloat(estilo.lineHeight) || Number.parseFloat(estilo.fontSize) * 1.2 || 16;
    const borda = Number.parseFloat(estilo.borderLeftWidth) || 0;
    const bordaDeCima = Number.parseFloat(estilo.borderTopWidth) || 0;

    const x = caixa.left + borda + marcador.offsetLeft - pCampo.scrollLeft;
    const y = ehArea
      ? caixa.top + bordaDeCima + marcador.offsetTop - pCampo.scrollTop
      : caixa.top + (caixa.height - alturaDaLinha) / 2;

    // Cursor rolado para fora da parte visível do campo: não há onde desenhar.
    if (x < caixa.left || x > caixa.right || y < caixa.top - 1 || y + alturaDaLinha > caixa.bottom + 1)
      return null;

    return { x: Math.round(x), y: Math.round(y), altura: Math.round(alturaDaLinha) };
  } finally {
    espelho.remove();
  }
}
