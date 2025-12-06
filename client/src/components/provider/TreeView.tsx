/**
 * Tree View Component - Refactored
 *
 * Key improvements:
 * - Simplified callback pattern - parent provides handlers, we just call them with IDs
 * - Removed unnecessary Map-based caching that was recreated on every render
 * - TreeNode callbacks are now stable via useCallback with ID closure
 * - Replaced window.prompt() with onRename callback pattern
 */

import React, { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Folder,
  Plus,
  Trash2,
  Copy,
  Edit2,
  ExternalLink,
  Maximize2
} from 'lucide-react';

import { DockMenuItem } from '@stern/openfin-platform';
import { RenameDialog } from './editors/RenameDialog';

// ============================================================================
// Types
// ============================================================================

interface TreeViewProps {
  items: DockMenuItem[];
  selectedId?: string | null;
  onSelect?: (item: DockMenuItem | null) => void;
  onReorder?: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  onUpdate?: (id: string, updates: Partial<DockMenuItem>) => void;
  onAdd?: (parentId?: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

interface TreeNodeProps {
  item: DockMenuItem;
  level: number;
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onReorder: (sourceId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
  onRename: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

// ============================================================================
// TreeNode Component (memoized)
// ============================================================================

const TreeNode = memo<TreeNodeProps>(function TreeNode({
  item,
  level,
  isSelected,
  isExpanded,
  onToggle,
  onSelect,
  onReorder,
  onRename,
  onAddChild,
  onDelete,
  onDuplicate
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragPosition, setDragPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.id);
  }, [item.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    if (y < height * 0.25) {
      setDragPosition('before');
    } else if (y > height * 0.75) {
      setDragPosition('after');
    } else {
      setDragPosition('inside');
    }

    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
    setDragPosition(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');

    if (sourceId && sourceId !== item.id && dragPosition) {
      onReorder(sourceId, item.id, dragPosition);
    }

    setIsDragOver(false);
    setDragPosition(null);
  }, [item.id, dragPosition, onReorder]);

  const handleToggleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
  }, [onToggle]);

  const hasChildren = item.children && item.children.length > 0;

  const chevronIcon = hasChildren
    ? (isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)
    : <div className="w-4" />;

  const itemIcon = hasChildren
    ? <Folder className="h-4 w-4 text-muted-foreground" />
    : item.openMode === 'window'
      ? <ExternalLink className="h-4 w-4 text-muted-foreground" />
      : <Maximize2 className="h-4 w-4 text-muted-foreground" />;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              'group flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
              isSelected && 'bg-accent text-accent-foreground',
              !isSelected && 'hover:bg-accent/50',
              isDragOver && dragPosition === 'inside' && 'bg-primary/20',
              isDragOver && dragPosition === 'before' && 'border-t-2 border-primary',
              isDragOver && dragPosition === 'after' && 'border-b-2 border-primary'
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={onSelect}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <GripVertical className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity cursor-move" />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0"
              onClick={handleToggleClick}
              disabled={!hasChildren}
            >
              {chevronIcon}
            </Button>
            {itemIcon}
            <span className="flex-1 truncate ml-1">{item.caption}</span>
            {hasChildren && (
              <span className="text-xs text-muted-foreground">
                ({item.children!.length})
              </span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={onAddChild}>
            <Plus className="h-4 w-4 mr-2" />
            Add Child Item
          </ContextMenuItem>
          <ContextMenuItem onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem onClick={onRename}>
            <Edit2 className="h-4 w-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
});

// ============================================================================
// TreeView Component
// ============================================================================

export const TreeView: React.FC<TreeViewProps> = ({
  items,
  selectedId,
  onSelect,
  onReorder,
  onUpdate,
  onAdd,
  onDelete,
  onDuplicate
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [renameDialog, setRenameDialog] = useState<{ id: string; caption: string } | null>(null);

  // Toggle expanded state for a node
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Handle item selection - find item and pass to parent
  const handleSelectItem = useCallback((id: string) => {
    if (!onSelect) return;

    if (selectedId === id) {
      onSelect(null);
      return;
    }

    // Find item in tree
    const findItem = (menuItems: DockMenuItem[]): DockMenuItem | null => {
      for (const item of menuItems) {
        if (item.id === id) return item;
        if (item.children) {
          const found = findItem(item.children);
          if (found) return found;
        }
      }
      return null;
    };

    const item = findItem(items);
    onSelect(item);
  }, [items, selectedId, onSelect]);

  // Handle rename via dialog
  const handleOpenRename = useCallback((id: string, caption: string) => {
    setRenameDialog({ id, caption });
  }, []);

  const handleRename = useCallback((newCaption: string) => {
    if (renameDialog && onUpdate) {
      onUpdate(renameDialog.id, { caption: newCaption });
    }
    setRenameDialog(null);
  }, [renameDialog, onUpdate]);

  // Reorder handler (stable reference)
  const handleReorder = useCallback((
    sourceId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside'
  ) => {
    onReorder?.(sourceId, targetId, position);
  }, [onReorder]);

  // Render tree recursively
  const renderTree = (menuItems: DockMenuItem[], level = 0): React.ReactNode[] => {
    return menuItems.map(item => {
      const isExpanded = expandedIds.has(item.id);
      const isSelected = selectedId === item.id;

      return (
        <React.Fragment key={item.id}>
          <TreeNode
            item={item}
            level={level}
            isSelected={isSelected}
            isExpanded={isExpanded}
            onToggle={() => toggleExpanded(item.id)}
            onSelect={() => handleSelectItem(item.id)}
            onReorder={handleReorder}
            onRename={() => handleOpenRename(item.id, item.caption)}
            onAddChild={() => onAdd?.(item.id)}
            onDelete={() => onDelete?.(item.id)}
            onDuplicate={() => onDuplicate?.(item.id)}
          />
          {isExpanded && item.children && renderTree(item.children, level + 1)}
        </React.Fragment>
      );
    });
  };

  // Handle click on empty area to deselect
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelect?.(null);
    }
  }, [onSelect]);

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-2 min-h-full" onClick={handleBackgroundClick}>
          {!items || items.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No menu items</p>
              <p className="text-sm mt-2">Click "Add" to create your first menu item</p>
            </div>
          ) : (
            <>
              {renderTree(items)}
              {/* Clickable area below items to deselect */}
              <div
                className="min-h-[40px] mt-2"
                onClick={() => onSelect?.(null)}
                role="button"
                tabIndex={-1}
                aria-label="Deselect item"
              />
            </>
          )}
        </div>
      </ScrollArea>

      {/* Rename Dialog */}
      <RenameDialog
        open={renameDialog !== null}
        onOpenChange={(open) => !open && setRenameDialog(null)}
        currentName={renameDialog?.caption || ''}
        onRename={handleRename}
        title="Rename Menu Item"
        description="Enter a new name for this menu item."
      />
    </>
  );
};
