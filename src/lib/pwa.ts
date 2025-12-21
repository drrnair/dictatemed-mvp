// src/lib/pwa.ts
// PWA utilities for service worker registration and updates

import { logger } from './logger';

const pwaLogger = logger.child({ action: 'pwa' });

export interface ServiceWorkerUpdateEvent {
  type: 'update-available' | 'update-installed' | 'controlling' | 'error';
  registration?: ServiceWorkerRegistration;
  error?: Error;
}

type UpdateCallback = (event: ServiceWorkerUpdateEvent) => void;

let registration: ServiceWorkerRegistration | null = null;
const updateCallbacks = new Set<UpdateCallback>();

/**
 * Register service worker with update handling
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    pwaLogger.debug('Service workers not supported');
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    pwaLogger.info('Service Worker registered', { resource: registration.scope });

    // Check for updates immediately
    await checkForUpdates();

    // Check for updates periodically (every 30 minutes)
    setInterval(checkForUpdates, 30 * 60 * 1000);

    // Listen for controlling service worker change
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;

      notifyCallbacks({
        type: 'controlling',
        registration: registration || undefined,
      });
    });

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration?.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // New update available
            pwaLogger.info('New update available');
            notifyCallbacks({
              type: 'update-available',
              registration: registration || undefined,
            });
          } else {
            // First install
            pwaLogger.info('Service Worker installed');
            notifyCallbacks({
              type: 'update-installed',
              registration: registration || undefined,
            });
          }
        }
      });
    });

    // Listen for service worker messages
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type, version } = event.data;

      if (type === 'SW_ACTIVATED') {
        pwaLogger.info('Service Worker activated', { resourceId: version });
      }
    });

    return registration;
  } catch (error) {
    pwaLogger.error('Service Worker registration failed', {}, error instanceof Error ? error : new Error(String(error)));
    notifyCallbacks({
      type: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return null;
  }
}

/**
 * Check for service worker updates
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!registration) {
    pwaLogger.debug('No registration available');
    return false;
  }

  try {
    await registration.update();
    pwaLogger.debug('Update check complete');
    return true;
  } catch (error) {
    pwaLogger.error('Update check failed', {}, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Activate waiting service worker
 */
export function activateUpdate(): void {
  if (!registration || !registration.waiting) {
    pwaLogger.debug('No update waiting');
    return;
  }

  pwaLogger.info('Activating update');
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Subscribe to service worker updates
 */
export function onServiceWorkerUpdate(callback: UpdateCallback): () => void {
  updateCallbacks.add(callback);
  return () => updateCallbacks.delete(callback);
}

/**
 * Notify all callbacks
 */
function notifyCallbacks(event: ServiceWorkerUpdateEvent): void {
  updateCallbacks.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      pwaLogger.error('Callback error', {}, error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Get current service worker registration
 */
export function getRegistration(): ServiceWorkerRegistration | null {
  return registration;
}

/**
 * Unregister service worker (for development/testing)
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!registration) {
    return false;
  }

  try {
    const result = await registration.unregister();
    registration = null;
    pwaLogger.info('Service Worker unregistered');
    return result;
  } catch (error) {
    pwaLogger.error('Unregistration failed', {}, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Clear all caches
 */
export async function clearCaches(): Promise<boolean> {
  if (!registration?.active) {
    return false;
  }

  const activeWorker = registration.active;
  return new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      resolve(event.data.success || false);
    };

    activeWorker.postMessage(
      { type: 'CLEAR_CACHES' },
      [channel.port2]
    );

    // Timeout after 5 seconds
    setTimeout(() => resolve(false), 5000);
  });
}

/**
 * Get cache size information
 */
export async function getCacheSize(): Promise<Array<{ name: string; entries: number }>> {
  if (!registration?.active) {
    return [];
  }

  const activeWorker = registration.active;
  return new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      resolve(event.data.sizes || []);
    };

    activeWorker.postMessage(
      { type: 'GET_CACHE_SIZE' },
      [channel.port2]
    );

    // Timeout after 5 seconds
    setTimeout(() => resolve([]), 5000);
  });
}

/**
 * Precache specific URLs
 */
export async function precacheUrls(urls: string[]): Promise<boolean> {
  if (!registration?.active) {
    return false;
  }

  const activeWorker = registration.active;
  return new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      resolve(event.data.success || false);
    };

    activeWorker.postMessage(
      { type: 'CACHE_URLS', payload: { urls } },
      [channel.port2]
    );

    // Timeout after 10 seconds
    setTimeout(() => resolve(false), 10000);
  });
}

/**
 * Check if app is installed as PWA
 */
export function isPWA(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if running in standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Check for iOS standalone
  // @ts-expect-error - iOS specific property
  const isIOSStandalone = window.navigator.standalone === true;

  return isStandalone || isIOSStandalone;
}

/**
 * Check if install prompt is available
 */
export function canInstall(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // Check if already installed
  if (isPWA()) {
    return false;
  }

  // beforeinstallprompt event indicates install is available
  // This is set up by the InstallPrompt component
  return 'beforeinstallprompt' in window;
}

/**
 * Get install prompt (must be stored from beforeinstallprompt event)
 */
let deferredPrompt: any = null;

export function storeDeferredPrompt(prompt: any): void {
  deferredPrompt = prompt;
}

export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) {
    pwaLogger.debug('No install prompt available');
    return false;
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    pwaLogger.info('Install prompt outcome', { resourceId: outcome });

    deferredPrompt = null;
    return outcome === 'accepted';
  } catch (error) {
    pwaLogger.error('Install prompt error', {}, error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}
