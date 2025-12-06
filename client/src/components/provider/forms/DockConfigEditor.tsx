/**
 * Dock Configuration Editor Component - Enhanced
 * Main interface for editing dock menu configurations
 * Features: Visual grouping, status indicators, improved toolbar layout
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
// Lazy load IconPicker to prevent loading hundreds of icons on initial page load
const IconPicker = React.lazy(() => import('../editors/IconPicker').then(m => ({ default: m.IconPicker })));
import { DockConfiguration, DockMenuItem, createMenuItem, validateDockConfiguration, createDockConfiguration, useOpenFinDock } from '@stern/openfin-platform';
import { useDockConfig, useSaveDockConfig } from '@/hooks/api/useDockConfigQueries';
import '@/test/helpers/testApi'; // Import test utility for debugging
import { logger } from '@/utils/logger';
import { COMPONENT_SUBTYPES } from '@stern/shared-types';

interface DockConfigEditorProps {
  userId?: string;
  appId?: string;
}

// Helper: Find menu item by ID recursively
function findMenuItem(items: DockMenuItem[], id: string): DockMenuItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findMenuItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

// Helper: Update menu item recursively
function updateMenuItemRecursive(items: DockMenuItem[], id: string, updates: Partial<DockMenuItem>): DockMenuItem[] {
  return items.map(item => {
    if (item.id === id) {
      return { ...item, ...updates };
    }
    if (item.children) {
      return {
        ...item,
        children: updateMenuItemRecursive(item.children, id, updates)
      };
    }
    return item;
  });
}

// Helper: Delete menu item recursively
function deleteMenuItemRecursive(items: DockMenuItem[], id: string): DockMenuItem[] {
  const result: DockMenuItem[] = [];
  for (const item of items) {
    if (item.id !== id) {
      if (item.children) {
        result.push({
          ...item,
          children: deleteMenuItemRecursive(item.children, id)
        });
      } else {
        result.push(item);
      }
    }
  }
  return result;
}

// Helper: Add child to item recursively
function addChildToItem(item: DockMenuItem, parentId: string, child: DockMenuItem): DockMenuItem {
  if (item.id === parentId) {
    return {
      ...item,
      children: [...(item.children || []), child]
    };
  }
  if (item.children) {
    return {
      ...item,
      children: item.children.map(childItem => addChildToItem(childItem, parentId, child))
    };
  }
  return item;
}

// System userId for admin configurations - shared across all users
const SYSTEM_USER_ID = 'System';

/**
 * Dock Configuration Editor - Simplified
 * Uses simple local state for fast, responsive editing
 */
