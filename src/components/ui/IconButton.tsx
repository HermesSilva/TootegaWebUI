/**
 * IconButton - Icon-only action button with guaranteed touch target.
 *
 * Enforces the project's responsive touch rules (skill `tootega-front`):
 * the hit area is always at least `--touch-target-min` (44px mobile / 32px desktop)
 * via the `min-h-touch min-w-touch` utilities, regardless of icon size.
 *
 * Accessibility: `aria-label` is REQUIRED — an icon-only control must expose an
 * accessible name.
 *
 * Dica: o botão-ícone não tem rótulo visível, e por isso SEMPRE traz um XHint — a `aria-label` é a
 * linha forte do painel. `hint` acrescenta o detalhe (aceita JSX, portanto cor), `hintTone` o tom e
 * `shortcut` a tecla. O atributo `title` nativo fica de fora: os dois juntos desenham duas caixas.
 */

import type { ButtonHTMLAttributes, ReactNode, JSX } from 'react';
import { XHint, type XHintTone, type XHintPlacement } from './XHint';

type IconButtonVariant = 'ghost' | 'subtle' | 'primary' | 'danger';

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title'> & {
  'aria-label': string;
  variant?: IconButtonVariant;
  children: ReactNode;
  /** Detalhe da dica. Aceita JSX — é aqui que o texto ganha cor. */
  hint?: ReactNode;
  hintTone?: XHintTone;
  hintPlacement?: XHintPlacement;
  shortcut?: string;
};

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: 'text-brand-text-muted hover:bg-hover hover:text-brand-text-primary',
  subtle: 'text-brand-text-secondary hover:bg-hover hover:text-brand-text-primary',
  primary: 'text-brand-primary hover:bg-brand-primary/10',
  danger: 'text-danger hover:bg-danger-bg',
};

export function IconButton({
  variant = 'ghost',
  className = '',
  type,
  children,
  hint,
  hintTone,
  hintPlacement = 'bottom',
  shortcut,
  ...props
}: IconButtonProps): JSX.Element {
  const base =
    'min-h-touch min-w-touch flex items-center justify-center rounded-lg transition-colors ' +
    'focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed';

  // A variante destrutiva avisa por padrão; as demais informam.
  const tone: XHintTone = hintTone ?? (variant === 'danger' ? 'danger' : 'info');

  return (
    <XHint
      label={props['aria-label']}
      body={hint}
      tone={tone}
      placement={hintPlacement}
      shortcut={shortcut}
    >
      <button
        type={type ?? 'button'}
        className={`${base} ${VARIANTS[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    </XHint>
  );
}
