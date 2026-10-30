import { useSyncExternalStore } from 'react';
import type { DeviceType } from '@core/lib';

/**
 * React hook to access the global device type.
 * Returns the device type set at application startup.
 * When the device type changes, the page reloads — no re-render needed.
 */
export function useDevice(): { deviceType: DeviceType; isMobile: boolean; isDesktop: boolean } {
  const deviceType = useSyncExternalStore(
    // Subscribe — no-op because device changes trigger reload
    () => () => {},
    // Get snapshot
    () => window.__DEVICE_TYPE__ ?? 'desktop',
    // Server snapshot
    () => 'desktop' as DeviceType
  );

  return {
    deviceType,
    isMobile: deviceType === 'mobile',
    isDesktop: deviceType === 'desktop',
  };
}
