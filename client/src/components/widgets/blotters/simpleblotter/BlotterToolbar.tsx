/**
 * BlotterToolbar Component
 *
 * Toolbar for SimpleBlotter displaying:
 * - Layout management (selector, save, manage)
 * - Custom buttons (organized by zone)
 * - Connection status
 * - Settings (provider selection, statistics)
 */

import React, { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Settings, CalendarIcon, Wrench, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { LayoutSelector, LayoutInfo } from './LayoutSelector';
import { resolveIcon } from '@/components/wizards/IconPickerDialog';

// ============================================================================
// Types (local definitions for standalone operation)
// ============================================================================

export type ToolbarZone = 'start' | 'left' | 'center' | 'right' | 'end';
export type ToolbarButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';

export interface ToolbarMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: string;
  actionData?: Record<string, unknown>;
  disabled?: boolean;
  separator?: boolean;
}

export interface ToolbarButton {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  action?: string;
  actionData?: Record<string, unknown>;
  zone?: ToolbarZone;
  variant?: ToolbarButtonVariant;
  showLabel?: boolean;
  disabled?: boolean;
  visible?: boolean;
  menuItems?: ToolbarMenuItem[];
  order?: number;
}

// ============================================================================
// Props

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

  // Custom buttons props
  /** Custom buttons to render in the toolbar */
  customButtons?: ToolbarButton[];
  /** Callback when a custom button action is triggered */
  onAction?: (actionId: string, actionData?: Record<string, unknown>) => void;
  /** Callback to open toolbar customization wizard */
  onCustomizeToolbar?: () => void;

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

// ============================================================================
// Custom Button Renderer
// ============================================================================

interface CustomButtonProps {
  button: ToolbarButton;
  onAction?: (actionId: string, actionData?: Record<string, unknown>) => void;
  disabled?: boolean;
}

const CustomButton: React.FC<CustomButtonProps> = ({
  button,
  onAction,
  disabled,
}) => {
  const Icon = resolveIcon(button.icon);

  const handleClick = () => {
    if (button.action) {
      onAction?.(button.action, button.actionData);
    }
  };

  // Render dropdown button if has menu items
  if (button.menuItems && button.menuItems.length > 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={button.variant ?? 'outline'}
            size="sm"
            className="h-8"
            disabled={disabled || button.disabled}
            title={button.tooltip}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {button.showLabel !== false && (
              <span className="ml-1">{button.label}</span>
            )}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {button.menuItems.map((item: ToolbarMenuItem) =>
            item.separator ? (
              <DropdownMenuSeparator key={item.id} />
            ) : (
              <DropdownMenuItem
                key={item.id}
                onClick={() => onAction?.(item.action, item.actionData)}
                disabled={item.disabled}
              >
                {(() => {
                  const ItemIcon = resolveIcon(item.icon);
                  return ItemIcon ? (
                    <ItemIcon className="h-4 w-4 mr-2" />
                  ) : null;
                })()}
                {item.label}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Render regular button
  return (
    <Button
      variant={button.variant ?? 'outline'}
      size="sm"
      className="h-8"
      onClick={handleClick}
      disabled={disabled || button.disabled}
      title={button.tooltip}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {button.showLabel !== false && <span className="ml-1">{button.label}</span>}
    </Button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

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
  // Custom buttons props
  customButtons = [],
  onAction,
  onCustomizeToolbar,
  // Debug props
  debugConfigId,
  debugActiveLayoutId,
  debugLayoutName,
  updateCount,
}) => {
  const showLayoutSelector = layouts !== undefined && onLayoutSelect;
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Group visible buttons by zone
  const buttonsByZone = useMemo(() => {
    const zones: Record<ToolbarZone, ToolbarButton[]> = {
      start: [],
      left: [],
      center: [],
      right: [],
      end: [],
    };

    customButtons
      .filter((btn) => btn.visible !== false)
      .sort((a, b) => (a.order ?? 50) - (b.order ?? 50))
      .forEach((btn) => {
        const zone = btn.zone ?? 'right';
        zones[zone].push(btn);
      });

    return zones;
  }, [customButtons]);

  // Render buttons for a zone
  const renderZone = (zone: ToolbarZone) => {
    const buttons = buttonsByZone[zone];
    if (buttons.length === 0) return null;

    return (
      <div className="flex items-center gap-1">
        {buttons.map((btn) => (
          <CustomButton
            key={btn.id}
            button={btn}
            onAction={onAction}
            disabled={isLoading}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-background">
      {/* Start Zone */}
      {renderZone('start')}

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

      {/* Left Zone */}
      {renderZone('left')}

      {/* Center Zone (with flex spacer) */}
      <div className="flex-1 flex items-center justify-center gap-1">
        {renderZone('center')}
      </div>

      {/* Right Zone */}
      {renderZone('right')}

      {/* Connection Status */}
      {isLoading && (
        <span className="text-sm text-blue-600 font-medium">Loading...</span>
      )}

      {adapter?.isConnected && !isLoading && (
        <span className="text-sm text-green-600 font-medium">✓</span>
      )}

      {/* End Zone */}
      {renderZone('end')}

      {/* Date Picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2 px-3">
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
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="sr-only">Blotter settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-3">
            <h4 className="font-medium text-sm border-b pb-2">
              Blotter Settings
            </h4>

            <div className="space-y-3">
              {/* Data Provider Selector */}
              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs font-medium">
                  Data Provider:
                </span>
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

              {/* Customize Toolbar Button */}
              {onCustomizeToolbar && (
                <div className="pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={onCustomizeToolbar}
                  >
                    <Wrench className="h-4 w-4 mr-2" />
                    Customize Toolbar
                  </Button>
                </div>
              )}

              {/* Grid Config ID */}
              {debugConfigId && (
                <div className="flex flex-col gap-1 pt-2 border-t">
                  <span className="text-muted-foreground text-xs">
                    Grid Config ID:
                  </span>
                  <span className="font-mono text-xs bg-muted p-1 rounded break-all">
                    {debugConfigId}
                  </span>
                </div>
              )}

              {/* Selected Layout ID */}
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Selected Layout ID:
                </span>
                <span className="font-mono text-xs bg-muted p-1 rounded break-all">
                  {selectedLayoutId || debugActiveLayoutId || 'None'}
                </span>
              </div>

              {/* Statistics */}
              <div className="flex flex-col gap-1 pt-2 border-t">
                <span className="text-muted-foreground text-xs">
                  Statistics:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Total Rows:</span>
                    <span className="ml-2 font-medium">
                      {rowCount.toLocaleString()}
                    </span>
                  </div>
                  {updateCount !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Updates:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {updateCount.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {loadTimeMs !== null && (
                    <div>
                      <span className="text-muted-foreground">Load Time:</span>
                      <span className="ml-2 font-medium">
                        {(loadTimeMs / 1000).toFixed(2)}s
                      </span>
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
