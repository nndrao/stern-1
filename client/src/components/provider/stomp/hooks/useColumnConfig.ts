/**
 * useColumnConfig
 *
 * Custom hook for managing column configuration
 * Handles column building, manual columns, and field overrides
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { StompProviderConfig, ColumnDefinition } from '@stern/shared-types';
import { FieldNode, findFieldByPath, convertFieldNodeToInfo } from '../FieldSelector';

export interface UseColumnConfigReturn {
  manualColumns: ColumnDefinition[];
  fieldColumnOverrides: Record<string, Partial<ColumnDefinition>>;
  setManualColumns: (columns: ColumnDefinition[]) => void;
  setFieldColumnOverrides: (overrides: Record<string, Partial<ColumnDefinition>>) => void;
  clearAll: () => void;
  initializeFromConfig: (config: StompProviderConfig) => void;
}

export function useColumnConfig(
  inferredFields: FieldNode[],
  committedSelectedFields: Set<string>,
  onChange: (field: string, value: any) => void
): UseColumnConfigReturn {
  const [manualColumns, setManualColumns] = useState<ColumnDefinition[]>([]);
  const [fieldColumnOverrides, setFieldColumnOverrides] = useState<Record<string, Partial<ColumnDefinition>>>({});

  // Refs to track previous values and prevent infinite loops
  const previousInferredFieldsRef = useRef<string>('');
  const previousColumnsRef = useRef<string>('');

  // Stable wrapper for onChange to prevent infinite loops
  const updateConfigFields = useCallback((inferredFieldsData: any[], allColumns: ColumnDefinition[]) => {
    const newInferredFields = JSON.stringify(inferredFieldsData);
    const newColumns = JSON.stringify(allColumns);

    if (previousInferredFieldsRef.current !== newInferredFields) {
      previousInferredFieldsRef.current = newInferredFields;
      onChange('inferredFields', inferredFieldsData);
    }
    if (previousColumnsRef.current !== newColumns) {
      previousColumnsRef.current = newColumns;
      onChange('columnDefinitions', allColumns);
    }
  }, [onChange]);

  // Build columns whenever field selection or overrides change
  // IMPORTANT: Always update, even when empty, to ensure clearing is saved
  useEffect(() => {
    const inferredFieldsData = inferredFields.map(field => convertFieldNodeToInfo(field));

    // Build columns from COMMITTED selections only
    const columnsFromFields = buildColumnsFromFields(
      committedSelectedFields,
      inferredFields,
      fieldColumnOverrides
    );

    const allColumns = [...columnsFromFields, ...manualColumns];
    updateConfigFields(inferredFieldsData, allColumns);
  }, [inferredFields, committedSelectedFields, manualColumns, fieldColumnOverrides, updateConfigFields]);

  const clearAll = useCallback(() => {
    setManualColumns([]);
    setFieldColumnOverrides({});
  }, []);

  const initializeFromConfig = useCallback((config: StompProviderConfig) => {
    if (config.columnDefinitions && config.columnDefinitions.length > 0) {
      // Separate manual columns from field-based columns
      const manual = config.columnDefinitions.filter(col =>
        !config.inferredFields?.some(field => field.path === col.field)
      );
      setManualColumns(manual);

      // Build field overrides
      const overrides: Record<string, Partial<ColumnDefinition>> = {};
      config.columnDefinitions.forEach(col => {
        if (config.inferredFields?.some(field => field.path === col.field)) {
          const fieldOverride: Partial<ColumnDefinition> = {};
          if (col.headerName) fieldOverride.headerName = col.headerName;
          if (col.cellDataType) fieldOverride.cellDataType = col.cellDataType;
          if (col.valueFormatter) fieldOverride.valueFormatter = col.valueFormatter;
          if (col.cellRenderer) fieldOverride.cellRenderer = col.cellRenderer;
          if (col.width) fieldOverride.width = col.width;
          if (col.filter !== undefined) fieldOverride.filter = col.filter;
          if (col.sortable !== undefined) fieldOverride.sortable = col.sortable;
          if (col.resizable !== undefined) fieldOverride.resizable = col.resizable;
          if (col.hide !== undefined) fieldOverride.hide = col.hide;
          if (col.type) fieldOverride.type = col.type;

          if (Object.keys(fieldOverride).length > 0) {
            overrides[col.field] = fieldOverride;
          }
        }
      });

      setFieldColumnOverrides(overrides);
    }
  }, []);

  return {
    manualColumns,
    fieldColumnOverrides,
    setManualColumns,
    setFieldColumnOverrides,
    clearAll,
    initializeFromConfig
  };
}

/**
 * Build column definitions from selected fields and overrides
 */
function buildColumnsFromFields(
  selectedFields: Set<string>,
  inferredFields: FieldNode[],
  overrides: Record<string, Partial<ColumnDefinition>>
): ColumnDefinition[] {
  return Array.from(selectedFields).map(path => {
    const override = overrides[path] || {};
    const fieldNode = findFieldByPath(path, inferredFields);
    const cellDataType = override.cellDataType || mapFieldTypeToCellType(fieldNode?.type || 'string');

    const column: ColumnDefinition = {
      field: path,
      headerName: override.headerName || formatFieldName(path),
      cellDataType: cellDataType,
    };

    // Apply overrides
    if (override.valueFormatter) column.valueFormatter = override.valueFormatter;
    if (override.cellRenderer) column.cellRenderer = override.cellRenderer;
    if (override.width) column.width = override.width;
    if (override.filter !== undefined) column.filter = override.filter;
    if (override.sortable !== undefined) column.sortable = override.sortable;
    if (override.resizable !== undefined) column.resizable = override.resizable;
    if (override.hide !== undefined) column.hide = override.hide;
    if (override.type) column.type = override.type;

    // Apply type-specific defaults
    if (cellDataType === 'number') {
      column.type = 'numericColumn';
      column.filter = 'agNumberColumnFilter';
      if (!override.valueFormatter) column.valueFormatter = '2DecimalWithThousandSeparator';
      if (!override.cellRenderer) column.cellRenderer = 'NumericCellRenderer';
    }

    if (cellDataType === 'date' || cellDataType === 'dateString') {
      column.filter = 'agDateColumnFilter';
      if (!override.valueFormatter) column.valueFormatter = 'YYYY-MM-DD HH:mm:ss';
    }

    return column;
  });
}

/**
 * Map field type to cell data type
 */
function mapFieldTypeToCellType(type: string): ColumnDefinition['cellDataType'] {
  switch (type) {
    case 'number': return 'number';
    case 'boolean': return 'boolean';
    case 'object': return 'object';
    case 'date': return 'date';
    default: return 'text';
  }
}

/**
 * Format field path to readable header name
 */
function formatFieldName(path: string): string {
  return path.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}
