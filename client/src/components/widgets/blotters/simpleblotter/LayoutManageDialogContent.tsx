/**
 * LayoutManageDialogContent Component
 *
 * Reusable content for managing SimpleBlotter layouts.
 * Can be used in both inline Dialog and OpenFin window contexts.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Layout, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LayoutItem } from './layout-dialogs';
import type { LayoutManageDialogContentProps, LayoutInfo } from './layout-dialogs';

// Re-export types for convenience
export type { LayoutInfo, LayoutManageDialogContentProps } from './layout-dialogs';

/**
 * LayoutManageDialogContent Component
 *
 * Displays blotter config info and a list of layouts with management actions.
 */
export const LayoutManageDialogContent: React.FC<LayoutManageDialogContentProps> = ({
  layouts,
  defaultLayoutId,
  selectedLayoutId,
  blotterInfo,
  isLoading = false,
  onRename,
  onDelete,
  onDuplicate,
  onSetDefault,
  onSelect,
  onSaveComponentSubType,
  onClose,
}) => {
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Duplicate dialog state
  const [duplicateDialogId, setDuplicateDialogId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState('');

  // ComponentSubType editing state
  const [editedSubType, setEditedSubType] = useState(blotterInfo?.componentSubType || '');
  const [isSubTypeModified, setIsSubTypeModified] = useState(false);
  const [isSavingSubType, setIsSavingSubType] = useState(false);

  // Reset subType when blotterInfo changes (e.g., dialog reopens)
  useEffect(() => {
    setEditedSubType(blotterInfo?.componentSubType || '');
    setIsSubTypeModified(false);
  }, [blotterInfo?.componentSubType]);

  // Handlers for subType editing
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

  // Handlers for layout editing
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

  // Delete handlers
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

  // Duplicate handlers
  const openDuplicateDialog = (layout: LayoutInfo) => {
    setDuplicateDialogId(layout.unified.configId);
    setDuplicateName(`${layout.unified.name} (Copy)`);
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

  // Set default handler
  const handleSetDefault = async (layoutId: string) => {
    setIsProcessing(true);
    try {
      await onSetDefault(layoutId);
    } finally {
      setIsProcessing(false);
    }
  };

  // Layout selection handler
  const handleSelect = (layout: LayoutInfo) => {
    if (onSelect) {
      onSelect(layout.unified.configId);
    }
    if (onClose) {
      onClose();
    }
  };

  const layoutToDelete = layouts.find((l) => l.unified.configId === deleteConfirmId);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Blotter Config Info Section */}
      {blotterInfo && (
        <div className="flex-shrink-0 rounded-lg border bg-gradient-to-br from-muted/40 to-muted/20 p-4">
          {/* Config ID - Prominent display */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <Layout className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Config ID
              </p>
              <p className="font-mono text-xs truncate" title={blotterInfo.configId}>
                {blotterInfo.configId}
              </p>
            </div>
          </div>

          {/* Type badges and SubType input */}
          <div className="flex items-center gap-3">
            {/* Component Type Badge */}
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">
                Type
              </span>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {blotterInfo.componentType}
              </span>
            </div>

            {/* SubType - Editable */}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">
                SubType
              </span>
              <div className="flex gap-1.5">
                <Input
                  value={editedSubType}
                  onChange={(e) => handleSubTypeChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="e.g., trades, positions"
                  className="h-7 text-xs flex-1 px-2.5 bg-background/50"
                  autoComplete="off"
                  disabled={isSavingSubType || !onSaveComponentSubType}
                />
                {onSaveComponentSubType && (
                  <Button
                    size="sm"
                    variant={isSubTypeModified ? 'default' : 'ghost'}
                    className={cn(
                      'h-7 w-7 p-0',
                      isSubTypeModified && 'bg-primary hover:bg-primary/90'
                    )}
                    onClick={handleSaveSubType}
                    disabled={!isSubTypeModified || isSavingSubType}
                  >
                    {isSavingSubType ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Layouts Section Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <Label className="text-sm font-medium">Layouts ({layouts.length})</Label>
      </div>

      {/* Layouts List - Scrollable */}
      <ScrollArea className="flex-1 min-h-0 -mx-1 px-1">
        {layouts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed rounded-md">
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
                onSelect={onSelect ? () => handleSelect(layout) : undefined}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Layout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{layoutToDelete?.unified.name}"? This action
              cannot be undone.
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
        onOpenChange={(open) => !open && setDuplicateDialogId(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Duplicate Layout</DialogTitle>
            <DialogDescription>Enter a name for the duplicated layout.</DialogDescription>
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
            <Button onClick={handleDuplicate} disabled={isProcessing || !duplicateName.trim()}>
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
    </div>
  );
};

export default LayoutManageDialogContent;
