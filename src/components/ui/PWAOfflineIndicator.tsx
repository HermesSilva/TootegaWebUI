/**
 * PWA Offline Indicator Component
 * 
 * Displays a notification banner when the app is offline.
 */

import { WifiOff } from 'lucide-react';
import { usePWA } from '../../hooks/usePWA';

export function PWAOfflineIndicator() {
  const { isOffline } = usePWA();

  if (!isOffline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-warning-foreground animate-slide-down">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium">
        <WifiOff className="h-4 w-4" />
        <span>{'Você está offline'}</span>
      </div>
    </div>
  );
}
