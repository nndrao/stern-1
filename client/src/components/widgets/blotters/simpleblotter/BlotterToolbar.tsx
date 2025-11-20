/**
 * BlotterToolbar Component
 *
 * Extracted toolbar content from SimpleBlotter for reusability.
 * Displays provider selection, connection status, and statistics.
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface BlotterToolbarProps {
  /** Currently selected provider ID */
  selectedProviderId: string | null;
  /** List of available data providers */
  availableProviders: Array<{ id: string; name: string }>;
  /** Whether data is currently loading */
  isLoading: boolean;
  /** Data provider adapter instance */
  adapter?: { isConnected: boolean } | null;
  /** Total number of rows in the grid */
  rowCount: number;
  /** Time taken to load the snapshot in milliseconds */
  loadTimeMs: number | null;
  /** Callback when provider selection changes */
  onProviderSelect: (providerId: string) => void;
}

export const BlotterToolbar: React.FC<BlotterToolbarProps> = ({
  selectedProviderId,
  availableProviders,
  isLoading,
  adapter,
  rowCount,
  loadTimeMs,
  onProviderSelect,
}) => {
  return (
    <div className="flex items-center gap-4 p-2">
      {/* Provider Selector */}
      <Select
        value={selectedProviderId || ''}
        onValueChange={onProviderSelect}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Select Provider..." />
        </SelectTrigger>
        <SelectContent>
          {availableProviders.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Connection Status */}
      {isLoading && (
        <span className="text-sm text-blue-600 font-medium">
          Loading snapshot...
        </span>
      )}

      {adapter?.isConnected && !isLoading && (
        <span className="text-sm text-green-600 font-medium">
          ✓ Connected
        </span>
      )}

      {/* Row Count */}
      {rowCount > 0 && (
        <span className="text-sm text-gray-600">
          {rowCount.toLocaleString()} rows
        </span>
      )}

      {/* Load Time */}
      {!isLoading && loadTimeMs !== null && rowCount > 0 && (
        <span className="text-sm text-gray-500">
          ({(loadTimeMs / 1000).toFixed(2)}s)
        </span>
      )}
    </div>
  );
};

export default BlotterToolbar;
