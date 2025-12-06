/**
 * Provider Helper Utilities
 *
 * Common utility functions for working with data providers.
 * Extracted to reduce code duplication across provider components.
 */

import { ColumnDefinition } from '@stern/shared-types';
import { ColDef } from 'ag-grid-community';
import { resolveValueFormatter } from '@/formatters';

// ============================================================================
// Column Definition Utilities
// ============================================================================

/**
 * Convert backend column definitions to AG-Grid column definitions
 * @param columnsData - Column definitions from backend
 * @returns AG-Grid compatible column definitions
 */
export function createAgGridColumns(columnsData: ColumnDefinition[]): ColDef[] {
  return columnsData.map((col) => {
    const colDef: ColDef = {
      field: col.field,
      headerName: col.headerName || col.field,
      width: col.width || 150,
      filter: col.filter !== undefined ? col.filter : true,
      sortable: col.sortable !== undefined ? col.sortable : true,
    };

    // Cell data type
    if (col.cellDataType) {
      colDef.cellDataType = col.cellDataType;
    }

    // Value formatter
    if (col.valueFormatter) {
      const formatter = resolveValueFormatter(col.valueFormatter);
      if (formatter) {
        colDef.valueFormatter = formatter;
      }
    }

    // Cell renderer
    if (col.cellRenderer) {
      // Handle numeric cell renderer
      if (col.cellRenderer === 'NumericCellRenderer' || col.cellDataType === 'number') {
        colDef.cellClass = 'ag-right-aligned-cell';
      }
      // Future: Add more cell renderer types here
    }

    // Optional column properties
    if (col.hide !== undefined) colDef.hide = col.hide;
    if (col.resizable !== undefined) colDef.resizable = col.resizable;

    return colDef;
  });
}

/**
 * Format field path to readable header name
 * @param path - Field path (e.g., "user.firstName")
 * @returns Formatted header (e.g., "User First Name")
 */
export function formatFieldName(path: string): string {
  return path
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Map field type to AG-Grid cell data type
 * @param type - Field type from inference
 * @returns AG-Grid cell data type
 */
export function mapFieldTypeToCellType(type: string): ColumnDefinition['cellDataType'] {
  switch (type) {
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

// ============================================================================
// Provider Validation Utilities
// ============================================================================

/**
 * Validate provider configuration
 * @param config - Provider configuration
 * @returns Validation result with errors
 */
export function validateProviderConfig(config: any): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config) {
    errors.push('Configuration is required');
    return { isValid: false, errors };
  }

  // Check for required fields based on provider type
  if (config.providerType === 'STOMP') {
    if (!config.config?.websocketUrl) {
      errors.push('WebSocket URL is required for STOMP providers');
    }
    if (!config.config?.listenerTopic) {
      errors.push('Listener topic is required for STOMP providers');
    }
  } else if (config.providerType === 'REST') {
    if (!config.config?.baseUrl) {
      errors.push('Base URL is required for REST providers');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if provider has required column definitions
 * @param config - Provider configuration
 * @returns Whether columns are defined
 */
export function hasColumnDefinitions(config: any): boolean {
  return !!(
    config?.config?.columnDefinitions &&
    Array.isArray(config.config.columnDefinitions) &&
    config.config.columnDefinitions.length > 0
  );
}

// ============================================================================
// Provider Filtering Utilities
// ============================================================================

/**
 * Filter providers by type
 * @param providers - Array of providers
 * @param types - Provider types to include
 * @returns Filtered providers
 */
export function filterProvidersByType(
  providers: any[],
  types: string[]
): any[] {
  return providers.filter((p) => {
    const subType = p.componentSubType?.toLowerCase();
    return types.some((type) => subType === type.toLowerCase());
  });
}

/**
 * Get unique provider types from a list
 * @param providers - Array of providers
 * @returns Unique provider types
 */
export function getUniqueProviderTypes(providers: any[]): string[] {
  const types = new Set<string>();
  providers.forEach((p) => {
    if (p.componentSubType) {
      types.add(p.componentSubType);
    }
  });
  return Array.from(types);
}

/**
 * Sort providers by name
 * @param providers - Array of providers
 * @returns Sorted providers
 */
export function sortProvidersByName(providers: any[]): any[] {
  return [...providers].sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
}
