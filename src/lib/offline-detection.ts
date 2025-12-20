// src/lib/offline-detection.ts
// Network status monitoring service for offline-first PWA

export type NetworkStatus = 'online' | 'offline' | 'slow';

export interface NetworkStatusEvent {
  status: NetworkStatus;
  timestamp: Date;
  effectiveType?: string | undefined; // 4g, 3g, 2g, slow-2g
  downlink?: number | undefined; // Mbps
  rtt?: number | undefined; // Round-trip time in ms
}

type NetworkStatusListener = (event: NetworkStatusEvent) => void;

// Threshold for "slow" connection (RTT > 500ms or downlink < 1 Mbps)
const SLOW_RTT_THRESHOLD = 500;
const SLOW_DOWNLINK_THRESHOLD = 1;

class OfflineDetectionService {
  private listeners = new Set<NetworkStatusListener>();
  private currentStatus: NetworkStatus = 'online';
  private initialized = false;

  /**
   * Initialize the offline detection service.
   * Must be called on client side only.
   */
  init(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.currentStatus = this.detectStatus();

    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Listen to connection quality changes
    const connection = this.getConnection();
    if (connection) {
      connection.addEventListener('change', this.handleConnectionChange);
    }
  }

  /**
   * Clean up event listeners.
   */
  destroy(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);

    const connection = this.getConnection();
    if (connection) {
      connection.removeEventListener('change', this.handleConnectionChange);
    }

    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * Get current network status.
   */
  getStatus(): NetworkStatus {
    return this.currentStatus;
  }

  /**
   * Check if currently online (includes slow connections).
   */
  isOnline(): boolean {
    return this.currentStatus !== 'offline';
  }

  /**
   * Check if connection is good (online and not slow).
   */
  hasGoodConnection(): boolean {
    return this.currentStatus === 'online';
  }

  /**
   * Subscribe to network status changes.
   */
  subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get detailed network information.
   */
  getNetworkInfo(): NetworkStatusEvent {
    const connection = this.getConnection();
    return {
      status: this.currentStatus,
      timestamp: new Date(),
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt,
    };
  }

  // ============ Private Methods ============

  private getConnection(): NetworkInformation | null {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      return (navigator as NavigatorWithConnection).connection ?? null;
    }
    return null;
  }

  private detectStatus(): NetworkStatus {
    if (typeof navigator === 'undefined') {
      return 'online';
    }

    if (!navigator.onLine) {
      return 'offline';
    }

    const connection = this.getConnection();
    if (connection) {
      const { rtt, downlink } = connection;
      if (
        (rtt !== undefined && rtt > SLOW_RTT_THRESHOLD) ||
        (downlink !== undefined && downlink < SLOW_DOWNLINK_THRESHOLD)
      ) {
        return 'slow';
      }
    }

    return 'online';
  }

  private notifyListeners(): void {
    const event = this.getNetworkInfo();
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in network status listener:', error);
      }
    });
  }

  private handleOnline = (): void => {
    this.currentStatus = this.detectStatus();
    this.notifyListeners();
  };

  private handleOffline = (): void => {
    this.currentStatus = 'offline';
    this.notifyListeners();
  };

  private handleConnectionChange = (): void => {
    const newStatus = this.detectStatus();
    if (newStatus !== this.currentStatus) {
      this.currentStatus = newStatus;
      this.notifyListeners();
    }
  };
}

// ============ Type Definitions for Network Information API ============

interface NetworkInformation extends EventTarget {
  readonly effectiveType?: string | undefined;
  readonly downlink?: number | undefined;
  readonly rtt?: number | undefined;
  readonly saveData?: boolean | undefined;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

interface NavigatorWithConnection extends Navigator {
  readonly connection?: NetworkInformation | undefined;
}

// ============ Singleton Export ============

export const offlineDetection = new OfflineDetectionService();

// ============ React Hook Helper ============

/**
 * Create a hook-compatible subscription function.
 * Use with useSyncExternalStore for React integration.
 */
export function subscribeToNetworkStatus(callback: () => void): () => void {
  return offlineDetection.subscribe(() => callback());
}

export function getNetworkStatusSnapshot(): NetworkStatus {
  return offlineDetection.getStatus();
}

export function getNetworkStatusServerSnapshot(): NetworkStatus {
  return 'online'; // SSR always returns online
}
