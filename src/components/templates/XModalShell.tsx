/**
 * XModalShell - Canonical modal container for the whole application.
 *
 * Implements the project modal rules (skill `tootega-front`) in ONE place so every
 * modal is responsive, contained and z-index-correct by construction:
 *
 * - `variant='inline'` (default): rendered INLINE (no portal) as a child of the app's
 *   `relative` tab container, using `absolute inset-0`. The modal is bounded to the
 *   open app/tab area — it never overlays the header/sidebar/viewport. Use for every
 *   app-, grid- and editor-scoped modal.
 * - `variant='overlay'`: rendered via portal to `document.body` using `fixed inset-0`,
 *   for genuinely global modals (pre-login, account, global error/blocking dialogs).
 *
 * DIRETIVA-RAIZ (dono, 2026-07-25), binária, na palavra dele: "se foi acionado por um
 * App, ele fica contido na ÁREA DE QUEM CHAMOU, SEM EXCEÇÃO."
 *
 * O quadro é o container de quem abriu — não a tela. Modal aberto da grade fica na área
 * do App; diálogo aberto de dentro de um formulário fica DENTRO daquele formulário. Ou
 * seja: `inline`, que é o padrão. `overlay` serve só ao diálogo DA CASCA — aquele que App
 * nenhum acionou (escolha de assinante, termos legais, aviso de versão). Na dúvida, alguém
 * o acionou ⇒ `inline`.
 *
 * Cobrado por teste: `App/src/__tests__/agnostic-responsive-guard.test.ts` reprova
 * `variant="overlay"` fora da OVERLAY_ALLOWLIST.
 *
 * Racional: modal que cobre a página ROUBA O CONTEXTO. O operador perde de vista a grade
 * que estava lendo e as abas que tinha abertas, e fica sem para onde olhar enquanto
 * decide. Observado em 2026-07-25 na App de Certificados, cujo diálogo de importação
 * escurecia a tela inteira. Enunciado completo: skill `tootega-front`.
 *
 * Both variants:
 * - take their z-index from `ZIndexManager.next()` (NEVER a hardcoded `z-[…]`),
 * - are a CENTERED card, never full-screen,
 * - NUNCA passam de 90% da área do App — nem em largura, nem em altura (regra do dono,
 *   2026-07-12). A medida é do CONTAINER (a área do App para `inline`; o viewport para
 *   `overlay`): `max-w-[90%] max-h-[90%]`, com rolagem interna. O preset de tamanho é a
 *   largura MÍNIMA do card; a largura real segue o conteúdo e cresce até o teto de 90%,
 * - close ONLY by its own close/cancel button — NEVER by Escape (dono, 2026-10-17) and NEVER by a click
 *   outside the card (dono, 2026-10-25),
 * - expose `role="dialog"` + `aria-modal` and an accessible close button.
 */

