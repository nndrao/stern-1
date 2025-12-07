/**
 * Properties Panel - Professional UI Design
 *
 * Design improvements:
 * - Grouped sections with clear headers
 * - Better visual hierarchy with icons and labels
 * - Inline validation and helpful hints
 * - Smooth transitions and hover states
 * - Professional spacing and typography
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
import {
  RefreshCw,
  Image,
  Save,
  RotateCcw,
  Link2,
  Tag,
  Hash,
  Monitor,
  Maximize2,
  Eye,
  Grid3x3,
  AlertCircle
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

function PropertiesPanelProfessional({ item, onUpdate, onIconSelect }: PropertiesPanelProps) {
  const [formState, setFormState] = useState<FormState>({ hasChanges: false });
  const [activeTab, setActiveTab] = useState('general');

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

  // Apply changes
  const applyChanges = () => {
    if (!item) return;
    const { hasChanges, ...updates } = formState;
    onUpdate(item.id, updates);
    setFormState(prev => ({ ...prev, hasChanges: false }));
  };

  // Reset changes
  const resetChanges = () => {
    if (item) {
      setFormState({ ...item, hasChanges: false });
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

  // Validation
  const errors = useMemo(() => {
    const errs: string[] = [];
    if (!formState.caption?.trim()) errs.push('Caption is required');
    if (!formState.id?.trim()) errs.push('ID is required');
    return errs;
  }, [formState.caption, formState.id]);

  if (!item) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Tag className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No Item Selected</h3>
          <p className="text-sm text-muted-foreground">
            Select a menu item from the tree to view and edit its properties
          </p>
        </div>
      </div>
    );
  }

  const hasChildren = item.children && item.children.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Sticky Header with Actions */}
      {formState.hasChanges && (
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-b border-amber-500/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 flex-1">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              You have unsaved changes
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetChanges}
            className="h-8 border-amber-500/30 hover:bg-amber-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={applyChanges}
            disabled={errors.length > 0}
            className="h-8 bg-amber-600 hover:bg-amber-700"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Apply Changes
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b px-6 pt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general" className="gap-2">
                <Tag className="h-3.5 w-3.5" />
                General
              </TabsTrigger>
              <TabsTrigger
                value="window"
                disabled={formState.openMode !== 'window'}
                className="gap-2"
              >
                <Monitor className="h-3.5 w-3.5" />
                Window
              </TabsTrigger>
              <TabsTrigger
                value="view"
                disabled={formState.openMode !== 'view'}
                className="gap-2"
              >
                <Eye className="h-3.5 w-3.5" />
                View
              </TabsTrigger>
            </TabsList>
          </div>

          {/* General Tab */}
          <TabsContent value="general" className="m-0 p-6 space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Basic Information
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <Label htmlFor="caption" className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  Display Name
                  <Badge variant="secondary" className="ml-auto text-xs">Required</Badge>
                </Label>
                <Input
                  id="caption"
                  value={formState.caption || ''}
                  onChange={(e) => updateField('caption', e.target.value)}
                  placeholder="Enter menu item name"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  This text will appear in the dock menu
                </p>
              </div>

              {/* ID */}
              <div className="space-y-2">
                <Label htmlFor="id" className="flex items-center gap-2 text-sm font-medium">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  Unique Identifier
                  <Badge variant="secondary" className="ml-auto text-xs">Required</Badge>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="id"
                    value={formState.id || ''}
                    onChange={(e) => updateField('id', e.target.value)}
                    placeholder="menu-item-id"
                    className="flex-1 h-10 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={generateId}
                    title="Generate unique ID"
                    className="h-10 w-10"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used internally to identify this menu item
                </p>
              </div>
            </div>

            <Separator />

            {/* Display Settings Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Display Settings
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Icon */}
              <div className="space-y-2">
                <Label htmlFor="icon" className="flex items-center gap-2 text-sm font-medium">
                  <Image className="h-3.5 w-3.5 text-muted-foreground" />
                  Icon
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="icon"
                    value={formState.icon || ''}
                    onChange={(e) => updateField('icon', e.target.value)}
                    placeholder="/icons/app.svg"
                    className="flex-1 h-10 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleIconClick}
                    title="Browse icons"
                    className="h-10 w-10"
                  >
                    <Image className="h-4 w-4" />
                  </Button>
                </div>
                {formState.icon && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
                    <img
                      src={formState.icon}
                      alt="Icon preview"
                      className="h-6 w-6"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <span className="text-xs text-muted-foreground font-mono">
                      {formState.icon}
                    </span>
                  </div>
                )}
              </div>

              {/* Order */}
              <div className="space-y-2">
                <Label htmlFor="order" className="flex items-center gap-2 text-sm font-medium">
                  <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />
                  Sort Order
                </Label>
                <Input
                  id="order"
                  type="number"
                  value={formState.order || 0}
                  onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
                  min="0"
                  className="h-10 w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first in the menu
                </p>
              </div>
            </div>

            <Separator />

            {/* Navigation Settings Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Navigation Settings
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="url" className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Component URL
                </Label>
                <Input
                  id="url"
                  value={formState.url || ''}
                  onChange={(e) => updateField('url', e.target.value)}
                  placeholder="/blotters/simple"
                  disabled={hasChildren}
                  className="h-10 font-mono text-sm"
                />
                {fullUrl && !hasChildren && (
                  <div className="p-2 rounded-md bg-muted/50 border space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Full URL:</p>
                    <code className="text-xs text-foreground break-all">
                      {fullUrl}?id={formState.id}
                    </code>
                  </div>
                )}
                {hasChildren && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Parent items with children cannot have a URL
                  </p>
                )}
              </div>

              {/* Open Mode */}
              <div className="space-y-2">
                <Label htmlFor="openMode" className="flex items-center gap-2 text-sm font-medium">
                  <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
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
                  <SelectTrigger id="openMode" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="window">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        <span>New Window</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="view">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span>New View (Tab)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formState.openMode === 'window'
                    ? 'Opens in a separate window'
                    : 'Opens as a tab in the current window'
                  }
                </p>
              </div>
            </div>
          </TabsContent>

          {/* Window Tab */}
          <TabsContent value="window" className="m-0 p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Window Dimensions
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Width (px)</Label>
                  <Input
                    type="number"
                    value={formState.windowOptions?.width || DEFAULT_WINDOW_OPTIONS.width}
                    onChange={(e) => updateField('windowOptions', {
                      ...formState.windowOptions,
                      width: parseInt(e.target.value) || 0
                    })}
                    min="100"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Height (px)</Label>
                  <Input
                    type="number"
                    value={formState.windowOptions?.height || DEFAULT_WINDOW_OPTIONS.height}
                    onChange={(e) => updateField('windowOptions', {
                      ...formState.windowOptions,
                      height: parseInt(e.target.value) || 0
                    })}
                    min="100"
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Window Behavior
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm font-medium cursor-pointer">Resizable</Label>
                      <p className="text-xs text-muted-foreground">Allow window to be resized</p>
                    </div>
                  </div>
                  <Switch
                    checked={formState.windowOptions?.resizable ?? DEFAULT_WINDOW_OPTIONS.resizable}
                    onCheckedChange={(checked) => updateField('windowOptions', {
                      ...formState.windowOptions,
                      resizable: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Label className="text-sm font-medium cursor-pointer">Maximizable</Label>
                      <p className="text-xs text-muted-foreground">Show maximize button</p>
                    </div>
                  </div>
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

          {/* View Tab */}
          <TabsContent value="view" className="m-0 p-6 space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  View Dimensions
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
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
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
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
                    className="h-10"
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

export const PropertiesPanel = PropertiesPanelProfessional;
