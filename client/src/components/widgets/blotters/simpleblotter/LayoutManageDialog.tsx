/**
 * LayoutManageDialog Component
 *
 * Dialog for managing layouts - rename, delete, duplicate, set default.
 * Also displays blotter config info (configId, componentType, componentSubType).
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Star,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  Loader2,
  Layout,
  Save
} from 'lucide-react';
import { UnifiedConfig, SimpleBlotterLayoutConfig } from '@stern/shared-types';
import { cn } from '@/lib/utils';

export interface LayoutInfo {
  config: SimpleBlotterLayoutConfig;
  unified: UnifiedConfig;
}

export interface BlotterInfo {
  configId: string;
  componentType: string;
  componentSubType?: string;
}

export interface LayoutManageDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** List of available layouts */
  layouts: LayoutInfo[];
  /** ID of the default layout */
  defaultLayoutId?: string;
  /** Currently selected layout ID */
  selectedLayoutId?: string;
  /** Blotter configuration info */
  blotterInfo?: BlotterInfo;
  /** Callback to rename a layout */
  onRename: (layoutId: string, newName: string) => Promise<void>;
  /** Callback to delete a layout */
  onDelete: (layoutId: string) => Promise<void>;
  /** Callback to duplicate a layout */
  onDuplicate: (layoutId: string, newName: string) => Promise<void>;
  /** Callback to set a layout as default */
  onSetDefault: (layoutId: string) => Promise<void>;
  /** Callback when a layout is selected */
  onSelect?: (layoutId: string) => void;
  /** Callback to save componentSubType */
  onSaveComponentSubType?: (subType: string) => Promise<void>;
}

interface LayoutItemProps {
  layout: LayoutInfo;
  isDefault: boolean;
  isSelected: boolean;
  isEditing: boolean;
  editName: string;
  isProcessing: boolean;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onEditNameChange: (name: string) => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSelect: () => void;
}

