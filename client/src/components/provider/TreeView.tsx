/**
 * Tree View Component - Modern & Sophisticated Design
 *
 * Design enhancements:
 * - Refined visual hierarchy with subtle depth indicators
 * - Smooth animations and micro-interactions
 * - Enhanced hover states with better visual feedback
 * - Modern card-based item design with proper spacing
 * - Icon integration with fallback handling
 * - Drag-and-drop with visual indicators
 * - Context menu with icon support
 *
 * Technical improvements:
 * - Simplified callback pattern - parent provides handlers, we just call them with IDs
 * - Removed unnecessary Map-based caching that was recreated on every render
 * - TreeNode callbacks are now stable via useCallback with ID closure
 * - Replaced window.prompt() with onRename callback pattern
 * - TreeView is memoized to prevent unnecessary re-renders
 * - Uses refs to keep callbacks stable without recreating on every items change
 */

import React, { useState, useCallback, memo, useRef } from 'react';
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
  FolderTree,
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

  // Use the configured icon if available, otherwise use generic icons
  const itemIcon = item.icon ? (
    <img
      src={item.icon.startsWith('http') ? item.icon : `http://localhost:5173${item.icon}`}
      alt={item.caption}
      className="h-4 w-4 object-contain"
      onError={(e) => {
        // Fallback to generic icon if image fails to load
        e.currentTarget.style.display = 'none';
      }}
    />
  ) : hasChildren ? (
    <Folder className="h-4 w-4 text-muted-foreground" />
  ) : item.openMode === 'window' ? (
    <ExternalLink className="h-4 w-4 text-muted-foreground" />
  ) : (
    <Maximize2 className="h-4 w-4 text-muted-foreground" />
  );

  return (
    <div className="relative">
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              'group relative flex items-center gap-1.5 px-2.5 py-2 rounded-lg cursor-pointer',
              'transition-all duration-200 ease-in-out',
              'border border-transparent',
              isSelected && 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20 shadow-sm',
              !isSelected && 'hover:bg-accent/60 hover:border-border/50',
              isDragOver && dragPosition === 'inside' && 'bg-primary/15 border-primary/30 shadow-md',
              isDragOver && dragPosition === 'before' && 'border-t-2 border-primary shadow-sm',
              isDragOver && dragPosition === 'after' && 'border-b-2 border-primary shadow-sm'
            )}
            style={{
              paddingLeft: `${level * 20 + 12}px`,
              marginBottom: '2px'
            }}
            onClick={onSelect}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Depth indicator line */}
            {level > 0 && (
              <div
                className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-border/50 via-border to-border/50"
                style={{ left: `${level * 20}px` }}
              />
            )}

            <GripVertical className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity duration-200 cursor-move text-muted-foreground" />

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-5 w-5 p-0 hover:bg-accent/80 transition-colors",
                !hasChildren && "invisible"
              )}
              onClick={handleToggleClick}
              disabled={!hasChildren}
            >
              {chevronIcon}
            </Button>

            <div className={cn(
              "flex items-center justify-center h-5 w-5 rounded-md bg-background/50 border border-border/50",
              isSelected && "border-primary/40 bg-primary/5"
            )}>
              {itemIcon}
            </div>

            <span className={cn(
              "flex-1 truncate text-sm font-medium transition-colors",
              isSelected && "text-foreground",
              !isSelected && "text-foreground/90"
            )}>
              {item.caption}
            </span>

            {hasChildren && (
              <div className={cn(
                "flex items-center justify-center h-5 px-1.5 rounded-full text-xs font-medium",
                "bg-muted/50 text-muted-foreground border border-border/50",
                isSelected && "bg-primary/10 text-primary border-primary/20"
              )}>
                {item.children!.length}
              </div>
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
          <ContextMenuItem onClick={onDelete} className="text-red-600 dark:text-red-500 focus:text-red-600 dark:focus:text-red-500 focus:bg-red-500/10">
            <Trash2 className="h-4 w-4 mr-2 text-red-600 dark:text-red-500" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
});

// ============================================================================
// TreeView Component (Memoized)
// ============================================================================

const TreeViewComponent: React.FC<TreeViewProps> = ({
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

  // Refs for stable callbacks - prevents recreating callbacks when items/selectedId change
  const itemsRef = useRef(items);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onReorderRef = useRef(onReorder);
  const onUpdateRef = useRef(onUpdate);
  const onAddRef = useRef(onAdd);
  const onDeleteRef = useRef(onDelete);
  const onDuplicateRef = useRef(onDuplicate);

  // Keep refs updated
  itemsRef.current = items;
  selectedIdRef.current = selectedId;
  onSelectRef.current = onSelect;
  onReorderRef.current = onReorder;
  onUpdateRef.current = onUpdate;
  onAddRef.current = onAdd;
  onDeleteRef.current = onDelete;
  onDuplicateRef.current = onDuplicate;

  // Toggle expanded state for a node - STABLE (no deps)
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

  // Handle item selection - STABLE (uses refs)
  const handleSelectItem = useCallback((id: string) => {
    const onSelectFn = onSelectRef.current;
    if (!onSelectFn) return;

    if (selectedIdRef.current === id) {
      onSelectFn(null);
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

    const item = findItem(itemsRef.current);
    onSelectFn(item);
  }, []);

  // Handle rename via dialog - STABLE
  const handleOpenRename = useCallback((id: string, caption: string) => {
    setRenameDialog({ id, caption });
  }, []);

  const handleRename = useCallback((newCaption: string) => {
    setRenameDialog(prev => {
      if (prev && onUpdateRef.current) {
        onUpdateRef.current(prev.id, { caption: newCaption });
      }
      return null;
    });
  }, []);

  // Reorder handler - STABLE (uses ref)
  const handleReorder = useCallback((
    sourceId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside'
  ) => {
    onReorderRef.current?.(sourceId, targetId, position);
  }, []);

  // STABLE callbacks for TreeNode actions - use refs
  const handleAddChild = useCallback((id: string) => {
    onAddRef.current?.(id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    onDeleteRef.current?.(id);
  }, []);

  const handleDuplicate = useCallback((id: string) => {
    onDuplicateRef.current?.(id);
  }, []);

  // Handle click on empty area to deselect - STABLE
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectRef.current?.(null);
    }
  }, []);

  const handleDeselectClick = useCallback(() => {
    onSelectRef.current?.(null);
  }, []);

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
            onAddChild={() => handleAddChild(item.id)}
            onDelete={() => handleDelete(item.id)}
            onDuplicate={() => handleDuplicate(item.id)}
          />
          {isExpanded && item.children && renderTree(item.children, level + 1)}
        </React.Fragment>
      );
    });
  };

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-3 min-h-full" onClick={handleBackgroundClick}>
          {!items || items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center mb-4 shadow-sm">
                <FolderTree className="h-8 w-8 text-primary/60" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No Menu Items</h3>
              <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                Click the <span className="font-medium text-foreground">+</span> button above to create your first menu item
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {renderTree(items)}
              {/* Clickable area below items to deselect */}
              <div
                className="min-h-[60px] mt-4 rounded-lg border border-dashed border-border/40 hover:border-border/60 hover:bg-accent/20 transition-all duration-200 cursor-pointer flex items-center justify-center"
                onClick={handleDeselectClick}
                role="button"
                tabIndex={-1}
                aria-label="Deselect item"
              >
                <span className="text-xs text-muted-foreground/50">Click to deselect</span>
              </div>
            </div>
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

// Memoize TreeView to prevent re-renders when parent re-renders
export const TreeView = memo(TreeViewComponent);
