/**
 * Dock Configuration Editor Component - Refactored
 *
 * Key improvements:
 * - Uses shared tree utilities with Immer for efficient updates
 * - Stores selectedId (string) instead of selectedNode (object) to prevent stale closures
 * - Cleaner callback structure with proper dependency management
 * - Removed duplicate tree traversal code
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useToast } from '@/hooks/ui/use-toast';
import {
  Save,
  Download,
  Upload,
  Plus,
  Trash2,
  Copy,
  Eye,
  AlertCircle,
  Menu,
  Settings2
} from 'lucide-react';

import { TreeView } from '../TreeView';
import { PropertiesPanel } from '../PropertiesPanel';
import {
  DockConfiguration,
  DockMenuItem,
  createMenuItem,
  validateDockConfiguration,
  createDockConfiguration,
  useOpenFinDock
} from '@stern/openfin-platform';
import { useDockConfig, useSaveDockConfig } from '@/hooks/api/useDockConfigQueries';
import { logger } from '@/utils/logger';
import {
  findMenuItem,
  updateMenuItem,
  deleteMenuItem,
  addChildToParent,
  moveMenuItem,
  duplicateMenuItem as duplicateMenuItemUtil
} from '@/utils/dock/treeUtils';

// Lazy load IconPicker to prevent loading hundreds of icons on initial page load
const IconPicker = React.lazy(() =>
  import('../editors/IconPicker').then(m => ({ default: m.IconPicker }))
);

interface DockConfigEditorProps {
  userId?: string;
  appId?: string;
}

// System userId for admin configurations - shared across all users
const SYSTEM_USER_ID = 'System';

/**
 * Dock Configuration Editor
 * Uses shared tree utilities and proper React patterns
 */
