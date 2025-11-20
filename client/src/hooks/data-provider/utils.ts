/**
 * Data Provider Utilities
 * Extracted utility functions for cleaner data provider implementation
 */

import { useState, useEffect } from 'react';
import { GetRowIdParams } from 'ag-grid-community';
import { configService } from '@/services/api/configurationService';

/**
 * Get row ID from AG-Grid params using provider config
 * Extracted from useDataProviderAdapter for reusability
 */
export function getRowIdFromConfig(config: any, params: GetRowIdParams): string {
  if (!config?.config) {
    console.error('[KEYCOLUMN] No config available, using fallback ID');
    return String(params.data.id || params.data.Id || Math.random());
  }

  // Try configured keyColumn
  let keyColumn = config.config.keyColumn;

  // Fallback: Check columnDefinitions for key column
  if (!keyColumn && config.config.columnDefinitions?.length > 0) {
    const keyCol = config.config.columnDefinitions.find((col: any) => col.isKey || col.isPrimary);
    if (keyCol) keyColumn = keyCol.field;
  }

  // Last resort: Try common ID field names
  if (!keyColumn) {
    const dataKeys = Object.keys(params.data || {});
    const commonIdFields = ['positionId', 'id', 'Id', 'ID', 'key', 'Key'];
    keyColumn = commonIdFields.find(field => dataKeys.includes(field));
  }

  if (!keyColumn) {
    console.error('[KEYCOLUMN] keyColumn not found and could not infer from data');
    return String(Math.random());
  }

  const rowId = params.data[keyColumn];
  if (rowId === undefined || rowId === null) {
    console.warn('[KEYCOLUMN] Row data missing key column value:', keyColumn);
    return String(Math.random());
  }

  return String(rowId);
}

/**
 * Hook to load provider configuration from API
 */
export function useProviderConfig(providerId: string | null) {
  const [config, setConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!providerId) {
      setConfig(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    configService.getById(providerId)
      .then(result => {
        if (isMounted) {
          setConfig(result);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [providerId]);

  return { config, isLoading, error };
}
