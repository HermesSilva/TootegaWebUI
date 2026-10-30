/**
 * XHint — dica flutuante (tooltip) da plataforma.
 *
 * Substitui o atributo `title` nativo, que o navegador desenha à sua maneira: fonte do sistema,
 * atraso longo, uma só linha, sem cor e sem ênfase. O XHint é um painel próprio — borda suave,
 * sombra leve, conteúdo rico — e vale para qualquer superfície: botão, ícone, célula de grade,
 * rótulo de formulário.
 *
 * A sombra desenha com a cor OPOSTA à superfície, e por isso vive no tema (`--hint-shadow`, em
 * `styles/index.css`), não aqui: em tema escuro é um halo de LUZ — sombra preta sobre fundo escuro
 * não se vê; em tema claro é o vulto escuro clássico. Três camadas nos dois casos: contorno de 1px,
 * halo curto que descola o painel, halo largo e difuso que o faz pairar. A borda e os fundos das
 * caixas de tecla/código seguem a mesma lógica (`--hint-border`, `--hint-inset`).
 *
 * Forma do conteúdo (as três se combinam):
 *   - `label`     — a linha forte, o que o controle faz;
 *   - `body`      — o detalhe: uma ou mais linhas, ou JSX inteiro quando o texto precisa de cor;
 *   - `shortcut`  — a tecla de atalho, quando existir.
 *
 * Cor: `tone` pinta a barra lateral e o ícone do painel, não o texto — o corpo continua legível.
 * Para colorir trechos do texto, passe JSX em `body` e use as classes de ênfase exportadas
 * (`hintEmphasis`), que já respeitam o tema.
 *
 * Acessibilidade: o painel é `role="tooltip"` e é anunciado por `aria-describedby`. Abre no hover e
 * também no FOCO do teclado, e fecha com `Escape` — um hint que só aparece no mouse não existe para
 * quem navega por teclado. Como o painel é meramente descritivo, ele não recebe foco.
 *
 * O XHint recebe TEXTO PRONTO, em pt-BR — como todo o front: o texto nasce escrito no back ou em
 * quem chama, e o componente só o exibe.
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  type ReactNode,
  type JSX,
} from 'react';
import { createPortal } from 'react-dom';
import { Info, CheckCircle2, AlertTriangle, OctagonAlert } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type XHintTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type XHintPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface XHintProps {
  /** Linha forte do painel. Texto pronto. */
  label?: ReactNode;
  /** Detalhe. Aceita JSX — é aqui que o texto ganha cor. */
  body?: ReactNode;
  /** Tecla de atalho, ex.: "Esc", "Ctrl+S". */
  shortcut?: string;
  /** Tom do painel: pinta a barra lateral e o ícone. */
  tone?: XHintTone;
  /** Lado preferido. Se não couber na viewport, o painel vira para o lado oposto. */
  placement?: XHintPlacement;
  /** Atraso até abrir, em milissegundos. Evita painel piscando ao varrer o mouse pela tela. */
  delay?: number;
  /** O controle que dispara o hint. */
  children: ReactNode;
  /** Classe do invólucro. O invólucro é `inline-flex` para não alterar o layout do filho. */
  className?: string;
}

// ============================================================================
// Tone
// ============================================================================

// Cores fixas, não as variáveis de tema: --info é laranja em um dos temas, e o tom do hint precisa
// dizer a mesma coisa em todos eles. Barra lateral e ícone carregam a cor; o texto permanece neutro.
const TONES: Record<XHintTone, { bar: string; icon: string; Icon: typeof Info | null }> = {
  neutral: { bar: 'bg-slate-400/60', icon: 'text-slate-400', Icon: null },
  info: { bar: 'bg-sky-400', icon: 'text-sky-400', Icon: Info },
  success: { bar: 'bg-emerald-400', icon: 'text-emerald-400', Icon: CheckCircle2 },
  warning: { bar: 'bg-amber-400', icon: 'text-amber-400', Icon: AlertTriangle },
  danger: { bar: 'bg-red-400', icon: 'text-red-400', Icon: OctagonAlert },
};

/** Classes de ênfase para colorir trechos do `body`. Seguem o tema. */
export const hintEmphasis = {
  strong: 'font-medium text-brand-text-primary',
  muted: 'text-brand-text-muted',
  info: 'text-sky-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
  code: 'px-1 py-0.5 rounded bg-[hsl(var(--hint-inset)/0.10)] font-mono text-ui-xs text-brand-text-primary',
} as const;

// ============================================================================
// Positioning
// ============================================================================

const GAP = 8;       // distância entre o controle e o painel
const MARGIN = 8;    // respiro mínimo até a borda da viewport

interface Position {
  top: number;
  left: number;
  placement: XHintPlacement;
}