export const DockConfigEditor: React.FC<DockConfigEditorProps> = ({
  userId = SYSTEM_USER_ID,
  appId = 'stern-platform'
}) => {
  const { toast } = useToast();
  const openFinDock = useOpenFinDock();

  // React Query hooks - always use System userId for dock configs
  const { data: loadedConfig, isLoading, error: loadError } = useDockConfig(SYSTEM_USER_ID);
  const saveMutation = useSaveDockConfig();

  // Core state - using selectedId (string) instead of selectedNode (object)
  // This prevents stale closure issues and makes memoization more effective
  const [currentConfig, setCurrentConfig] = useState<DockConfiguration | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Icon picker state
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconPickerCallback, setIconPickerCallback] = useState<((icon: string) => void) | null>(null);

  // Derive selected item from selectedId (memoized)
  const selectedItem = useMemo(() => {
    if (!selectedId || !currentConfig?.config?.menuItems) return null;
    return findMenuItem(currentConfig.config.menuItems, selectedId);
  }, [selectedId, currentConfig?.config?.menuItems]);

  // Sync loaded config to local state
  useEffect(() => {
    if (loadedConfig) {
      setCurrentConfig(loadedConfig as unknown as DockConfiguration);
      setIsDirty(false);
      setSelectedId(null);
    } else if (!isLoading && !loadedConfig) {
      // No config found, create new one
      const newConfig = createDockConfiguration(userId, appId) as unknown as DockConfiguration;
      setCurrentConfig(newConfig);
      setIsDirty(true);
    }
  }, [loadedConfig, isLoading, userId, appId]);

  // Auto-save draft to localStorage (debounced)
  useEffect(() => {
    if (!isDirty || !currentConfig) return;

    const timer = setTimeout(() => {
      localStorage.setItem('dock-config-draft', JSON.stringify(currentConfig));
      logger.debug('Draft auto-saved to localStorage', undefined, 'DockConfigEditor');
    }, 30000);

    return () => clearTimeout(timer);
  }, [isDirty, currentConfig]);

  // ============================================================================
  // Handlers - Using shared utilities with proper dependencies
  // ============================================================================

  const handleSave = useCallback(async () => {
    if (!currentConfig) {
      toast({
        title: 'Error',
        description: 'No configuration loaded',
        variant: 'destructive'
      });
      return;
    }

    // Validate configuration before saving
    const validation = validateDockConfiguration(currentConfig);
    if (!validation.isValid) {
      toast({
        title: 'Validation failed',
        description: validation.errors[0]?.message || 'Please fix validation errors',
        variant: 'destructive'
      });
      return;
    }

    const menuItemCount = currentConfig.config?.menuItems?.length || 0;
    const configName = currentConfig.name;

    try {
      logger.info('Saving dock configuration', { configId: currentConfig.configId }, 'DockConfigEditor');

      await saveMutation.mutateAsync({ userId: SYSTEM_USER_ID, config: currentConfig });

      setIsDirty(false);
      localStorage.removeItem('dock-config-draft');

      // Update the dock with the new configuration
      if (window.fin) {
        try {
          const dock = await import('@/openfin/platform/openfinDock');
          await dock.updateConfig({
            menuItems: currentConfig.config?.menuItems || []
          });
          logger.info('Dock updated successfully', undefined, 'DockConfigEditor');
        } catch (dockError) {
          logger.error('Failed to update dock', dockError, 'DockConfigEditor');
        }
      }

      toast({
        title: 'Configuration saved',
        description: `Saved "${configName}" with ${menuItemCount} menu item(s).`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save configuration';
      toast({
        title: 'Save failed',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  }, [currentConfig, saveMutation, toast]);

  const handleAddMenuItem = useCallback(() => {
    if (!currentConfig) return;

    const newItem = createMenuItem();
    const menuItems = currentConfig.config?.menuItems || [];

    // Add as child of selected item, or to root if nothing selected
    const newMenuItems = addChildToParent(menuItems, selectedId, newItem);

    setCurrentConfig({
      ...currentConfig,
      config: {
        ...currentConfig.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);
    setSelectedId(newItem.id);
  }, [currentConfig, selectedId]);

  const handleDeleteMenuItem = useCallback(() => {
    if (!currentConfig || !selectedId) return;

    const menuItems = currentConfig.config?.menuItems || [];
    const newMenuItems = deleteMenuItem(menuItems, selectedId);

    setCurrentConfig({
      ...currentConfig,
      config: {
        ...currentConfig.config,
        menuItems: newMenuItems
      }
    });
    setSelectedId(null);
    setIsDirty(true);

    toast({
      title: 'Item deleted',
      description: 'Menu item has been removed',
    });
  }, [currentConfig, selectedId, toast]);

  const handleDuplicateMenuItem = useCallback(() => {
    if (!currentConfig || !selectedItem) return;

    const duplicate = createMenuItem({
      ...selectedItem,
      id: undefined,
      caption: `${selectedItem.caption} (Copy)`
    });

    const menuItems = currentConfig.config?.menuItems || [];
    const newMenuItems = duplicateMenuItemUtil(menuItems, duplicate);

    setCurrentConfig({
      ...currentConfig,
      config: {
        ...currentConfig.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);
    setSelectedId(duplicate.id);

    toast({
      title: 'Item duplicated',
      description: 'Menu item has been duplicated',
    });
  }, [currentConfig, selectedItem, toast]);

  const handleUpdateMenuItem = useCallback((id: string, updates: Partial<DockMenuItem>) => {
    if (!currentConfig) return;

    const menuItems = currentConfig.config?.menuItems || [];
    const newMenuItems = updateMenuItem(menuItems, id, updates);

    setCurrentConfig({
      ...currentConfig,
      config: {
        ...currentConfig.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);
  }, [currentConfig]);

  const handleReorderItems = useCallback((
    sourceId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside'
  ) => {
    if (!currentConfig) return;

    const menuItems = currentConfig.config?.menuItems || [];
    const newMenuItems = moveMenuItem(menuItems, sourceId, targetId, position);

    setCurrentConfig({
      ...currentConfig,
      config: {
        ...currentConfig.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);
  }, [currentConfig]);

  const handlePreview = useCallback(async () => {
    if (!currentConfig) return;

    try {
      await openFinDock.updateDock(currentConfig.config);
      await openFinDock.showDock();
      toast({
        title: 'Preview updated',
        description: 'Dock has been updated with your changes',
      });
    } catch {
      toast({
        title: 'Preview failed',
        description: 'Failed to update dock preview',
        variant: 'destructive'
      });
    }
  }, [currentConfig, openFinDock, toast]);

  const handleExport = useCallback(() => {
    if (!currentConfig) return;

    const dataStr = JSON.stringify(currentConfig, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportFileName = `dock-config-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();

    toast({
      title: 'Configuration exported',
      description: 'Configuration has been downloaded',
    });
  }, [currentConfig, toast]);

  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string);
        setCurrentConfig(config);
        setIsDirty(true);
        setSelectedId(null);
        toast({
          title: 'Configuration imported',
          description: 'Configuration has been loaded successfully',
        });
      } catch {
        toast({
          title: 'Import failed',
          description: 'Invalid configuration file',
          variant: 'destructive'
        });
      }
    };
    reader.readAsText(file);

    // Reset input so same file can be imported again
    event.target.value = '';
  }, [toast]);

  const handleCreateNewConfig = useCallback(() => {
    const newConfig = createDockConfiguration(userId, appId) as unknown as DockConfiguration;
    setCurrentConfig(newConfig);
    setIsDirty(true);
    setSelectedId(null);
  }, [userId, appId]);

  const handleIconSelect = useCallback((callback: (icon: string) => void) => {
    setIconPickerCallback(() => callback);
    setIsIconPickerOpen(true);
  }, []);

  const handleIconPicked = useCallback((icon: string) => {
    if (iconPickerCallback) {
      iconPickerCallback(icon);
    }
    setIsIconPickerOpen(false);
    setIconPickerCallback(null);
  }, [iconPickerCallback]);

  // Selection handler - just sets the ID, not the object
  const handleSelectItem = useCallback((item: DockMenuItem | null) => {
    setSelectedId(item?.id || null);
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  const error = loadError instanceof Error ? loadError.message : loadError ? String(loadError) : null;
  const menuItemCount = currentConfig?.config?.menuItems?.length || 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
              <Menu className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Dock Configuration</h1>
              <p className="text-sm text-muted-foreground">
                {menuItemCount} menu item{menuItemCount !== 1 ? 's' : ''} configured
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Loading...</span>
              </div>
            )}
            {isDirty && (
              <Badge variant="outline" className="gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Unsaved changes
              </Badge>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-t bg-muted/30">
          {/* Edit Actions */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground mr-2">Edit:</span>
            <Button variant="outline" size="sm" onClick={handleAddMenuItem} className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteMenuItem}
              disabled={!selectedId}
              className="h-8"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicateMenuItem}
              disabled={!selectedId}
              className="h-8"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Duplicate
            </Button>
          </div>

          {/* File & Save Actions */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground mr-2">Actions:</span>
            <Button variant="outline" size="sm" onClick={handlePreview} className="h-8">
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <label htmlFor="import-file">
              <Button variant="outline" size="sm" asChild className="h-8">
                <span>
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Import
                </span>
              </Button>
            </label>
            <input
              id="import-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />

            <Button variant="outline" size="sm" onClick={handleExport} className="h-8">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <Button
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || isLoading || saveMutation.isPending}
              className="h-8 min-w-[80px]"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden bg-muted/20">
        {error && (
          <Alert variant="destructive" className="m-4 shadow-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!currentConfig ? (
          <div className="flex items-center justify-center h-full p-8">
            <Card className="max-w-md shadow-lg border-2">
              <CardHeader className="text-center pb-3">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mx-auto mb-3">
                  <Settings2 className="w-6 h-6 text-muted-foreground" />
                </div>
                <CardTitle className="text-xl">No Configuration Found</CardTitle>
                <CardDescription className="text-sm">
                  Create a new dock configuration to get started
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button onClick={handleCreateNewConfig} size="lg" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create New Configuration
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className="h-full p-4 overflow-auto">
                <Card className="h-full shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Menu className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">Menu Structure</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Drag and drop to reorder menu items
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <TreeView
                      items={currentConfig.config.menuItems}
                      selectedId={selectedId}
                      onSelect={handleSelectItem}
                      onReorder={handleReorderItems}
                      onUpdate={handleUpdateMenuItem}
                    />
                  </CardContent>
                </Card>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={60} minSize={40}>
              <div className="h-full p-4 overflow-auto">
                <Card className="h-full shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">Properties</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      Configure the selected menu item
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <PropertiesPanel
                      item={selectedItem}
                      onUpdate={handleUpdateMenuItem}
                      onIconSelect={handleIconSelect}
                    />
                  </CardContent>
                </Card>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* Icon Picker Dialog - Lazy loaded */}
      {isIconPickerOpen && (
        <React.Suspense fallback={<div className="p-4">Loading icons...</div>}>
          <IconPicker
            open={isIconPickerOpen}
            onOpenChange={setIsIconPickerOpen}
            onSelect={handleIconPicked}
          />
        </React.Suspense>
      )}
    </div>
  );
};
