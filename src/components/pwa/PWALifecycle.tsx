// src/components/pwa/PWALifecycle.tsx
'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pwa';
import { logger } from '@/lib/logger';
import { UpdateBanner, InstallPrompt } from './UpdatePrompt';

const pwaLogger = logger.child({ action: 'pwa' });

/**
 * PWA Lifecycle component
 * Handles service worker registration and PWA prompts
 * Should be included once in the root layout
 */
export function PWALifecycle() {
  useEffect(() => {
    // Only register service worker in production or when explicitly enabled
    const isProd = process.env.NODE_ENV === 'production';
    const enablePWA = process.env.NEXT_PUBLIC_ENABLE_PWA === 'true';

    if (isProd || enablePWA) {
      pwaLogger.info('Registering service worker');
      registerServiceWorker().catch((error) => {
        pwaLogger.error('Registration failed', {}, error instanceof Error ? error : new Error(String(error)));
      });
    } else {
      pwaLogger.debug('Service worker disabled in development');
    }
  }, []);

  return (
    <>
      <UpdateBanner />
      <InstallPrompt />
    </>
  );
}
