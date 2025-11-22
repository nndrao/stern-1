/**
 * BlotterToolbar Component
 *
 * Toolbar for SimpleBlotter displaying:
 * - Provider selection
 * - Layout management (selector, save, manage)
 * - Connection status
 * - Statistics
 */

import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { LayoutSelector, LayoutInfo } from './LayoutSelector';

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

  // Layout management props (optional - only shown if provided)
  /** List of available layouts */
  layouts?: LayoutInfo[];
  /** Currently selected layout ID */
  selectedLayoutId?: string | null;
  /** ID of the default layout */
  defaultLayoutId?: string;
  /** Whether layout save is in progress */
  isLayoutSaving?: boolean;
  /** Callback when layout selection changes */
  onLayoutSelect?: (layoutId: string) => void;
  /** Callback to save current state to selected layout */
  onSaveLayout?: () => void;
  /** Callback to save current state as new layout */
  onSaveAsNew?: () => void;
  /** Callback to open layout management dialog */
  onManageLayouts?: () => void;
}

export const BlotterToolbar: React.FC<BlotterToolbarProps> = ({
  selectedProviderId,
  availableProviders,
  isLoading,
  adapter,
  rowCount,
  loadTimeMs,
  onProviderSelect,
  // Layout props
  layouts,
  selectedLayoutId,
  defaultLayoutId,
  isLayoutSaving,
  onLayoutSelect,
  onSaveLayout,
  onSaveAsNew,
  onManageLayouts,
}) => {
  const showLayoutSelector = layouts !== undefined && onLayoutSelect;

  return (
    <div className="flex items-center gap-4 p-2">
      {/* Provider Selector */}
      <Select
        value={selectedProviderId || ''}
        onValueChange={onProviderSelect}
        disabled={isLoading}
      >
        <SelectTrigger className="w-[250px] h-8">
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

      {/* Layout Selector (only shown if layout props provided) */}
      {showLayoutSelector && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <LayoutSelector
            layouts={layouts || []}
            selectedLayoutId={selectedLayoutId || null}
            defaultLayoutId={defaultLayoutId}
            isLoading={isLoading}
            isSaving={isLayoutSaving}
            onLayoutSelect={onLayoutSelect!}
            onSaveLayout={onSaveLayout || (() => {})}
            onSaveAsNew={onSaveAsNew || (() => {})}
            onManageLayouts={onManageLayouts || (() => {})}
          />
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

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
        <span className="text-sm text-muted-foreground">
          {rowCount.toLocaleString()} rows
        </span>
      )}

      {/* Load Time */}
      {!isLoading && loadTimeMs !== null && rowCount > 0 && (
        <span className="text-sm text-muted-foreground/70">
          ({(loadTimeMs / 1000).toFixed(2)}s)
        </span>
      )}
    </div>
  );
};

export default BlotterToolbar;