function computePosition(
  pAnchor: DOMRect,
  pPanel: { width: number; height: number },
  pPreferred: XHintPlacement,
): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const fits: Record<XHintPlacement, boolean> = {
    top: pAnchor.top - pPanel.height - GAP >= MARGIN,
    bottom: pAnchor.bottom + pPanel.height + GAP <= vh - MARGIN,
    left: pAnchor.left - pPanel.width - GAP >= MARGIN,
    right: pAnchor.right + pPanel.width + GAP <= vw - MARGIN,
  };

  const opposite: Record<XHintPlacement, XHintPlacement> = {
    top: 'bottom', bottom: 'top', left: 'right', right: 'left',
  };

  // Vira para o lado oposto quando o preferido não cabe; se nenhum dos dois couber, mantém o
  // preferido e deixa o travamento na viewport (abaixo) resolver.
  const placement = fits[pPreferred] ? pPreferred
    : fits[opposite[pPreferred]] ? opposite[pPreferred]
    : pPreferred;

  let top: number;
  let left: number;

  if (placement === 'top' || placement === 'bottom') {
    top = placement === 'top'
      ? pAnchor.top - pPanel.height - GAP
      : pAnchor.bottom + GAP;
    left = pAnchor.left + pAnchor.width / 2 - pPanel.width / 2;
  } else {
    top = pAnchor.top + pAnchor.height / 2 - pPanel.height / 2;
    left = placement === 'left'
      ? pAnchor.left - pPanel.width - GAP
      : pAnchor.right + GAP;
  }

  // Trava dentro da viewport: um painel cortado na borda não se lê.
  left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - pPanel.width - MARGIN));
  top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - pPanel.height - MARGIN));

  return { top, left, placement };
}

// ============================================================================
// Component
// ============================================================================

export function XHint({
  label,
  body,
  shortcut,
  tone = 'neutral',
  placement = 'top',
  delay = 350,
  children,
  className = '',
}: XHintProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimer = useRef<number | null>(null);

  const hintID = useId();
  // O ATALHO TAMBÉM É CONTEÚDO. Sem ele nesta conta, um hint que traz SÓ a tecla ("Esc") nunca
  // abria — e o componente tem um ramo escrito exatamente para esse caso (`shortcut && !label`),
  // que assim ficava inalcançável. O painel existe para mostrar o que o usuário não sabe, e a
  // tecla de atalho é o exemplo típico disso.
  const hasContent = Boolean(label || body || shortcut);

  // ---------------------------------------------------------------------------
  // Abertura e fechamento
  // ---------------------------------------------------------------------------

  const cancelPendingOpen = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);

  const open = useCallback((pImmediate = false) => {
    if (!hasContent)
      return;

    cancelPendingOpen();

    if (pImmediate) {
      setIsOpen(true);
      return;
    }

    openTimer.current = window.setTimeout(() => setIsOpen(true), delay);
  }, [hasContent, delay, cancelPendingOpen]);

  const close = useCallback(() => {
    cancelPendingOpen();
    setIsOpen(false);
    setPosition(null);
  }, [cancelPendingOpen]);

  useEffect(() => cancelPendingOpen, [cancelPendingOpen]);

  // Fecha com Escape, e também quando a página rola ou é redimensionada: o painel é posicionado uma
  // vez, e seguir o controle a cada quadro custaria mais do que fechar e reabrir.
  useEffect(() => {
    if (!isOpen)
      return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        close();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen, close]);

  // Mede o painel já renderizado e o posiciona antes da pintura — sem isso ele apareceria no canto
  // superior esquerdo por um quadro, e saltaria para o lugar certo em seguida.
  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current || !panelRef.current)
      return;

    const anchor = anchorRef.current.getBoundingClientRect();
    const panel = panelRef.current.getBoundingClientRect();

    setPosition(computePosition(anchor, { width: panel.width, height: panel.height }, placement));
  }, [isOpen, placement]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const { bar, icon, Icon } = TONES[tone];

  const panel = isOpen && (
    <div
      ref={panelRef}
      id={hintID}
      role="tooltip"
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        // Invisível até estar medido e posicionado — evita o salto do primeiro quadro.
        visibility: position ? 'visible' : 'hidden',
        // A dica flutua acima de tudo (inclusive de modais); o guarda de estilo proíbe z-[N] em classe.
        zIndex: 9999,
      }}
      className={`
        fixed pointer-events-none
        max-w-[min(20rem,calc(100vw-1rem))]
        flex items-stretch gap-0 overflow-hidden
        rounded-xl border
        border-[hsl(var(--hint-border)/var(--hint-border-alpha))]
        bg-brand-surface/95 backdrop-blur-sm
        shadow-[var(--hint-shadow)]
        ${position ? 'animate-in fade-in' : ''}
      `}
    >
      {/* Barra lateral: o tom, sem tingir o texto. */}
      <div className={`w-1 shrink-0 ${bar}`} aria-hidden="true" />

      <div className="flex items-start gap-2.5 px-3 py-2">
        {Icon && <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${icon}`} aria-hidden="true" />}

        <div className="min-w-0 space-y-1">
          {label && (
            <div className="flex items-baseline gap-2">
              <span className="text-ui-sm font-medium text-brand-text-primary">{label}</span>
              {shortcut && (
                <kbd className="shrink-0 px-1.5 py-0.5 rounded border border-border text-ui-xs font-mono text-brand-text-muted bg-[hsl(var(--hint-inset)/0.06)]">
                  {shortcut}
                </kbd>
              )}
            </div>
          )}

          {body && (
            <div className="text-ui-xs leading-relaxed text-brand-text-secondary">{body}</div>
          )}

          {shortcut && !label && (
            <kbd className="px-1.5 py-0.5 rounded border border-border text-ui-xs font-mono text-brand-text-muted bg-[hsl(var(--hint-inset)/0.06)]">
              {shortcut}
            </kbd>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <span
      ref={anchorRef}
      className={`inline-flex ${className}`}
      onMouseEnter={() => open()}
      onMouseLeave={close}
      onFocus={() => open(true)}
      onBlur={close}
      aria-describedby={isOpen ? hintID : undefined}
    >
      {children}
      {panel && createPortal(panel, document.body)}
    </span>
  );
}
