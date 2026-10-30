/**
 * PWA Hook - Service Worker Registration and Update Management
 * 
 * This hook provides PWA functionality including:
 * - Service worker registration status
 * - Update detection and notification
 * - Offline status detection
 * - Install prompt handling
 */

import { useState, useEffect, useCallback } from 'react';

interface PWAStatus {
  /** Whether the app is ready to work offline */
  isOfflineReady: boolean;
  /** Whether a new version is available */
  needsUpdate: boolean;
  /** Whether the app is currently offline */
  isOffline: boolean;
  /** Whether the app can be installed (install prompt available) */
  canInstall: boolean;
  /** Whether the app is running as standalone PWA */
  isStandalone: boolean;
  /** Whether the service worker is registered */
  isRegistered: boolean;
}

interface UsePWAResult extends PWAStatus {
  /** Trigger the update to the new version */
  updateServiceWorker: () => void;
  /** Show the install prompt */
  promptInstall: () => Promise<boolean>;
  /** Dismiss the update notification */
  dismissUpdate: () => void;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

export function usePWA(): UsePWAResult {
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [canInstall, setCanInstall] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Check if running as standalone PWA
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://');

  // Update service worker
  const updateServiceWorker = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setNeedsUpdate(false);
      // Reload after the new service worker takes control
      registration.waiting.addEventListener('statechange', (e) => {
        if ((e.target as ServiceWorker).state === 'activated') {
          window.location.reload();
        }
      });
    }
  }, [registration]);

  // Dismiss update notification
  const dismissUpdate = useCallback(() => {
    setNeedsUpdate(false);
  }, []);

  // Handle install prompt
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredInstallPrompt) {
      return false;
    }

    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    setCanInstall(false);
    return outcome === 'accepted';
  }, []);

  // Register service worker and handle updates
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // In dev, do NOT register a service worker. Also actively unregister any stale
    // SW (and purge its caches) left from a previous production build, which can
    // otherwise serve outdated assets and blank the page on a device.
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => { /* non-critical */ });
      if (typeof caches !== 'undefined')
        void caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => { /* non-critical */ });
      return;
    }

    const registerSW = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        
        setRegistration(reg);
        setIsRegistered(true);

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content available
                setNeedsUpdate(true);
              } else {
                // Content cached for offline
                setIsOfflineReady(true);
              }
            }
          });
        });

        // Check if there's already a waiting worker
        if (reg.waiting) {
          setNeedsUpdate(true);
        }

        // Check for updates periodically (every 30 minutes)
        setInterval(() => {
          reg.update();
        }, 30 * 60 * 1000);
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerSW();

    // Handle controller change (new service worker activated)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      deferredInstallPrompt = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return {
    isOfflineReady,
    needsUpdate,
    isOffline,
    canInstall,
    isStandalone,
    isRegistered,
    updateServiceWorker,
    promptInstall,
    dismissUpdate,
  };
}
