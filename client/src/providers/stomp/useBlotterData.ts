/**
 * useBlotterData
 *
 * A single hook that handles everything for blotter data:
 * - Loads provider configuration
 * - Connects to SharedWorker
 * - Applies data to AG-Grid
 *
 * This combines useStompProvider + useBlotterDataConnection into one.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GridApi, GetRowIdParams } from 'ag-grid-community';
import { configService } from '@/services/api/configurationService';

// ============================================================================
// Types
// ============================================================================

export interface UseBlotterDataOptions {
  providerId: string | null;
  gridApi: GridApi | null;
  gridReady: boolean;
  onRowCountChange?: (count: number) => void;
  onLoadingChange?: (loading: boolean) => void;
  onLoadComplete?: (loadTimeMs: number) => void;
  onError?: (error: Error) => void;
}

export interface UseBlotterDataResult {
  isConnected: boolean;
  isLoading: boolean;
  isConfigLoaded: boolean;
  error: Error | null;
  statistics: ProviderStats | null;
  getRowId: (params: GetRowIdParams) => string;
  connect: () => void;
  disconnect: () => void;
}

interface ProviderStats {
  isConnected: boolean;
  mode: string;
  snapshotRowCount: number;
  updateCount: number;
  cacheSize: number;
}

interface WorkerMessage {
  type: string;
  providerId: string;
  data?: any[];
  statistics?: ProviderStats;
  error?: string;
}

// ============================================================================
// Hook
// ============================================================================

export function useBlotterData(options: UseBlotterDataOptions): UseBlotterDataResult {
  const { providerId, gridApi, gridReady, onRowCountChange, onLoadingChange, onLoadComplete, onError } = options;

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [statistics, setStatistics] = useState<ProviderStats | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);

  // Refs
  const portRef = useRef<MessagePort | null>(null);
  const portIdRef = useRef(`port-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const configRef = useRef<any>(null);
  const gridApiRef = useRef(gridApi);
  const snapshotLoadedRef = useRef(false);
  const rowCountRef = useRef(0);
  const loadStartTimeRef = useRef<number | null>(null);

  // Callback refs
  const onRowCountChangeRef = useRef(onRowCountChange);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onErrorRef = useRef(onError);

  // Update refs
  gridApiRef.current = gridApi;
  onRowCountChangeRef.current = onRowCountChange;
  onLoadingChangeRef.current = onLoadingChange;
  onLoadCompleteRef.current = onLoadComplete;
  onErrorRef.current = onError;

  // Load configuration
  useEffect(() => {
    if (!providerId) {
      setConfig(null);
      configRef.current = null;
      return;
    }

    let mounted = true;
    setIsConfigLoading(true);
    setError(null);

    configService.getById(providerId)
      .then(result => {
        if (mounted) {
          setConfig(result);
          configRef.current = result;
          setIsConfigLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err);
          setIsConfigLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [providerId]);

  // Get row ID function
  const getRowId = useCallback((params: GetRowIdParams): string => {
    const cfg = configRef.current;
    if (!cfg?.config?.keyColumn) {
      const data = params.data || {};
      return String(data.positionId || data.id || data.Id || data.ID || Math.random());
    }
    const key = params.data?.[cfg.config.keyColumn];
    return key != null ? String(key) : String(Math.random());
  }, []);

  // Handle worker messages
  const handleMessage = useCallback((event: MessageEvent<WorkerMessage>) => {
    const { type, data, statistics: stats, error: errorMsg } = event.data;
    const api = gridApiRef.current;

    switch (type) {
      case 'subscribed':
        setIsConnected(true);
        setIsLoading(false);
        if (stats) setStatistics(stats);
        // Request snapshot after subscription
        if (portRef.current && providerId) {
          portRef.current.postMessage({
            type: 'getSnapshot',
            providerId,
            portId: portIdRef.current,
          });
        }
        break;

      case 'snapshot':
        if (data && Array.isArray(data) && data.length > 0 && api) {
          if (!snapshotLoadedRef.current) {
            api.setGridOption('rowData', data);
            snapshotLoadedRef.current = true;
            rowCountRef.current = data.length;
          } else {
            api.applyTransactionAsync({ add: data });
            rowCountRef.current += data.length;
          }
          onRowCountChangeRef.current?.(rowCountRef.current);
        }
        if (stats) setStatistics(stats);
        break;

      case 'update':
        if (data && Array.isArray(data) && snapshotLoadedRef.current && api) {
          api.applyTransactionAsync({ update: data });
        }
        if (stats) setStatistics(stats);
        break;

      case 'snapshot-complete':
        const loadTime = loadStartTimeRef.current ? Date.now() - loadStartTimeRef.current : 0;
        onLoadCompleteRef.current?.(loadTime);
        onLoadingChangeRef.current?.(false);
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

  // Connect
  const connect = useCallback(() => {
    if (!providerId || !config || portRef.current) return;

    // Reset state
    snapshotLoadedRef.current = false;
    rowCountRef.current = 0;
    loadStartTimeRef.current = Date.now();
    setIsLoading(true);
    setError(null);
    onLoadingChangeRef.current?.(true);

    try {
      const worker = new SharedWorker(
        new URL('./stompDataWorker.ts', import.meta.url),
        { type: 'module', name: 'stomp-data' }
      );

      portRef.current = worker.port;
      worker.port.onmessage = handleMessage;
      worker.onerror = (e: ErrorEvent) => {
        const err = new Error(e.message || 'SharedWorker error');
        setError(err);
        setIsLoading(false);
        onErrorRef.current?.(err);
      };
      worker.port.start();

      worker.port.postMessage({
        type: 'subscribe',
        providerId,
        portId: portIdRef.current,
        config: { providerId: config.configId, name: config.name, config: config.config },
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Connection failed');
      setError(err);
      setIsLoading(false);
      onErrorRef.current?.(err);
    }
  }, [providerId, config, handleMessage]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (!portRef.current) return;

    portRef.current.postMessage({
      type: 'unsubscribe',
      providerId,
      portId: portIdRef.current,
    });
    portRef.current.close();
    portRef.current = null;

    setIsConnected(false);
    setStatistics(null);
  }, [providerId]);

  // Auto-connect when grid is ready and config is loaded
  useEffect(() => {
    const isConfigLoaded = !!config && !isConfigLoading;
    if (!gridReady || !gridApi || !isConfigLoaded || portRef.current) return;

    connect();

    return () => {
      if (portRef.current) {
        portRef.current.postMessage({
          type: 'unsubscribe',
          providerId,
          portId: portIdRef.current,
        });
        portRef.current.close();
        portRef.current = null;
      }
    };
  }, [gridReady, gridApi, config, isConfigLoading, providerId, connect]);

  return useMemo(() => ({
    isConnected,
    isLoading: isLoading || isConfigLoading,
    isConfigLoaded: !!config && !isConfigLoading,
    error,
    statistics,
    getRowId,
    connect,
    disconnect,
  }), [isConnected, isLoading, isConfigLoading, config, error, statistics, getRowId, connect, disconnect]);
}

export default useBlotterData;