const LayoutItem: React.FC<LayoutItemProps> = ({
  layout,
  isDefault,
  isSelected,
  isEditing,
  editName,
  isProcessing,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditNameChange,
  onSetDefault,
  onDuplicate,
  onDelete,
  onSelect,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEditSave();
    } else if (e.key === 'Escape') {
      onEditCancel();
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors hover:bg-accent/50',
        isSelected && 'bg-accent border-primary'
      )}
      onClick={() => !isEditing && onSelect()}
    >
      {/* Layout Icon */}
      <Layout className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      {/* Name / Edit Input */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Input
              value={editName}
              onChange={(e) => onEditNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-6 text-xs"
              autoFocus
              disabled={isProcessing}
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onEditSave();
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3 text-green-600" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onEditCancel();
              }}
              disabled={isProcessing}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate">{layout.unified.name}</span>
              {isDefault && (
                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
              )}
            </div>
            <span
              className="text-[10px] text-muted-foreground truncate font-mono leading-tight"
              title={layout.unified.configId}
            >
              {layout.unified.configId}
            </span>
          </div>
        )}
      </div>

      {/* Actions Menu */}
      {!isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onEditStart();
            }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}>
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            {!isDefault && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onSetDefault();
              }}>
                <Star className="h-4 w-4 mr-2" />
                Set as Default
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export const LayoutManageDialog: React.FC<LayoutManageDialogProps> = ({
  open,
  onClose,
  layouts,
  defaultLayoutId,
  selectedLayoutId,
  blotterInfo,
  onRename,
  onDelete,
  onDuplicate,
  onSetDefault,
  onSelect,
  onSaveComponentSubType,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicateDialogId, setDuplicateDialogId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  // ComponentSubType editing state
  const [editedSubType, setEditedSubType] = useState(blotterInfo?.componentSubType || '');
  const [isSubTypeModified, setIsSubTypeModified] = useState(false);
  const [isSavingSubType, setIsSavingSubType] = useState(false);

  // Track if we've initialized for this dialog open
  const [lastOpenState, setLastOpenState] = useState(false);

  // Reset subType state only when dialog opens (transitions from closed to open)
  // Use primitive values instead of object reference to avoid resetting on every render
  useEffect(() => {
    // Only reset when dialog transitions from closed to open
    if (open && !lastOpenState) {
      setEditedSubType(blotterInfo?.componentSubType || '');
      setIsSubTypeModified(false);
    }
    setLastOpenState(open);
  }, [open, blotterInfo?.componentSubType, lastOpenState]);

  const handleSubTypeChange = (value: string) => {
    setEditedSubType(value);
    setIsSubTypeModified(value !== (blotterInfo?.componentSubType || ''));
  };

  const handleSaveSubType = async () => {
    if (!onSaveComponentSubType || !isSubTypeModified) return;

    setIsSavingSubType(true);
    try {
      await onSaveComponentSubType(editedSubType);
      setIsSubTypeModified(false);
    } finally {
      setIsSavingSubType(false);
    }
  };

  const handleEditStart = (layout: LayoutInfo) => {
    setEditingId(layout.unified.configId);
    setEditName(layout.unified.name);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleEditSave = async () => {
    if (!editingId || !editName.trim()) return;

    setIsProcessing(true);
    try {
      await onRename(editingId, editName.trim());
      setEditingId(null);
      setEditName('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;

    setIsProcessing(true);
    try {
      await onDelete(deleteConfirmId);
      setDeleteConfirmId(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDuplicate = async () => {
    if (!duplicateDialogId || !duplicateName.trim()) return;

    setIsProcessing(true);
    try {
      await onDuplicate(duplicateDialogId, duplicateName.trim());
      setDuplicateDialogId(null);
      setDuplicateName('');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetDefault = async (layoutId: string) => {
    setIsProcessing(true);
    try {
      await onSetDefault(layoutId);
    } finally {
      setIsProcessing(false);
    }
  };

  const openDuplicateDialog = (layout: LayoutInfo) => {
    setDuplicateDialogId(layout.unified.configId);
    setDuplicateName(`${layout.unified.name} (Copy)`);
  };

  const layoutToDelete = layouts.find(l => l.unified.configId === deleteConfirmId);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-[520px] h-[520px] flex flex-col gap-4 p-5 overflow-hidden">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-lg font-semibold">Manage Layouts</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              View, edit, and organize your saved layouts.
            </DialogDescription>
          </DialogHeader>

          {/* Blotter Config Info Section - Elegant Design */}
          {blotterInfo && (
            <div className="flex-shrink-0 rounded-lg border bg-gradient-to-br from-muted/40 to-muted/20 p-4">
              {/* Config ID - Prominent display */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <Layout className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Config ID</p>
                  <p className="font-mono text-xs truncate" title={blotterInfo.configId}>
                    {blotterInfo.configId}
                  </p>
                </div>
              </div>

              {/* Type badges and SubType input */}
              <div className="flex items-center gap-3">
                {/* Component Type Badge */}
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Type</span>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {blotterInfo.componentType}
                  </span>
                </div>

                {/* SubType - Editable */}
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">SubType</span>
                  <div className="flex gap-1.5">
                    <Input
                      id="componentSubType"
                      value={editedSubType}
                      onChange={(e) => handleSubTypeChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="e.g., trades, positions"
                      className="h-7 text-xs flex-1 px-2.5 bg-background/50"
                      autoComplete="off"
                      disabled={isSavingSubType}
                    />
                    <Button
                      size="sm"
                      variant={isSubTypeModified ? 'default' : 'ghost'}
                      className={cn(
                        "h-7 w-7 p-0",
                        isSubTypeModified && "bg-primary hover:bg-primary/90"
                      )}
                      onClick={handleSaveSubType}
                      disabled={!isSubTypeModified || isSavingSubType || !onSaveComponentSubType}
                    >
                      {isSavingSubType ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Layouts Section Header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <Label className="text-sm font-medium">
              Layouts ({layouts.length})
            </Label>
          </div>

          {/* Layouts List - Scrollable, takes remaining space */}
          <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
            {layouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground border border-dashed rounded-md">
                <Layout className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-medium">No layouts saved yet.</p>
                <p className="text-xs mt-1">
                  Save your current grid configuration to create a layout.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 pb-1">
                {layouts.map((layout) => (
                  <LayoutItem
                    key={layout.unified.configId}
                    layout={layout}
                    isDefault={layout.unified.configId === defaultLayoutId}
                    isSelected={layout.unified.configId === selectedLayoutId}
                    isEditing={editingId === layout.unified.configId}
                    editName={editName}
                    isProcessing={isProcessing && editingId === layout.unified.configId}
                    onEditStart={() => handleEditStart(layout)}
                    onEditCancel={handleEditCancel}
                    onEditSave={handleEditSave}
                    onEditNameChange={setEditName}
                    onSetDefault={() => handleSetDefault(layout.unified.configId)}
                    onDuplicate={() => openDuplicateDialog(layout)}
                    onDelete={() => setDeleteConfirmId(layout.unified.configId)}
                    onSelect={() => {
                      onSelect?.(layout.unified.configId);
                      onClose();
                    }}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(isOpen) => !isOpen && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{layoutToDelete?.unified.name}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Dialog */}
      <Dialog
        open={!!duplicateDialogId}
        onOpenChange={(isOpen) => !isOpen && setDuplicateDialogId(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Duplicate Layout</DialogTitle>
            <DialogDescription>
              Enter a name for the duplicated layout.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Input
              value={duplicateName}
              onChange={(e) => setDuplicateName(e.target.value)}
              placeholder="Enter layout name..."
              autoFocus
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isProcessing) {
                  handleDuplicate();
                }
              }}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDuplicateDialogId(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDuplicate}
              disabled={isProcessing || !duplicateName.trim()}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Duplicating...
                </>
              ) : (
                'Duplicate'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LayoutManageDialog;
