/**
 * LayoutManageDialog Component
 *
 * Dialog wrapper for managing layouts.
 * This is a thin wrapper around LayoutManageDialogContent that adds the Dialog shell.
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LayoutManageDialogContent } from './LayoutManageDialogContent';
import type { LayoutManageDialogProps } from './layout-dialogs';

// Re-export types for convenience
export type { LayoutInfo, BlotterInfo, LayoutManageDialogProps } from './layout-dialogs';

/**
 * LayoutManageDialog - Inline dialog for managing layouts
 *
 * Wraps LayoutManageDialogContent in a shadcn Dialog component.
 * For OpenFin windows, use LayoutManageDialogContent directly.
 */
export const LayoutManageDialog: React.FC<LayoutManageDialogProps> = ({
  open,
  onClose,
  layouts,
  defaultLayoutId,
  selectedLayoutId,
  blotterInfo,
  isLoading,
  onRename,
  onDelete,
  onDuplicate,
  onSetDefault,
  onSelect,
  onSaveComponentSubType,
}) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[520px] h-[520px] flex flex-col gap-0 p-5 overflow-hidden">
        <DialogHeader className="pb-4 flex-shrink-0">
          <DialogTitle className="text-lg font-semibold">Manage Layouts</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            View, edit, and organize your saved layouts.
          </DialogDescription>
        </DialogHeader>

        <LayoutManageDialogContent
          layouts={layouts}
          defaultLayoutId={defaultLayoutId}
          selectedLayoutId={selectedLayoutId}
          blotterInfo={blotterInfo}
          isLoading={isLoading}
          onRename={onRename}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onSetDefault={onSetDefault}
          onSelect={onSelect}
          onSaveComponentSubType={onSaveComponentSubType}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default LayoutManageDialog;
