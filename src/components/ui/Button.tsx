import type { ButtonHTMLAttributes, ReactNode, JSX } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps): JSX.Element {
  const baseStyles = 'font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';
  
  const variants = {
    primary: 'bg-brand-primary hover:bg-brand-primary-dark text-white focus:ring-brand-primary',
    secondary: 'bg-brand-background hover:bg-hover text-brand-text-primary focus:ring-border',
    ghost: 'bg-transparent hover:bg-hover text-brand-text-primary focus:ring-border',
  };

  const sizes = {
    sm: 'px-3 py-2 text-ui-xs min-h-[36px]',
    md: 'px-4 py-2.5 sm:py-2 text-ui min-h-[44px] sm:min-h-[38px]',
    lg: 'px-6 py-3 sm:py-2.5 text-base min-h-[48px] sm:min-h-[42px]',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
