/**
 * Properties Panel Component - Refactored for Performance
 *
 * Key design:
 * - All editing happens in local state only (instant typing)
 * - Changes are applied to the config ONLY when user clicks "Apply Changes"
 * - No onBlur handlers that update parent state
 * - This completely isolates typing from tree re-renders
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { buildUrl } from '@/openfin/utils';
import { RefreshCw, Image, Save, RotateCcw } from 'lucide-react';

import { DockMenuItem, DEFAULT_WINDOW_OPTIONS, DEFAULT_VIEW_OPTIONS } from '@stern/openfin-platform';

interface PropertiesPanelProps {
  item: DockMenuItem | null;
  onUpdate: (id: string, updates: Partial<DockMenuItem>) => void;
  onIconSelect: (callback: (icon: string) => void) => void;
}

const PropertiesPanelComponent: React.FC<PropertiesPanelProps> = ({
  item,
  onUpdate,
  onIconSelect
}) => {
  // ============================================================================
  // Local State - All editing happens here, no parent updates until Apply
  // ============================================================================

  // General tab
  const [localCaption, setLocalCaption] = useState('');
  const [localId, setLocalId] = useState('');
  const [localUrl, setLocalUrl] = useState('');
  const [localIcon, setLocalIcon] = useState('');
  const [localOrder, setLocalOrder] = useState(0);
  const [localOpenMode, setLocalOpenMode] = useState<'window' | 'view'>('window');

  // Window tab
  const [localWidth, setLocalWidth] = useState(DEFAULT_WINDOW_OPTIONS.width);
  const [localHeight, setLocalHeight] = useState(DEFAULT_WINDOW_OPTIONS.height);
  const [localMinWidth, setLocalMinWidth] = useState(DEFAULT_WINDOW_OPTIONS.minWidth);
  const [localMinHeight, setLocalMinHeight] = useState(DEFAULT_WINDOW_OPTIONS.minHeight);
  const [localResizable, setLocalResizable] = useState(DEFAULT_WINDOW_OPTIONS.resizable);
  const [localMaximizable, setLocalMaximizable] = useState(DEFAULT_WINDOW_OPTIONS.maximizable);
  const [localMinimizable, setLocalMinimizable] = useState(DEFAULT_WINDOW_OPTIONS.minimizable);
  const [localCenter, setLocalCenter] = useState(DEFAULT_WINDOW_OPTIONS.center);
  const [localFrame, setLocalFrame] = useState(DEFAULT_WINDOW_OPTIONS.frame);
  const [localAlwaysOnTop, setLocalAlwaysOnTop] = useState(false);

  // View tab
  const [localViewWidth, setLocalViewWidth] = useState(DEFAULT_VIEW_OPTIONS.bounds.width);
  const [localViewHeight, setLocalViewHeight] = useState(DEFAULT_VIEW_OPTIONS.bounds.height);
  const [localCustomData, setLocalCustomData] = useState('{}');

  // Track if local state differs from item
  const [hasChanges, setHasChanges] = useState(false);

  // ============================================================================
  // Sync local state when a different item is selected
  // ============================================================================

  useEffect(() => {
    if (item) {
      setLocalCaption(item.caption || '');
      setLocalId(item.id || '');
      setLocalUrl(item.url || '');
      setLocalIcon(item.icon || '');
      setLocalOrder(item.order || 0);
      setLocalOpenMode(item.openMode || 'window');

      // Window options
      setLocalWidth(item.windowOptions?.width ?? DEFAULT_WINDOW_OPTIONS.width);
      setLocalHeight(item.windowOptions?.height ?? DEFAULT_WINDOW_OPTIONS.height);
      setLocalMinWidth(item.windowOptions?.minWidth ?? DEFAULT_WINDOW_OPTIONS.minWidth);
      setLocalMinHeight(item.windowOptions?.minHeight ?? DEFAULT_WINDOW_OPTIONS.minHeight);
      setLocalResizable(item.windowOptions?.resizable ?? DEFAULT_WINDOW_OPTIONS.resizable);
      setLocalMaximizable(item.windowOptions?.maximizable ?? DEFAULT_WINDOW_OPTIONS.maximizable);
      setLocalMinimizable(item.windowOptions?.minimizable ?? DEFAULT_WINDOW_OPTIONS.minimizable);
      setLocalCenter(item.windowOptions?.center ?? DEFAULT_WINDOW_OPTIONS.center);
      setLocalFrame(item.windowOptions?.frame ?? DEFAULT_WINDOW_OPTIONS.frame);
      setLocalAlwaysOnTop(item.windowOptions?.alwaysOnTop ?? false);

      // View options
      setLocalViewWidth(item.viewOptions?.bounds?.width ?? DEFAULT_VIEW_OPTIONS.bounds.width);
      setLocalViewHeight(item.viewOptions?.bounds?.height ?? DEFAULT_VIEW_OPTIONS.bounds.height);
      setLocalCustomData(JSON.stringify(item.viewOptions?.customData || {}, null, 2));

      setHasChanges(false);
    }
  }, [item?.id]);

  // ============================================================================
  // Change handlers - only update local state, mark as changed
  // ============================================================================

  const handleFieldChange = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value);
    setHasChanges(true);
  }, []);

  // Generate unique ID
  const generateId = useCallback(() => {
    const id = `menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setLocalId(id);
    setHasChanges(true);
  }, []);

  // Handle icon selection
  const handleIconClick = useCallback(() => {
    onIconSelect((icon) => {
      setLocalIcon(icon);
      setHasChanges(true);
    });
  }, [onIconSelect]);

  // ============================================================================
  // Apply Changes - commits all local state to the config
  // Performance: No useCallback needed since this is only called from onClick
  // This prevents the massive dependency array from causing re-creates on every keystroke
  // ============================================================================

  const applyChanges = () => {
    if (!item) return;

    // Parse custom data JSON
    let customData = {};
    try {
      customData = JSON.parse(localCustomData);
    } catch {
      // Keep empty object if invalid JSON
    }

    // Build the complete update object
    const updates: Partial<DockMenuItem> = {
      caption: localCaption,
      id: localId,
      url: localUrl,
      icon: localIcon,
      order: localOrder,
      openMode: localOpenMode,
      windowOptions: {
        width: localWidth,
        height: localHeight,
        minWidth: localMinWidth,
        minHeight: localMinHeight,
        resizable: localResizable,
        maximizable: localMaximizable,
        minimizable: localMinimizable,
        center: localCenter,
        frame: localFrame,
        alwaysOnTop: localAlwaysOnTop,
      },
      viewOptions: {
        bounds: {
          width: localViewWidth,
          height: localViewHeight,
        },
        customData,
      },
    };

    onUpdate(item.id, updates);
    setHasChanges(false);
  };

  // Reset to original values
  // Performance: No useCallback needed since this is only called from onClick
  const resetChanges = () => {
    if (item) {
      setLocalCaption(item.caption || '');
      setLocalId(item.id || '');
      setLocalUrl(item.url || '');
      setLocalIcon(item.icon || '');
      setLocalOrder(item.order || 0);
      setLocalOpenMode(item.openMode || 'window');
      setLocalWidth(item.windowOptions?.width ?? DEFAULT_WINDOW_OPTIONS.width);
      setLocalHeight(item.windowOptions?.height ?? DEFAULT_WINDOW_OPTIONS.height);
      setLocalMinWidth(item.windowOptions?.minWidth ?? DEFAULT_WINDOW_OPTIONS.minWidth);
      setLocalMinHeight(item.windowOptions?.minHeight ?? DEFAULT_WINDOW_OPTIONS.minHeight);
      setLocalResizable(item.windowOptions?.resizable ?? DEFAULT_WINDOW_OPTIONS.resizable);
      setLocalMaximizable(item.windowOptions?.maximizable ?? DEFAULT_WINDOW_OPTIONS.maximizable);
      setLocalMinimizable(item.windowOptions?.minimizable ?? DEFAULT_WINDOW_OPTIONS.minimizable);
      setLocalCenter(item.windowOptions?.center ?? DEFAULT_WINDOW_OPTIONS.center);
      setLocalFrame(item.windowOptions?.frame ?? DEFAULT_WINDOW_OPTIONS.frame);
      setLocalAlwaysOnTop(item.windowOptions?.alwaysOnTop ?? false);
      setLocalViewWidth(item.viewOptions?.bounds?.width ?? DEFAULT_VIEW_OPTIONS.bounds.width);
      setLocalViewHeight(item.viewOptions?.bounds?.height ?? DEFAULT_VIEW_OPTIONS.bounds.height);
      setLocalCustomData(JSON.stringify(item.viewOptions?.customData || {}, null, 2));
      setHasChanges(false);
    }
  };

  // Memoize full URL construction
  const fullUrl = useMemo(() =>
    localUrl ? buildUrl(localUrl) : '',
    [localUrl]
  );

  // ============================================================================
  // Render
  // ============================================================================

  if (!item) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Select a menu item to edit its properties
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Apply/Reset buttons - always visible when there are changes */}
      {hasChanges && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border-b border-amber-500/20">
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            Unsaved changes
          </Badge>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={resetChanges}
            className="h-7"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={applyChanges}
            className="h-7"
          >
            <Save className="h-3 w-3 mr-1" />
            Apply Changes
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="window" disabled={localOpenMode !== 'window'}>
              Window
            </TabsTrigger>
            <TabsTrigger value="view" disabled={localOpenMode !== 'view'}>
              View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="caption">Caption *</Label>
              <Input
                id="caption"
                value={localCaption}
                onChange={(e) => handleFieldChange(setLocalCaption, e.target.value)}
                placeholder="Menu item text"
              />
            </div>

            {/* ID */}
            <div className="space-y-2">
              <Label htmlFor="id">Unique ID *</Label>
              <div className="flex gap-2">
                <Input
                  id="id"
                  value={localId}
                  onChange={(e) => handleFieldChange(setLocalId, e.target.value)}
                  placeholder="Unique identifier"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={generateId}
                  title="Generate ID"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">Component URL</Label>
              <Input
                id="url"
                value={localUrl}
                onChange={(e) => handleFieldChange(setLocalUrl, e.target.value)}
                placeholder="/data-grid, /watchlist, etc."
                disabled={hasChildren}
              />
              {fullUrl && (
                <p className="text-xs text-muted-foreground">
                  Full URL: {fullUrl}?id={localId}
                </p>
              )}
            </div>

            {/* Open Mode */}
            <div className="space-y-2">
              <Label htmlFor="openMode">Open Mode</Label>
              <Select
                value={localOpenMode}
                onValueChange={(value: 'window' | 'view') => handleFieldChange(setLocalOpenMode, value)}
                disabled={hasChildren}
              >
                <SelectTrigger id="openMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="window">New Window</SelectItem>
                  <SelectItem value="view">New View (Tab)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <div className="flex gap-2">
                <Input
                  id="icon"
                  value={localIcon}
                  onChange={(e) => handleFieldChange(setLocalIcon, e.target.value)}
                  placeholder="/icons/app.svg"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleIconClick}
                  title="Select Icon"
                >
                  <Image className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Order */}
            <div className="space-y-2">
              <Label htmlFor="order">Sort Order</Label>
              <Input
                id="order"
                type="number"
                value={localOrder}
                onChange={(e) => handleFieldChange(setLocalOrder, parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
          </TabsContent>

          <TabsContent value="window" className="space-y-4 mt-4">
            {/* Window Dimensions */}
            <div>
              <h4 className="text-sm font-medium mb-3">Dimensions</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="width">Width</Label>
                  <Input
                    id="width"
                    type="number"
                    value={localWidth}
                    onChange={(e) => handleFieldChange(setLocalWidth, parseInt(e.target.value) || 0)}
                    min="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height</Label>
                  <Input
                    id="height"
                    type="number"
                    value={localHeight}
                    onChange={(e) => handleFieldChange(setLocalHeight, parseInt(e.target.value) || 0)}
                    min="100"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Window Constraints */}
            <div>
              <h4 className="text-sm font-medium mb-3">Size Constraints</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="minWidth">Min Width</Label>
                  <Input
                    id="minWidth"
                    type="number"
                    value={localMinWidth}
                    onChange={(e) => handleFieldChange(setLocalMinWidth, parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minHeight">Min Height</Label>
                  <Input
                    id="minHeight"
                    type="number"
                    value={localMinHeight}
                    onChange={(e) => handleFieldChange(setLocalMinHeight, parseInt(e.target.value) || 0)}
                    min="0"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Window Options */}
            <div>
              <h4 className="text-sm font-medium mb-3">Window Options</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="resizable">Resizable</Label>
                  <Switch
                    id="resizable"
                    checked={localResizable}
                    onCheckedChange={(checked) => handleFieldChange(setLocalResizable, checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="maximizable">Maximizable</Label>
                  <Switch
                    id="maximizable"
                    checked={localMaximizable}
                    onCheckedChange={(checked) => handleFieldChange(setLocalMaximizable, checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="minimizable">Minimizable</Label>
                  <Switch
                    id="minimizable"
                    checked={localMinimizable}
                    onCheckedChange={(checked) => handleFieldChange(setLocalMinimizable, checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="center">Center on Screen</Label>
                  <Switch
                    id="center"
                    checked={localCenter}
                    onCheckedChange={(checked) => handleFieldChange(setLocalCenter, checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="frame">Show Frame</Label>
                  <Switch
                    id="frame"
                    checked={localFrame}
                    onCheckedChange={(checked) => handleFieldChange(setLocalFrame, checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="alwaysOnTop">Always on Top</Label>
                  <Switch
                    id="alwaysOnTop"
                    checked={localAlwaysOnTop}
                    onCheckedChange={(checked) => handleFieldChange(setLocalAlwaysOnTop, checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="view" className="space-y-4 mt-4">
            {/* View Bounds */}
            <div>
              <h4 className="text-sm font-medium mb-3">View Bounds</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="viewWidth">Width</Label>
                  <Input
                    id="viewWidth"
                    type="number"
                    value={localViewWidth}
                    onChange={(e) => handleFieldChange(setLocalViewWidth, parseInt(e.target.value) || 0)}
                    min="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="viewHeight">Height</Label>
                  <Input
                    id="viewHeight"
                    type="number"
                    value={localViewHeight}
                    onChange={(e) => handleFieldChange(setLocalViewHeight, parseInt(e.target.value) || 0)}
                    min="100"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Custom Data */}
            <div>
              <h4 className="text-sm font-medium mb-3">Custom Data (JSON)</h4>
              <textarea
                className="w-full h-32 p-2 text-sm border rounded-md font-mono bg-background"
                value={localCustomData}
                onChange={(e) => handleFieldChange(setLocalCustomData, e.target.value)}
                placeholder="{}"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Memoize the component to prevent re-renders when parent updates
// Only re-render when item.id changes (not when parent config changes)
export const PropertiesPanel = React.memo(PropertiesPanelComponent, (prevProps, nextProps) => {
  // Only re-render if the item ID changes or callbacks change
  return prevProps.item?.id === nextProps.item?.id &&
         prevProps.onUpdate === nextProps.onUpdate &&
         prevProps.onIconSelect === nextProps.onIconSelect;
});
