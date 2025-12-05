/**
 * useBlotterDataConnection Hook
 *
 * Manages the data provider connection lifecycle for the blotter.
 * Handles snapshot processing, updates, and connection state.
 */

import { useEffect, useRef, useCallback } from 'react';
import { GridApi } from 'ag-grid-community';
import { useDataProviderAdapter } from '@/hooks/data-provider';
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
  /** Blotter type for worker isolation */
  blotterType: BlotterType | string;
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
  /** The data provider adapter */
  adapter: ReturnType<typeof useDataProviderAdapter>;
  /** Whether currently connected */
  isConnected: boolean;
  /** Whether config is loaded */
  isConfigLoaded: boolean;
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

  const snapshotRowsRef = useRef<any[]>([]);
  const snapshotLoadedRef = useRef(false);
  const loadStartTimeRef = useRef<number | null>(null);
  const receivedRowKeysRef = useRef<Set<string>>(new Set());
  const isConnectedRef = useRef(false);

  // Store callback refs to avoid dependency issues
  const onRowCountChangeRef = useRef(onRowCountChange);
  const onLoadingChangeRef = useRef(onLoadingChange);
  const onLoadCompleteRef = useRef(onLoadComplete);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    onRowCountChangeRef.current = onRowCountChange;
    onLoadingChangeRef.current = onLoadingChange;
    onLoadCompleteRef.current = onLoadComplete;
    onErrorRef.current = onError;
  }, [onRowCountChange, onLoadingChange, onLoadComplete, onError]);

  // ============================================================================
  // Data Provider Adapter
  // ============================================================================

  const adapter = useDataProviderAdapter(providerId, {
    autoConnect: false,
    preferOpenFin: true,
    blotterType,
  });

  // Store adapter in ref
  const adapterRef = useRef(adapter);
  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  // ============================================================================
  // Connection Effect
  // ============================================================================

  useEffect(() => {
    const currentAdapter = adapterRef.current;

    if (!currentAdapter || !currentAdapter.isConfigLoaded || !gridReady || !gridApi) {
      logger.debug('Skipping connection - conditions not met', {
        hasAdapter: !!currentAdapter,
        isConfigLoaded: currentAdapter?.isConfigLoaded,
        gridReady,
        hasGridApi: !!gridApi,
      }, 'useBlotterDataConnection');
      return;
    }

    logger.info('Setting up data connection', { providerId }, 'useBlotterDataConnection');

    // Setup snapshot handler
    currentAdapter.setOnSnapshot((rows) => {
      const keyColumn = currentAdapter.config?.config?.keyColumn || 'id';

      // Deduplicate rows
      const uniqueRows = rows.filter(row => {
        const key = row[keyColumn] != null ? String(row[keyColumn]) : null;
        if (key === null) return true; // Allow rows without keys
        if (receivedRowKeysRef.current.has(key)) {
          return false;
        }
        receivedRowKeysRef.current.add(key);
        return true;
      });

      if (uniqueRows.length !== rows.length) {
        logger.warn('Duplicates filtered', {
          original: rows.length,
          unique: uniqueRows.length,
        }, 'useBlotterDataConnection');
      }

      snapshotRowsRef.current.push(...uniqueRows);

      if (gridApi && !snapshotLoadedRef.current && snapshotRowsRef.current.length > 0) {
        logger.info('Loading initial snapshot', { totalRows: snapshotRowsRef.current.length }, 'useBlotterDataConnection');
        gridApi.setGridOption('rowData', snapshotRowsRef.current);
        snapshotLoadedRef.current = true;
        onRowCountChangeRef.current?.(snapshotRowsRef.current.length);
      } else if (gridApi && snapshotLoadedRef.current && rows.length > 0) {
        gridApi.applyTransactionAsync({ add: rows });
        onRowCountChangeRef.current?.(snapshotRowsRef.current.length);
      }
    });

    // Setup snapshot complete handler
    currentAdapter.setOnSnapshotComplete(() => {
      const loadTime = loadStartTimeRef.current ? Date.now() - loadStartTimeRef.current : 0;

      if (gridApi && snapshotRowsRef.current.length > 0 && !snapshotLoadedRef.current) {
        gridApi.setGridOption('rowData', snapshotRowsRef.current);
        snapshotLoadedRef.current = true;
        onRowCountChangeRef.current?.(snapshotRowsRef.current.length);
      }

      logger.info('Snapshot complete', {
        totalRows: snapshotRowsRef.current.length,
        loadTimeMs: loadTime,
      }, 'useBlotterDataConnection');

      onLoadCompleteRef.current?.(loadTime);
      onLoadingChangeRef.current?.(false);
    });

    // Setup update handler
    currentAdapter.setOnUpdate((rows) => {
      if (snapshotLoadedRef.current && gridApi) {
        gridApi.applyTransactionAsync({ update: rows });
      }
    });

    // Setup error handler
    currentAdapter.setOnError((error) => {
      logger.error('Provider error', error, 'useBlotterDataConnection');
      onLoadingChangeRef.current?.(false);
      onErrorRef.current?.(error);
    });

    // Connect
    onLoadingChangeRef.current?.(true);
    loadStartTimeRef.current = Date.now();
    snapshotLoadedRef.current = false;
    snapshotRowsRef.current = [];
    receivedRowKeysRef.current.clear();

    currentAdapter.connect();
    isConnectedRef.current = true;

    // Cleanup
    return () => {
      logger.debug('Disconnecting from provider', {}, 'useBlotterDataConnection');
      if (adapterRef.current) {
        adapterRef.current.disconnect();
        isConnectedRef.current = false;
      }
    };
  }, [gridReady, providerId, gridApi]);

  return {
    adapter,
    isConnected: isConnectedRef.current,
    isConfigLoaded: adapter?.isConfigLoaded ?? false,
  };
}

export default useBlotterDataConnection;