export const DockConfigEditor: React.FC<DockConfigEditorProps> = ({
  userId = SYSTEM_USER_ID, // Default to System for admin configs
  appId = 'stern-platform'
}) => {
  const { toast } = useToast();
  const openFinDock = useOpenFinDock();

  // React Query hooks - always use System userId for dock configs
  const { data: loadedConfig, isLoading, error: loadError } = useDockConfig(SYSTEM_USER_ID);
  const saveMutation = useSaveDockConfig();

  // UI state
  const [currentConfig, setCurrentConfig] = useState<DockConfiguration | null>(null);
  const [selectedNode, setSelectedNode] = useState<DockMenuItem | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Note: useOpenfinTheme is called at App level, no need to call here
  // Calling it here causes performance issues on every keystroke

  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconPickerCallback, setIconPickerCallback] = useState<((icon: string) => void) | null>(null);

  // PERFORMANCE FIX: Use ref to get current config without triggering callback recreation
  const currentConfigRef = useRef<DockConfiguration | null>(null);
  currentConfigRef.current = currentConfig;

  // Sync loaded config to local state
  useEffect(() => {
    if (loadedConfig) {
      setCurrentConfig(loadedConfig as unknown as DockConfiguration);
      setIsDirty(false);
    } else if (!isLoading && !loadedConfig) {
      // No config found, create new one
      const newConfig = createDockConfiguration(userId, appId) as unknown as DockConfiguration;
      setCurrentConfig(newConfig);
      setIsDirty(true);
    }
  }, [loadedConfig, isLoading, userId, appId]);

  // Auto-save draft every 30 seconds
  // PERFORMANCE FIX: Use ref to avoid recreating callback on every config change
  useEffect(() => {
    if (!isDirty) return;

    const timer = setTimeout(() => {
      const config = currentConfigRef.current;
      if (config) {
        localStorage.setItem('dock-config-draft', JSON.stringify(config));
        toast({
          title: 'Draft saved',
          description: 'Your changes have been saved locally',
        });
      }
    }, 30000);

    return () => clearTimeout(timer);
  }, [isDirty, toast]);  // Only depends on isDirty and toast, not currentConfig

  const handleSave = useCallback(async () => {
    logger.debug('Save button clicked', undefined, 'DockConfigEditor');

    if (!currentConfig) {
      logger.error('No current config available', undefined, 'DockConfigEditor');
      toast({
        title: 'Error',
        description: 'No configuration loaded',
        variant: 'destructive'
      });
      return;
    }

    // Validate configuration before saving
    const validation = validateDockConfiguration(currentConfig);
    logger.debug('Validation result', validation, 'DockConfigEditor');

    if (!validation.isValid) {
      logger.warn('Validation failed', validation.errors, 'DockConfigEditor');
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
      logger.info('Saving configuration...', undefined, 'DockConfigEditor');
      logger.info('📝 Configuration to save:', {
        configId: currentConfig.configId,
        name: currentConfig.name,
        menuItemCount: currentConfig.config?.menuItems?.length
      }, 'DockConfigEditor');
      logger.info('📋 MENU ITEMS TO SAVE:', JSON.stringify(currentConfig.config?.menuItems, null, 2), 'DockConfigEditor');

      await saveMutation.mutateAsync({ userId: SYSTEM_USER_ID, config: currentConfig });

      logger.info('Save completed successfully', undefined, 'DockConfigEditor');
      setIsDirty(false);

      // Update the dock with the new configuration (fast, no reload!)
      if (window.fin) {
        try {
          logger.info('Updating dock with new configuration...', undefined, 'DockConfigEditor');
          const dock = await import('@/openfin/platform/openfinDock');

          // Use fast updateConfig - no reload needed!
          await dock.updateConfig({
            menuItems: currentConfig.config?.menuItems || []
          });

          logger.info('✅ Dock updated successfully', {
            menuItemCount: currentConfig.config?.menuItems?.length
          }, 'DockConfigEditor');
        } catch (dockError) {
          logger.error('Failed to update dock', dockError, 'DockConfigEditor');
        }
      }

      toast({
        title: 'Configuration saved successfully',
        description: `Saved "${configName}" with ${menuItemCount} menu item(s). Dock has been reloaded.`,
      });
    } catch (error) {
      logger.error('Save failed in component', error, 'DockConfigEditor');
      const errorMessage = error instanceof Error ? error.message : 'Failed to save configuration';
      toast({
        title: 'Save failed',
        description: `Could not save "${configName}": ${errorMessage}`,
        variant: 'destructive'
      });
    }
  }, [currentConfig, saveMutation, toast]);

  const handleAddMenuItem = useCallback(() => {
    const config = currentConfigRef.current;
    if (!config) return;

    const newItem = createMenuItem();

    // Update local config
    let newMenuItems = [...(config.config.menuItems || [])];

    // PERFORMANCE: Access selectedNode directly from closure instead of dependency
    if (selectedNode) {
      // Add as child
      newMenuItems = newMenuItems.map(menuItem =>
        addChildToItem(menuItem, selectedNode.id, newItem)
      );
    } else {
      // Add to root
      newMenuItems.push(newItem);
    }

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);

    // Select the newly added item
    setSelectedNode(newItem);
  }, []);

  const handleDeleteMenuItem = useCallback(() => {
    const config = currentConfigRef.current;
    // PERFORMANCE: Access selectedNode from closure, not dependency
    if (!config || !selectedNode) return;

    const newMenuItems = deleteMenuItemRecursive(config.config.menuItems || [], selectedNode.id);

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    setSelectedNode(null);
    setIsDirty(true);

    toast({
      title: 'Item deleted',
      description: 'Menu item has been removed',
    });
  }, [toast]);

  const handleDuplicateMenuItem = useCallback(() => {
    const config = currentConfigRef.current;
    if (!config || !selectedNode) return;

    const duplicate = createMenuItem({
      ...selectedNode,
      id: undefined,
      caption: `${selectedNode.caption} (Copy)`
    });

    const newMenuItems = [...(config.config.menuItems || []), duplicate];

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);

    toast({
      title: 'Item duplicated',
      description: 'Menu item has been duplicated',
    });
  }, [selectedNode, toast]);

  const handlePreview = useCallback(async () => {
    if (!currentConfig) return;

    try {
      // Update dock with current configuration
      await openFinDock.updateDock(currentConfig.config);
      await openFinDock.showDock();
      toast({
        title: 'Preview updated',
        description: 'Dock has been updated with your changes',
      });
    } catch (error) {
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

    const exportFileDefaultName = `dock-config-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
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
        setSelectedNode(null);
        toast({
          title: 'Configuration imported',
          description: 'Configuration has been loaded successfully',
        });
      } catch (error) {
        toast({
          title: 'Import failed',
          description: 'Invalid configuration file',
          variant: 'destructive'
        });
      }
    };
    reader.readAsText(file);
  }, [toast]);

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

  const handleUpdateMenuItem = useCallback((id: string, updates: Partial<DockMenuItem>) => {
    const config = currentConfigRef.current;
    if (!config) return;

    const newMenuItems = updateMenuItemRecursive(config.config.menuItems || [], id, updates);

    // PERFORMANCE FIX: Don't update selectedNode on property changes
    // PropertiesPanel gets the item from the tree directly via findMenuItem
    // Only the config needs to be updated - selectedNode stays stable
    // This prevents cascading re-renders in PropertiesPanel

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);
  }, []);  // NO DEPENDENCIES - stable function reference!

  const handleReorderItems = useCallback((sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
    const config = currentConfigRef.current;
    if (!config) return;

    let newMenuItems = [...(config.config.menuItems || [])];

    // Find and remove source item
    const sourceItem = findMenuItem(newMenuItems, sourceId);
    if (!sourceItem) return;

    newMenuItems = deleteMenuItemRecursive(newMenuItems, sourceId);

    // Insert at new position (simplified - just add to root for now)
    if (position === 'inside') {
      newMenuItems = newMenuItems.map(item => addChildToItem(item, targetId, sourceItem));
    } else {
      const targetIndex = newMenuItems.findIndex(item => item.id === targetId);
      if (targetIndex !== -1) {
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        newMenuItems.splice(insertIndex, 0, sourceItem);
      }
    }

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);
  }, []);

  const handleCreateNewConfig = useCallback(() => {
    const newConfig = createDockConfiguration(userId, appId) as unknown as DockConfiguration;
    setCurrentConfig(newConfig);
    setIsDirty(true);
    setSelectedNode(null);
  }, [userId, appId]);

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
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddMenuItem}
              className="h-8"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteMenuItem}
              disabled={!selectedNode}
              className="h-8"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicateMenuItem}
              disabled={!selectedNode}
              className="h-8"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Duplicate
            </Button>
          </div>

          {/* File & Save Actions */}
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-muted-foreground mr-2">Actions:</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreview}
              className="h-8"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              Preview
            </Button>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <label htmlFor="import-file">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8"
              >
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

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8"
            >
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
                  Create a new dock configuration to get started with customizing your dock menu
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
                      selectedId={selectedNode?.id}
                      onSelect={setSelectedNode}
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
                      item={selectedNode}
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
        <React.Suspense fallback={<div>Loading icons...</div>}>
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

