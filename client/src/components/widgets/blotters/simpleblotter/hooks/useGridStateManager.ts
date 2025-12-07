/**
 * useGridStateManager Hook
 *
 * Manages AG Grid state capture and application.
 * Extracted from useBlotterLayoutManager for single responsibility.
 */

import { useCallback } from 'react';
import { GridApi, ColumnState as AgColumnState } from 'ag-grid-community';
import {
  SimpleBlotterLayoutConfig,
  ColumnState,
  BlotterToolbarState,
  SideBarState,
  BlotterToolbarConfig,
} from '@stern/shared-types';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface GridStateManagerOptions {
  gridApi: GridApi | null;
  selectedProviderId?: string;
  toolbarState?: BlotterToolbarState;
}

export interface GridStateManagerResult {
  /** Capture current grid state */
  captureGridState: () => Partial<SimpleBlotterLayoutConfig>;
  /** Apply layout config to grid */
  applyLayoutToGrid: (
    layoutConfig: SimpleBlotterLayoutConfig,
    callbacks?: LayoutApplyCallbacks,
    resetFirst?: boolean
  ) => ApplyLayoutResult;
  /** Reset grid state to defaults */
  resetGridState: () => void;
}

export interface LayoutApplyCallbacks {
  onProviderChange?: (providerId: string) => void;
  onToolbarStateChange?: (state: BlotterToolbarState) => void;
  onToolbarConfigChange?: (config: BlotterToolbarConfig) => void;
}

