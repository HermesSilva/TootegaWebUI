/**
 * PWA Install Prompt Component
 * 
 * Displays a button or banner prompting the user to install the PWA.
 */

import { Download, X } from 'lucide-react';
import { useState } from 'react';
import { usePWA } from '../../hooks/usePWA';
import { useSiteConfig } from '../../hooks/useSiteConfig';

interface PWAInstallPromptProps {
  /** Show as a floating banner (default) or inline button */
  variant?: 'banner' | 'button';
  /** Custom class name */
  className?: string;
}

export function PWAInstallPrompt({ variant = 'banner', className = '' }: PWAInstallPromptProps) {
  const { canInstall, isStandalone, promptInstall } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const { config } = useSiteConfig();

  // Don't show if already installed or can't install
  if (!canInstall || isStandalone || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (!accepted) {
      setDismissed(true);
    }
  };

  if (variant === 'button') {
    return (
      <button
        onClick={handleInstall}
        className={`flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors min-h-[44px] ${className}`}
      >
        <Download className="h-4 w-4" />
        <span className="text-sm font-medium">{'Instalar'}</span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-4 sm:w-96 animate-slide-up ${className}`}>
      <div className="bg-card text-card-foreground border border-border rounded-lg shadow-lg p-4 flex items-start gap-3">
        <div className="bg-primary/10 text-primary p-2 rounded-full flex-shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {`Instalar ${config.nome}`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {'Instale o aplicativo para acesso rápido e uma melhor experiência.'}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded text-xs font-medium hover:bg-primary/90 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {'Instalar'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="bg-transparent border border-border px-3 py-1.5 rounded text-xs font-medium hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {'Agora não'}
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 min-h-[44px] min-w-[44px] flex items-center justify-center -m-1"
          aria-label={'Fechar'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
