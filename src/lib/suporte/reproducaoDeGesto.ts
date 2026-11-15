/**
 * reproducaoDeGesto — reproduz, na página de quem chamou o suporte, os gestos que o atendente fez sobre o
 * vídeo da tela. É o "controle da aba": eventos criados aqui, dentro da própria página.
 *
 * <b>O que isto alcança e o que não alcança.</b> Evento criado por script não é confiável para o
 * navegador (`isTrusted = false`): ele chega aos componentes da página — clique, foco, digitação,
 * rolagem —, mas não abre o seletor de arquivos, não dispara download, não mexe na área de transferência
 * nem em diálogo do navegador. O controle vale para o que é desta aplicação, e só.
 *
 * <b>Três travas, todas binárias:</b>
 * 1. campo de SENHA não recebe digitação remota — senha é de quem a conhece;
 * 2. gesto do PRÓPRIO usuário tem prioridade: enquanto ele mexe no mouse ou no teclado, o gesto remoto
 *    é descartado (duas pessoas no mesmo ponteiro só produzem clique errado);
 * 3. o que é do próprio suporte na tela (a barra com o botão de encerrar) não recebe gesto remoto — quem
 *    encerra a sessão de quem chamou é ele mesmo, ou o atendente pelo lado dele.
 */

import { pontoNaJanela, teclaEscreve, textoAposTecla, type GestoRemoto } from './controleRemoto';

/** O que foi feito do gesto. `senha` e `usuario` voltam ao atendente como aviso. */
export type DesfechoDoGesto = 'aplicado' | 'ignorado' | 'senha' | 'usuario';

/** Marca, no DOM, o que é do próprio suporte e não recebe gesto remoto. */
export const ATRIBUTO_DO_SUPORTE = 'data-suporte-local';

/** Tempo, em ms, em que o gesto remoto cede a vez depois de um gesto do próprio usuário. */
export const PRIORIDADE_DO_USUARIO_MS = 1200;

const INTERVALO_DO_DUPLO_CLIQUE_MS = 400;

const FOCAVEIS = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

const TABULAVEIS = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), '
  + 'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const EVENTOS_DO_USUARIO = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const;

type CampoDeTexto = HTMLInputElement | HTMLTextAreaElement;

