/**
 * Properties Panel - ULTRA SIMPLE VERSION
 *
 * Key changes from original:
 * - Single form state object (NOT 22 individual useState calls)
 * - No useCallback wrappers (not needed for onClick handlers)
 * - No complex memoization
 * - Direct, straightforward updates
 */

import React, { useState, useEffect, useMemo } from 'react';
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

// Simple form state type
interface FormState extends Partial<DockMenuItem> {
  hasChanges: boolean;
}

function PropertiesPanelSimple({ item, onUpdate, onIconSelect }: PropertiesPanelProps) {
  // SINGLE STATE OBJECT - not 22 separate states!
  const [formState, setFormState] = useState<FormState>({ hasChanges: false });

  // Sync form when item changes
  useEffect(() => {
    if (item) {
      setFormState({
        ...item,
        hasChanges: false
      });
    }
  }, [item?.id]);

  // Simple update function
  const updateField = <K extends keyof DockMenuItem>(field: K, value: DockMenuItem[K]) => {
    setFormState(prev => ({
      ...prev,
      [field]: value,
      hasChanges: true
    }));
  };

  // Apply changes - no useCallback needed
  const applyChanges = () => {
    if (!item) return;

    const { hasChanges, ...updates } = formState;
    onUpdate(item.id, updates);
    setFormState(prev => ({ ...prev, hasChanges: false }));
  };

  // Reset changes - no useCallback needed
  const resetChanges = () => {
    if (item) {
      setFormState({
        ...item,
        hasChanges: false
      });
    }
  };

  // Generate ID
  const generateId = () => {
    const id = `menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    updateField('id', id);
  };

  // Handle icon selection
  const handleIconClick = () => {
    onIconSelect((icon) => {
      updateField('icon', icon);
    });
  };

  // Memoize full URL
  const fullUrl = useMemo(() =>
    formState.url ? buildUrl(formState.url) : '',
    [formState.url]
  );

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
      {/* Apply/Reset buttons */}
      {formState.hasChanges && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border-b border-amber-500/20">
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            Unsaved changes
          </Badge>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={resetChanges} className="h-7">
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
          <Button variant="default" size="sm" onClick={applyChanges} className="h-7">
            <Save className="h-3 w-3 mr-1" />
            Apply Changes
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="window" disabled={formState.openMode !== 'window'}>Window</TabsTrigger>
            <TabsTrigger value="view" disabled={formState.openMode !== 'view'}>View</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            {/* Caption */}
            <div className="space-y-2">
              <Label htmlFor="caption">Caption *</Label>
              <Input
                id="caption"
                value={formState.caption || ''}
                onChange={(e) => updateField('caption', e.target.value)}
                placeholder="Menu item text"
              />
            </div>

            {/* ID */}
            <div className="space-y-2">
              <Label htmlFor="id">Unique ID *</Label>
              <div className="flex gap-2">
                <Input
                  id="id"
                  value={formState.id || ''}
                  onChange={(e) => updateField('id', e.target.value)}
                  placeholder="Unique identifier"
                />
                <Button variant="outline" size="icon" onClick={generateId} title="Generate ID">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">Component URL</Label>
              <Input
                id="url"
                value={formState.url || ''}
                onChange={(e) => updateField('url', e.target.value)}
                placeholder="/data-grid, /watchlist, etc."
                disabled={hasChildren}
              />
              {fullUrl && (
                <p className="text-xs text-muted-foreground">
                  Full URL: {fullUrl}?id={formState.id}
                </p>
              )}
            </div>

            {/* Open Mode */}
            <div className="space-y-2">
              <Label htmlFor="openMode">Open Mode</Label>
              <Select
                value={formState.openMode || 'window'}
                onValueChange={(value: 'window' | 'view') => updateField('openMode', value)}
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
                  value={formState.icon || ''}
                  onChange={(e) => updateField('icon', e.target.value)}
                  placeholder="/icons/app.svg"
                />
                <Button variant="outline" size="icon" onClick={handleIconClick} title="Select Icon">
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
                value={formState.order || 0}
                onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
                min="0"
              />
            </div>
          </TabsContent>

          <TabsContent value="window" className="space-y-4 mt-4">
            {/* Window dimensions and options - simplified */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Dimensions</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Width</Label>
                  <Input
                    type="number"
                    value={formState.windowOptions?.width || DEFAULT_WINDOW_OPTIONS.width}
                    onChange={(e) => updateField('windowOptions', {
                      ...formState.windowOptions,
                      width: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
                <div>
                  <Label>Height</Label>
                  <Input
                    type="number"
                    value={formState.windowOptions?.height || DEFAULT_WINDOW_OPTIONS.height}
                    onChange={(e) => updateField('windowOptions', {
                      ...formState.windowOptions,
                      height: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Resizable</Label>
                  <Switch
                    checked={formState.windowOptions?.resizable ?? DEFAULT_WINDOW_OPTIONS.resizable}
                    onCheckedChange={(checked) => updateField('windowOptions', {
                      ...formState.windowOptions,
                      resizable: checked
                    })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Maximizable</Label>
                  <Switch
                    checked={formState.windowOptions?.maximizable ?? DEFAULT_WINDOW_OPTIONS.maximizable}
                    onCheckedChange={(checked) => updateField('windowOptions', {
                      ...formState.windowOptions,
                      maximizable: checked
                    })}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="view" className="space-y-4 mt-4">
            <div>
              <h4 className="text-sm font-medium mb-3">View Bounds</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Width</Label>
                  <Input
                    type="number"
                    value={formState.viewOptions?.bounds?.width || DEFAULT_VIEW_OPTIONS.bounds.width}
                    onChange={(e) => updateField('viewOptions', {
                      ...formState.viewOptions,
                      bounds: {
                        ...formState.viewOptions?.bounds,
                        width: parseInt(e.target.value) || 0,
                        height: formState.viewOptions?.bounds?.height || DEFAULT_VIEW_OPTIONS.bounds.height
                      }
                    })}
                  />
                </div>
                <div>
                  <Label>Height</Label>
                  <Input
                    type="number"
                    value={formState.viewOptions?.bounds?.height || DEFAULT_VIEW_OPTIONS.bounds.height}
                    onChange={(e) => updateField('viewOptions', {
                      ...formState.viewOptions,
                      bounds: {
                        ...formState.viewOptions?.bounds,
                        height: parseInt(e.target.value) || 0,
                        width: formState.viewOptions?.bounds?.width || DEFAULT_VIEW_OPTIONS.bounds.width
                      }
                    })}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// NO React.memo needed - parent already uses stable callbacks
export const PropertiesPanel = PropertiesPanelSimple;