import { useState, type ReactNode, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { useMolduraDeModal } from '@core/hooks/useMolduraDeModal';
import { IconButton } from '../ui/IconButton';

export type XModalShellSize = 'sm' | 'md' | 'lg' | 'xl';
export type XModalShellVariant = 'inline' | 'overlay';

export interface XModalShellProps {
  /** Header title. Omit to render a headerless shell (caller provides its own header). */
  title?: ReactNode;
  /** Optional secondary line under the title. */
  subtitle?: ReactNode;
  /** Optional node rendered left of the close button (status badge, etc.). */
  headerExtra?: ReactNode;
  /** Localized accessible label/tooltip for the close button. */
  closeLabel: string;
  /** Close handler (backdrop click, close button). */
  onClose: () => void;
  /** Optional sticky footer (action buttons). */
  footer?: ReactNode;
  /** Desktop max-width preset. Mobile is always full-screen. */
  size?: XModalShellSize;
  /** Containment strategy — see component doc. */
  variant?: XModalShellVariant;
  /** Extra classes for the scrollable content region. */
  contentClassName?: string;
  /** Tour anchor passed through to the wrapper. */
  'data-tour'?: string;
  /**
   * O cartão se ARRASTA pelo cabeçalho (dono, 2026-10-22) — sempre dentro da área que o contém, nunca
   * para fora dela (diretiva de contenção). Serve para afastar o diálogo e ver o que está por trás (a
   * grade, um documento de apoio) sem fechá-lo. Falso ⇒ fixo e centrado, como sempre.
   */
  draggable?: boolean;
  children: ReactNode;
}

// O preset é a largura MÍNIMA do card (piso, para o modal não nascer espremido); a largura
// real acompanha o conteúdo e CRESCE até o teto de 90% da área do App.
const SIZE_MIN_WIDTH: Record<XModalShellSize, string> = {
  sm: 'sm:min-w-[28rem]',
  md: 'sm:min-w-[32rem]',
  lg: 'sm:min-w-[42rem]',
  xl: 'sm:min-w-[56rem]',
};

/** Teto duro: nenhum modal passa de 90% da área do App, em largura ou altura (dono, 2026-07-12). */
const MODAL_MAX = 'max-w-[90%] max-h-[90%]';

export function XModalShell({
  title,
  subtitle,
  headerExtra,
  closeLabel,
  onClose,
  footer,
  size = 'md',
  variant = 'inline',
  contentClassName = '',
  draggable = false,
  children,
  ...rest
}: XModalShellProps): JSX.Element {
  const [zIndex] = useState(() => ZIndexManager.next());

  // MOLDURA (dono, 2026-10-25): arrastar pelo cabeçalho, redimensionar pelas arestas e cantos, em tempo
  // real e contido na área do App — tudo no `useMolduraDeModal`, a fonte única de todo cartão de diálogo.
  // `transition-none` no cartão: o `duration-200` do fade de entrada também define `transition-duration`,
  // e com a `transition-property` padrão do CSS (`all`) cada passo do gesto era ANIMADO em 200 ms.
  const moldura = useMolduraDeModal({ arrastavel: draggable });

  // ESC NÃO FECHA (dono, 2026-10-17): o diálogo aberto por um botão ou pela grade só sai pelo seu
  // botão de fechar/cancelar. O ouvinte global de teclado que havia aqui fechava também o diálogo
  // de baixo quando o de cima (um picker, uma confirmação) recebia o Esc — dois fechamentos num toque.
  const positionClass = variant === 'overlay' ? 'fixed' : 'absolute';

  const node = (
    <div
      className={`${positionClass} inset-0 flex items-center justify-center`}
      style={{ zIndex }}
      data-tour={rest['data-tour']}
    >
      <div
        className="absolute inset-0 bg-black/40 sm:backdrop-blur-sm animate-in fade-in duration-200"
        role="presentation"
        // CLICAR FORA NÃO FECHA (dono, 2026-10-25, binária — vale para TODO modal): um clique perdido
        // ao lado do cartão descartava o que se digitara. O diálogo só sai pelo seu botão de
        // fechar/cancelar, como já não saía pelo Esc. Não há opção para religar.
      />

      <div
        ref={moldura.ref}
        className={`
          x-moldura-modal relative flex flex-col bg-brand-surface
          animate-in fade-in duration-200
          w-full sm:w-fit ${SIZE_MIN_WIDTH[size]} ${MODAL_MAX}
          rounded-2xl will-change-transform transition-none
        `}
        role="dialog"
        aria-modal="true"
      >
        {(title || headerExtra) && (
          <div
            className={`flex items-center justify-between gap-2 px-4 sm:px-6 py-2.5 border-b border-border-light shrink-0 bg-brand-surface rounded-t-[14px] ${
              draggable ? 'cursor-move select-none touch-none' : ''}`}
            {...moldura.alca}
            data-testid={draggable ? 'modal-alca-arrasto' : undefined}
          >
            {/* Título e subtítulo inteiros, numa linha (dono, 2026-10-25): o diálogo se alarga até o teto da área. */}
            <div className="whitespace-nowrap">
              {title && (
                <h2 className="text-base sm:text-lg font-semibold text-brand-text-primary">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-ui-xs text-brand-text-secondary">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerExtra}
              <IconButton aria-label={closeLabel} onClick={onClose}>
                <X className="w-5 h-5" />
              </IconButton>
            </div>
          </div>
        )}

        <div className={`flex-1 min-h-0 overflow-y-auto ${contentClassName}`} data-corpo-do-modal>
          {children}
        </div>

        {footer && (
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 border-t border-border-light bg-muted-bg shrink-0 rounded-b-[14px]">
            {footer}
          </div>
        )}

        {moldura.alcasDeRedimensionar}
      </div>
    </div>
  );

  if (variant === 'overlay')
    return createPortal(node, document.body);

  return node;
}
