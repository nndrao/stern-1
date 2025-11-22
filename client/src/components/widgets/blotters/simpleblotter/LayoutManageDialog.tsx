/**
 * LayoutManageDialog Component
 *
 * Dialog for managing layouts - rename, delete, duplicate, set default.
 */

import React, { useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Layout
} from 'lucide-react';
import { UnifiedConfig, SimpleBlotterLayoutConfig } from '@stern/shared-types';
import { cn } from '@/lib/utils';

export interface LayoutInfo {
  config: SimpleBlotterLayoutConfig;
  unified: UnifiedConfig;
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
        'flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 cursor-pointer group',
        isSelected && 'bg-accent'
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
              className="h-7 text-sm"
              autoFocus
              disabled={isProcessing}
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onEditSave();
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-green-600" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onEditCancel();
              }}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm truncate">{layout.unified.name}</span>
            {isDefault && (
              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
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
              className="h-7 w-7 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
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
  onRename,
  onDelete,
  onDuplicate,
  onSetDefault,
  onSelect,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [duplicateDialogId, setDuplicateDialogId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Manage Layouts</DialogTitle>
            <DialogDescription>
              View, edit, and organize your saved layouts.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            {layouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Layout className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No layouts saved yet.</p>
                <p className="text-sm mt-1">
                  Save your current grid configuration to create a layout.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
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
