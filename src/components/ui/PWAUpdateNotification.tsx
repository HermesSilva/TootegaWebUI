/**
 * PWA Update Notification Component
 * 
 * Displays a notification when a new version of the app is available
 * and prompts the user to update.
 */

import { RefreshCw, X } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export function PWAUpdateNotification() {
  const { needsUpdate, updateServiceWorker, dismissUpdate } = usePWA();

  if (!needsUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-96 animate-slide-up">
      <div className="bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-start gap-3">
        <RefreshCw className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {'Nova versão disponível'}
          </p>
          <p className="text-xs opacity-90 mt-1">
            {'Uma nova versão do aplicativo está pronta para ser instalada.'}
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={updateServiceWorker}
              className="bg-primary-foreground text-primary px-3 py-1.5 rounded text-xs font-medium hover:opacity-90 transition-opacity min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {'Atualizar agora'}
            </button>
            <button
              onClick={dismissUpdate}
              className="bg-transparent border border-primary-foreground/30 px-3 py-1.5 rounded text-xs font-medium hover:bg-primary-foreground/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              {'Depois'}
            </button>
          </div>
        </div>
        <button
          onClick={dismissUpdate}
          className="flex-shrink-0 hover:opacity-70 transition-opacity p-1 min-h-[44px] min-w-[44px] flex items-center justify-center -m-1"
          aria-label={'Fechar'}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