const ehCampoDeTexto = (pElemento: Element | null): pElemento is CampoDeTexto =>
  pElemento instanceof HTMLTextAreaElement
  || (pElemento instanceof HTMLInputElement
    && !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image', 'hidden'].includes(pElemento.type));

export class ReprodutorDeGestos {
  private readonly _Documento: Document;
  private readonly _AoMover: (pX: number, pY: number) => void;
  private readonly _Agora: () => number;
  private readonly _EhDoUsuario: (pEvento: Event) => boolean;
  private _UltimoGestoDoUsuario = Number.NEGATIVE_INFINITY;
  private _Pressionado: Element | null = null;
  private _UltimoClique: { alvo: Element; instante: number } | null = null;

  /**
   * @param pAoMover Chamado a cada gesto com posição, em pixels da janela: é onde quem hospeda desenha o
   *                 ponteiro do atendente, para o usuário ver o que está sendo apontado.
   * @param pEhDoUsuario Diz se um evento veio do próprio usuário. O padrão é o do navegador (`isTrusted`):
   *                 o evento que este reprodutor cria não é confiável e não conta como gesto do usuário.
   */
  constructor(
    pAoMover: (pX: number, pY: number) => void,
    pDocumento: Document = document,
    pAgora: () => number = () => Date.now(),
    pEhDoUsuario: (pEvento: Event) => boolean = (pEvento) => pEvento.isTrusted
  ) {
    this._Documento = pDocumento;
    this._AoMover = pAoMover;
    this._Agora = pAgora;
    this._EhDoUsuario = pEhDoUsuario;

    for (const evento of EVENTOS_DO_USUARIO)
      this._Documento.addEventListener(evento, this._MarcarGestoDoUsuario, { capture: true, passive: true });
  }

  /** Para de escutar os gestos do usuário. Chamar ao fim do atendimento. */
  parar(): void {
    for (const evento of EVENTOS_DO_USUARIO)
      this._Documento.removeEventListener(evento, this._MarcarGestoDoUsuario, { capture: true });
  }

  aplicar(pGesto: GestoRemoto): DesfechoDoGesto {
    if (pGesto.t !== 'tecla') {
      const janela = this._Documento.defaultView;
      const ponto = pontoNaJanela(pGesto, janela?.innerWidth ?? 0, janela?.innerHeight ?? 0);

      // O ponteiro do atendente aparece SEMPRE, mesmo quando o gesto é descartado: apontar não é operar.
      this._AoMover(ponto.x, ponto.y);

      if (this._UsuarioTemAVez())
        return pGesto.t === 'mover' ? 'ignorado' : 'usuario';

      const alvo = this._Documento.elementFromPoint(ponto.x, ponto.y);
      if (!alvo || alvo.closest(`[${ATRIBUTO_DO_SUPORTE}]`))
        return 'ignorado';

      switch (pGesto.t) {
        case 'mover':
          this._Ponteiro(alvo, 'pointermove', 'mousemove', ponto.x, ponto.y, 0);
          return 'aplicado';
        case 'pressionar':
          return this._Pressionar(alvo, ponto.x, ponto.y, pGesto.b);
        case 'soltar':
          return this._Soltar(alvo, ponto.x, ponto.y, pGesto.b);
        case 'rolar':
          return this._Rolar(alvo, pGesto.dx, pGesto.dy);
      }
    }

    return this._UsuarioTemAVez() ? 'usuario' : this._Tecla(pGesto);
  }

  // Só evento do próprio usuário conta: o que este reprodutor cria tem isTrusted falso e não se marca.
  private readonly _MarcarGestoDoUsuario = (pEvento: Event): void => {
    if (this._EhDoUsuario(pEvento))
      this._UltimoGestoDoUsuario = this._Agora();
  };

  private _UsuarioTemAVez(): boolean {
    return this._Agora() - this._UltimoGestoDoUsuario < PRIORIDADE_DO_USUARIO_MS;
  }

  private _Ponteiro(pAlvo: Element, pPonteiro: string, pMouse: string, pX: number, pY: number, pBotao: number): boolean {
    const base = {
      bubbles: true, cancelable: true, composed: true,
      clientX: pX, clientY: pY, button: pBotao, buttons: pMouse === 'mouseup' || pMouse === 'mousemove' ? 0 : 1,
    };

    // jsdom e navegadores antigos não têm PointerEvent; o evento de mouse basta para eles.
    if (typeof PointerEvent === 'function')
      pAlvo.dispatchEvent(new PointerEvent(pPonteiro, { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true }));

    return pAlvo.dispatchEvent(new MouseEvent(pMouse, base));
  }

  private _Pressionar(pAlvo: Element, pX: number, pY: number, pBotao: number): DesfechoDoGesto {
    this._Pressionado = pAlvo;

    const seguiu = this._Ponteiro(pAlvo, 'pointerdown', 'mousedown', pX, pY, pBotao);

    // Clique de verdade leva o foco ao que foi clicado; evento criado por script não leva, e sem foco a
    // digitação que vem em seguida não teria destino. A página que cancelou o mousedown fica sem foco, como
    // ficaria com o clique de verdade.
    if (seguiu) {
      const focavel = pAlvo.closest<HTMLElement>(FOCAVEIS);

      if (focavel)
        focavel.focus();
      else if (this._Documento.activeElement instanceof HTMLElement)
        this._Documento.activeElement.blur();
    }

    return 'aplicado';
  }

  private _Soltar(pAlvo: Element, pX: number, pY: number, pBotao: number): DesfechoDoGesto {
    const pressionado = this._Pressionado;

    this._Pressionado = null;
    this._Ponteiro(pAlvo, 'pointerup', 'mouseup', pX, pY, pBotao);

    // Clique é pressionar e soltar no MESMO elemento (ou dentro dele). Soltar em outro lugar é arrasto.
    if (!pressionado || !(pressionado === pAlvo || pressionado.contains(pAlvo) || pAlvo.contains(pressionado)))
      return 'aplicado';

    const base = { bubbles: true, cancelable: true, composed: true, clientX: pX, clientY: pY, button: pBotao };

    if (pBotao === 2) {
      pAlvo.dispatchEvent(new MouseEvent('contextmenu', base));
      return 'aplicado';
    }

    if (pBotao !== 0)
      return 'aplicado';

    pAlvo.dispatchEvent(new MouseEvent('click', { ...base, detail: 1 }));

    const agora = this._Agora();
    const anterior = this._UltimoClique;

    if (anterior && anterior.alvo === pAlvo && agora - anterior.instante <= INTERVALO_DO_DUPLO_CLIQUE_MS) {
      pAlvo.dispatchEvent(new MouseEvent('dblclick', { ...base, detail: 2 }));
      this._UltimoClique = null;
    } else {
      this._UltimoClique = { alvo: pAlvo, instante: agora };
    }

    return 'aplicado';
  }

  private _Rolar(pAlvo: Element, pDX: number, pDY: number): DesfechoDoGesto {
    const seguiu = pAlvo.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, composed: true, deltaX: pDX, deltaY: pDY,
    }));

    if (!seguiu)
      return 'aplicado';

    // Rola o primeiro ancestral que de fato rola naquele sentido; sem nenhum, a página.
    for (let elemento: Element | null = pAlvo; elemento; elemento = elemento.parentElement) {
      const rolaNaVertical = pDY !== 0 && elemento.scrollHeight > elemento.clientHeight;
      const rolaNaHorizontal = pDX !== 0 && elemento.scrollWidth > elemento.clientWidth;

      if (!rolaNaVertical && !rolaNaHorizontal)
        continue;

      const estilo = this._Documento.defaultView?.getComputedStyle(elemento);
      const transbordo = `${estilo?.overflowY ?? ''} ${estilo?.overflowX ?? ''}`;

      if (/(auto|scroll)/.test(transbordo)) {
        elemento.scrollLeft += pDX;
        elemento.scrollTop += pDY;
        return 'aplicado';
      }
    }

    this._Documento.defaultView?.scrollBy(pDX, pDY);

    return 'aplicado';
  }

  private _Tecla(pGesto: Extract<GestoRemoto, { t: 'tecla' }>): DesfechoDoGesto {
    const alvo = this._Documento.activeElement ?? this._Documento.body;

    if (!alvo || alvo.closest(`[${ATRIBUTO_DO_SUPORTE}]`))
      return 'ignorado';

    if (alvo instanceof HTMLInputElement && alvo.type === 'password')
      return 'senha';

    const base = {
      bubbles: true, cancelable: true, composed: true,
      key: pGesto.k, ctrlKey: pGesto.ctrl, shiftKey: pGesto.shift, altKey: pGesto.alt,
    };

    // A página pode tratar a tecla por conta própria (atalho, navegação numa lista) e cancelá-la; aí o
    // efeito padrão não se aplica, como numa tecla de verdade.
    if (alvo.dispatchEvent(new KeyboardEvent('keydown', base)))
      this._EfeitoPadraoDaTecla(alvo, pGesto);

    alvo.dispatchEvent(new KeyboardEvent('keyup', base));

    return 'aplicado';
  }

  private _EfeitoPadraoDaTecla(pAlvo: Element, pGesto: Extract<GestoRemoto, { t: 'tecla' }>): void {
    if (pGesto.k === 'Tab' && !pGesto.ctrl && !pGesto.alt) {
      this._MoverFoco(pAlvo, pGesto.shift ? -1 : 1);
      return;
    }

    if (pGesto.k === 'Enter' && !pGesto.ctrl && !pGesto.alt) {
      if (pAlvo instanceof HTMLTextAreaElement)
        this._Escrever(pAlvo, { k: '\n', ctrl: false, alt: false });
      else if (pAlvo instanceof HTMLInputElement && ehCampoDeTexto(pAlvo))
        pAlvo.form?.requestSubmit?.();
      else if (pAlvo instanceof HTMLElement && pAlvo.matches('button, a[href], [role="button"], input'))
        pAlvo.click();

      return;
    }

    if (pGesto.k === ' ' && pAlvo instanceof HTMLElement && pAlvo.matches('button, [role="button"], input[type="checkbox"], input[type="radio"]')) {
      pAlvo.click();
      return;
    }

    if (ehCampoDeTexto(pAlvo) && !pAlvo.readOnly && !pAlvo.disabled)
      this._Escrever(pAlvo, pGesto);
    else if (pAlvo instanceof HTMLElement && pAlvo.isContentEditable && teclaEscreve(pGesto))
      this._Documento.execCommand?.('insertText', false, pGesto.k);
  }

  private _Escrever(pCampo: CampoDeTexto, pGesto: { k: string; ctrl: boolean; alt: boolean }): void {
    // Campo que não expõe seleção (número, e-mail, data) devolve nulo: escreve-se no fim.
    let inicio: number | null = null;
    let fim: number | null = null;

    try {
      inicio = pCampo.selectionStart;
      fim = pCampo.selectionEnd;
    } catch {
      // Alguns tipos de campo lançam ao ler a seleção; vale o fim do texto.
    }

    const resultado = textoAposTecla(pCampo.value, inicio ?? pCampo.value.length, fim ?? pCampo.value.length, pGesto);
    if (!resultado)
      return;

    // O valor entra pelo setter NATIVO do protótipo: o React guarda o seu próprio setter no elemento para
    // saber o que ele mesmo escreveu, e uma atribuição direta seria tomada como "nada mudou".
    const prototipo = pCampo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototipo, 'value')?.set;

    if (setter)
      setter.call(pCampo, resultado.texto);
    else
      pCampo.value = resultado.texto;

    try {
      pCampo.setSelectionRange(resultado.cursor, resultado.cursor);
    } catch {
      // Campo sem seleção: o cursor fica onde o navegador o puser.
    }

    pCampo.dispatchEvent(new Event('input', { bubbles: true }));
  }

  private _MoverFoco(pAtual: Element, pPasso: 1 | -1): void {
    const tabulaveis = Array.from(this._Documento.querySelectorAll<HTMLElement>(TABULAVEIS))
      .filter((pElemento) => !pElemento.closest(`[${ATRIBUTO_DO_SUPORTE}]`));

    if (tabulaveis.length === 0)
      return;

    const indice = tabulaveis.indexOf(pAtual as HTMLElement);
    const proximo = indice < 0
      ? (pPasso === 1 ? 0 : tabulaveis.length - 1)
      : (indice + pPasso + tabulaveis.length) % tabulaveis.length;

    tabulaveis[proximo].focus();
  }
}
