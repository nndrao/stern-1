/**
 * Properties Panel Component
 * Displays and edits properties of selected menu items
 * Uses simple props and local state for fast, responsive editing
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildUrl } from '@/openfin/utils';
import { RefreshCw, Image } from 'lucide-react';
import { logger } from '@/utils/logger';

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
  // Track component renders
  logger.info('[STATE_UPDATE] PropertiesPanel rendered', {
    itemId: item?.id,
    itemCaption: item?.caption
  }, 'PropertiesPanel');

  // Local state for text inputs - only calls onUpdate on blur
  const [localCaption, setLocalCaption] = useState(item?.caption || '');
  const [localId, setLocalId] = useState(item?.id || '');
  const [localUrl, setLocalUrl] = useState(item?.url || '');
  const [localIcon, setLocalIcon] = useState(item?.icon || '');
  const [localOrder, setLocalOrder] = useState(item?.order || 0);

  // Local state for window dimension inputs - only calls onUpdate on blur
  const [localWidth, setLocalWidth] = useState(item?.windowOptions?.width || DEFAULT_WINDOW_OPTIONS.width);
  const [localHeight, setLocalHeight] = useState(item?.windowOptions?.height || DEFAULT_WINDOW_OPTIONS.height);
  const [localMinWidth, setLocalMinWidth] = useState(item?.windowOptions?.minWidth || DEFAULT_WINDOW_OPTIONS.minWidth);
  const [localMinHeight, setLocalMinHeight] = useState(item?.windowOptions?.minHeight || DEFAULT_WINDOW_OPTIONS.minHeight);

  // Local state for view dimension inputs - only calls onUpdate on blur
  const [localViewWidth, setLocalViewWidth] = useState(item?.viewOptions?.bounds?.width || DEFAULT_VIEW_OPTIONS.bounds.width);
  const [localViewHeight, setLocalViewHeight] = useState(item?.viewOptions?.bounds?.height || DEFAULT_VIEW_OPTIONS.bounds.height);

  // Sync local state when item changes (different node selected)
  useEffect(() => {
    if (item) {
      logger.info('[STATE_UPDATE] Syncing local state from item change', { itemId: item.id }, 'PropertiesPanel');

      setLocalCaption(item.caption);
      setLocalId(item.id);
      setLocalUrl(item.url || '');
      setLocalIcon(item.icon || '');
      setLocalOrder(item.order);

      // Sync window dimension state
      setLocalWidth(item.windowOptions?.width || DEFAULT_WINDOW_OPTIONS.width);
      setLocalHeight(item.windowOptions?.height || DEFAULT_WINDOW_OPTIONS.height);
      setLocalMinWidth(item.windowOptions?.minWidth || DEFAULT_WINDOW_OPTIONS.minWidth);
      setLocalMinHeight(item.windowOptions?.minHeight || DEFAULT_WINDOW_OPTIONS.minHeight);

      // Sync view dimension state
      setLocalViewWidth(item.viewOptions?.bounds?.width || DEFAULT_VIEW_OPTIONS.bounds.width);
      setLocalViewHeight(item.viewOptions?.bounds?.height || DEFAULT_VIEW_OPTIONS.bounds.height);

      logger.info('[STATE_UPDATE] Local state synced', {
        caption: item.caption,
        windowOptions: { width: item.windowOptions?.width, height: item.windowOptions?.height },
        viewOptions: { width: item.viewOptions?.bounds?.width, height: item.viewOptions?.bounds?.height }
      }, 'PropertiesPanel');
    }
  }, [item?.id]);

  // Helper to update item - just calls parent callback
  const updateItem = useCallback((updates: Partial<DockMenuItem>) => {
    if (item) {
      logger.info('[STATE_UPDATE] Calling parent onUpdate (blur event)', {
        itemId: item.id,
        updates
      }, 'PropertiesPanel');
      onUpdate(item.id, updates);
    }
  }, [item?.id, onUpdate]);

  // Generate unique ID
  const generateId = useCallback(() => {
    const id = `menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setLocalId(id);
    updateItem({ id });
  }, [updateItem]);

  // Handle window option changes (immediate update for switches/selects)
  // PERFORMANCE: Don't depend on item.windowOptions - access via closure
  const handleWindowOptionChange = useCallback((key: string, value: any) => {
    if (item) {
      updateItem({
        windowOptions: {
          ...item.windowOptions,
          [key]: value
        }
      });
    }
  }, [item?.id, updateItem]);

  // Handle view option changes (immediate update for switches/selects)
  // PERFORMANCE: Don't depend on item.viewOptions - access via closure
  const handleViewOptionChange = useCallback((key: string, value: any) => {
    if (item) {
      updateItem({
        viewOptions: {
          ...item.viewOptions,
          [key]: value
        }
      });
    }
  }, [item?.id, updateItem]);

  // Memoize full URL construction
  const fullUrl = useMemo(() =>
    item?.url ? buildUrl(item.url) : '',
    [item?.url]
  );

  // If no item selected, show empty state
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

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Item Properties</CardTitle>
        <CardDescription>
          Configure the selected menu item
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="window" disabled={item.openMode !== 'window'}>
              Window
            </TabsTrigger>
            <TabsTrigger value="view" disabled={item.openMode !== 'view'}>
              View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="caption">Caption *</Label>
              <Input
                id="caption"
                value={localCaption}
                onChange={(e) => setLocalCaption(e.target.value)}
                onBlur={() => updateItem({ caption: localCaption })}
                placeholder="Menu item text"
                required
              />
            </div>

            {/* ID */}
            <div className="space-y-2">
              <Label htmlFor="id">Unique ID *</Label>
              <div className="flex gap-2">
                <Input
                  id="id"
                  value={localId}
                  onChange={(e) => setLocalId(e.target.value)}
                  onBlur={() => updateItem({ id: localId })}
                  placeholder="Unique identifier"
                  required
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
                onChange={(e) => setLocalUrl(e.target.value)}
                onBlur={() => updateItem({ url: localUrl })}
                placeholder="/data-grid, /watchlist, etc."
                disabled={item.children && item.children.length > 0}
              />
              {fullUrl && (
                <p className="text-xs text-muted-foreground">
                  Full URL: {fullUrl}?id={item.id}
                </p>
              )}
            </div>

            {/* Open Mode */}
            <div className="space-y-2">
              <Label htmlFor="openMode">Open Mode</Label>
              <Select
                value={item.openMode}
                onValueChange={(value: 'window' | 'view') => updateItem({ openMode: value })}
                disabled={item.children && item.children.length > 0}
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
                  onChange={(e) => setLocalIcon(e.target.value)}
                  onBlur={() => updateItem({ icon: localIcon })}
                  placeholder="/icons/app.svg"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onIconSelect((icon) => {
                    setLocalIcon(icon);
                    updateItem({ icon });
                  })}
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
                onChange={(e) => setLocalOrder(parseInt(e.target.value) || 0)}
                onBlur={() => updateItem({ order: localOrder })}
                min="0"
              />
            </div>
          </TabsContent>

          <TabsContent value="window" className="space-y-4">
            <div className="space-y-4">
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
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) || 0;
                        logger.info('[STATE_UPDATE] Width onChange (local state only)', { oldValue: localWidth, newValue }, 'PropertiesPanel');
                        setLocalWidth(newValue);
                      }}
                      onBlur={() => {
                        logger.info('[STATE_UPDATE] Width onBlur (updating parent)', { value: localWidth }, 'PropertiesPanel');
                        handleWindowOptionChange('width', localWidth);
                      }}
                      min="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height</Label>
                    <Input
                      id="height"
                      type="number"
                      value={localHeight}
                      onChange={(e) => setLocalHeight(parseInt(e.target.value) || 0)}
                      onBlur={() => handleWindowOptionChange('height', localHeight)}
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
                      onChange={(e) => setLocalMinWidth(parseInt(e.target.value) || 0)}
                      onBlur={() => handleWindowOptionChange('minWidth', localMinWidth)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minHeight">Min Height</Label>
                    <Input
                      id="minHeight"
                      type="number"
                      value={localMinHeight}
                      onChange={(e) => setLocalMinHeight(parseInt(e.target.value) || 0)}
                      onBlur={() => handleWindowOptionChange('minHeight', localMinHeight)}
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
                      checked={item.windowOptions?.resizable ?? DEFAULT_WINDOW_OPTIONS.resizable}
                      onCheckedChange={(checked) => handleWindowOptionChange('resizable', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="maximizable">Maximizable</Label>
                    <Switch
                      id="maximizable"
                      checked={item.windowOptions?.maximizable ?? DEFAULT_WINDOW_OPTIONS.maximizable}
                      onCheckedChange={(checked) => handleWindowOptionChange('maximizable', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="minimizable">Minimizable</Label>
                    <Switch
                      id="minimizable"
                      checked={item.windowOptions?.minimizable ?? DEFAULT_WINDOW_OPTIONS.minimizable}
                      onCheckedChange={(checked) => handleWindowOptionChange('minimizable', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="center">Center on Screen</Label>
                    <Switch
                      id="center"
                      checked={item.windowOptions?.center ?? DEFAULT_WINDOW_OPTIONS.center}
                      onCheckedChange={(checked) => handleWindowOptionChange('center', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="frame">Show Frame</Label>
                    <Switch
                      id="frame"
                      checked={item.windowOptions?.frame ?? DEFAULT_WINDOW_OPTIONS.frame}
                      onCheckedChange={(checked) => handleWindowOptionChange('frame', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="alwaysOnTop">Always on Top</Label>
                    <Switch
                      id="alwaysOnTop"
                      checked={item.windowOptions?.alwaysOnTop ?? false}
                      onCheckedChange={(checked) => handleWindowOptionChange('alwaysOnTop', checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="view" className="space-y-4">
            <div className="space-y-4">
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
                      onChange={(e) => setLocalViewWidth(parseInt(e.target.value) || 0)}
                      onBlur={() => handleViewOptionChange('bounds', {
                        ...item.viewOptions?.bounds,
                        width: localViewWidth
                      })}
                      min="100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="viewHeight">Height</Label>
                    <Input
                      id="viewHeight"
                      type="number"
                      value={localViewHeight}
                      onChange={(e) => setLocalViewHeight(parseInt(e.target.value) || 0)}
                      onBlur={() => handleViewOptionChange('bounds', {
                        ...item.viewOptions?.bounds,
                        height: localViewHeight
                      })}
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
                  className="w-full h-32 p-2 text-sm border rounded-md font-mono"
                  value={JSON.stringify(item.viewOptions?.customData || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const customData = JSON.parse(e.target.value);
                      handleViewOptionChange('customData', customData);
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder="{}"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

// Memoize component to prevent re-renders when item reference changes but data is the same
// This happens because TreeView finds and returns new object references on every click
export const PropertiesPanel = React.memo(PropertiesPanelComponent, (prevProps, nextProps) => {
  // Only re-render if the item ID changes or item becomes null/non-null
  // Don't compare by reference - TreeView returns new objects from tree traversal
  const prevId = prevProps.item?.id;
  const nextId = nextProps.item?.id;

  // If ID is the same, don't re-render (callbacks are stable via useCallback)
  const isSameItem = prevId === nextId;

  logger.info('[STATE_UPDATE] PropertiesPanel memo comparison', {
    prevId,
    nextId,
    willRerender: !isSameItem
  }, 'PropertiesPanel');

  return isSameItem;
});
