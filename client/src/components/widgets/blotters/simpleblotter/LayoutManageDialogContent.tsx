/**
 * LayoutManageDialogContent Component
 *
 * Reusable content for managing SimpleBlotter layouts.
 * Can be used in both inline Dialog and OpenFin window contexts.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Star,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UnifiedConfig, SimpleBlotterLayoutConfig } from '@stern/shared-types';

export interface LayoutInfo {
  config: SimpleBlotterLayoutConfig;
  unified: UnifiedConfig;
}

export interface LayoutManageDialogContentProps {
  /** List of available layouts */
  layouts: LayoutInfo[];
  /** ID of the default layout */
  defaultLayoutId?: string;
  /** Current blotter config ID */
  blotterConfigId: string;
  /** Component type from blotter config */
  componentType: string;
  /** Component subtype from blotter config */
  componentSubType?: string;
  /** Whether operations are in progress */
  isLoading?: boolean;
  /** Callback to set a layout as default */
  onSetDefault: (layoutId: string) => void;
  /** Callback to delete a layout */
  onDelete: (layoutId: string) => void;
  /** Callback to rename a layout */
  onRename: (layoutId: string, newName: string) => void;
  /** Callback to duplicate a layout */
  onDuplicate: (layoutId: string, newName: string) => void;
  /** Callback when component subtype changes */
  onComponentSubTypeChange?: (newSubType: string) => void;
  /** Callback to close the dialog */
  onClose?: () => void;
}

/**
 * LayoutItem Component
 *
 * Individual layout row with edit/delete actions
 */
interface LayoutItemProps {
  layout: LayoutInfo;
  isDefault: boolean;
  isEditing: boolean;
  editedName: string;
  onSetDefault: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onNameChange: (name: string) => void;
}

const LayoutItem: React.FC<LayoutItemProps> = ({
  layout,
  isDefault,
  isEditing,
  editedName,
  onSetDefault,
  onDelete,
  onDuplicate,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onNameChange,
}) => {
  return (
    <div
      className={`
        flex items-center gap-3 p-3 rounded-md border
        ${isDefault ? 'bg-yellow-50 border-yellow-200' : 'bg-background'}
        hover:bg-muted/50 transition-colors
      `}
    >
      {/* Default Star Icon */}
      <button
        onClick={onSetDefault}
        className={`
          flex-shrink-0 transition-colors
          ${isDefault ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}
        `}
        title={isDefault ? 'Default layout' : 'Set as default'}
      >
        <Star
          className={`h-5 w-5 ${isDefault ? 'fill-yellow-500' : ''}`}
        />
      </button>

      {/* Layout Name (editable) */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            value={editedName}
            onChange={(e) => onNameChange(e.target.value)}
            className="h-8"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit();
              if (e.key === 'Escape') onCancelEdit();
            }}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">
              {layout.unified.name}
            </span>
            {isDefault && (
              <span className="text-xs text-yellow-600 font-medium">
                (Default)
              </span>
            )}
          </div>
        )}
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          ID: {layout.unified.configId}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {isEditing ? (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onSaveEdit}
              title="Save"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0"
              onClick={onCancelEdit}
              title="Cancel"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartEdit}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

/**
 * LayoutManageDialogContent Component
 */