export interface ApplyLayoutResult {
  providerId?: string;
  toolbarState?: BlotterToolbarState;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert AG Grid ColumnState to our simplified ColumnState
 */
function convertColumnState(agState: AgColumnState[]): ColumnState[] {
  return agState.map((col) => {
    let pinned: 'left' | 'right' | null | undefined = undefined;
    if (col.pinned === 'left' || col.pinned === 'right') {
      pinned = col.pinned;
    } else if (col.pinned === true) {
      pinned = 'left';
    } else if (col.pinned === false || col.pinned === null) {
      pinned = null;
    }

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
}

// ============================================================================
// Hook
// ============================================================================

export function useGridStateManager({
  gridApi,
  selectedProviderId,
  toolbarState,
}: GridStateManagerOptions): GridStateManagerResult {
  /**
   * Capture current grid state for saving
   */
  const captureGridState = useCallback((): Partial<SimpleBlotterLayoutConfig> => {
    const baseState: Partial<SimpleBlotterLayoutConfig> = {
      selectedProviderId,
      toolbarState: toolbarState ?? { isCollapsed: true, isPinned: false },
    };

    if (!gridApi) {
      logger.warn('Grid API not available for state capture', {}, 'useGridStateManager');
      return baseState;
    }

    try {
      const agColumnState = gridApi.getColumnState();
      const columnState = convertColumnState(agColumnState);
      const filterState = gridApi.getFilterModel() || {};

      const sortState = agColumnState
        .filter((col) => col.sort)
        .map((col) => ({
          colId: col.colId,
          sort: col.sort as 'asc' | 'desc',
        }));

      const columnDefs = gridApi.getColumnDefs()?.map((col: any) => ({
        field: col.field,
        headerName: col.headerName,
        width: col.width,
        hide: col.hide,
        pinned: col.pinned,
      })) || [];

      let sideBarState: SideBarState | undefined;
      try {
        // Always try to capture sidebar state - don't rely on getSideBar() returning a value
        // since sideBar={true} may not return a meaningful value from getSideBar()
        const isVisible = gridApi.isSideBarVisible?.() ?? false;
        const openToolPanel = gridApi.getOpenedToolPanel?.() || null;

        sideBarState = {
          visible: isVisible,
          openToolPanel: openToolPanel,
        };

        logger.debug('Sidebar state captured', { sideBarState }, 'useGridStateManager');
      } catch (e) {
        logger.warn('Failed to capture sidebar state', { error: e }, 'useGridStateManager');
        sideBarState = undefined;
      }

      const rowGroupColumns = gridApi.getRowGroupColumns?.()?.map((col: any) => col.getColId()) || [];
      const pivotColumns = gridApi.getPivotColumns?.()?.map((col: any) => col.getColId()) || [];

      logger.debug('Grid state captured', {
        columnCount: columnState.length,
        filterCount: Object.keys(filterState).length,
        sortCount: sortState.length,
        sideBarVisible: sideBarState?.visible,
        openToolPanel: sideBarState?.openToolPanel,
      }, 'useGridStateManager');

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
      logger.error('Failed to capture grid state', error, 'useGridStateManager');
      return baseState;
    }
  }, [gridApi, selectedProviderId, toolbarState]);

  /**
   * Reset grid state completely
   */
  const resetGridState = useCallback(() => {
    if (!gridApi) return;

    try {
      logger.debug('Resetting grid state', {}, 'useGridStateManager');
      gridApi.resetColumnState();
      gridApi.setFilterModel(null);
      gridApi.setRowGroupColumns([]);
      gridApi.setPivotColumns([]);
      gridApi.setValueColumns([]);
      try {
        gridApi.closeToolPanel();
      } catch {
        // Side bar may not be configured
      }
    } catch (error) {
      logger.error('Failed to reset grid state', error, 'useGridStateManager');
    }
  }, [gridApi]);

  /**
   * Apply layout config to grid
   */
  const applyLayoutToGrid = useCallback((
    layoutConfig: SimpleBlotterLayoutConfig,
    callbacks?: LayoutApplyCallbacks,
    resetFirst: boolean = false
  ): ApplyLayoutResult => {
    const result: ApplyLayoutResult = {};

    // Apply provider via callback
    if (layoutConfig.selectedProviderId) {
      result.providerId = layoutConfig.selectedProviderId;
      callbacks?.onProviderChange?.(layoutConfig.selectedProviderId);
    }

    // Apply toolbar state via callback
    if (layoutConfig.toolbarState) {
      result.toolbarState = layoutConfig.toolbarState;
      callbacks?.onToolbarStateChange?.(layoutConfig.toolbarState);
    }

    // Apply toolbar config (custom buttons, additional toolbars) via callback
    if (layoutConfig.toolbarConfig) {
      callbacks?.onToolbarConfigChange?.(layoutConfig.toolbarConfig);
    }

    // Apply grid state if API available
    if (gridApi) {
      try {
        if (resetFirst) {
          resetGridState();
        }

        if (layoutConfig.columnState?.length) {
          gridApi.applyColumnState({
            state: layoutConfig.columnState,
            applyOrder: true,
          });
        }

        if (layoutConfig.filterState) {
          gridApi.setFilterModel(layoutConfig.filterState);
        }

        if (layoutConfig.rowGroupColumns?.length) {
          gridApi.setRowGroupColumns(layoutConfig.rowGroupColumns);
        }

        if (layoutConfig.pivotColumns?.length) {
          gridApi.setPivotColumns(layoutConfig.pivotColumns);
        }

        // Always apply sidebar state - default to hidden if not specified
        try {
          const sideBarVisible = layoutConfig.sideBarState?.visible ?? false;
          gridApi.setSideBarVisible(sideBarVisible);
          if (sideBarVisible && layoutConfig.sideBarState?.openToolPanel) {
            gridApi.openToolPanel(layoutConfig.sideBarState.openToolPanel);
          } else {
            gridApi.closeToolPanel();
          }
        } catch {
          // Side bar may not be configured
        }

        logger.debug('Layout applied to grid', {
          columnCount: layoutConfig.columnState?.length || 0,
        }, 'useGridStateManager');
      } catch (error) {
        logger.error('Failed to apply layout to grid', error, 'useGridStateManager');
      }
    }

    return result;
  }, [gridApi, resetGridState]);

  return {
    captureGridState,
    applyLayoutToGrid,
    resetGridState,
  };
}

export default useGridStateManager;
