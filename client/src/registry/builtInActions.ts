/**
 * Built-in Actions
 *
 * Registers standard grid, selection, and dialog actions.
 * These are available to all blotters by default.
 */

import { actionRegistry, RegisterActionOptions } from './actionRegistry';

// ============================================================================
// Grid Actions
// ============================================================================

const gridActions: RegisterActionOptions[] = [
  {
    id: 'grid:refresh',
    name: 'Refresh Data',
    description: 'Reload data from the data provider',
    category: 'Grid',
    icon: 'RefreshCw',
    handler: (ctx) => {
      ctx.refreshData();
    },
  },
  {
    id: 'grid:exportCsv',
    name: 'Export to CSV',
    description: 'Export grid data as a CSV file',
    category: 'Grid',
    icon: 'Download',
    handler: (ctx) => {
      ctx.gridApi?.exportDataAsCsv();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'grid:exportExcel',
    name: 'Export to Excel',
    description: 'Export grid data as an Excel file',
    category: 'Grid',
    icon: 'FileSpreadsheet',
    handler: (ctx) => {
      ctx.gridApi?.exportDataAsExcel();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'grid:resetColumns',
    name: 'Reset Columns',
    description: 'Reset column widths, order, and visibility to defaults',
    category: 'Grid',
    icon: 'RotateCcw',
    handler: (ctx) => {
      ctx.gridApi?.resetColumnState();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'grid:resetFilters',
    name: 'Clear All Filters',
    description: 'Remove all active filters from the grid',
    category: 'Grid',
    icon: 'FilterX',
    handler: (ctx) => {
      ctx.gridApi?.setFilterModel(null);
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'grid:autoSizeColumns',
    name: 'Auto-size Columns',
    description: 'Automatically resize columns to fit content',
    category: 'Grid',
    icon: 'Columns',
    handler: (ctx) => {
      ctx.gridApi?.autoSizeAllColumns();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'grid:sizeColumnsToFit',
    name: 'Fit Columns to Grid',
    description: 'Resize columns to fit the grid width',
    category: 'Grid',
    icon: 'Maximize2',
    handler: (ctx) => {
      ctx.gridApi?.sizeColumnsToFit();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
];

// ============================================================================
// Selection Actions
// ============================================================================

const selectionActions: RegisterActionOptions[] = [
  {
    id: 'selection:all',
    name: 'Select All Rows',
    description: 'Select all visible rows in the grid',
    category: 'Selection',
    icon: 'CheckSquare',
    handler: (ctx) => {
      ctx.gridApi?.selectAll();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'selection:none',
    name: 'Deselect All',
    description: 'Clear all row selection',
    category: 'Selection',
    icon: 'Square',
    handler: (ctx) => {
      ctx.gridApi?.deselectAll();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'selection:filtered',
    name: 'Select Filtered Rows',
    description: 'Select all rows matching current filters',
    category: 'Selection',
    icon: 'CheckSquare2',
    handler: (ctx) => {
      ctx.gridApi?.selectAllFiltered();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'selection:copy',
    name: 'Copy Selected Rows',
    description: 'Copy selected rows to clipboard as JSON',
    category: 'Selection',
    icon: 'Copy',
    handler: async (ctx) => {
      const rows = ctx.selectedRows;
      if (rows.length > 0) {
        const text = JSON.stringify(rows, null, 2);
        await navigator.clipboard.writeText(text);
      }
    },
    isAvailable: (ctx) => ctx.selectedRows.length > 0,
  },
  {
    id: 'selection:copyWithHeaders',
    name: 'Copy with Headers',
    description: 'Copy selected rows with column headers',
    category: 'Selection',
    icon: 'ClipboardCopy',
    handler: (ctx) => {
      ctx.gridApi?.copySelectedRowsToClipboard({ includeHeaders: true });
    },
    isAvailable: (ctx) => ctx.selectedRows.length > 0 && !!ctx.gridApi,
  },
];

// ============================================================================
// Dialog Actions
// ============================================================================

const dialogActions: RegisterActionOptions[] = [
  {
    id: 'dialog:columnChooser',
    name: 'Column Chooser',
    description: 'Open the column visibility chooser',
    category: 'Dialogs',
    icon: 'Columns',
    handler: (ctx) => {
      // Try AG Grid's built-in column chooser
      if (ctx.gridApi?.showColumnChooser) {
        ctx.gridApi.showColumnChooser();
      } else {
        // Fall back to opening tool panel
        ctx.gridApi?.openToolPanel('columns');
      }
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'dialog:filters',
    name: 'Filter Panel',
    description: 'Open the filter panel',
    category: 'Dialogs',
    icon: 'Filter',
    handler: (ctx) => {
      ctx.gridApi?.openToolPanel('filters');
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'dialog:advancedFilters',
    name: 'Advanced Filters',
    description: 'Open advanced filter builder',
    category: 'Dialogs',
    icon: 'SlidersHorizontal',
    handler: async (ctx) => {
      await ctx.openDialog('advanced-filters');
    },
  },
  {
    id: 'dialog:settings',
    name: 'Blotter Settings',
    description: 'Open blotter settings dialog',
    category: 'Dialogs',
    icon: 'Settings',
    handler: async (ctx) => {
      await ctx.openDialog('blotter-settings');
    },
  },
  {
    id: 'dialog:customizeToolbar',
    name: 'Customize Toolbar',
    description: 'Open toolbar customization wizard',
    category: 'Dialogs',
    icon: 'Wrench',
    handler: async (ctx) => {
      await ctx.openDialog('customize-toolbar');
    },
  },
];

// ============================================================================
// View Actions
// ============================================================================

const viewActions: RegisterActionOptions[] = [
  {
    id: 'view:toggleSidebar',
    name: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    category: 'View',
    icon: 'PanelRight',
    handler: (ctx) => {
      const isVisible = ctx.gridApi?.isSideBarVisible?.();
      ctx.gridApi?.setSideBarVisible(!isVisible);
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'view:fullscreen',
    name: 'Toggle Fullscreen',
    description: 'Enter or exit fullscreen mode',
    category: 'View',
    icon: 'Maximize',
    handler: () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    },
  },
  {
    id: 'view:print',
    name: 'Print',
    description: 'Print the grid contents',
    category: 'View',
    icon: 'Printer',
    handler: () => {
      window.print();
    },
  },
];

// ============================================================================
// Registration Function
// ============================================================================

/**
 * Register all built-in actions
 * Call this at app startup
 */
export function registerBuiltInActions(): () => void {
  const allActions = [
    ...gridActions,
    ...selectionActions,
    ...dialogActions,
    ...viewActions,
  ];

  return actionRegistry.registerMany(allActions);
}

/**
 * Get all built-in action IDs
 */
export function getBuiltInActionIds(): string[] {
  return [
    ...gridActions.map((a) => a.id),
    ...selectionActions.map((a) => a.id),
    ...dialogActions.map((a) => a.id),
    ...viewActions.map((a) => a.id),
  ];
}
