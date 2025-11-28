/**
 * BlotterToolbar Component
 *
 * Toolbar for SimpleBlotter displaying:
 * - Provider selection
 * - Layout management (selector, save, manage)
 * - Connection status
 * - Statistics
 */

import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Settings, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
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

  // Debug info (optional - for troubleshooting)
  /** Debug: configId for this blotter instance */
  debugConfigId?: string;
  /** Debug: activeLayoutId from view customData */
  debugActiveLayoutId?: string | null;
  /** Debug: layout name from view customData */
  debugLayoutName?: string | null;
  /** Real-time update counter */
  updateCount?: number;
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
  // Debug props
  debugConfigId,
  debugActiveLayoutId,
  debugLayoutName,
  updateCount,
}) => {
  const showLayoutSelector = layouts !== undefined && onLayoutSelect;
  const showDebugInfo = debugConfigId !== undefined;
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="flex items-center gap-4 p-2 bg-background">
      {/* Layout Selector (only shown if layout props provided) */}
      {showLayoutSelector && (
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

      {/* Date Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2 px-3"
          >
            <CalendarIcon className="h-4 w-4" />
            <span className="text-sm">
              {date ? format(date, 'MMM dd, yyyy') : 'Pick a date'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Settings Popup Button */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Blotter settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <h4 className="font-medium text-sm border-b pb-2">Blotter Settings</h4>

            <div className="space-y-3">
              {/* Data Provider Selector */}
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs font-medium">Data Provider:</span>
                <Select
                  value={selectedProviderId || ''}
                  onValueChange={onProviderSelect}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full h-8">
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
              </div>

              {/* Grid Config ID */}
              {debugConfigId && (
                <div className="flex flex-col gap-1 pt-2 border-t">
                  <span className="text-muted-foreground text-xs">Grid Config ID:</span>
                  <span className="font-mono text-xs bg-muted p-1 rounded break-all">
                    {debugConfigId}
                  </span>
                </div>
              )}

              {/* Selected Layout ID */}
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Selected Layout ID:</span>
                <span className="font-mono text-xs bg-muted p-1 rounded break-all">
                  {selectedLayoutId || debugActiveLayoutId || 'None'}
                </span>
              </div>

              {/* Statistics */}
              <div className="flex flex-col gap-1 pt-2 border-t">
                <span className="text-muted-foreground text-xs">Statistics:</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total Rows:</span>
                    <span className="ml-2 font-medium">{rowCount.toLocaleString()}</span>
                  </div>
                  {updateCount !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Updates:</span>
                      <span className="ml-2 font-medium text-green-600">{updateCount.toLocaleString()}</span>
                    </div>
                  )}
                  {loadTimeMs !== null && (
                    <div>
                      <span className="text-muted-foreground">Load Time:</span>
                      <span className="ml-2 font-medium">{(loadTimeMs / 1000).toFixed(2)}s</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default BlotterToolbar;
