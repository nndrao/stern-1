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

import React, { useRef, useEffect, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { GridApi, ColDef, GridReadyEvent, GetContextMenuItemsParams } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { sternAgGridTheme } from '@/utils/grid/agGridTheme';
import { useAgGridTheme } from '@/hooks/ui/useAgGridTheme';
import { useSternPlatform } from '@/providers/SternPlatformProvider';
import { getViewInstanceId, getActiveLayoutId, getViewCustomData } from '@/openfin/utils/viewUtils';
import { useDataProviderAdapter } from '@/hooks/data-provider';
import { OpenFinCustomEvents } from '@stern/openfin-platform';
import { resolveValueFormatter } from '@/formatters';
import { CollapsibleToolbar } from '@/components/ui/CollapsibleToolbar';
import { BlotterToolbar } from './BlotterToolbar';
import { LayoutSaveDialog } from './LayoutSaveDialog';
import { LayoutManageDialog } from './LayoutManageDialog';
import { useBlotterLayoutManager } from './useBlotterLayoutManager';
import { COMPONENT_TYPES } from '@stern/shared-types';
import { logger } from '@/utils/logger';

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

  // Debug info state (for troubleshooting customData persistence)
  const [debugActiveLayoutId, setDebugActiveLayoutId] = useState<string | null>(null);
  const [debugLayoutName, setDebugLayoutName] = useState<string | null>(null);

  // Real-time update counter
  const [updateCount, setUpdateCount] = useState(0);

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
  // Layout Manager
  // ============================================================================

  const layoutManager = useBlotterLayoutManager({
    blotterConfigId: viewInstanceId,
    userId,
    blotterName: 'SimpleBlotter',
    gridApi: gridApiRef.current,
    toolbarState: {
      isCollapsed: isToolbarCollapsed,
      isPinned: isToolbarPinned,
    },
    selectedProviderId: selectedProviderId ?? undefined,
  });

  // Register callbacks for layout application IMMEDIATELY (before paint)
  // useLayoutEffect runs synchronously after DOM mutations but before paint,
  // ensuring callbacks are registered before any layout is applied
  useLayoutEffect(() => {
    layoutManager.registerApplyCallbacks({
      onToolbarStateChange: (state) => {
        logger.debug('Layout applying toolbar state', { state }, 'SimpleBlotter');
        setIsToolbarCollapsed(state.isCollapsed);
        setIsToolbarPinned(state.isPinned);
      },
      onProviderChange: (providerId) => {
        logger.debug('Layout applying provider selection', { providerId }, 'SimpleBlotter');
        setSelectedProviderId(providerId);
      },
    });
  }, [layoutManager.registerApplyCallbacks]);

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
    // Note: Not filtering by userId to include System-level providers
    platform.configService.getAll({
      componentType: COMPONENT_TYPES.DATA_PROVIDER,
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
      logger.error('Failed to load providers', error, 'SimpleBlotter');
      onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to load providers'));
    });
  }, [platform.configService]);

  // ============================================================================
  // Restore View Caption from CustomData (on mount)
  // ============================================================================

  // Restore caption - run once when component mounts AND isOpenFin is true
  useEffect(() => {
    console.log('[CAPTION RESTORE] Effect triggered', { isOpenFin: platform.isOpenFin });

    // Only run in OpenFin environment
    if (!platform.isOpenFin) {
      console.log('[CAPTION RESTORE] Skipping - not in OpenFin');
      logger.debug('Skipping caption restoration - not in OpenFin', undefined, 'SimpleBlotter');
      return;
    }

    console.log('[CAPTION RESTORE] Starting caption restoration from customData');
    logger.debug('Attempting to restore view caption from customData', undefined, 'SimpleBlotter');

    // Restore the view caption from customData if it was previously saved
    // This ensures renamed views keep their custom names across workspace restores
    getViewCustomData()
      .then((customData) => {
        console.log('[CAPTION RESTORE] Retrieved customData:', customData);
        logger.debug('Retrieved customData for caption restoration', {
          customData,
          hasCaption: !!customData?.caption
        }, 'SimpleBlotter');

        if (customData?.caption) {
          console.log('[CAPTION RESTORE] Found caption, restoring:', customData.caption);
          logger.info('Restoring view caption from customData', {
            caption: customData.caption,
            currentTitle: document.title
          }, 'SimpleBlotter');
          // Set document.title to restore the tab caption
          document.title = customData.caption;
          console.log('[CAPTION RESTORE] Caption restored, new title:', document.title);
          logger.debug('View caption restored', {
            newTitle: document.title
          }, 'SimpleBlotter');
        } else {
          console.log('[CAPTION RESTORE] No caption in customData, keeping default:', document.title);
          logger.debug('No caption found in customData, keeping default title', {
            currentTitle: document.title
          }, 'SimpleBlotter');
        }
      })
      .catch((error) => {
        console.error('[CAPTION RESTORE] Failed to restore caption:', error);
        logger.warn('Failed to restore view caption from customData', error, 'SimpleBlotter');
      });
  }, [platform.isOpenFin]); // Re-run if isOpenFin changes from false to true

  // ============================================================================
  // Initialize Blotter Layout (on mount)
  // ============================================================================

  // Store initializeBlotter in ref to avoid dependency issues while ensuring
  // it only runs once on mount
  const initializeBlotterRef = useRef(layoutManager.initializeBlotter);
  initializeBlotterRef.current = layoutManager.initializeBlotter;

  useEffect(() => {
    initializeBlotterRef.current().catch((error) => {
      logger.error('Failed to initialize blotter layout', error, 'SimpleBlotter');
      onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to initialize blotter layout'));
    });
  }, []); // Run once on mount - uses ref to access latest initializeBlotter

  // Track if we've applied the initial layout
  const initialLayoutAppliedRef = useRef(false);

  // Apply layout when layouts load - don't wait for grid to be ready
  // Provider and toolbar state need to be applied immediately so the grid can initialize
  useEffect(() => {
    // Only apply once on initial load
    if (initialLayoutAppliedRef.current) {
      return;
    }

    // Wait for layouts to load and a layout to be selected (from initializeBlotter)
    // Use selectedLayout from layoutManager (already memoized) to avoid duplicate lookup
    if (layoutManager.selectedLayout) {
      logger.debug('Applying initial layout', {
        layoutId: layoutManager.selectedLayoutId,
        providerId: layoutManager.selectedLayout.config.selectedProviderId,
        toolbarState: layoutManager.selectedLayout.config.toolbarState,
      }, 'SimpleBlotter');
      layoutManager.applyLayoutToGrid(layoutManager.selectedLayout.config);
      initialLayoutAppliedRef.current = true;
    }
  }, [layoutManager.selectedLayout, layoutManager.selectedLayoutId, layoutManager.applyLayoutToGrid]);

  // Re-apply grid state when grid becomes ready (if we already applied provider/toolbar)
  useEffect(() => {
    // Use selectedLayout from layoutManager to avoid duplicate lookup
    if (gridReady && layoutManager.selectedLayout && initialLayoutAppliedRef.current) {
      const { config } = layoutManager.selectedLayout;
      logger.debug('Re-applying grid state after grid ready', {
        layoutId: layoutManager.selectedLayoutId,
        columnCount: config.columnState?.length || 0,
        sideBarVisible: config.sideBarState?.visible,
      }, 'SimpleBlotter');
      // Only apply grid state (column, filter, sort, sidebar) - provider/toolbar already applied
      if (gridApiRef.current && config.columnState?.length > 0) {
        gridApiRef.current.applyColumnState({
          state: config.columnState,
          applyOrder: true,
        });
      }
      if (gridApiRef.current && config.filterState) {
        gridApiRef.current.setFilterModel(config.filterState);
      }
      // Apply side bar state if specified
      if (gridApiRef.current && config.sideBarState) {
        try {
          // Set side bar visibility
          gridApiRef.current.setSideBarVisible(config.sideBarState.visible);

          // Open the tool panel if one was open
          if (config.sideBarState.visible && config.sideBarState.openToolPanel) {
            gridApiRef.current.openToolPanel(config.sideBarState.openToolPanel);
          } else if (!config.sideBarState.openToolPanel) {
            // Close any open tool panel
            gridApiRef.current.closeToolPanel();
          }
          logger.debug('Applied sidebar state after grid ready', {
            visible: config.sideBarState.visible,
            openToolPanel: config.sideBarState.openToolPanel,
          }, 'SimpleBlotter');
        } catch (error) {
          logger.warn('Failed to apply sidebar state after grid ready', error, 'SimpleBlotter');
        }
      }
    }
  }, [gridReady, layoutManager.selectedLayout, layoutManager.selectedLayoutId]);

  // ============================================================================
  // Debug Info: Fetch activeLayoutId from customData
  // ============================================================================

  useEffect(() => {
    // Fetch debug info from view customData
    const fetchDebugInfo = async () => {
      try {
        const activeLayoutId = await getActiveLayoutId();
        setDebugActiveLayoutId(activeLayoutId || null);

        // Find layout name if we have layouts
        if (activeLayoutId && layoutManager.layouts) {
          const layout = layoutManager.layouts.find(l => l.layoutId === activeLayoutId);
          setDebugLayoutName(layout?.name || null);
        } else {
          setDebugLayoutName(null);
        }
      } catch (error) {
        logger.debug('Could not fetch debug info from customData', { error }, 'SimpleBlotter');
        setDebugActiveLayoutId(null);
        setDebugLayoutName(null);
      }
    };

    fetchDebugInfo();
  }, [layoutManager.selectedLayoutId, layoutManager.layouts]);

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
          logger.warn('No columns found in config', { selectedProviderId }, 'SimpleBlotter');
        }
      })
      .catch((error) => {
        logger.error('Failed to load columns', error, 'SimpleBlotter');
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
      logger.debug('Config loaded state changed', { isConfigLoaded: adapter?.isConfigLoaded }, 'SimpleBlotter');
      isConfigLoadedRef.current = adapter?.isConfigLoaded || false;
    }
  }, [adapter?.isConfigLoaded]);

  // ============================================================================
  // Setup Data Handlers & Connection
  // ============================================================================

  useEffect(() => {
    logger.debug('Connection effect triggered', {
      hasAdapter: !!adapterRef.current,
      isConfigLoaded: isConfigLoadedRef.current,
      gridReady,
      selectedProviderId
    }, 'SimpleBlotter');

    // Use adapterRef.current to access adapter without depending on it
    const currentAdapter = adapterRef.current;

    if (!currentAdapter || !isConfigLoadedRef.current || !gridReady) {
      logger.debug('Skipping connection - conditions not met', {
        hasAdapter: !!currentAdapter,
        isConfigLoaded: isConfigLoadedRef.current,
        gridReady
      }, 'SimpleBlotter');
      return;
    }

    logger.info('Setting up data handlers and connecting', { selectedProviderId }, 'SimpleBlotter');

    // Setup data handlers
    currentAdapter.setOnSnapshot((rows) => {
      logger.debug('Snapshot batch received', {
        batchSize: rows.length,
        totalBefore: snapshotRowsRef.current.length,
        gridReady,
        apiAvailable: !!gridApiRef.current,
        alreadyLoaded: snapshotLoadedRef.current
      }, 'SimpleBlotter');

      snapshotRowsRef.current.push(...rows);

      // Load immediately on first batch instead of waiting for complete event
      if (gridApiRef.current && !snapshotLoadedRef.current) {
        logger.debug('Loading first batch into grid', { rowCount: snapshotRowsRef.current.length }, 'SimpleBlotter');
        gridApiRef.current.setGridOption('rowData', snapshotRowsRef.current);
        snapshotLoadedRef.current = true;
        setIsLoading(false);
        setRowCount(snapshotRowsRef.current.length);
      } else if (gridApiRef.current && snapshotLoadedRef.current) {
        gridApiRef.current.applyTransactionAsync({ add: rows });
        setRowCount(snapshotRowsRef.current.length);
      }
    });

    currentAdapter.setOnSnapshotComplete(() => {
      const loadTime = loadStartTimeRef.current ? Date.now() - loadStartTimeRef.current : 0;
      logger.info('Snapshot complete', {
        totalRows: snapshotRowsRef.current.length,
        loadTimeMs: loadTime,
        displayedRows: gridApiRef.current?.getDisplayedRowCount() || 0
      }, 'SimpleBlotter');
      setLoadTimeMs(loadTime);
      setIsLoading(false);
    });

    currentAdapter.setOnUpdate((rows) => {
      if (snapshotLoadedRef.current && gridApiRef.current) {
        // No logging on hot path for performance
        gridApiRef.current.applyTransactionAsync({ update: rows });
        // Increment update counter
        setUpdateCount(prev => prev + rows.length);
      }
    });

    currentAdapter.setOnError((error) => {
      logger.error('Provider error', error, 'SimpleBlotter');
      setIsLoading(false);
      onErrorRef.current?.(error);
    });

    // Connect to provider
    logger.info('Connecting to provider', { selectedProviderId }, 'SimpleBlotter');
    setIsLoading(true);
    loadStartTimeRef.current = Date.now();
    setLoadTimeMs(null);
    setRowCount(0);
    setUpdateCount(0); // Reset update counter on new connection
    snapshotLoadedRef.current = false;
    snapshotRowsRef.current = [];

    currentAdapter.connect();

    // Update connection state ref
    isConnectedRef.current = true;

    // Cleanup - use ref to get latest adapter
    return () => {
      logger.debug('Disconnecting from provider', {}, 'SimpleBlotter');
      if (adapterRef.current) {
        adapterRef.current.disconnect();
        isConnectedRef.current = false;
      }
    };
    // CRITICAL: Do NOT include adapter in dependencies - it changes on every render
    // Use adapterRef.current instead, which is kept in sync by the effect above
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
        logger.error('Failed to reload columns after config update', error, 'SimpleBlotter');
      });
  }, [platform.configService]);

  // ============================================================================
  // OpenFin Custom Events Subscription
  // ============================================================================

  useEffect(() => {
    if (!platform.isOpenFin) return;

    logger.debug('Subscribing to OpenFin events', {}, 'SimpleBlotter');

    // Subscribe to data refresh - reload data when requested
    const unsubRefresh = platform.subscribeToEvent(
      OpenFinCustomEvents.DATA_REFRESH,
      (data) => {
        logger.debug('Data refresh event received', { data }, 'SimpleBlotter');
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
        logger.debug('Config update event received', { data }, 'SimpleBlotter');
        if (data.componentType === COMPONENT_TYPES.DATA_PROVIDER && data.configId === selectedProviderId) {
          // Use memoized column loading function
          loadColumnsForProvider(selectedProviderId);
        }
      }
    );

    // Subscribe to provider status - update connection state
    const unsubProviderStatus = platform.subscribeToEvent(
      OpenFinCustomEvents.PROVIDER_STATUS,
      (data) => {
        logger.debug('Provider status event received', { data }, 'SimpleBlotter');
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      unsubRefresh();
      unsubConfig();
      unsubProviderStatus();
      logger.debug('Unsubscribed from OpenFin events', {}, 'SimpleBlotter');
    };
  }, [platform, selectedProviderId, loadColumnsForProvider]);

  // ============================================================================
  // Grid Ready Handler
  // ============================================================================

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    logger.debug('Grid ready', {}, 'SimpleBlotter');
    gridApiRef.current = event.api;
    gridReadyRef.current = true;
    setGridReady(true);

    onReadyRef.current?.();
  }, []);

  // ============================================================================
  // Provider Selection Handler
  // ============================================================================

  const handleProviderSelect = useCallback((providerId: string) => {
    logger.debug('Provider selected', { providerId }, 'SimpleBlotter');
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
          // Layout management props
          layouts={layoutManager.layouts}
          selectedLayoutId={layoutManager.selectedLayoutId}
          defaultLayoutId={layoutManager.defaultLayoutId}
          isLayoutSaving={layoutManager.isSaving}
          onLayoutSelect={layoutManager.selectLayout}
          onSaveLayout={layoutManager.saveCurrentLayout}
          onSaveAsNew={() => layoutManager.setIsSaveDialogOpen(true)}
          onManageLayouts={() => layoutManager.setIsManageDialogOpen(true)}
          // Debug props (for troubleshooting customData persistence)
          debugConfigId={viewInstanceId}
          debugActiveLayoutId={debugActiveLayoutId}
          debugLayoutName={debugLayoutName}
          updateCount={updateCount}
        />
      </CollapsibleToolbar>

      {/* Layout Save Dialog */}
      <LayoutSaveDialog
        open={layoutManager.isSaveDialogOpen}
        onClose={() => layoutManager.setIsSaveDialogOpen(false)}
        onSave={layoutManager.saveAsNewLayout}
        isSaving={layoutManager.isSaving}
        defaultName={`Layout ${layoutManager.layouts.length + 1}`}
      />

      {/* Layout Manage Dialog */}
      <LayoutManageDialog
        open={layoutManager.isManageDialogOpen}
        onClose={() => layoutManager.setIsManageDialogOpen(false)}
        layouts={layoutManager.layouts}
        defaultLayoutId={layoutManager.defaultLayoutId}
        selectedLayoutId={layoutManager.selectedLayoutId ?? undefined}
        blotterInfo={layoutManager.blotterUnified ? {
          configId: layoutManager.blotterUnified.configId,
          componentType: layoutManager.blotterUnified.componentType,
          componentSubType: layoutManager.blotterUnified.componentSubType,
        } : undefined}
        onRename={layoutManager.renameLayout}
        onDelete={layoutManager.deleteLayout}
        onDuplicate={layoutManager.duplicateLayout}
        onSetDefault={layoutManager.setDefaultLayout}
        onSelect={layoutManager.selectLayout}
        onSaveComponentSubType={layoutManager.updateComponentSubType}
      />

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
            suppressClipboardPaste={false}
            debounceVerticalScrollbar={true}
            suppressScrollOnNewData={true}
            // Enable cell selection
            cellSelection={true}
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
