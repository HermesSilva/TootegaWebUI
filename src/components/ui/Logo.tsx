import type { JSX } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  /**
   * Nome do produto, como o back o declara (`SYS:Aplicacao:Nome`, via `useSiteConfig`). O motor não crava
   * marca: a imagem é o `/logo.svg` que cada SaaS serve, e o nome chega por aqui. Sem nome, a imagem é
   * decorativa (`alt=""`) — é o caso das telas de entrada, que já escrevem o nome ao lado do logo.
   */
  name?: string;
  /** Linha de descrição (`SYS:Aplicacao:Descricao`), exibida após o nome quando `showText`. */
  description?: string;
  className?: string;
  onClick?: () => void;
}

const SIZES = {
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-14',
} as const;

const TEXT_SIZES = {
  sm: 'text-ui',
  md: 'text-base',
  lg: 'text-xl',
} as const;

export function Logo({ size = 'md', showText = false, name, description, className = '', onClick }: LogoProps): JSX.Element {

  return (
    <div
      className={`flex items-center gap-2 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    >
      <img
        src="/logo.svg"
        alt={name ?? ''}
        className={`${SIZES[size]} w-auto object-contain`}
      />
      {showText && name && (
        <span className={`${TEXT_SIZES[size]} font-semibold text-brand-text-primary`}>
          {description ? `${name} - ${description}` : name}
        </span>
      )}
    </div>
  );
}
