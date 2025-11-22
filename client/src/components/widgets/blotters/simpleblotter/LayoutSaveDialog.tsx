/**
 * LayoutSaveDialog Component
 *
 * Dialog for saving the current grid state as a new layout.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

export interface LayoutSaveDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback when save is confirmed */
  onSave: (name: string, setAsDefault: boolean) => void;
  /** Whether save operation is in progress */
  isSaving?: boolean;
  /** Suggested default name for the layout */
  defaultName?: string;
}

export const LayoutSaveDialog: React.FC<LayoutSaveDialogProps> = ({
  open,
  onClose,
  onSave,
  isSaving = false,
  defaultName = 'New Layout',
}) => {
  const [name, setName] = useState(defaultName);
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setSetAsDefault(false);
      setError(null);
    }
  }, [open, defaultName]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Layout name is required');
      return;
    }
    setError(null);
    onSave(trimmedName, setAsDefault);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSaving) {
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Save Layout</DialogTitle>
          <DialogDescription>
            Save the current grid configuration as a new layout.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="layout-name">Layout Name</Label>
            <Input
              id="layout-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter layout name..."
              autoFocus
              disabled={isSaving}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="set-default"
              checked={setAsDefault}
              onCheckedChange={(checked) => setSetAsDefault(checked === true)}
              disabled={isSaving}
            />
            <Label
              htmlFor="set-default"
              className="text-sm font-normal cursor-pointer"
            >
              Set as default layout
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Layout'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LayoutSaveDialog;
