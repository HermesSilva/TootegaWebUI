/**
 * ErrorBoundary - Top-level React error boundary.
 *
 * Catches render-phase exceptions anywhere in the component tree below it and
 * shows a friendly fallback UI instead of unmounting the whole SPA (blank screen).
 *
 * ERRO MUDO É DEFEITO (dono, 2026-08-07): a tela de falha DIZ o que quebrou — a mensagem real da
 * exceção e a tela em que ela ocorreu. Um "ocorreu um erro inesperado" aqui deixa o usuário sem nada
 * para relatar e o defeito sem rastro fora do console.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(pProps: ErrorBoundaryProps) {
    super(pProps);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(pError: Error): ErrorBoundaryState {
    return { hasError: true, error: pError };
  }

  componentDidCatch(pError: Error, pInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Render error captured by ErrorBoundary:', pError, pInfo.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError)
      return this.props.children;

    const title = 'A tela não pôde ser exibida';
    const detalhe = this.state.error?.message?.trim();
    const message = detalhe
      ? `Uma falha no programa interrompeu a montagem desta tela, em ${window.location.pathname}. Nada do que você digitou foi enviado.`
      : `Uma falha no programa interrompeu a montagem desta tela, em ${window.location.pathname}, e o navegador não informou a causa. Nada do que você digitou foi enviado.`;
    const orientacao = 'Recarregue a tela. Se repetir, avise o suporte informando esta mensagem — o defeito é do sistema, não do que você fez.';
    const retry = 'Recarregar a tela';

    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-background p-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-brand-surface p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-brand-text-primary">{title}</h1>
          <p className="mb-3 text-ui text-brand-text-secondary">{message}</p>
          {detalhe && (
            <p className="mb-3 break-words rounded border border-border bg-brand-background p-2 text-left text-xs font-mono text-brand-text-secondary">
              {detalhe}
            </p>
          )}
          <p className="mb-6 text-ui text-brand-text-secondary">{orientacao}</p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-primary px-4 py-2.5 text-ui font-medium text-white transition-all duration-200 hover:bg-brand-primary-dark focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 sm:min-h-[38px] sm:py-2"
          >
            {retry}
          </button>
        </div>
      </div>
    );
  }
}
