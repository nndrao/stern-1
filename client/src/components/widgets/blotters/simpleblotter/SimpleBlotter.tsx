/**
 * SimpleBlotter v2 - Optimized Implementation
 *
 * Clean, deterministic implementation with no re-render loops.
 * Optimizations:
 * - Minimal state (4 pieces)
 * - Stable references via refs
 * - Reduced logging overhead
 * - Efficient snapshot accumulation (push vs spread)
 * - Separate effects for config loaded state tracking
 * - Memoized column creation
 * - Refs for callback props to avoid dependency issues
 * - Connection state tracking in ref to avoid toolbar re-renders
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { GridApi, ColDef, GridReadyEvent, GetContextMenuItemsParams } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { sternAgGridTheme } from '@/utils/grid/agGridTheme';
import { useAgGridTheme } from '@/hooks/ui/useAgGridTheme';
import { useSternPlatform } from '@/providers/SternPlatformProvider';
import { getViewInstanceId } from '@/openfin/utils/viewUtils';
import { useDataProviderAdapter } from '@/hooks/data-provider';
import { OpenFinCustomEvents } from '@/openfin/types/openfinEvents';
import { resolveValueFormatter } from '@/formatters';
import { CollapsibleToolbar } from '@/components/ui/CollapsibleToolbar';
import { BlotterToolbar } from './BlotterToolbar';

// Register AG Grid Enterprise modules
ModuleRegistry.registerModules([AllEnterpriseModule]);

// ============================================================================
// Types
// ============================================================================

export interface SimpleBlotterProps {
  onReady?: () => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Memoized column transformation helper
 * Converts raw column definitions to AG Grid ColDef format
 */
const createColumnDefs = (columnsData: any[]): ColDef[] => {
  return columnsData.map((col: any) => {
    const colDef: ColDef = {
      field: col.field,
      headerName: col.headerName || col.field,
      width: col.width || 150,
      filter: true,
      sortable: true,
    };

    // Apply cellDataType if provided
    if (col.cellDataType) {
      colDef.cellDataType = col.cellDataType;
    }

    // Resolve valueFormatter from string to function
    if (col.valueFormatter) {
      const formatter = resolveValueFormatter(col.valueFormatter);
      if (formatter) {
        colDef.valueFormatter = formatter;
      }
    }

    // Apply cellRenderer - for numeric cells, use right alignment via cellClass
    if (col.cellRenderer === 'NumericCellRenderer' || col.cellDataType === 'number') {
      colDef.cellClass = 'ag-right-aligned-cell';
    }

    // Apply any additional column properties
    if (col.editable !== undefined) {
      colDef.editable = col.editable;
    }
    if (col.hide !== undefined) {
      colDef.hide = col.hide;
    }
    if (col.pinned) {
      colDef.pinned = col.pinned;
    }
    if (col.flex !== undefined) {
      colDef.flex = col.flex;
    }

    return colDef;
  });
};

// ============================================================================
// Component
// ============================================================================

