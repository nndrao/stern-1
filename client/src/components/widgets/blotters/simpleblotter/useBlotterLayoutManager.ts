/**
 * useBlotterLayoutManager Hook
 *
 * Manages layout state and operations for SimpleBlotter.
 * Provides a clean interface for loading, saving, and switching layouts.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { GridApi, ColumnState as AgColumnState } from 'ag-grid-community';
import {
  SimpleBlotterLayoutConfig,
  ColumnState,
  BlotterToolbarState,
  SideBarState,
  createDefaultLayoutConfig
} from '@stern/shared-types';
import {
  useBlotterConfig,
  useBlotterLayouts,
  useGetOrCreateBlotterConfig,
  useUpdateBlotterConfig,
  useUpdateComponentSubType,
  useCreateLayout,
  useUpdateLayout,
  useDeleteLayout,
  useDuplicateLayout,
  useSetDefaultLayout,
} from '@/hooks/api/useSimpleBlotterQueries';
import { getActiveLayoutId, setActiveLayoutId, updateViewCustomData } from '@/openfin/utils/viewUtils';
import { logger } from '@/utils/logger';

export interface UseBlotterLayoutManagerOptions {
  /** The blotter's config ID (viewInstanceId) */
  blotterConfigId: string;
  /** User ID */
  userId: string;
  /** Blotter name for display */
  blotterName?: string;
  /** AG Grid API reference */
  gridApi?: GridApi | null;
  /** Current selected provider ID */
  selectedProviderId?: string | null;
  /** Current toolbar state */
  toolbarState?: BlotterToolbarState;
}

/**
 * Callback interface for layout application
 */
export interface LayoutApplyCallbacks {
  /** Called when provider should change */
  onProviderChange?: (providerId: string | null) => void;
  /** Called when toolbar state should change */
  onToolbarStateChange?: (state: BlotterToolbarState) => void;
}

export interface LayoutManagerState {
  /** Currently selected layout ID */
  selectedLayoutId: string | null;
  /** Whether save dialog is open */
  isSaveDialogOpen: boolean;
  /** Whether manage dialog is open */
  isManageDialogOpen: boolean;
}

