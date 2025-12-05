/**
 * BlotterGrid Component
 *
 * Renders the AG Grid with proper configuration and performance optimizations.
 * Extracted from SimpleBlotter for better composition.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { GridApi, ColDef, GridReadyEvent, GetContextMenuItemsParams } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import { sternAgGridTheme } from '@/utils/grid/agGridTheme';

// Register AG Grid Enterprise modules
ModuleRegistry.registerModules([AllEnterpriseModule]);

// ============================================================================
// Types
// ============================================================================

export interface BlotterGridProps {
  /** Column definitions */
  columns: ColDef[];
  /** Callback when grid is ready */
  onGridReady: (api: GridApi) => void;
  /** Function to get row ID */
  getRowId?: (params: any) => string;
  /** Whether to show empty state */
  showEmptyState?: boolean;
  /** Empty state message */
  emptyStateMessage?: string;
}

// ============================================================================
// Component
// ============================================================================

export const BlotterGrid: React.FC<BlotterGridProps> = ({
  columns,
  onGridReady,
  getRowId: getRowIdProp,
  showEmptyState = false,
  emptyStateMessage = 'Select a provider to begin',
}) => {
  const gridApiRef = useRef<GridApi | null>(null);

  // ============================================================================
  // Memoized Config
  // ============================================================================

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 100,
    filter: true,
    sortable: true,
    resizable: true,
    enableValue: true,
    enableRowGroup: true,
    enablePivot: true,
    enableCellChangeFlash: true,
  }), []);

  const statusBar = useMemo(() => ({
    statusPanels: [
      { statusPanel: 'agTotalAndFilteredRowCountComponent', align: 'left' as const },
      { statusPanel: 'agTotalRowCountComponent', align: 'center' as const },
      { statusPanel: 'agFilteredRowCountComponent', align: 'center' as const },
      { statusPanel: 'agSelectedRowCountComponent', align: 'center' as const },
      { statusPanel: 'agAggregationComponent', align: 'right' as const },
    ],
  }), []);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleGridReady = useCallback((event: GridReadyEvent) => {
    gridApiRef.current = event.api;
    onGridReady(event.api);
  }, [onGridReady]);

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

  const getRowId = useCallback((params: any) => {
    if (getRowIdProp) {
      return getRowIdProp(params);
    }
    // Fallback: use id field or generate unique key
    return params.data?.id || params.data?.positionId || `row-${params.rowIndex}`;
  }, [getRowIdProp]);

  // ============================================================================
  // Render
  // ============================================================================

  if (showEmptyState || columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {emptyStateMessage}
      </div>
    );
  }

  return (
    <AgGridReact
      theme={sternAgGridTheme}
      columnDefs={columns}
      getRowId={getRowId}
      onGridReady={handleGridReady}
      defaultColDef={defaultColDef}
      sideBar={true}
      getContextMenuItems={getContextMenuItems}
      statusBar={statusBar}
      // Performance optimizations
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
  );
};

export default BlotterGrid;