export const SimpleBlotterV2: React.FC<SimpleBlotterProps> = ({ onReady, onError }) => {
  // Sync AG Grid theme with application theme
  useAgGridTheme();

  // Platform access
  const platform = useSternPlatform();

  // Stable IDs (never change) - use useMemo to prevent re-execution
  const viewInstanceId = useMemo(() => getViewInstanceId(), []);
  const userId = 'default-user';

  // ============================================================================
  // State - Keep minimal
  // ============================================================================

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [columns, setColumns] = useState<ColDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gridReady, setGridReady] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);

  // Toolbar collapse/pin state
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(true); // Start collapsed
  const [isToolbarPinned, setIsToolbarPinned] = useState(false); // Start unpinned

  // ============================================================================
  // Refs - For stable access without re-renders
  // ============================================================================

  const gridApiRef = useRef<GridApi | null>(null);
  const snapshotRowsRef = useRef<any[]>([]);
  const snapshotLoadedRef = useRef(false);
  const gridReadyRef = useRef(false);
  const loadStartTimeRef = useRef<number | null>(null);

  // Store callback props in refs to avoid dependency issues
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  // Track connection state in ref to avoid toolbar re-renders
  const isConnectedRef = useRef(false);

  // Track config loaded state in ref
  const isConfigLoadedRef = useRef(false);

  // Keep refs up to date
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // ============================================================================
  // Data Provider Adapter
  // ============================================================================

  const adapter = useDataProviderAdapter(selectedProviderId, {
    autoConnect: false,
    preferOpenFin: true,
  });

  // ============================================================================
  // Load Available Providers (once on mount)
  // ============================================================================

  useEffect(() => {
    // Load all DataProvider configs and filter for STOMP and REST only
    platform.configService.getAll({
      componentType: 'DataProvider',
      userId,
    })
    .then((providers) => {
      // Filter for only STOMP and REST providers
      const filteredProviders = providers.filter((p: any) => {
        const subType = p.componentSubType?.toLowerCase();
        return subType === 'stomp' || subType === 'rest';
      });

      setAvailableProviders(
        filteredProviders.map((p: any) => ({
          id: p.configId,
          name: p.name,
        }))
      );
    })
    .catch((error) => {
      console.error('[SimpleBlotter] Failed to load providers:', error);
      onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to load providers'));
    });
  }, [platform.configService, userId]);

  // ============================================================================
  // Load Provider Columns (when provider selected)
  // ============================================================================

  useEffect(() => {
    if (!selectedProviderId) {
      setColumns([]);
      return;
    }

    platform.configService.getById(selectedProviderId)
      .then((config) => {
        const columnsData = config?.config?.columnDefinitions;

        if (columnsData && Array.isArray(columnsData)) {
          const cols = createColumnDefs(columnsData);
          setColumns(cols);
        } else {
          console.warn('[SimpleBlotter] No columns found in config');
        }
      })
      .catch((error) => {
        console.error('[SimpleBlotter] Failed to load columns:', error);
        onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to load columns'));
      });
  }, [selectedProviderId, platform.configService]);

  // ============================================================================
  // Track Config Loaded State (separate effect)
  // ============================================================================

  // Store adapter in ref for cleanup and access
  const adapterRef = useRef(adapter);
  useEffect(() => {
    adapterRef.current = adapter;
  }, [adapter]);

  // Separate effect to watch for config loaded state changes
  useEffect(() => {
    if (adapter?.isConfigLoaded !== isConfigLoadedRef.current) {
      console.log('[SimpleBlotter] Config loaded state changed:', adapter?.isConfigLoaded);
      isConfigLoadedRef.current = adapter?.isConfigLoaded || false;
    }
  }, [adapter?.isConfigLoaded]);

  // ============================================================================
  // Setup Data Handlers & Connection
  // ============================================================================

  useEffect(() => {
    console.log('[SimpleBlotter] Connection effect triggered', {
      hasAdapter: !!adapterRef.current,
      isConfigLoaded: isConfigLoadedRef.current,
      gridReady,
      selectedProviderId
    });

    // Use adapterRef.current to access adapter without depending on it
    const currentAdapter = adapterRef.current;

    if (!currentAdapter || !isConfigLoadedRef.current || !gridReady) {
      console.log('[SimpleBlotter] Skipping connection - conditions not met');
      return;
    }

    console.log('[SimpleBlotter] Setting up data handlers and connecting...');

    // Setup data handlers with detailed logging
    currentAdapter.setOnSnapshot((rows) => {
      console.log(`[SNAPSHOT-LOADING] Batch received: ${rows.length} rows, total before: ${snapshotRowsRef.current.length}`);
      console.log(`[SNAPSHOT-LOADING] Grid ready: ${gridReady}, API available: ${!!gridApiRef.current}, already loaded: ${snapshotLoadedRef.current}`);

      snapshotRowsRef.current.push(...rows);
      console.log(`[SNAPSHOT-LOADING] Total after accumulation: ${snapshotRowsRef.current.length}`);

      // Load immediately on first batch instead of waiting for complete event
      if (gridApiRef.current && !snapshotLoadedRef.current) {
        console.log(`[SNAPSHOT-LOADING] Loading first batch (${snapshotRowsRef.current.length} rows) into grid NOW`);
        gridApiRef.current.setGridOption('rowData', snapshotRowsRef.current);
        snapshotLoadedRef.current = true;
        setIsLoading(false);
        setRowCount(snapshotRowsRef.current.length);
        console.log(`[SNAPSHOT-LOADING] ✅ Grid populated with first batch`);
      } else if (gridApiRef.current && snapshotLoadedRef.current) {
        console.log(`[SNAPSHOT-LOADING] Adding ${rows.length} rows incrementally`);
        gridApiRef.current.applyTransactionAsync({ add: rows });
        setRowCount(snapshotRowsRef.current.length);
      }
    });

    currentAdapter.setOnSnapshotComplete(() => {
      const loadTime = loadStartTimeRef.current ? Date.now() - loadStartTimeRef.current : 0;
      console.log(`[SNAPSHOT-LOADING] ✅ Snapshot complete: ${snapshotRowsRef.current.length} total rows in ${loadTime}ms`);
      console.log(`[SNAPSHOT-LOADING] Final state - already loaded: ${snapshotLoadedRef.current}, grid rows: ${gridApiRef.current?.getDisplayedRowCount() || 0}`);
      setLoadTimeMs(loadTime);
      setIsLoading(false);
    });

    currentAdapter.setOnUpdate((rows) => {
      if (snapshotLoadedRef.current && gridApiRef.current) {
        // Remove verbose logging from hot path
        gridApiRef.current.applyTransactionAsync({ update: rows });
      }
    });

    currentAdapter.setOnError((error) => {
      console.error('[SimpleBlotter] Provider error:', error);
      setIsLoading(false);
      onErrorRef.current?.(error);
    });

    // Connect to provider
    console.log('[SimpleBlotter] Connecting to provider...');
    setIsLoading(true);
    loadStartTimeRef.current = Date.now();
    setLoadTimeMs(null);
    setRowCount(0);
    snapshotLoadedRef.current = false;
    snapshotRowsRef.current = [];

    currentAdapter.connect();

    // Update connection state ref
    isConnectedRef.current = true;

    // Cleanup - use ref to get latest adapter
    return () => {
      console.log('[SimpleBlotter] Disconnecting from provider');
      if (adapterRef.current) {
        adapterRef.current.disconnect();
        isConnectedRef.current = false;
      }
    };
    // CRITICAL: Do NOT include adapter in dependencies - it changes on every render
    // Use adapterRef.current instead, which is kept in sync by the effect on lines 192-195
  }, [gridReady, selectedProviderId]);

  // ============================================================================
  // Memoized Column Creation for OpenFin Events
  // ============================================================================

  const loadColumnsForProvider = useCallback((providerId: string) => {
    platform.configService.getById(providerId)
      .then((config) => {
        const columnsData = config?.config?.columnDefinitions;
        if (columnsData && Array.isArray(columnsData)) {
          const cols = createColumnDefs(columnsData);
          setColumns(cols);
        }
      })
      .catch((error) => {
        console.error('[SimpleBlotter] Failed to reload columns after config update:', error);
      });
  }, [platform.configService]);

  // ============================================================================
  // OpenFin Custom Events Subscription
  // ============================================================================

  useEffect(() => {
    if (!platform.isOpenFin) return;

    console.log('[SimpleBlotter] Subscribing to OpenFin events...');

    // Subscribe to data refresh - reload data when requested
    const unsubRefresh = platform.subscribeToEvent(
      OpenFinCustomEvents.DATA_REFRESH,
      (data) => {
        console.log('[SimpleBlotter] Data refresh event received', data);
        if (adapterRef.current?.isConnected) {
          adapterRef.current.disconnect();
          setTimeout(() => adapterRef.current?.connect(), 100);
        }
      }
    );

    // Subscribe to config updates - reload if provider config changes
    const unsubConfig = platform.subscribeToEvent(
      OpenFinCustomEvents.CONFIG_UPDATED,
      (data) => {
        console.log('[SimpleBlotter] Config update event received', data);
        if (data.componentType === 'DataProvider' && data.configId === selectedProviderId) {
          // Use memoized column loading function
          loadColumnsForProvider(selectedProviderId);
        }
      }
    );

    // Subscribe to provider status - update connection state
    const unsubProviderStatus = platform.subscribeToEvent(
      OpenFinCustomEvents.PROVIDER_STATUS,
      (data) => {
        console.log('[SimpleBlotter] Provider status event received', data);
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      unsubRefresh();
      unsubConfig();
      unsubProviderStatus();
      console.log('[SimpleBlotter] Unsubscribed from OpenFin events');
    };
  }, [platform, selectedProviderId, loadColumnsForProvider]);

  // ============================================================================
  // Grid Ready Handler
  // ============================================================================

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    console.log('[SimpleBlotter] Grid ready');
    gridApiRef.current = event.api;
    gridReadyRef.current = true;
    setGridReady(true);

    onReadyRef.current?.();
  }, []);

  // ============================================================================
  // Provider Selection Handler
  // ============================================================================

  const handleProviderSelect = useCallback((providerId: string) => {
    console.log('[SimpleBlotter] Provider selected:', providerId);
    setSelectedProviderId(providerId);
    setGridReady(false);
    gridReadyRef.current = false;
  }, []);

  // ============================================================================
  // Context Menu Handler
  // ============================================================================

  const getContextMenuItems = useCallback((_params: GetContextMenuItemsParams): any => {
    return [
      'resetColumns',
      'separator',
      'copy',
      'copyWithHeaders',
      'paste',
      'separator',
      'export',
    ];
  }, []);

  // ============================================================================
  // Memoized Grid Config
  // ============================================================================

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    filter: true,
    sortable: true,
    resizable: true,
    enableValue: true,      // Enable aggregation
    enableRowGroup: true,   // Enable row grouping
    enablePivot: true,      // Enable pivoting
    enableCellChangeFlash: true, // Enable cell flashing on data changes
  }), []);

  // Stable getRowId function that uses adapterRef
  const getRowId = useCallback((params: any) => {
    if (adapterRef.current?.getRowId) {
      return adapterRef.current.getRowId(params);
    }
    // Fallback to default behavior
    return params.data?.id || params.data?.positionId || String(Math.random());
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex flex-col h-full">
      {/* Collapsible Toolbar */}
      <CollapsibleToolbar
        id="blotter-main"
        color="blue"
        isCollapsed={isToolbarCollapsed}
        isPinned={isToolbarPinned}
        onCollapsedChange={setIsToolbarCollapsed}
        onPinnedChange={setIsToolbarPinned}
      >
        <BlotterToolbar
          selectedProviderId={selectedProviderId}
          availableProviders={availableProviders}
          isLoading={isLoading}
          adapter={adapter}
          rowCount={rowCount}
          loadTimeMs={loadTimeMs}
          onProviderSelect={handleProviderSelect}
        />
      </CollapsibleToolbar>

      {/* Grid */}
      <div className="flex-1">
        {selectedProviderId && columns.length > 0 ? (
          <AgGridReact
            theme={sternAgGridTheme}
            columnDefs={columns}
            getRowId={getRowId}
            onGridReady={handleGridReady}
            defaultColDef={defaultColDef}
            sideBar={true}
            getContextMenuItems={getContextMenuItems}
            statusBar={{
              statusPanels: [
                { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' },
                { statusPanel: 'agTotalRowCountComponent', align: 'center' },
                { statusPanel: 'agFilteredRowCountComponent', align: 'center' },
                { statusPanel: 'agSelectedRowCountComponent', align: 'center' },
                { statusPanel: 'agAggregationComponent', align: 'right' },
              ],
            }}
            // Performance optimizations (from agv3)
            asyncTransactionWaitMillis={16}
            rowBuffer={5}
            animateRows={false}
            suppressRowHoverHighlight={true}
            suppressAnimationFrame={true}
            suppressColumnVirtualisation={false}
            suppressRowVirtualisation={false}
            suppressCellFocus={true}
            suppressClipboardPaste={false}
            debounceVerticalScrollbar={true}
            suppressScrollOnNewData={true}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {selectedProviderId ? 'Loading columns...' : 'Select a provider to begin'}
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleBlotterV2;
