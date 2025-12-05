/**
 * useBlotterDataConnection Hook
 *
 * Manages the data provider connection lifecycle for the blotter.
 * Uses the simplified STOMP provider for shared connections.
 */

import { useEffect, useRef, useCallback } from 'react';
import { GridApi } from 'ag-grid-community';
import { useStompProvider } from '@/providers/stomp';
import { BlotterType } from '@/types/blotter';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface UseBlotterDataConnectionOptions {
  /** Selected provider ID */
  providerId: string | null;
  /** Grid API reference */
  gridApi: GridApi | null;
  /** Whether grid is ready */
  gridReady: boolean;
  /** Blotter type (for logging/identification) */
  blotterType?: BlotterType | string;
  /** Callback for row count updates */
  onRowCountChange?: (count: number) => void;
  /** Callback when loading state changes */
  onLoadingChange?: (loading: boolean) => void;
  /** Callback when load completes with timing */
  onLoadComplete?: (loadTimeMs: number) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

export interface UseBlotterDataConnectionResult {
  /** Whether currently connected */
  isConnected: boolean;
  /** Whether config is loaded */
  isConfigLoaded: boolean;
  /** Whether currently loading */
  isLoading: boolean;
  /** Provider statistics */
  statistics: any;
  /** Get row ID function for AG-Grid */
  getRowId: (params: any) => string;
  /** Connect to provider */
  connect: () => Promise<void>;
  /** Disconnect from provider */
  disconnect: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useBlotterDataConnection({
  providerId,
  gridApi,
  gridReady,
  blotterType,
  onRowCountChange,
  onLoadingChange,
  onLoadComplete,
  onError,
}: UseBlotterDataConnectionOptions): UseBlotterDataConnectionResult {
  // ============================================================================
  // Refs
  // ============================================================================

  const snapshotLoadedRef = useRef(false);
  const loadStartTimeRef = useRef<number | null>(null);
  const rowCountRef = useRef(0);
  const gridApiRef = useRef(gridApi);
  gridApiRef.current = gridApi;

  // Callback refs (updated on each render)
  const onRowCountChangeRef = useRef(onRowCountChange);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onErrorRef = useRef(onError);
  onRowCountChangeRef.current = onRowCountChange;
  onLoadingChangeRef.current = onLoadingChange;
  onLoadCompleteRef.current = onLoadComplete;
  onErrorRef.current = onError;

  // ============================================================================
  // Snapshot Handler
  // ============================================================================

  const handleSnapshot = useCallback((rows: any[]) => {
    const api = gridApiRef.current;
    if (!api || rows.length === 0) return;

    logger.debug('Snapshot received', { rowCount: rows.length }, 'useBlotterDataConnection');

    if (!snapshotLoadedRef.current) {
      // First snapshot - set row data
      api.setGridOption('rowData', rows);
      snapshotLoadedRef.current = true;
      rowCountRef.current = rows.length;
    } else {
      // Additional snapshot data - add to grid
      api.applyTransactionAsync({ add: rows });
      rowCountRef.current += rows.length;
    }

    onRowCountChangeRef.current?.(rowCountRef.current);
  }, []);

  // ============================================================================
  // Update Handler
  // ============================================================================

  const handleUpdate = useCallback((rows: any[]) => {
    const api = gridApiRef.current;
    if (!api || !snapshotLoadedRef.current || rows.length === 0) return;

    logger.debug('Update received', { rowCount: rows.length }, 'useBlotterDataConnection');

    api.applyTransactionAsync({ update: rows });
  }, []);

  // ============================================================================
  // Snapshot Complete Handler
  // ============================================================================

  const handleSnapshotComplete = useCallback(() => {
    const loadTime = loadStartTimeRef.current ? Date.now() - loadStartTimeRef.current : 0;

    logger.info('Snapshot complete', {
      rowCount: rowCountRef.current,
      loadTimeMs: loadTime,
    }, 'useBlotterDataConnection');

    onLoadCompleteRef.current?.(loadTime);
    onLoadingChangeRef.current?.(false);
  }, []);

  // ============================================================================
  // Error Handler
  // ============================================================================

  const handleError = useCallback((error: Error) => {
    logger.error('Provider error', error, 'useBlotterDataConnection');
    onLoadingChangeRef.current?.(false);
    onErrorRef.current?.(error);
  }, []);

  // ============================================================================
  // STOMP Provider
  // ============================================================================

  const provider = useStompProvider(providerId, {
    autoConnect: false,
    onSnapshot: handleSnapshot,
    onUpdate: handleUpdate,
    onSnapshotComplete: handleSnapshotComplete,
    onError: handleError,
  });

  // ============================================================================
  // Connection Effect
  // ============================================================================

  useEffect(() => {
    // Only connect when grid is ready and config is loaded
    if (!gridReady || !gridApi || !provider.isConfigLoaded) {
      logger.debug('Skipping connection - conditions not met', {
        gridReady,
        hasGridApi: !!gridApi,
        isConfigLoaded: provider.isConfigLoaded,
      }, 'useBlotterDataConnection');
      return;
    }

    // Reset state for new connection
    snapshotLoadedRef.current = false;
    rowCountRef.current = 0;
    loadStartTimeRef.current = Date.now();

    logger.info('Connecting to provider', { providerId, blotterType }, 'useBlotterDataConnection');
    onLoadingChangeRef.current?.(true);

    // Connect
    provider.connect();

    // Cleanup on unmount or provider change
    return () => {
      logger.debug('Disconnecting from provider', { providerId }, 'useBlotterDataConnection');
      provider.disconnect();
    };
  }, [gridReady, gridApi, provider.isConfigLoaded, providerId, blotterType, provider.connect, provider.disconnect]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    isConnected: provider.isConnected,
    isConfigLoaded: provider.isConfigLoaded,
    isLoading: provider.isLoading,
    statistics: provider.statistics,
    getRowId: provider.getRowId,
    connect: provider.connect,
    disconnect: provider.disconnect,
  };
}

export default useBlotterDataConnection;
