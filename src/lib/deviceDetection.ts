/**
 * Device detection and CSS loader.
 * Determines device type ONCE at startup and loads the appropriate CSS.
 * Monitors for device changes and reloads the page when detected.
 *
 * Global flag: window.__DEVICE_TYPE__ ('mobile' | 'desktop')
 */

const MOBILE_BREAKPOINT = 640;

type DeviceType = 'mobile' | 'desktop';

declare global {
  interface Window {
    __DEVICE_TYPE__: DeviceType;
  }
}

function detectDeviceType(): DeviceType {
  // Classify by DEVICE tags (User-Agent / UA-Client-Hints), NOT viewport size.
  // A phone is "mobile" in any orientation/zoom, so rotating it (which changes the
  // viewport width) never flips the device type nor reloads into the desktop layout.
  // Tablets and touch laptops stay desktop (their screens fit the desktop layout).
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData && typeof uaData.mobile === 'boolean')
    return uaData.mobile ? 'mobile' : 'desktop';

  // Fallback for browsers without UA-Client-Hints (Safari/Firefox): UA string.
  const ua = navigator.userAgent || '';
  const isPhone =
    /iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua) ||
    /Android.*Mobile/i.test(ua); // Android phones carry "Mobile"; tablets do not.
  return isPhone ? 'mobile' : 'desktop';
}

function loadDeviceCSS(pDeviceType: DeviceType): void {
  const existingLink = document.getElementById('device-css') as HTMLLinkElement | null;
  if (existingLink)
    existingLink.remove();

  // In Vite, CSS imports are handled at build time.
  // For runtime loading, we dynamically import the correct CSS module.
  if (pDeviceType === 'mobile')
    import('../styles/mobile.css');
  else
    import('../styles/desktop.css');
}

/**
 * Initialize device detection system.
 * Sets global flag, loads device-specific CSS, and watches for device changes.
 */
export function initDeviceDetection(): DeviceType {
  const deviceType = detectDeviceType();

  // Set global flag accessible from anywhere
  window.__DEVICE_TYPE__ = deviceType;

  // Set data attribute on <html> for CSS selectors
  document.documentElement.setAttribute('data-device', deviceType);

  // Load device-specific CSS
  loadDeviceCSS(deviceType);

  // Monitor for device type changes — reload page on change
  const currentType = deviceType;
  const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

  function handleDeviceChange(): void {
    const newType = detectDeviceType();
    if (newType !== currentType)
      window.location.reload();
  }

  mediaQuery.addEventListener('change', handleDeviceChange);

  return deviceType;
}

/**
 * Returns true if the current device is mobile.
 */
export function isMobile(): boolean {
  return window.__DEVICE_TYPE__ === 'mobile';
}

/**
 * Returns true if the current device is desktop (includes tablet in landscape).
 */
export function isDesktop(): boolean {
  return window.__DEVICE_TYPE__ === 'desktop';
}

/**
 * Returns the current device type.
 */
export function getDeviceType(): DeviceType {
  return window.__DEVICE_TYPE__;
}

export type { DeviceType };
