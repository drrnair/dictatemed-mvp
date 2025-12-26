// src/components/pwa/PWASettings.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  clearCaches,
  getCacheSize,
  checkForUpdates,
  isPWA,
} from '@/lib/pwa';
import { logger } from '@/lib/logger';
import { Trash2, RefreshCw, HardDrive, Download } from 'lucide-react';

export function PWASettings() {
  const [isClearing, setIsClearing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<Array<{ name: string; entries: number }>>([]);
  const [showCacheInfo, setShowCacheInfo] = useState(false);

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear all cached data? This will remove offline content.')) {
      return;
    }

    setIsClearing(true);
    try {
      const success = await clearCaches();
      if (success) {
        alert('Cache cleared successfully. The app will reload.');
        window.location.reload();
      } else {
        alert('Failed to clear cache. Please try again.');
      }
    } catch (error) {
      logger.error('Clear cache error', { error });
      alert('An error occurred while clearing cache.');
    } finally {
      setIsClearing(false);
    }
  };

  const handleCheckUpdates = async () => {
    setIsChecking(true);
    try {
      const hasUpdate = await checkForUpdates();
      if (hasUpdate) {
        alert('Checking for updates... If an update is available, you will be notified.');
      }
    } catch (error) {
      logger.error('Update check error', { error });
    } finally {
      setIsChecking(false);
    }
  };

  const handleShowCacheInfo = async () => {
    if (showCacheInfo) {
      setShowCacheInfo(false);
      return;
    }

    try {
      const info = await getCacheSize();
      setCacheInfo(info);
      setShowCacheInfo(true);
    } catch (error) {
      logger.error('Cache info error', { error });
    }
  };

  const totalEntries = cacheInfo.reduce((sum, cache) => sum + cache.entries, 0);
  const isInstalledPWA = isPWA();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Progressive Web App</h3>
          <p className="text-sm text-muted-foreground">
            Manage offline content and updates
          </p>
        </div>
        {isInstalledPWA && (
          <div className="flex items-center gap-2 rounded-md bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <Download className="h-4 w-4" />
            Installed
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
              <RefreshCw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Check for Updates</h4>
              <p className="text-sm text-muted-foreground">
                Manually check for app updates
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckUpdates}
                disabled={isChecking}
                className="mt-3"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking...' : 'Check Now'}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/20">
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Clear Cache</h4>
              <p className="text-sm text-muted-foreground">
                Remove all offline cached data
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCache}
                disabled={isClearing}
                className="mt-3"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isClearing ? 'Clearing...' : 'Clear Cache'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
            <HardDrive className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Cache Information</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShowCacheInfo}
              >
                {showCacheInfo ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              View cached data statistics
            </p>

            {showCacheInfo && (
              <div className="mt-4 space-y-2">
                {cacheInfo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No cache data available</p>
                ) : (
                  <>
                    <div className="rounded-md bg-muted p-3">
                      <div className="text-sm font-medium">Total cached items: {totalEntries}</div>
                    </div>
                    <div className="space-y-1">
                      {cacheInfo.map((cache) => (
                        <div
                          key={cache.name}
                          className="flex items-center justify-between rounded border p-2 text-sm"
                        >
                          <span className="font-mono text-xs">{cache.name}</span>
                          <span className="text-muted-foreground">
                            {cache.entries} {cache.entries === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <h4 className="mb-2 font-medium text-blue-900 dark:text-blue-100">
          Offline Support
        </h4>
        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Recordings are queued when offline
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Automatic sync when connection restored
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Static content cached for offline access
          </li>
        </ul>
      </div>
    </div>
  );
}
