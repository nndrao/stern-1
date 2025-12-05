/**
 * LayoutItem Component
 *
 * Reusable layout row for layout management dialogs.
 * Shows layout name, default status, and action menu.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LayoutItemProps } from './types';

/**
 * LayoutItem - Individual layout row with edit/delete actions
 */
export const LayoutItem: React.FC<LayoutItemProps> = ({
  layout,
  isDefault,
  isSelected = false,
  isEditing,
  editName,
  isProcessing = false,
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

  const handleClick = () => {
    if (!isEditing && onSelect) {
      onSelect();
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
        onSelect && 'cursor-pointer hover:bg-accent/50',
        isSelected && 'bg-accent border-primary',
        !isSelected && !onSelect && 'bg-background'
      )}
      onClick={handleClick}
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
              className="h-7 w-7 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onEditSave();
              }}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 text-green-600" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onEditCancel();
              }}
              disabled={isProcessing}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate">
                {layout.unified.name}
              </span>
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
              className="h-7 w-7 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEditStart();
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicate
            </DropdownMenuItem>
            {!isDefault && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onSetDefault();
                }}
              >
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

export default LayoutItem;
