/**
 * Properties Panel - 2-Column Layout
 *
 * Optimizations:
 * - 2-column grid layout for better horizontal space usage
 * - Related fields grouped side-by-side
 * - More content visible without scrolling
 * - Maintains compact spacing
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { buildUrl } from '@/openfin/utils';
import {
  RefreshCw,
  Image,
  Save,
  RotateCcw,
  Link2,
  Tag,
  Hash,
  Monitor,
  Eye,
  Grid3x3,
  AlertCircle,
  Maximize2,
  Square,
  Minimize2
} from 'lucide-react';
import { DockMenuItem, DEFAULT_WINDOW_OPTIONS, DEFAULT_VIEW_OPTIONS } from '@stern/openfin-platform';

interface PropertiesPanelProps {
  item: DockMenuItem | null;
  onUpdate: (id: string, updates: Partial<DockMenuItem>) => void;
  onIconSelect: (callback: (icon: string) => void) => void;
}

interface FormState extends Partial<DockMenuItem> {
  hasChanges: boolean;
}

function PropertiesPanelTwoColumn({ item, onUpdate, onIconSelect }: PropertiesPanelProps) {
  const [formState, setFormState] = useState<FormState>({ hasChanges: false });
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (item) {
      setFormState({ ...item, hasChanges: false });
    }
  }, [item?.id]);

  const updateField = <K extends keyof DockMenuItem>(field: K, value: DockMenuItem[K]) => {
    setFormState(prev => ({ ...prev, [field]: value, hasChanges: true }));
  };

  const applyChanges = () => {
    if (!item) return;
    const { hasChanges, ...updates } = formState;
    onUpdate(item.id, updates);
    setFormState(prev => ({ ...prev, hasChanges: false }));
  };

  const resetChanges = () => {
    if (item) setFormState({ ...item, hasChanges: false });
  };

  const generateId = () => {
    updateField('id', `menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  };

  const handleIconClick = () => {
    onIconSelect((icon) => updateField('icon', icon));
  };

  const fullUrl = useMemo(() =>
    formState.url ? buildUrl(formState.url) : '',
    [formState.url]
  );

  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!formState.caption?.trim()) errs.push('Caption required');
    if (!formState.id?.trim()) errs.push('ID required');
    return errs;
  }, [formState.caption, formState.id]);

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center space-y-2 max-w-xs">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Tag className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium">No Item Selected</h3>
          <p className="text-xs text-muted-foreground">
            Select a menu item from the tree to edit
          </p>
        </div>
      </div>
    );
  }

  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Compact Action Bar */}
      {formState.hasChanges && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300 flex-1">
            Unsaved changes
          </span>
          <Button variant="ghost" size="sm" onClick={resetChanges} className="h-7 px-2">
            <RotateCcw className="h-3 w-3 mr-1" />
            <span className="text-xs">Discard</span>
          </Button>
          <Button size="sm" onClick={applyChanges} disabled={errors.length > 0} className="h-7 px-3 bg-amber-600 hover:bg-amber-700">
            <Save className="h-3 w-3 mr-1" />
            <span className="text-xs">Apply</span>
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Compact Tab Bar */}
          <div className="sticky top-0 z-10 bg-background border-b px-4 pt-3 pb-2">
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="general" className="text-xs gap-1.5">
                <Tag className="h-3 w-3" />
                General
              </TabsTrigger>
              <TabsTrigger value="window" disabled={formState.openMode !== 'window'} className="text-xs gap-1.5">
                <Monitor className="h-3 w-3" />
                Window
              </TabsTrigger>
              <TabsTrigger value="view" disabled={formState.openMode !== 'view'} className="text-xs gap-1.5">
                <Eye className="h-3 w-3" />
                View
              </TabsTrigger>
            </TabsList>
          </div>

          {/* General Tab - 2-Column Layout */}
          <TabsContent value="general" className="m-0 p-4 space-y-3">
            {/* Caption & ID - Side by Side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="caption" className="text-sm font-medium flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    Display Name
                  </Label>
                  <Badge variant="secondary" className="h-4 px-1.5 text-xs">Required</Badge>
                </div>
                <Input
                  id="caption"
                  value={formState.caption || ''}
                  onChange={(e) => updateField('caption', e.target.value)}
                  placeholder="Menu item name"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="id" className="text-sm font-medium flex items-center gap-1.5">
                    <Hash className="h-3 w-3 text-muted-foreground" />
                    Unique ID
                  </Label>
                  <Badge variant="secondary" className="h-4 px-1.5 text-xs">Required</Badge>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="id"
                    value={formState.id || ''}
                    onChange={(e) => updateField('id', e.target.value)}
                    placeholder="menu-item-id"
                    className="flex-1 h-8 font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={generateId} className="h-8 w-8 flex-shrink-0">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Icon & Sort Order - Side by Side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="icon" className="text-sm font-medium flex items-center gap-1.5">
                  <Image className="h-3 w-3 text-muted-foreground" />
                  Icon
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="icon"
                    value={formState.icon || ''}
                    onChange={(e) => updateField('icon', e.target.value)}
                    placeholder="/icons/app.svg"
                    className="flex-1 h-8 font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={handleIconClick} className="h-8 w-8 flex-shrink-0">
                    <Image className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {formState.icon && (
                  <div className="flex items-center gap-2 p-1.5 rounded bg-muted/50 border">
                    <img src={formState.icon} alt="" className="h-4 w-4" onError={(e) => (e.target as HTMLImageElement).style.display = 'none'} />
                    <span className="text-xs text-muted-foreground font-mono truncate">{formState.icon}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="order" className="text-sm font-medium flex items-center gap-1.5">
                  <Grid3x3 className="h-3 w-3 text-muted-foreground" />
                  Sort Order
                </Label>
                <Input
                  id="order"
                  type="number"
                  value={formState.order || 0}
                  onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
                  min="0"
                  className="h-8"
                />
                <p className="text-xs text-muted-foreground">Lower numbers appear first</p>
              </div>
            </div>

            <Separator />

            {/* URL - Full Width */}
            <div className="space-y-1.5">
              <Label htmlFor="url" className="text-sm font-medium flex items-center gap-1.5">
                <Link2 className="h-3 w-3 text-muted-foreground" />
                Component URL
              </Label>
              <Input
                id="url"
                value={formState.url || ''}
                onChange={(e) => updateField('url', e.target.value)}
                placeholder="/blotters/simple"
                disabled={hasChildren}
                className="h-8 font-mono text-xs"
              />
              {fullUrl && !hasChildren && (
                <div className="px-2 py-1.5 rounded bg-muted/50 border">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Full URL:</p>
                  <code className="text-xs text-foreground break-all">{fullUrl}?id={formState.id}</code>
                </div>
              )}
              {hasChildren && (
                <p className="text-xs text-amber-600">Parent items cannot have a URL</p>
              )}
            </div>

            {/* Open Mode - Full Width */}
            <div className="space-y-1.5">
              <Label htmlFor="openMode" className="text-sm font-medium flex items-center gap-1.5">
                <Monitor className="h-3 w-3 text-muted-foreground" />
                Open Mode
              </Label>
              <Select
                value={formState.openMode || 'window'}
                onValueChange={(value: 'window' | 'view') => {
                  updateField('openMode', value);
                  setActiveTab(value === 'window' ? 'window' : 'view');
                }}
                disabled={hasChildren}
              >
                <SelectTrigger id="openMode" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="window">
                    <div className="flex items-center gap-2 text-xs">
                      <Monitor className="h-3 w-3" />
                      New Window
                    </div>
                  </SelectItem>
                  <SelectItem value="view">
                    <div className="flex items-center gap-2 text-xs">
                      <Eye className="h-3 w-3" />
                      New View (Tab)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Window Tab - 2-Column Grid */}
          <TabsContent value="window" className="m-0 p-4 space-y-3">
            {/* Dimensions - 2 Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Width (px)</Label>
                <Input
                  type="number"
                  value={formState.windowOptions?.width || DEFAULT_WINDOW_OPTIONS.width}
                  onChange={(e) => updateField('windowOptions', {
                    ...formState.windowOptions,
                    width: parseInt(e.target.value) || 0
                  })}
                  min="100"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Height (px)</Label>
                <Input
                  type="number"
                  value={formState.windowOptions?.height || DEFAULT_WINDOW_OPTIONS.height}
                  onChange={(e) => updateField('windowOptions', {
                    ...formState.windowOptions,
                    height: parseInt(e.target.value) || 0
                  })}
                  min="100"
                  className="h-8"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Min Width (px)</Label>
                <Input
                  type="number"
                  value={formState.windowOptions?.minWidth || DEFAULT_WINDOW_OPTIONS.minWidth}
                  onChange={(e) => updateField('windowOptions', {
                    ...formState.windowOptions,
                    minWidth: parseInt(e.target.value) || 0
                  })}
                  min="0"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Min Height (px)</Label>
                <Input
                  type="number"
                  value={formState.windowOptions?.minHeight || DEFAULT_WINDOW_OPTIONS.minHeight}
                  onChange={(e) => updateField('windowOptions', {
                    ...formState.windowOptions,
                    minHeight: parseInt(e.target.value) || 0
                  })}
                  min="0"
                  className="h-8"
                />
              </div>
            </div>

            <Separator />

            {/* Options - 2 Columns */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between px-2 py-1.5 rounded border bg-card hover:bg-accent/30 transition-colors">
                <Label className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Maximize2 className="h-3 w-3 text-muted-foreground" />
                  Resizable
                </Label>
                <Switch
                  checked={formState.windowOptions?.resizable ?? DEFAULT_WINDOW_OPTIONS.resizable}
                  onCheckedChange={(checked) => updateField('windowOptions', {
                    ...formState.windowOptions,
                    resizable: checked
                  })}
                  className="scale-75"
                />
              </div>

              <div className="flex items-center justify-between px-2 py-1.5 rounded border bg-card hover:bg-accent/30 transition-colors">
                <Label className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Square className="h-3 w-3 text-muted-foreground" />
                  Maximizable
                </Label>
                <Switch
                  checked={formState.windowOptions?.maximizable ?? DEFAULT_WINDOW_OPTIONS.maximizable}
                  onCheckedChange={(checked) => updateField('windowOptions', {
                    ...formState.windowOptions,
                    maximizable: checked
                  })}
                  className="scale-75"
                />
              </div>

              <div className="flex items-center justify-between px-2 py-1.5 rounded border bg-card hover:bg-accent/30 transition-colors">
                <Label className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Minimize2 className="h-3 w-3 text-muted-foreground" />
                  Minimizable
                </Label>
                <Switch
                  checked={formState.windowOptions?.minimizable ?? DEFAULT_WINDOW_OPTIONS.minimizable}
                  onCheckedChange={(checked) => updateField('windowOptions', {
                    ...formState.windowOptions,
                    minimizable: checked
                  })}
                  className="scale-75"
                />
              </div>

              <div className="flex items-center justify-between px-2 py-1.5 rounded border bg-card hover:bg-accent/30 transition-colors">
                <Label className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Monitor className="h-3 w-3 text-muted-foreground" />
                  Center
                </Label>
                <Switch
                  checked={formState.windowOptions?.center ?? DEFAULT_WINDOW_OPTIONS.center}
                  onCheckedChange={(checked) => updateField('windowOptions', {
                    ...formState.windowOptions,
                    center: checked
                  })}
                  className="scale-75"
                />
              </div>
            </div>
          </TabsContent>

          {/* View Tab - 2 Column */}
          <TabsContent value="view" className="m-0 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Width (px)</Label>
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
                  min="100"
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Height (px)</Label>
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
                  min="100"
                  className="h-8"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export const PropertiesPanel = PropertiesPanelTwoColumn;
