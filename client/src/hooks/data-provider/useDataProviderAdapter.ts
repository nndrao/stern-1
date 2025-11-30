/**
 * useDataProviderAdapter
 *
 * Simplified React hook for connecting grids to data provider engines via SharedWorker.
 * Direct MessagePort communication - no adapter layer needed.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { GetRowIdParams } from 'ag-grid-community';
import { UseDataProviderAdapterResult, AdapterOptions } from './adapters/types';
import { getRowIdFromConfig, useProviderConfig } from './utils';
import { normalizeBlotterType } from '@/types/blotter';

export function useDataProviderAdapter(
  providerId: string | null,
  options: AdapterOptions = {}
): UseDataProviderAdapterResult {
  // Extract and normalize blotter type (defaults to 'default')
  const blotterType = normalizeBlotterType(options.blotterType);

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [snapshotData, setSnapshotData] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  // Load configuration
  const { config, isLoading: isConfigLoading, error: configError } = useProviderConfig(providerId);
  const configRef = useRef<any>(null);
  configRef.current = config;

  // SharedWorker port
  const workerPortRef = useRef<MessagePort | null>(null);
  const workerRef = useRef<SharedWorker | null>(null);
  const portIdRef = useRef<string>(`port-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Event handler refs
  const onSnapshotRef = useRef<((rows: any[]) => void) | undefined>();
  const onUpdateRef = useRef<((rows: any[]) => void) | undefined>();
  const onSnapshotCompleteRef = useRef<(() => void) | undefined>();
  const onErrorRef = useRef<((error: Error) => void) | undefined>();

  // getRowId function for AG-Grid (stable reference)
  const getRowId = useCallback((params: GetRowIdParams) => {
    return getRowIdFromConfig(configRef.current, params);
  }, []);

  // Connect to provider
  const connect = useCallback(async () => {
    if (!providerId || !config) {
      console.warn('[useDataProviderAdapter] No provider ID or config');
      return;
    }

    if (workerPortRef.current) {
      console.warn('[useDataProviderAdapter] Already connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log(`[useDataProviderAdapter] Connecting to SharedWorker for ${providerId} (type: ${blotterType})`);

      // Create SharedWorker connection with type-specific name
      // Note: SharedWorkers with different names create separate worker instances
      // Multiple blotters of the SAME type share ONE worker instance
      // Different blotter types get SEPARATE worker instances for isolation
      const workerName = `data-provider-worker-${blotterType}`;
      const worker = new SharedWorker(
        new URL('../../workers/dataProviderSharedWorker.ts', import.meta.url),
        /* @vite-ignore */ { type: 'module', name: workerName }
      );

      console.log(`[useDataProviderAdapter] Connected to SharedWorker '${workerName}' (shared across all ${blotterType} blotters)`);

      workerRef.current = worker;
      workerPortRef.current = worker.port;

      // Set up message handler (worker sends responses in different format)
      worker.port.onmessage = (event) => {
        const response = event.data;
        const { type, data, statistics, error: errorMsg } = response;

        switch (type) {
          case 'subscribed':
            setIsConnected(true);
            setIsLoading(false);
            if (statistics) setStatistics(statistics);
            console.log(`[useDataProviderAdapter] Subscribed to ${providerId}`);

            // AGV3 pattern: Request snapshot after subscription completes
            // This handles late subscribers who connect after snapshot is already complete
            console.log(`[useDataProviderAdapter] Requesting snapshot after subscription`);
            worker.port.postMessage({
              type: 'getSnapshot',
              providerId,
              portId: portIdRef.current,
              requestId: `post-subscribe-snapshot-${Date.now()}`
            });
            break;

          case 'snapshot':
            console.log(`[useDataProviderAdapter] Snapshot received: ${data?.length || 0} rows`);

            // Log cache diagnostics if available
            if (statistics?._cacheDiagnostics) {
              const diag = statistics._cacheDiagnostics;
              console.log(`[useDataProviderAdapter] Cache Diagnostics:`, diag);
              if (diag.message.includes('WARNING')) {
                console.warn(`[useDataProviderAdapter] ${diag.message}`);
              }
            }

            if (data && Array.isArray(data)) {
              setSnapshotData(prev => [...prev, ...data]);
              onSnapshotRef.current?.(data);
            }
            if (statistics) setStatistics(statistics);
            break;

          case 'update':
            if (data && Array.isArray(data)) {
              onUpdateRef.current?.(data);
            }
            if (statistics) setStatistics(statistics);
            break;

          case 'snapshot-complete':
            console.log('[useDataProviderAdapter] Snapshot complete');
            onSnapshotCompleteRef.current?.();
            break;

          case 'statistics':
            if (statistics) setStatistics(statistics);
            break;

          case 'status':
            // Worker sends status messages with statistics
            if (statistics) setStatistics(statistics);
            break;

          case 'error':
            const err = new Error(errorMsg || 'Provider error');
            console.error('[useDataProviderAdapter] Provider error:', err);
            setError(err);
            setIsLoading(false);
            onErrorRef.current?.(err);
            break;

          case 'unsubscribed':
            setIsConnected(false);
            console.log(`[useDataProviderAdapter] Unsubscribed from ${providerId}`);
            break;

          default:
            console.warn('[useDataProviderAdapter] Unknown message type:', type, response);
        }
      };

      worker.onerror = (event: ErrorEvent) => {
        const err = new Error(event.message || 'SharedWorker error');
        console.error('[useDataProviderAdapter] SharedWorker error:', event);
        setError(err);
        setIsLoading(false);
        onErrorRef.current?.(err);
      };

      // Start the port
      worker.port.start();

      // Send subscribe message (worker expects 'subscribe', not 'connect')
      const providerConfig = {
        providerId: config.configId,
        providerType: config.componentSubType,
        name: config.name,
        config: config.config
      };

      worker.port.postMessage({
        type: 'subscribe',
        providerId,
        portId: portIdRef.current,
        config: providerConfig,
        requestId: `connect-${Date.now()}`
      });

      console.log(`[useDataProviderAdapter] Subscribe message sent for ${providerId} (portId: ${portIdRef.current})`);

    } catch (err) {
      const error = err as Error;
      console.error('[useDataProviderAdapter] Connection failed:', error);
      setError(error);
      setIsLoading(false);
      onErrorRef.current?.(error);
    }
  }, [providerId, config]);

  // Disconnect from provider
  const disconnect = useCallback(() => {
    if (workerPortRef.current) {
      console.log(`[useDataProviderAdapter] Disconnecting from ${providerId} (portId: ${portIdRef.current})`);

      // Send unsubscribe message (worker expects 'unsubscribe', not 'disconnect')
      workerPortRef.current.postMessage({
        type: 'unsubscribe',
        providerId,
        portId: portIdRef.current,
        requestId: `disconnect-${Date.now()}`
      });

      // Close port
      workerPortRef.current.close();
      workerPortRef.current = null;
      workerRef.current = null;
    }

    setIsConnected(false);
    setSnapshotData([]);
    setStatistics(null);
  }, [providerId]);

  // Auto-connect if enabled
  useEffect(() => {
    const shouldAutoConnect = options.autoConnect !== false;

    if (shouldAutoConnect && providerId && config && !workerPortRef.current && !isLoading) {
      console.log(`[useDataProviderAdapter] Auto-connecting to ${providerId}`);
      connect();
    }
  }, [providerId, config, isLoading, options.autoConnect, connect]);

  // Cleanup on unmount or provider change
  useEffect(() => {
    return () => {
      console.log(`[useDataProviderAdapter] Cleanup: disconnecting from ${providerId} (portId: ${portIdRef.current})`);
      if (workerPortRef.current) {
        workerPortRef.current.postMessage({
          type: 'unsubscribe',
          providerId,
          portId: portIdRef.current,
          requestId: `cleanup-${Date.now()}`
        });
        workerPortRef.current.close();
        workerPortRef.current = null;
      }
    };
  }, [providerId]);

  // Event handler setters (stable references)
  const setOnSnapshot = useCallback((handler: (rows: any[]) => void) => {
    onSnapshotRef.current = handler;
  }, []);

  const setOnUpdate = useCallback((handler: (rows: any[]) => void) => {
    onUpdateRef.current = handler;
  }, []);

  const setOnSnapshotComplete = useCallback((handler: () => void) => {
    onSnapshotCompleteRef.current = handler;
  }, []);

  const setOnError = useCallback((handler: (error: Error) => void) => {
    onErrorRef.current = handler;
  }, []);

  // Request snapshot explicitly (AGV3 pattern for late subscribers)
  const requestSnapshot = useCallback(async () => {
    if (!workerPortRef.current || !providerId) {
      console.log(`[useDataProviderAdapter] Cannot request snapshot - not connected`);
      return;
    }

    console.log(`[useDataProviderAdapter] Requesting snapshot for ${providerId}`);

    workerPortRef.current.postMessage({
      type: 'getSnapshot',
      providerId,
      portId: portIdRef.current,
      requestId: `snapshot-${Date.now()}`
    });
  }, [providerId]);

  // Return API - MUST be memoized to prevent infinite re-renders
  // Without useMemo, this creates a new object on every render, causing components
  // that use this hook to re-render infinitely
  return useMemo(() => ({
    isConnected,
    isLoading: isLoading || isConfigLoading,
    isConfigLoaded: !!config && !isConfigLoading,
    error: error || configError,
    snapshotData,
    statistics,
    getRowId,
    connect,
    disconnect,
    requestSnapshot,
    setOnSnapshot,
    setOnUpdate,
    setOnSnapshotComplete,
    setOnError
  }), [
    isConnected,
    isLoading,
    isConfigLoading,
    config,
    configError,
    error,
    snapshotData,
    statistics,
    getRowId,
    connect,
    disconnect,
    requestSnapshot,
    setOnSnapshot,
    setOnUpdate,
    setOnSnapshotComplete,
    setOnError
  ]);
}
