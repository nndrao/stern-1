/**
 * DockConfigEditor - Modern & Sophisticated Design
 *
 * Design principles:
 * - Clean, modern interface with refined spacing and visual hierarchy
 * - Professional gradient accents and subtle shadows
 * - Smooth transitions and micro-interactions
 * - Enhanced visual feedback for all states (loading, error, dirty, validation)
 * - Card-based layout with proper depth and elevation
 * - Intuitive iconography and color coding
 * - Responsive design with contextual actions
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Save,
  Download,
  Upload,
  Eye,
  Plus,
  FolderTree,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/ui/use-toast';
import { useDockConfig, useSaveDockConfig } from '@/hooks/api/useDockConfigQueries';
import { DockMenuItem, DockApplicationsMenuItemsConfig } from '@stern/openfin-platform';
import { TreeView } from '@/components/provider/TreeView';
import { PropertiesPanel } from '@/components/provider/PropertiesPanel';
import { IconPicker } from '@/components/provider/editors/IconPicker';
import { findMenuItem, updateMenuItem, deleteMenuItem, addChildToParent, duplicateMenuItem } from '@/utils/dock/treeUtils';

const SYSTEM_USER_ID = 'System';

export default function DockConfigEditor() {
  const { toast } = useToast();

  // Refs for stable callbacks
  const currentConfigRef = useRef<DockApplicationsMenuItemsConfig | null>(null);

  // State
  const [currentConfig, setCurrentConfig] = useState<DockApplicationsMenuItemsConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [iconPickerCallback, setIconPickerCallback] = useState<((icon: string) => void) | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Queries
  const { data: loadedConfig, isLoading, error } = useDockConfig(SYSTEM_USER_ID);
  const saveMutation = useSaveDockConfig();

  // Sync loaded config
  useEffect(() => {
    if (loadedConfig) {
      setCurrentConfig(loadedConfig);
      currentConfigRef.current = loadedConfig;
      setIsDirty(false);
      setValidationErrors([]);
    }
  }, [loadedConfig]);

  // Update ref when config changes
  useEffect(() => {
    currentConfigRef.current = currentConfig;
  }, [currentConfig]);

  // Get selected item
  const selectedItem = useMemo(() => {
    if (!selectedId || !currentConfig?.config?.menuItems) return null;
    return findMenuItem(currentConfig.config.menuItems, selectedId);
  }, [selectedId, currentConfig]);

  // Validation
  const validateConfig = useCallback(() => {
    if (!currentConfig) return false;

    const errors: string[] = [];

    // Simple validation - check required fields
    if (!currentConfig.config?.menuItems) {
      errors.push('No menu items configured');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [currentConfig]);

  // Handlers
  const handleUpdateMenuItem = useCallback((id: string, updates: Partial<DockMenuItem>) => {
    const config = currentConfigRef.current;
    if (!config) return;

    const menuItems = config.config?.menuItems || [];
    const newMenuItems = updateMenuItem(menuItems, id, updates);

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    setIsDirty(true);
  }, []);

  const handleAddMenuItem = useCallback((parentId?: string) => {
    const config = currentConfigRef.current;
    if (!config) return;

    const newItem: DockMenuItem = {
      id: `menu-${Date.now()}`,
      caption: 'New Menu Item',
      url: '',
      icon: '/icons/app.svg',
      order: 0,
      openMode: 'window'
    };

    const menuItems = config.config?.menuItems || [];
    const newMenuItems = parentId
      ? addChildToParent(menuItems, parentId, newItem)
      : [...menuItems, newItem];

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    setSelectedId(newItem.id);
    setIsDirty(true);
  }, []);

  const handleDeleteMenuItem = useCallback((id?: string) => {
    const config = currentConfigRef.current;
    const targetId = id || selectedId;
    if (!config || !targetId) return;

    const menuItems = config.config?.menuItems || [];
    const newMenuItems = deleteMenuItem(menuItems, targetId);

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    if (selectedId === targetId) {
      setSelectedId(null);
    }
    setIsDirty(true);
  }, [selectedId]);

  const handleDuplicateMenuItem = useCallback((id?: string) => {
    const config = currentConfigRef.current;
    if (!config) return;

    const targetId = id || selectedId;
    if (!targetId) return;

    const menuItems = config.config?.menuItems || [];
    const itemToDuplicate = findMenuItem(menuItems, targetId);
    if (!itemToDuplicate) return;

    // Create a copy with a new ID
    const newItem: DockMenuItem = {
      ...itemToDuplicate,
      id: `menu-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      caption: `${itemToDuplicate.caption} (Copy)`
    };

    const newMenuItems = duplicateMenuItem(menuItems, newItem);

    setCurrentConfig({
      ...config,
      config: {
        ...config.config,
        menuItems: newMenuItems
      }
    });
    setSelectedId(newItem.id);
    setIsDirty(true);
  }, [selectedId]);

  const handleSave = useCallback(async () => {
    if (!currentConfig) return;

    // Validate first
    if (!validateConfig()) {
      toast({
        title: 'Validation Failed',
        description: 'Please fix the errors before saving',
        variant: 'destructive'
      });
      return;
    }

    try {
      await saveMutation.mutateAsync({
        userId: SYSTEM_USER_ID,
        config: currentConfig as any
      });
      setIsDirty(false);
      setValidationErrors([]);

      // Reload the dock from database to apply changes
      if (window.fin) {
        try {
          // Dynamically import the dock module to call the custom action
          const { dockGetCustomActions } = await import('@/openfin/platform/openfinDock');
          const customActions = dockGetCustomActions();
          const reloadAction = customActions['reload-dock-from-db'];

          if (reloadAction) {
            await reloadAction({} as any);
            toast({
              title: 'Dock Updated',
              description: 'Menu changes have been applied to the dock',
            });
          } else {
            throw new Error('Reload action not found');
          }
        } catch (error) {
          console.error('Failed to reload dock:', error);
          toast({
            title: 'Dock Reload Failed',
            description: 'Changes saved but dock menu not updated. Try restarting OpenFin.',
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      // Error toast handled by mutation
    }
  }, [currentConfig, saveMutation, validateConfig, toast]);

  const handleExport = useCallback(() => {
    if (!currentConfig) return;

    const dataStr = JSON.stringify(currentConfig, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dock-config-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Configuration Exported',
      description: 'Configuration saved to file'
    });
  }, [currentConfig, toast]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        setCurrentConfig(imported);
        setIsDirty(true);
        toast({
          title: 'Configuration Imported',
          description: 'Configuration loaded from file'
        });
      } catch (error) {
        toast({
          title: 'Import Failed',
          description: 'Invalid configuration file',
          variant: 'destructive'
        });
      }
    };
    input.click();
  }, [toast]);

  const handleIconSelect = useCallback((callback: (icon: string) => void) => {
    setIconPickerCallback(() => callback);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-background to-muted/20">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Loading Configuration</h3>
            <p className="text-sm text-muted-foreground">Please wait...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-background to-muted/20">
        <Card className="w-[400px]">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Failed to Load Configuration</h3>
                <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
              </div>
              <Button onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const menuItems = currentConfig?.config?.menuItems || [];
  const itemCount = menuItems.length;

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/5">
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden p-5 gap-5">
        {/* Left Panel - Tree */}
        <Card className="w-[400px] flex flex-col shadow-lg border-border/50 bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-3.5 space-y-2 bg-gradient-to-b from-muted/30 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
                  <FolderTree className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold">
                    Menu Structure
                  </CardTitle>
                  <Badge variant="secondary" className="h-5 px-2 text-xs font-medium border-border/50 shadow-sm">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
              </div>
              <Button
                onClick={() => handleAddMenuItem()}
                variant="outline"
                size="sm"
                className="h-8 px-3 shadow-sm hover:shadow-md transition-all border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span className="text-xs font-medium">Add</span>
              </Button>
            </div>
          </CardHeader>
          <Separator className="bg-border/50" />
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <div className="p-3">
                <TreeView
                  items={menuItems}
                  selectedId={selectedId}
                  onSelect={(item) => setSelectedId(item?.id || null)}
                  onUpdate={handleUpdateMenuItem}
                  onAdd={handleAddMenuItem}
                  onDelete={handleDeleteMenuItem}
                  onDuplicate={handleDuplicateMenuItem}
                />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel - Properties */}
        <Card className="flex-1 flex flex-col shadow-lg border-border/50 bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-3.5 space-y-2 bg-gradient-to-b from-muted/30 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold truncate max-w-[250px]">
                    {selectedItem ? selectedItem.caption || 'Unnamed Item' : 'Properties'}
                  </CardTitle>
                  {isDirty && (
                    <Badge className="h-5 px-2 text-xs bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 shadow-sm">
                      Unsaved
                    </Badge>
                  )}
                  {validationErrors.length > 0 && (
                    <Badge variant="destructive" className="h-5 px-2 text-xs shadow-sm">
                      {validationErrors.length} {validationErrors.length === 1 ? 'error' : 'errors'}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleImport}
                    className="h-8 w-8 p-0 hover:bg-accent/80 transition-all"
                    title="Import configuration"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExport}
                    disabled={!currentConfig}
                    className="h-8 w-8 p-0 hover:bg-accent/80 transition-all"
                    title="Export configuration"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <Separator orientation="vertical" className="h-5 bg-border/50" />
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || saveMutation.isPending}
                  size="sm"
                  className="h-8 px-4 gap-2 shadow-sm hover:shadow-md transition-all bg-gradient-to-r from-primary to-primary/90"
                >
                  {saveMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-xs font-medium">Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span className="text-xs font-medium">Save Changes</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <Separator className="bg-border/50" />
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              <PropertiesPanel
                item={selectedItem}
                onUpdate={handleUpdateMenuItem}
                onIconSelect={handleIconSelect}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="border-t border-destructive/20 bg-gradient-to-r from-destructive/5 to-destructive/10 px-6 py-4 shadow-inner">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/10 border border-destructive/20 flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-destructive mb-2">
                Validation {validationErrors.length === 1 ? 'Error' : 'Errors'}
              </h4>
              <ul className="space-y-1.5">
                {validationErrors.map((error, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive/60 flex-shrink-0" />
                    <span className="text-xs text-destructive/90">{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Icon Picker Dialog */}
      <IconPicker
        open={!!iconPickerCallback}
        onOpenChange={(open) => {
          if (!open) setIconPickerCallback(null);
        }}
        onSelect={(icon: string) => {
          if (iconPickerCallback) {
            iconPickerCallback(icon);
            setIconPickerCallback(null);
          }
        }}
      />
    </div>
  );
}