export const LayoutManageDialogContent: React.FC<LayoutManageDialogContentProps> = ({
  layouts,
  defaultLayoutId,
  blotterConfigId,
  componentType,
  componentSubType,
  isLoading = false,
  onSetDefault,
  onDelete,
  onRename,
  onDuplicate,
  onComponentSubTypeChange,
  onClose,
}) => {
  // Edit state
  const [editingLayoutId, setEditingLayoutId] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');

  // Delete confirmation state
  const [deleteConfirmLayout, setDeleteConfirmLayout] = useState<LayoutInfo | null>(null);

  // Duplicate dialog state
  const [duplicateLayout, setDuplicateLayout] = useState<LayoutInfo | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  // Component SubType edit state
  const [isEditingSubType, setIsEditingSubType] = useState(false);
  const [editedSubType, setEditedSubType] = useState(componentSubType || '');

  // Handlers
  const handleStartEdit = (layout: LayoutInfo) => {
    setEditingLayoutId(layout.unified.configId);
    setEditedName(layout.unified.name);
  };

  const handleCancelEdit = () => {
    setEditingLayoutId(null);
    setEditedName('');
  };

  const handleSaveEdit = () => {
    if (editingLayoutId && editedName.trim()) {
      onRename(editingLayoutId, editedName.trim());
      setEditingLayoutId(null);
      setEditedName('');
    }
  };

  const handleDeleteClick = (layout: LayoutInfo) => {
    setDeleteConfirmLayout(layout);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmLayout) {
      onDelete(deleteConfirmLayout.unified.configId);
      setDeleteConfirmLayout(null);
    }
  };

  const handleDuplicateClick = (layout: LayoutInfo) => {
    setDuplicateLayout(layout);
    setDuplicateName(`${layout.unified.name} (Copy)`);
  };

  const handleDuplicateConfirm = () => {
    if (duplicateLayout && duplicateName.trim()) {
      onDuplicate(duplicateLayout.unified.configId, duplicateName.trim());
      setDuplicateLayout(null);
      setDuplicateName('');
    }
  };

  const handleSaveSubType = () => {
    if (onComponentSubTypeChange && editedSubType.trim()) {
      onComponentSubTypeChange(editedSubType.trim());
      setIsEditingSubType(false);
    }
  };

  const handleCancelSubType = () => {
    setEditedSubType(componentSubType || '');
    setIsEditingSubType(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Blotter Config Info Section */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-3">Blotter Configuration</h4>
          <div className="grid gap-3">
            {/* Config ID (read-only) */}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Config ID</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-mono text-xs break-all">
                {blotterConfigId}
              </div>
            </div>

            {/* Component Type (read-only) */}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Component Type</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm">
                {componentType}
              </div>
            </div>

            {/* Component SubType (editable) */}
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Component SubType</Label>
              {isEditingSubType ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedSubType}
                    onChange={(e) => setEditedSubType(e.target.value)}
                    className="flex-1"
                    placeholder="Enter component subtype..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveSubType();
                      if (e.key === 'Escape') handleCancelSubType();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveSubType}
                    title="Save"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelSubType}
                    title="Cancel"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-2 bg-muted rounded-md text-sm">
                    {componentSubType || <span className="text-muted-foreground italic">Not set</span>}
                  </div>
                  {onComponentSubTypeChange && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingSubType(true)}
                      title="Edit SubType"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Layouts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">
            Layouts ({layouts.length})
          </h4>
        </div>

        {/* Layouts List */}
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {layouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No layouts available
              </div>
            ) : (
              layouts.map((layout) => (
                <LayoutItem
                  key={layout.unified.configId}
                  layout={layout}
                  isDefault={layout.unified.configId === defaultLayoutId}
                  isEditing={editingLayoutId === layout.unified.configId}
                  editedName={editedName}
                  onSetDefault={() => onSetDefault(layout.unified.configId)}
                  onDelete={() => handleDeleteClick(layout)}
                  onDuplicate={() => handleDuplicateClick(layout)}
                  onStartEdit={() => handleStartEdit(layout)}
                  onCancelEdit={handleCancelEdit}
                  onSaveEdit={handleSaveEdit}
                  onNameChange={setEditedName}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog
        open={deleteConfirmLayout !== null}
        onOpenChange={(open) => !open && setDeleteConfirmLayout(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the layout "{deleteConfirmLayout?.unified.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Dialog */}
      <Dialog
        open={duplicateLayout !== null}
        onOpenChange={(open) => !open && setDuplicateLayout(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Layout</DialogTitle>
            <DialogDescription>
              Enter a name for the duplicated layout
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="duplicate-name">Layout Name</Label>
              <Input
                id="duplicate-name"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                placeholder="Enter layout name..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && duplicateName.trim()) {
                    handleDuplicateConfirm();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDuplicateLayout(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDuplicateConfirm}
              disabled={!duplicateName.trim()}
            >
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LayoutManageDialogContent;
