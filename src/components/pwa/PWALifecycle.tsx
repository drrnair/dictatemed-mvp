// src/components/pwa/PWALifecycle.tsx
'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/pwa';
import { UpdateBanner, InstallPrompt } from './UpdatePrompt';

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
      console.log('[PWA] Registering service worker...');
      registerServiceWorker().catch((error) => {
        console.error('[PWA] Registration failed:', error);
      });
    } else {
      console.log('[PWA] Service worker disabled in development');
    }
  }, []);

  return (
    <>
      <UpdateBanner />
      <InstallPrompt />
    </>
  );
}
