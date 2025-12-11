/**
 * ToolbarCustomizationWizard
 *
 * A comprehensive wizard for customizing toolbar buttons and additional toolbars.
 * Features:
 * - Add/edit/remove custom buttons
 * - Drag-and-drop reordering
 * - Action selection via ActionPickerWizard
 * - Icon selection via IconPickerDialog
 * - Live preview
 * - Multiple toolbar management
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Copy,
  MoreVertical,
  Wand2,
  ChevronUp,
  ChevronDown,
  Save,
} from 'lucide-react';
import { ActionPickerWizard, ActionPickerResult } from './ActionPickerWizard';
import { IconPickerDialog, resolveIcon } from './IconPickerDialog';
import { useActionRegistry } from '@/hooks/useActionRegistry';

// ============================================================================
// Types (local definitions for standalone operation)
// ============================================================================

export type ToolbarZone = 'start' | 'left' | 'center' | 'right' | 'end';
export type ToolbarButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';
export type ToolbarColor = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'cyan' | 'red' | 'yellow';

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
  action: string;
  actionData?: Record<string, unknown>;
  zone?: ToolbarZone;
  variant?: ToolbarButtonVariant;
  showLabel?: boolean;
  disabled?: boolean;
  visible?: boolean;
  menuItems?: ToolbarMenuItem[];
  order?: number;
}

export interface DynamicToolbar {
  id: string;
  name?: string;
  position: 'above' | 'below';
  order?: number;
  color?: ToolbarColor;
  defaultCollapsed?: boolean;
  defaultPinned?: boolean;
  buttons?: ToolbarButton[];
  componentRef?: string;
  componentProps?: Record<string, unknown>;
}

export interface BlotterToolbarConfig {
  showLayoutSelector?: boolean;
  showExportButton?: boolean;
  showFilterBar?: boolean;
  showColumnChooser?: boolean;
  showRefreshButton?: boolean;
  showSettingsButton?: boolean;
  customButtons?: ToolbarButton[];
  additionalToolbars?: DynamicToolbar[];
}

interface EditingButton extends ToolbarButton {
  isNew?: boolean;
}

export interface ToolbarCustomizationWizardProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Current custom buttons (simplified API) */
  buttons?: ToolbarButton[];
  /** Callback when buttons are saved (simplified API) */
  onSave?: (buttons: ToolbarButton[]) => void;
  /** Current toolbar configuration (full API) */
  config?: BlotterToolbarConfig;
  /** Callback when full configuration is saved */
  onSaveConfig?: (config: BlotterToolbarConfig) => void;
}

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(prefix: string = 'btn'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Button Editor Component
// ============================================================================

interface ButtonEditorProps {
  button: EditingButton;
  onChange: (button: EditingButton) => void;
  onClose: () => void;
}

const ButtonEditor: React.FC<ButtonEditorProps> = ({
  button,
  onChange,
  onClose,
}) => {
  const [showActionPicker, setShowActionPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const { getAction } = useActionRegistry();

  const selectedAction = getAction(button.action);
  const Icon = resolveIcon(button.icon);

  const updateButton = (updates: Partial<EditingButton>) => {
    onChange({ ...button, ...updates });
  };

  return (
    <div className="space-y-4 p-4 border-l bg-muted/30 w-80 flex-shrink-0">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          {button.isNew ? 'New Button' : 'Edit Button'}
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>

      <Separator />

      {/* Label */}
      <div className="space-y-1.5">
        <Label htmlFor="btn-label">Label *</Label>
        <Input
          id="btn-label"
          value={button.label}
          onChange={(e) => updateButton({ label: e.target.value })}
          placeholder="Button label"
        />
      </div>

      {/* Icon */}
      <div className="space-y-1.5">
        <Label>Icon</Label>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 p-2 border rounded-md bg-background min-h-[38px]">
            {Icon ? (
              <>
                <Icon className="h-4 w-4" />
                <span className="text-sm truncate">{button.icon}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No icon</span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowIconPicker(true)}
          >
            Choose
          </Button>
        </div>
      </div>

      {/* Action */}
      <div className="space-y-1.5">
        <Label>Action *</Label>
        <div className="flex gap-2">
          <div className="flex-1 p-2 border rounded-md bg-background min-h-[52px]">
            {selectedAction ? (
              <div>
                <div className="font-medium text-sm">{selectedAction.name}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedAction.category}
                </div>
              </div>
            ) : button.action ? (
              <div>
                <div className="font-medium text-sm text-orange-600">
                  Unknown action
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {button.action}
                </div>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                Select an action
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActionPicker(true)}
          >
            <Wand2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Zone */}
      <div className="space-y-1.5">
        <Label htmlFor="btn-zone">Position</Label>
        <Select
          value={button.zone ?? 'right'}
          onValueChange={(value) => updateButton({ zone: value as ToolbarZone })}
        >
          <SelectTrigger id="btn-zone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="start">Start (far left)</SelectItem>
            <SelectItem value="left">Left (after layout)</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right (before settings)</SelectItem>
            <SelectItem value="end">End (far right)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Variant */}
      <div className="space-y-1.5">
        <Label htmlFor="btn-variant">Style</Label>
        <Select
          value={button.variant ?? 'outline'}
          onValueChange={(value) => updateButton({ variant: value as any })}
        >
          <SelectTrigger id="btn-variant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default (filled)</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="ghost">Ghost (minimal)</SelectItem>
            <SelectItem value="destructive">Destructive (red)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Show Label Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="btn-showLabel">Show label text</Label>
        <Switch
          id="btn-showLabel"
          checked={button.showLabel !== false}
          onCheckedChange={(checked) => updateButton({ showLabel: checked })}
        />
      </div>

      {/* Tooltip */}
      <div className="space-y-1.5">
        <Label htmlFor="btn-tooltip">Tooltip</Label>
        <Input
          id="btn-tooltip"
          value={button.tooltip ?? ''}
          onChange={(e) =>
            updateButton({ tooltip: e.target.value || undefined })
          }
          placeholder="Hover text (optional)"
        />
      </div>

      {/* Action Picker */}
      <ActionPickerWizard
        open={showActionPicker}
        onClose={() => setShowActionPicker(false)}
        currentActionId={button.action}
        currentActionData={button.actionData}
        onSelect={(result: ActionPickerResult) => {
          updateButton({
            action: result.actionId,
            actionData: result.actionData,
          });
          setShowActionPicker(false);
        }}
      />

      {/* Icon Picker */}
      <IconPickerDialog
        open={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        currentIcon={button.icon}
        onSelect={(icon) => updateButton({ icon: icon || undefined })}
      />
    </div>
  );
};

// ============================================================================
// Button List Item Component
// ============================================================================

interface ButtonListItemProps {
  button: EditingButton;
  index: number;
  totalCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const ButtonListItem: React.FC<ButtonListItemProps> = ({
  button,
  index,
  totalCount,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
}) => {
  const { getAction } = useActionRegistry();
  const action = getAction(button.action);
  const Icon = resolveIcon(button.icon);

  return (
    <div
      className={`
        flex items-center gap-2 p-2.5 rounded-lg transition-all duration-200
        ${button.visible === false ? 'opacity-50' : ''}
        ${button.isNew ? 'border border-primary/30 border-dashed bg-primary/5' : 'border border-transparent'}
        ${isSelected
          ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 shadow-sm'
          : 'hover:bg-accent/60 hover:border-border/50'
        }
      `}
    >
      {/* Reorder Buttons */}
      <div className="flex flex-col gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={onMoveUp}
          disabled={index === 0}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0"
          onClick={onMoveDown}
          disabled={index === totalCount - 1}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Button Preview */}
      <div
        className="flex-1 flex items-center gap-2 cursor-pointer"
        onClick={onSelect}
      >
        {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{button.label}</div>
          <div className="text-xs text-muted-foreground truncate">
            {action?.name ?? button.action ?? 'No action'}
          </div>
        </div>
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {button.zone ?? 'right'}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={onToggleVisibility}
          title={button.visible === false ? 'Show' : 'Hide'}
        >
          {button.visible === false ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onSelect}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

// ============================================================================
// Toolbar Preview Component
// ============================================================================

interface ToolbarPreviewProps {
  buttons: EditingButton[];
}

const ToolbarPreview: React.FC<ToolbarPreviewProps> = ({ buttons }) => {
  const visibleButtons = buttons.filter((b) => b.visible !== false);

  const byZone = useMemo(() => {
    const zones: Record<ToolbarZone, EditingButton[]> = {
      start: [],
      left: [],
      center: [],
      right: [],
      end: [],
    };
    visibleButtons.forEach((btn) => {
      zones[btn.zone ?? 'right'].push(btn);
    });
    return zones;
  }, [visibleButtons]);

  const renderZone = (zone: ToolbarZone) => {
    return byZone[zone].map((btn) => {
      const Icon = resolveIcon(btn.icon);
      return (
        <Button
          key={btn.id}
          variant={btn.variant ?? 'outline'}
          size="sm"
          className="pointer-events-none h-7 text-xs"
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {btn.showLabel !== false && <span className="ml-1">{btn.label}</span>}
        </Button>
      );
    });
  };

  return (
    <div className="border rounded-lg p-2 bg-muted/30">
      <div className="text-xs text-muted-foreground mb-2">Preview</div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {renderZone('start')}
        <div className="px-1.5 py-0.5 border rounded text-xs text-muted-foreground bg-background">
          Layout
        </div>
        {renderZone('left')}
        <div className="flex-1 flex justify-center gap-1">{renderZone('center')}</div>
        {renderZone('right')}
        <span className="text-xs text-green-600">✓</span>
        {renderZone('end')}
        <div className="px-1.5 py-0.5 border rounded text-xs text-muted-foreground bg-background">
          ⚙
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Wizard Component
// ============================================================================

export const ToolbarCustomizationWizard: React.FC<ToolbarCustomizationWizardProps> = ({
  open,
  onClose,
  buttons: buttonsProp,
  onSave,
  config,
  onSaveConfig,
}) => {
  // State - initialize from buttons prop or config.customButtons
  const [activeTab, setActiveTab] = useState<'main' | 'additional'>('main');
  const [buttons, setButtons] = useState<EditingButton[]>(() =>
    buttonsProp?.map((b: ToolbarButton) => ({ ...b })) ?? config?.customButtons?.map((b: ToolbarButton) => ({ ...b })) ?? []
  );
  const [additionalToolbars, setAdditionalToolbars] = useState<DynamicToolbar[]>(
    () => config?.additionalToolbars?.map((t: DynamicToolbar) => ({ ...t })) ?? []
  );
  const [editingButtonId, setEditingButtonId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Track previous open state to detect open transitions
  const prevOpenRef = React.useRef(open);

  // Sync internal state when dialog opens (not while it's open)
  React.useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    // Only reset when transitioning from closed to open
    if (open && !wasOpen) {
      setButtons(
        buttonsProp?.map((b: ToolbarButton) => ({ ...b })) ??
        config?.customButtons?.map((b: ToolbarButton) => ({ ...b })) ??
        []
      );
      setAdditionalToolbars(
        config?.additionalToolbars?.map((t: DynamicToolbar) => ({ ...t })) ?? []
      );
      setEditingButtonId(null);
      setHasChanges(false);
    }
  }, [open, buttonsProp, config]);

  // Get editing button
  const editingButton = editingButtonId
    ? buttons.find((b) => b.id === editingButtonId) ?? null
    : null;

  // Handlers
  const handleAddButton = useCallback(() => {
    const newButton: EditingButton = {
      id: generateId('btn'),
      label: 'New Button',
      action: '',
      zone: 'right',
      variant: 'outline',
      showLabel: true,
      visible: true,
      isNew: true,
    };
    setButtons((prev) => [...prev, newButton]);
    setEditingButtonId(newButton.id);
    setHasChanges(true);
  }, []);

  const handleUpdateButton = useCallback((updated: EditingButton) => {
    setButtons((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
    setHasChanges(true);
  }, []);

  const handleDeleteButton = useCallback(
    (id: string) => {
      setButtons((prev) => prev.filter((b) => b.id !== id));
      if (editingButtonId === id) {
        setEditingButtonId(null);
      }
      setHasChanges(true);
    },
    [editingButtonId]
  );

  const handleDuplicateButton = useCallback(
    (id: string) => {
      const source = buttons.find((b) => b.id === id);
      if (!source) return;

      const duplicate: EditingButton = {
        ...source,
        id: generateId('btn'),
        label: `${source.label} (copy)`,
        isNew: true,
      };
      setButtons((prev) => [...prev, duplicate]);
      setEditingButtonId(duplicate.id);
      setHasChanges(true);
    },
    [buttons]
  );

  const handleToggleVisibility = useCallback((id: string) => {
    setButtons((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, visible: b.visible === false ? true : false } : b
      )
    );
    setHasChanges(true);
  }, []);

  const handleMoveButton = useCallback((id: string, direction: 'up' | 'down') => {
    setButtons((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index < 0) return prev;

      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;

      const newButtons = [...prev];
      [newButtons[index], newButtons[newIndex]] = [
        newButtons[newIndex],
        newButtons[index],
      ];
      return newButtons;
    });
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(() => {
    // Remove isNew flag and filter buttons without actions
    const cleanButtons = buttons
      .filter((b: EditingButton) => b.action) // Remove buttons without action
      .map(({ isNew, ...btn }: EditingButton) => btn as ToolbarButton);

    // Call simplified onSave if provided
    if (onSave) {
      onSave(cleanButtons);
    }

    // Call full config onSaveConfig if provided
    if (onSaveConfig) {
      const newConfig: BlotterToolbarConfig = {
        ...config,
        customButtons: cleanButtons,
        additionalToolbars,
      };
      onSaveConfig(newConfig);
    }

    onClose();
  }, [buttons, additionalToolbars, config, onSave, onSaveConfig, onClose]);

  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (!confirm('Discard unsaved changes?')) {
        return;
      }
    }
    // Reset state
    setButtons(buttonsProp?.map((b: ToolbarButton) => ({ ...b })) ?? config?.customButtons?.map((b: ToolbarButton) => ({ ...b })) ?? []);
    setAdditionalToolbars(config?.additionalToolbars?.map((t: DynamicToolbar) => ({ ...t })) ?? []);
    setEditingButtonId(null);
    setHasChanges(false);
    onClose();
  }, [hasChanges, buttonsProp, config, onClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 bg-gradient-to-br from-background via-background to-muted/5">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="flex-1 flex flex-col min-h-0"
        >
          {/* Enhanced Tab Bar */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-6 pt-6 pb-3">
            <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/50 border border-border/50 p-1">
              <TabsTrigger
                value="main"
                className="text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <span className="font-medium">Main Toolbar</span>
                <Badge variant="secondary" className="h-5 px-2 text-xs font-medium border-border/50 shadow-sm">
                  {buttons.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="additional"
                className="text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
              >
                <span className="font-medium">Additional Toolbars</span>
                {additionalToolbars.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-2 text-xs font-medium border-border/50 shadow-sm">
                    {additionalToolbars.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Main Toolbar Tab */}
          <TabsContent
            value="main"
            className="flex-1 flex min-h-0 mt-4 px-6 data-[state=inactive]:hidden"
          >
            {/* Button List */}
            <div className="flex-1 flex flex-col min-w-0 pr-4">
              {/* Preview */}
              <ToolbarPreview buttons={buttons} />

              {/* Button List Header */}
              <div className="flex items-center justify-between mt-4 mb-3">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-semibold">Custom Buttons</Label>
                  <Badge variant="outline" className="h-5 px-2 text-xs font-medium">
                    {buttons.length} button{buttons.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  onClick={handleAddButton}
                  className="h-8 px-3 gap-1.5 shadow-sm hover:shadow-md transition-all bg-gradient-to-r from-primary to-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-xs font-medium">Add Button</span>
                </Button>
              </div>

              {/* Button List */}
              <ScrollArea className="flex-1">
                {buttons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center mb-4 shadow-sm">
                      <Plus className="h-8 w-8 text-primary/60" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">No Custom Buttons</h3>
                    <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                      Click the <span className="font-medium text-foreground">Add Button</span> button above to create your first custom toolbar button
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-4">
                    {buttons.map((button, index) => (
                      <ButtonListItem
                        key={button.id}
                        button={button}
                        index={index}
                        totalCount={buttons.length}
                        isSelected={editingButtonId === button.id}
                        onSelect={() => setEditingButtonId(button.id)}
                        onDelete={() => handleDeleteButton(button.id)}
                        onDuplicate={() => handleDuplicateButton(button.id)}
                        onToggleVisibility={() =>
                          handleToggleVisibility(button.id)
                        }
                        onMoveUp={() => handleMoveButton(button.id, 'up')}
                        onMoveDown={() => handleMoveButton(button.id, 'down')}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Editor Panel */}
            {editingButton && (
              <ButtonEditor
                button={editingButton}
                onChange={handleUpdateButton}
                onClose={() => setEditingButtonId(null)}
              />
            )}
          </TabsContent>

          {/* Additional Toolbars Tab */}
          <TabsContent
            value="additional"
            className="flex-1 mt-4 px-6 data-[state=inactive]:hidden"
          >
            <div className="text-center py-12 text-muted-foreground">
              <p>Additional toolbars configuration coming soon.</p>
              <p className="text-sm mt-1">
                This will allow you to add secondary toolbars with custom buttons.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {/* Enhanced Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/20 shadow-inner">
          <div className="flex items-center gap-2 mr-auto">
            {hasChanges && (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/20 border border-amber-500/30">
                  <div className="w-2 h-2 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
                </div>
                <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                  Unsaved changes
                </span>
              </div>
            )}
          </div>
          <Button
            variant="outline"
            onClick={handleClose}
            className="h-9 px-4 shadow-sm hover:shadow transition-all"
          >
            <span className="text-sm font-medium">Cancel</span>
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="h-9 px-5 shadow-sm hover:shadow-md transition-all bg-gradient-to-r from-primary to-primary/90"
          >
            <Save className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">Save Changes</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ToolbarCustomizationWizard;