export function useBlotterLayoutManager({
  blotterConfigId,
  userId,
  blotterName = 'Blotter',
  gridApi,
  selectedProviderId,
  toolbarState,
}: UseBlotterLayoutManagerOptions) {
  // ============================================================================
  // State
  // ============================================================================

  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  // Callbacks for applying layout state to parent component
  // Use ref to avoid timing issues - callbacks should be available immediately
  const applyCallbacksRef = useRef<LayoutApplyCallbacks>({});

  // ============================================================================
  // Queries
  // ============================================================================

  const blotterConfigQuery = useBlotterConfig(blotterConfigId);
  const layoutsQuery = useBlotterLayouts(blotterConfigId);

  // ============================================================================
  // Mutations
  // ============================================================================

  const getOrCreateBlotter = useGetOrCreateBlotterConfig();
  const updateBlotterConfig = useUpdateBlotterConfig();
  const updateComponentSubType = useUpdateComponentSubType();
  const createLayout = useCreateLayout();
  const updateLayout = useUpdateLayout();
  const deleteLayout = useDeleteLayout();
  const duplicateLayout = useDuplicateLayout();
  const setDefaultLayout = useSetDefaultLayout();

  // ============================================================================
  // Derived State
  // ============================================================================

  const layouts = useMemo(() => layoutsQuery.data || [], [layoutsQuery.data]);
  const blotterData = blotterConfigQuery.data; // Full blotter data including unified
  const blotterConfig = blotterData?.config;
  const blotterUnified = blotterData?.unified;
  const defaultLayoutId = blotterConfig?.defaultLayoutId;
  const lastSelectedLayoutId = blotterConfig?.lastSelectedLayoutId;

  const selectedLayout = useMemo(
    () => layouts.find((l) => l.unified.configId === selectedLayoutId),
    [layouts, selectedLayoutId]
  );

  const isLoading = blotterConfigQuery.isLoading || layoutsQuery.isLoading;
  const isSaving =
    createLayout.isPending ||
    updateLayout.isPending ||
    deleteLayout.isPending ||
    duplicateLayout.isPending ||
    setDefaultLayout.isPending;

  // ============================================================================
  // Grid State Capture
  // ============================================================================

  /**
   * Convert AG Grid ColumnState to our simplified ColumnState
   * Handles type conversions for properties that differ between AG Grid and our types:
   * - pinned: AG Grid uses boolean | 'left' | 'right', we use 'left' | 'right' | null
   * - aggFunc: AG Grid can use functions, we only store string names
   */
  const convertColumnState = (agState: AgColumnState[]): ColumnState[] => {
    return agState.map((col) => {
      // Convert boolean pinned to string or null
      let pinned: 'left' | 'right' | null | undefined = undefined;
      if (col.pinned === 'left' || col.pinned === 'right') {
        pinned = col.pinned;
      } else if (col.pinned === true) {
        pinned = 'left'; // Default boolean true to left
      } else if (col.pinned === false || col.pinned === null) {
        pinned = null;
      }

      // Convert aggFunc - only keep string values, discard functions
      let aggFunc: string | null | undefined = undefined;
      if (typeof col.aggFunc === 'string') {
        aggFunc = col.aggFunc;
      } else if (col.aggFunc === null) {
        aggFunc = null;
      }

      return {
        colId: col.colId,
        width: col.width ?? undefined,
        hide: col.hide ?? undefined,
        pinned,
        sort: col.sort ?? undefined,
        sortIndex: col.sortIndex ?? undefined,
        aggFunc,
        rowGroup: col.rowGroup ?? undefined,
        rowGroupIndex: col.rowGroupIndex ?? undefined,
        pivot: col.pivot ?? undefined,
        pivotIndex: col.pivotIndex ?? undefined,
        flex: col.flex ?? undefined,
      };
    });
  };

  /**
   * Capture current grid state for saving
   * Includes grid state, selected provider, and toolbar state
   */
  const captureGridState = useCallback((): Partial<SimpleBlotterLayoutConfig> => {
    // Capture provider and toolbar state even if grid is not ready
    const baseState: Partial<SimpleBlotterLayoutConfig> = {
      selectedProviderId: selectedProviderId ?? null,
      toolbarState: toolbarState ?? { isCollapsed: true, isPinned: false },
    };

    if (!gridApi) {
      logger.warn('Grid API not available for state capture, saving provider/toolbar state only', {}, 'useBlotterLayoutManager');
      return baseState;
    }

    try {
      // Get column state (order, width, visibility, pinning, etc.)
      const agColumnState = gridApi.getColumnState();
      const columnState = convertColumnState(agColumnState);

      // Get filter model
      const filterState = gridApi.getFilterModel() || {};

      // Get sort model
      const sortState = agColumnState
        .filter((col) => col.sort)
        .map((col) => ({
          colId: col.colId,
          sort: col.sort as 'asc' | 'desc',
        }));

      // Get column definitions (simplified)
      const columnDefs = gridApi.getColumnDefs()?.map((col: any) => ({
        field: col.field,
        headerName: col.headerName,
        width: col.width,
        hide: col.hide,
        pinned: col.pinned,
      })) || [];

      // Get side bar state
      let sideBarState: SideBarState | undefined;
      try {
        const sideBar = gridApi.getSideBar();
        if (sideBar) {
          const openToolPanel = gridApi.getOpenedToolPanel();
          sideBarState = {
            visible: gridApi.isSideBarVisible(),
            openToolPanel: openToolPanel || null,
          };
        }
      } catch {
        // Side bar may not be configured
        sideBarState = undefined;
      }

      // Get row grouping columns
      const rowGroupColumns = gridApi.getRowGroupColumns?.()?.map((col: any) => col.getColId()) || [];

      // Get pivot columns
      const pivotColumns = gridApi.getPivotColumns?.()?.map((col: any) => col.getColId()) || [];

      logger.debug('Grid state captured', {
        columnCount: columnState.length,
        filterCount: Object.keys(filterState).length,
        sortCount: sortState.length,
        sideBarVisible: sideBarState?.visible,
        openToolPanel: sideBarState?.openToolPanel,
        rowGroupColumns: rowGroupColumns.length,
        pivotColumns: pivotColumns.length,
        selectedProviderId,
        toolbarState,
      }, 'useBlotterLayoutManager');

      return {
        ...baseState,
        columnDefs,
        columnState,
        filterState,
        sortState,
        sideBarState,
        rowGroupColumns,
        pivotColumns,
      };
    } catch (error) {
      logger.error('Failed to capture grid state', error, 'useBlotterLayoutManager');
      return baseState;
    }
  }, [gridApi, selectedProviderId, toolbarState]);

  /**
   * Reset grid state completely before applying a new layout
   * This ensures the previous layout's state doesn't bleed through
   */
  const resetGridState = useCallback(() => {
    if (!gridApi) return;

    try {
      logger.debug('Resetting grid state before layout switch', {}, 'useBlotterLayoutManager');

      // Reset column state to default (removes all sorting, filtering, pinning, etc.)
      gridApi.resetColumnState();

      // Clear all filters
      gridApi.setFilterModel(null);

      // Clear any row grouping
      gridApi.setRowGroupColumns([]);

      // Clear any pivot columns
      gridApi.setPivotColumns([]);

      // Clear any value columns (aggregations)
      gridApi.setValueColumns([]);

      // Close any open tool panel and reset side bar
      try {
        gridApi.closeToolPanel();
      } catch {
        // Side bar may not be configured
      }

      logger.debug('Grid state reset complete', {}, 'useBlotterLayoutManager');
    } catch (error) {
      logger.error('Failed to reset grid state', error, 'useBlotterLayoutManager');
    }
  }, [gridApi]);

  /**
   * Apply layout config to grid and component state
   * Returns the provider ID and toolbar state that should be applied
   */
  const applyLayoutToGrid = useCallback((layoutConfig: SimpleBlotterLayoutConfig, resetFirst: boolean = false): {
    providerId?: string | null;
    toolbarState?: BlotterToolbarState;
  } => {
    const result: { providerId?: string | null; toolbarState?: BlotterToolbarState } = {};
    const callbacks = applyCallbacksRef.current;

    logger.debug('Applying layout to grid', {
      hasCallbacks: !!callbacks.onProviderChange || !!callbacks.onToolbarStateChange,
      selectedProviderId: layoutConfig.selectedProviderId,
      toolbarState: layoutConfig.toolbarState,
      resetFirst,
    }, 'useBlotterLayoutManager');

    // Apply provider selection via callback
    if (layoutConfig.selectedProviderId !== undefined) {
      result.providerId = layoutConfig.selectedProviderId;
      if (callbacks.onProviderChange) {
        logger.debug('Calling onProviderChange callback', { providerId: layoutConfig.selectedProviderId }, 'useBlotterLayoutManager');
        callbacks.onProviderChange(layoutConfig.selectedProviderId);
      }
    }

    // Apply toolbar state via callback
    if (layoutConfig.toolbarState) {
      result.toolbarState = layoutConfig.toolbarState;
      if (callbacks.onToolbarStateChange) {
        logger.debug('Calling onToolbarStateChange callback', { toolbarState: layoutConfig.toolbarState }, 'useBlotterLayoutManager');
        callbacks.onToolbarStateChange(layoutConfig.toolbarState);
      }
    }

    // Apply grid state if grid API is available
    if (gridApi) {
      try {
        // Reset grid state first if requested (when switching layouts)
        if (resetFirst) {
          resetGridState();
        }

        // Apply column state
        if (layoutConfig.columnState && layoutConfig.columnState.length > 0) {
          gridApi.applyColumnState({
            state: layoutConfig.columnState,
            applyOrder: true,
          });
        }

        // Apply filter model
        if (layoutConfig.filterState) {
          gridApi.setFilterModel(layoutConfig.filterState);
        }

        // Apply row grouping if specified
        if (layoutConfig.rowGroupColumns && layoutConfig.rowGroupColumns.length > 0) {
          gridApi.setRowGroupColumns(layoutConfig.rowGroupColumns);
        }

        // Apply pivot columns if specified
        if (layoutConfig.pivotColumns && layoutConfig.pivotColumns.length > 0) {
          gridApi.setPivotColumns(layoutConfig.pivotColumns);
        }

        // Apply side bar state if specified
        if (layoutConfig.sideBarState) {
          try {
            // Set side bar visibility
            gridApi.setSideBarVisible(layoutConfig.sideBarState.visible);

            // Open the tool panel if one was open
            if (layoutConfig.sideBarState.visible && layoutConfig.sideBarState.openToolPanel) {
              gridApi.openToolPanel(layoutConfig.sideBarState.openToolPanel);
            } else if (!layoutConfig.sideBarState.openToolPanel) {
              // Close any open tool panel
              gridApi.closeToolPanel();
            }
          } catch {
            // Side bar may not be configured
          }
        }

        logger.debug('Layout applied to grid', {
          layoutColumns: layoutConfig.columnState?.length || 0,
          sideBarVisible: layoutConfig.sideBarState?.visible,
          openToolPanel: layoutConfig.sideBarState?.openToolPanel,
          providerId: layoutConfig.selectedProviderId,
          toolbarState: layoutConfig.toolbarState,
        }, 'useBlotterLayoutManager');
      } catch (error) {
        logger.error('Failed to apply layout to grid', error, 'useBlotterLayoutManager');
      }
    } else {
      logger.debug('Layout applied (grid not ready, provider/toolbar only)', {
        providerId: layoutConfig.selectedProviderId,
        toolbarState: layoutConfig.toolbarState,
      }, 'useBlotterLayoutManager');
    }

    return result;
  }, [gridApi, resetGridState]);

  /**
   * Register callbacks for applying layout state
   * Uses a ref so callbacks are immediately available without re-render
   */
  const registerApplyCallbacks = useCallback((callbacks: LayoutApplyCallbacks) => {
    logger.debug('Registering apply callbacks', {
      hasProviderChange: !!callbacks.onProviderChange,
      hasToolbarChange: !!callbacks.onToolbarStateChange,
    }, 'useBlotterLayoutManager');
    applyCallbacksRef.current = callbacks;
  }, []);

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Initialize blotter config (called on mount)
   * Priority for layout selection:
   * 1. View customData.activeLayoutId (per-view, set when user selects layout) - PRIMARY
   * 2. defaultLayoutId from blotter config (fallback for truly new views only)
   *
   * NOTE: We intentionally do NOT fall back to lastSelectedLayoutId because:
   * - lastSelectedLayoutId is stored on the shared blotter config
   * - Multiple views of the same component share the same config
   * - Using lastSelectedLayoutId would cause all views to load the same layout
   * - activeLayoutId in view customData is the correct per-view mechanism
   */
  const initializeBlotter = useCallback(async () => {
    try {
      const result = await getOrCreateBlotter.mutateAsync({
        configId: blotterConfigId,
        userId,
        name: blotterName,
      });

      // First, try to get activeLayoutId from view customData (per-view layout)
      // This is the primary mechanism for workspace restore with per-view layouts
      let layoutToSelect: string | null = null;
      let layoutSource: 'viewCustomData' | 'default' | 'none' = 'none';

      try {
        const viewActiveLayoutId = await getActiveLayoutId();
        if (viewActiveLayoutId) {
          logger.info('Found activeLayoutId in view customData (workspace restore)', {
            activeLayoutId: viewActiveLayoutId,
            blotterConfigId,
          }, 'useBlotterLayoutManager');
          layoutToSelect = viewActiveLayoutId;
          layoutSource = 'viewCustomData';
        } else {
          logger.debug('No activeLayoutId in view customData', {
            blotterConfigId,
          }, 'useBlotterLayoutManager');
        }
      } catch (error) {
        logger.debug('Could not read view customData (may not be in OpenFin)', { error }, 'useBlotterLayoutManager');
      }

      // Only fall back to defaultLayoutId for truly new views (no per-view layout set)
      // Do NOT use lastSelectedLayoutId - it's shared between all views of the same config
      if (!layoutToSelect && result.config.defaultLayoutId) {
        layoutToSelect = result.config.defaultLayoutId;
        layoutSource = 'default';
        logger.debug('Using defaultLayoutId for new view', {
          defaultLayoutId: result.config.defaultLayoutId,
          blotterConfigId,
        }, 'useBlotterLayoutManager');
      }

      if (layoutToSelect) {
        logger.info('Selecting initial layout', {
          layoutId: layoutToSelect,
          source: layoutSource,
          blotterConfigId,
        }, 'useBlotterLayoutManager');
        setSelectedLayoutId(layoutToSelect);

        // IMPORTANT: If we selected a layout from default (not from customData),
        // we need to save it to customData so future saves work correctly
        if (layoutSource === 'default') {
          try {
            await setActiveLayoutId(layoutToSelect);
            logger.debug('Saved defaultLayoutId to view customData for new view', {
              layoutId: layoutToSelect,
              blotterConfigId,
            }, 'useBlotterLayoutManager');
          } catch (error) {
            logger.debug('Could not save default layout to view customData (may not be in OpenFin)', { error }, 'useBlotterLayoutManager');
          }
        }
      } else {
        logger.debug('No layout to select on init', { blotterConfigId }, 'useBlotterLayoutManager');
      }

      return result;
    } catch (error) {
      logger.error('Failed to initialize blotter', error, 'useBlotterLayoutManager');
      throw error;
    }
  }, [blotterConfigId, userId, blotterName, getOrCreateBlotter]);

  /**
   * Select a layout and apply it to the grid
   * Also saves the selection:
   * - To view customData.activeLayoutId (per-view, persisted with workspace)
   * - To blotter config lastSelectedLayoutId (fallback for non-OpenFin or new views)
   * @param layoutId - The layout ID to select
   * @param isInitialLoad - Whether this is the initial load (don't reset grid state)
   */
  const selectLayout = useCallback(async (layoutId: string, isInitialLoad: boolean = false) => {
    logger.debug('Selecting layout', { layoutId, isInitialLoad }, 'useBlotterLayoutManager');
    setSelectedLayoutId(layoutId);

    const layout = layouts.find((l) => l.unified.configId === layoutId);
    if (layout) {
      // Reset grid state first when switching layouts (not on initial load)
      applyLayoutToGrid(layout.config, !isInitialLoad);
    }

    // Save activeLayoutId to view customData (per-view, persisted with workspace)
    // This is the primary mechanism for per-view layout selection
    try {
      await setActiveLayoutId(layoutId);
      logger.debug('Saved activeLayoutId to view customData', { layoutId }, 'useBlotterLayoutManager');
    } catch (error) {
      logger.debug('Could not save to view customData (may not be in OpenFin)', { error }, 'useBlotterLayoutManager');
    }

    // Also save as the last selected layout in blotter config (fallback for non-OpenFin)
    // Fire and forget - this is secondary to view customData
    updateBlotterConfig.mutate({
      configId: blotterConfigId,
      updates: { lastSelectedLayoutId: layoutId },
      userId,
    });
  }, [layouts, applyLayoutToGrid, updateBlotterConfig, blotterConfigId, userId]);

  /**
   * Save current grid state to the selected layout
   */
  const saveCurrentLayout = useCallback(async () => {
    if (!selectedLayoutId) {
      logger.warn('No layout selected for saving', {}, 'useBlotterLayoutManager');
      return;
    }

    const gridState = captureGridState();
    await updateLayout.mutateAsync({
      layoutId: selectedLayoutId,
      updates: gridState,
      userId,
      blotterConfigId,
    });
  }, [selectedLayoutId, captureGridState, updateLayout, userId, blotterConfigId]);

  /**
   * Save current grid state as a new layout
   */
  const saveAsNewLayout = useCallback(async (name: string, setAsDefault: boolean) => {
    const gridState = captureGridState();
    const layoutConfig = createDefaultLayoutConfig(gridState);

    const result = await createLayout.mutateAsync({
      blotterConfigId,
      userId,
      name,
      config: layoutConfig,
    });

    // Set as default if requested
    if (setAsDefault) {
      await setDefaultLayout.mutateAsync({
        blotterConfigId,
        layoutId: result.unified.configId,
        userId,
      });
    }

    // Select the new layout
    setSelectedLayoutId(result.unified.configId);

    // Save activeLayoutId to view customData (per-view, persisted with workspace)
    try {
      await setActiveLayoutId(result.unified.configId);
      logger.debug('Saved new layout to view customData', { layoutId: result.unified.configId }, 'useBlotterLayoutManager');
    } catch (error) {
      logger.debug('Could not save to view customData (may not be in OpenFin)', { error }, 'useBlotterLayoutManager');
    }

    setIsSaveDialogOpen(false);

    return result;
  }, [captureGridState, createLayout, blotterConfigId, userId, setDefaultLayout]);

  /**
   * Rename a layout
   * Note: Currently logs the rename action but the actual rename requires
   * updating the UnifiedConfig.name field via simpleBlotterConfigService.renameLayout
   * TODO: Implement renameLayout in simpleBlotterConfigService when needed
   */
  const renameLayout = useCallback(async (layoutId: string, newName: string) => {
    const layout = layouts.find((l) => l.unified.configId === layoutId);
    if (!layout) {
      logger.warn('Cannot rename - layout not found', { layoutId }, 'useBlotterLayoutManager');
      return;
    }

    // For now, log a warning that rename is not fully implemented
    // The UI should still work, but the name won't persist until the API is added
    logger.warn(
      'Layout rename not fully implemented - name change will not persist',
      { layoutId, newName, currentName: layout.unified.name },
      'useBlotterLayoutManager'
    );

    // TODO: When simpleBlotterConfigService.renameLayout is implemented:
    // await simpleBlotterConfigService.renameLayout(layoutId, newName, userId);
  }, [layouts]);

  /**
   * Delete a layout
   */
  const handleDeleteLayout = useCallback(async (layoutId: string) => {
    await deleteLayout.mutateAsync({
      layoutId,
      blotterConfigId,
    });

    // If we deleted the selected layout, select the next available layout
    if (selectedLayoutId === layoutId) {
      // Find the next layout to select
      const remainingLayouts = layouts.filter(l => l.unified.configId !== layoutId);

      if (remainingLayouts.length > 0) {
        // Select the first remaining layout (or could be the default if it exists)
        const nextLayoutId = defaultLayoutId && remainingLayouts.some(l => l.unified.configId === defaultLayoutId)
          ? defaultLayoutId
          : remainingLayouts[0].unified.configId;

        logger.debug('Selecting next layout after deletion', { nextLayoutId }, 'useBlotterLayoutManager');

        // Use selectLayout to ensure customData is properly updated
        await selectLayout(nextLayoutId);
      } else {
        // No layouts left, clear selection
        setSelectedLayoutId(null);

        // Clear activeLayoutId from view customData
        try {
          await updateViewCustomData({ activeLayoutId: undefined });
          logger.debug('Cleared activeLayoutId from view customData - no layouts remaining', {}, 'useBlotterLayoutManager');
        } catch (error) {
          logger.debug('Could not clear view customData (may not be in OpenFin)', { error }, 'useBlotterLayoutManager');
        }
      }
    }
  }, [deleteLayout, blotterConfigId, selectedLayoutId, layouts, defaultLayoutId, selectLayout]);

  /**
   * Duplicate a layout
   */
  const handleDuplicateLayout = useCallback(async (layoutId: string, newName: string) => {
    await duplicateLayout.mutateAsync({
      layoutId,
      newName,
      userId,
      blotterConfigId,
    });
  }, [duplicateLayout, userId, blotterConfigId]);

  /**
   * Set a layout as default
   */
  const handleSetDefaultLayout = useCallback(async (layoutId: string) => {
    await setDefaultLayout.mutateAsync({
      blotterConfigId,
      layoutId,
      userId,
    });
  }, [setDefaultLayout, blotterConfigId, userId]);

  /**
   * Update blotter componentSubType
   */
  const handleUpdateComponentSubType = useCallback(async (subType: string) => {
    await updateComponentSubType.mutateAsync({
      configId: blotterConfigId,
      componentSubType: subType,
      userId,
    });
  }, [updateComponentSubType, blotterConfigId, userId]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    selectedLayoutId,
    selectedLayout,
    layouts,
    defaultLayoutId,
    blotterConfig,
    blotterUnified,
    isLoading,
    isSaving,

    // Dialog state
    isSaveDialogOpen,
    isManageDialogOpen,
    setIsSaveDialogOpen,
    setIsManageDialogOpen,

    // Actions
    initializeBlotter,
    selectLayout,
    saveCurrentLayout,
    saveAsNewLayout,
    renameLayout,
    deleteLayout: handleDeleteLayout,
    duplicateLayout: handleDuplicateLayout,
    setDefaultLayout: handleSetDefaultLayout,
    updateComponentSubType: handleUpdateComponentSubType,

    // Grid helpers
    captureGridState,
    applyLayoutToGrid,
    resetGridState,

    // Callback registration
    registerApplyCallbacks,
  };
}

export default useBlotterLayoutManager;
