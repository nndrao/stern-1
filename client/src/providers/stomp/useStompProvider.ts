/**
 * useStompProvider
 *
 * Simplified React hook for connecting to STOMP data providers.
 * Uses SharedWorker for connection sharing across components.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GetRowIdParams } from 'ag-grid-community';
import { configService } from '@/services/api/configurationService';

// ============================================================================
// Types
// ============================================================================

export interface StompProviderConfig {
  websocketUrl: string;
  listenerTopic: string;
  requestMessage?: string;
  requestBody?: string;
  snapshotEndToken?: string;
  keyColumn: string;
  timeoutMs?: number;
}

export interface ProviderStatistics {
  isConnected: boolean;
  mode: 'idle' | 'connecting' | 'snapshot' | 'realtime' | 'error';
  snapshotRowCount: number;
  updateCount: number;
  cacheSize: number;
  lastError?: string;
}

export interface UseStompProviderOptions {
  /** Auto-connect when providerId is available (default: true) */
  autoConnect?: boolean;
  /** Callback when snapshot data is received */
  onSnapshot?: (rows: any[]) => void;
  /** Callback when update data is received */
  onUpdate?: (rows: any[]) => void;
  /** Callback when snapshot is complete */
  onSnapshotComplete?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export interface UseStompProviderResult {
  /** Whether connected to provider */
  isConnected: boolean;
  /** Whether connecting or loading config */
  isLoading: boolean;
  /** Whether config has been loaded */
  isConfigLoaded: boolean;
  /** Current error if any */
  error: Error | null;
  /** Provider statistics */
  statistics: ProviderStatistics | null;
  /** Provider configuration */
  config: any | null;
  /** Get row ID function for AG-Grid */
  getRowId: (params: GetRowIdParams) => string;
  /** Connect to provider */
  connect: () => Promise<void>;
  /** Disconnect from provider */
  disconnect: () => void;
  /** Request snapshot (for late joiners) */
  requestSnapshot: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useStompProvider(
  providerId: string | null,
  options: UseStompProviderOptions = {}
): UseStompProviderResult {
  const { autoConnect = true, onSnapshot, onUpdate, onSnapshotComplete, onError } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [statistics, setStatistics] = useState<ProviderStatistics | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);

  // Refs
  const workerRef = useRef<SharedWorker | null>(null);
  const portRef = useRef<MessagePort | null>(null);
  const portIdRef = useRef(`port-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const configRef = useRef<any>(null);

  // Callback refs (to avoid stale closures)
  const onSnapshotRef = useRef(onSnapshot);
  const onUpdateRef = useRef(onUpdate);
  const onSnapshotCompleteRef = useRef(onSnapshotComplete);
  const onErrorRef = useRef(onError);

  // Keep callback refs updated
  onSnapshotRef.current = onSnapshot;
  onUpdateRef.current = onUpdate;
  onSnapshotCompleteRef.current = onSnapshotComplete;
  onErrorRef.current = onError;

  // Load configuration
  useEffect(() => {
    if (!providerId) {
      setConfig(null);
      configRef.current = null;
      return;
    }

    let isMounted = true;
    setIsConfigLoading(true);
    setError(null);

    configService.getById(providerId)
      .then(result => {
        if (isMounted) {
          setConfig(result);
          configRef.current = result;
          setIsConfigLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err);
          setIsConfigLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [providerId]);

  // Get row ID function (stable reference)
  const getRowId = useCallback((params: GetRowIdParams): string => {
    const cfg = configRef.current;

    if (!cfg?.config?.keyColumn) {
      // Fallback to common ID fields
      const data = params.data || {};
      return String(data.positionId || data.id || data.Id || data.ID || Math.random());
    }

    const key = params.data?.[cfg.config.keyColumn];
    if (key === undefined || key === null) {
      return String(Math.random());
    }

    return String(key);
  }, []);

  // Handle worker messages
  const handleMessage = useCallback((event: MessageEvent) => {
    const message = event.data;
    const { type, data, statistics: stats, error: errorMsg } = message;

    switch (type) {
      case 'subscribed':
        setIsConnected(true);
        setIsLoading(false);
        if (stats) setStatistics(stats);

        // Request snapshot after subscription (handles late joiners)
        if (portRef.current && providerId) {
          portRef.current.postMessage({
            type: 'getSnapshot',
            providerId,
            portId: portIdRef.current,
            requestId: `snapshot-${Date.now()}`,
          });
        }
        break;

      case 'snapshot':
        if (data && Array.isArray(data) && data.length > 0) {
          onSnapshotRef.current?.(data);
        }
        if (stats) setStatistics(stats);
        break;

      case 'update':
        if (data && Array.isArray(data)) {
          onUpdateRef.current?.(data);
        }
        if (stats) setStatistics(stats);
        break;

      case 'snapshot-complete':
        onSnapshotCompleteRef.current?.();
        break;

      case 'status':
        if (stats) setStatistics(stats);
        break;

      case 'error':
        const err = new Error(errorMsg || 'Provider error');
        setError(err);
        setIsLoading(false);
        onErrorRef.current?.(err);
        break;

      case 'unsubscribed':
        setIsConnected(false);
        break;
    }
  }, [providerId]);

  // Connect to provider
  const connect = useCallback(async () => {
    if (!providerId || !config) {
      console.warn('[useStompProvider] Cannot connect: no providerId or config');
      return;
    }

    if (portRef.current) {
      console.warn('[useStompProvider] Already connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create SharedWorker
      const worker = new SharedWorker(
        new URL('./stompWorker.ts', import.meta.url),
        { type: 'module', name: `stomp-provider` }
      );

      workerRef.current = worker;
      portRef.current = worker.port;

      // Set up message handler
      worker.port.onmessage = handleMessage;

      worker.onerror = (event: ErrorEvent) => {
        const err = new Error(event.message || 'SharedWorker error');
        setError(err);
        setIsLoading(false);
        onErrorRef.current?.(err);
      };

      // Start port
      worker.port.start();

      // Send subscribe message
      worker.port.postMessage({
        type: 'subscribe',
        providerId,
        portId: portIdRef.current,
        config: {
          providerId: config.configId,
          name: config.name,
          config: config.config,
        },
        requestId: `connect-${Date.now()}`,
      });

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Connection failed');
      setError(error);
      setIsLoading(false);
      onErrorRef.current?.(error);
    }
  }, [providerId, config, handleMessage]);

  // Disconnect from provider
  const disconnect = useCallback(() => {
    if (!portRef.current) return;

    portRef.current.postMessage({
      type: 'unsubscribe',
      providerId,
      portId: portIdRef.current,
      requestId: `disconnect-${Date.now()}`,
    });

    portRef.current.close();
    portRef.current = null;
    workerRef.current = null;

    setIsConnected(false);
    setStatistics(null);
  }, [providerId]);

  // Request snapshot
  const requestSnapshot = useCallback(() => {
    if (!portRef.current || !providerId) return;

    portRef.current.postMessage({
      type: 'getSnapshot',
      providerId,
      portId: portIdRef.current,
      requestId: `snapshot-${Date.now()}`,
    });
  }, [providerId]);

  // Auto-connect when config is ready
  useEffect(() => {
    if (autoConnect && providerId && config && !portRef.current && !isLoading) {
      connect();
    }
  }, [autoConnect, providerId, config, isLoading, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (portRef.current) {
        portRef.current.postMessage({
          type: 'unsubscribe',
          providerId,
          portId: portIdRef.current,
          requestId: `cleanup-${Date.now()}`,
        });
        portRef.current.close();
        portRef.current = null;
      }
    };
  }, [providerId]);

  // Return stable object
  return useMemo(() => ({
    isConnected,
    isLoading: isLoading || isConfigLoading,
    isConfigLoaded: !!config && !isConfigLoading,
    error,
    statistics,
    config,
    getRowId,
    connect,
    disconnect,
    requestSnapshot,
  }), [
    isConnected,
    isLoading,
    isConfigLoading,
    config,
    error,
    statistics,
    getRowId,
    connect,
    disconnect,
    requestSnapshot,
  ]);
}
