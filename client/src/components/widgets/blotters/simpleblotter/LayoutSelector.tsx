/**
 * LayoutSelector Component
 *
 * Dropdown to select and manage layouts for SimpleBlotter.
 * Integrates with the layout configuration system.
 */

import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Save,
  Settings,
  Plus,
  Layout,
  Star,
  Loader2,
  MoreVertical
} from 'lucide-react';
import type { LayoutInfo } from './layout-dialogs';

// Re-export for convenience
export type { LayoutInfo } from './layout-dialogs';

export interface LayoutSelectorProps {
  /** List of available layouts */
  layouts: LayoutInfo[];
  /** Currently selected layout ID */
  selectedLayoutId: string | null;
  /** ID of the default layout */
  defaultLayoutId?: string;
  /** Whether layouts are loading */
  isLoading?: boolean;
  /** Whether save operation is in progress */
  isSaving?: boolean;
  /** Callback when layout selection changes */
  onLayoutSelect: (layoutId: string) => void;
  /** Callback to save current state to selected layout */
  onSaveLayout: () => void;
  /** Callback to save current state as new layout */
  onSaveAsNew: () => void;
  /** Callback to open layout management dialog */
  onManageLayouts: () => void;
}

export const LayoutSelector: React.FC<LayoutSelectorProps> = ({
  layouts,
  selectedLayoutId,
  defaultLayoutId,
  isLoading = false,
  isSaving = false,
  onLayoutSelect,
  onSaveLayout,
  onSaveAsNew,
  onManageLayouts,
}) => {
  const selectedLayout = layouts.find(l => l.unified.configId === selectedLayoutId);
  const hasLayouts = layouts.length > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Layout Selector */}
      <div className="flex items-center gap-1">
        <Layout className="h-4 w-4 text-muted-foreground" />
        {hasLayouts ? (
          <Select
            value={selectedLayoutId || ''}
            onValueChange={onLayoutSelect}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Select Layout..." />
            </SelectTrigger>
            <SelectContent>
              {layouts.map((layout) => (
                <SelectItem key={layout.unified.configId} value={layout.unified.configId}>
                  <div className="flex items-center gap-2">
                    {layout.unified.configId === defaultLayoutId && (
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    )}
                    <span>{layout.unified.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground px-2">
            {isLoading ? 'Loading...' : 'No layouts'}
          </span>
        )}
      </div>

      {/* More Options Menu (⋮) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={isLoading}
          >
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">More options</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onSaveAsNew}>
            <Plus className="h-4 w-4 mr-2" />
            Save as New Layout...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onManageLayouts}>
            <Settings className="h-4 w-4 mr-2" />
            Manage Layouts...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Button (standalone) */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        onClick={onSaveLayout}
        disabled={isSaving || isLoading || !selectedLayoutId}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        <span className="sr-only sm:not-sr-only">Save</span>
      </Button>
    </div>
  );
};

export default LayoutSelector;
