// src/components/pwa/UpdatePrompt.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  onServiceWorkerUpdate,
  activateUpdate,
  type ServiceWorkerUpdateEvent,
} from '@/lib/pwa';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

export function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = onServiceWorkerUpdate((event: ServiceWorkerUpdateEvent) => {
      if (event.type === 'update-available') {
        setUpdateAvailable(true);
      } else if (event.type === 'controlling') {
        // New service worker is controlling, reload page
        window.location.reload();
      }
    });

    return unsubscribe;
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    activateUpdate();
    // The page will reload automatically when new SW takes control
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  return (
    <Dialog open={updateAvailable} onOpenChange={setUpdateAvailable}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Update Available
          </DialogTitle>
          <DialogDescription>
            A new version of DictateMED is available. Update now to get the
            latest features and improvements.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleDismiss}
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            <X className="mr-2 h-4 w-4" />
            Later
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Updating...' : 'Update Now'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Banner version (less intrusive than modal)
 */
export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = onServiceWorkerUpdate((event: ServiceWorkerUpdateEvent) => {
      if (event.type === 'update-available') {
        setUpdateAvailable(true);
        setIsDismissed(false);
      } else if (event.type === 'controlling') {
        window.location.reload();
      }
    });

    return unsubscribe;
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    activateUpdate();
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (!updateAvailable || isDismissed) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg dark:border-blue-800 dark:bg-blue-950"
      role="alert"
      aria-live="polite"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <p className="font-semibold text-blue-900 dark:text-blue-100">
            Update Available
          </p>
        </div>
        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
          A new version is ready to install
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          disabled={isUpdating}
          className="h-8 px-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
        <Button
          size="sm"
          onClick={handleUpdate}
          disabled={isUpdating}
          className="h-8"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${isUpdating ? 'animate-spin' : ''}`} />
          {isUpdating ? 'Updating...' : 'Update'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Install prompt for PWA
 */
export function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent default install prompt
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    console.log(`User response to install prompt: ${outcome}`);

    // Clear the saved prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't clear deferredPrompt in case user changes their mind
  };

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-center gap-4 rounded-lg border border-primary/20 bg-card p-4 shadow-lg"
      role="dialog"
      aria-labelledby="install-prompt-title"
    >
      <div className="flex-1">
        <p id="install-prompt-title" className="font-semibold">
          Install DictateMED
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Install the app for quick access and offline support
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="h-8 px-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
        <Button size="sm" onClick={handleInstall} className="h-8">
          Install
        </Button>
      </div>
    </div>
  );
}
