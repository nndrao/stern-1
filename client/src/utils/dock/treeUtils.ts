/**
 * Tree Utilities for Dock Menu Items
 *
 * Centralized, performant utilities for tree operations on DockMenuItem structures.
 * Uses Immer for efficient immutable updates with structural sharing.
 */

import { produce } from 'immer';
import { DockMenuItem } from '@stern/openfin-platform';

/**
 * Find a menu item by ID in a tree structure
 * O(n) where n = total number of items
 */
export function findMenuItem(items: DockMenuItem[], id: string): DockMenuItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findMenuItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find the parent ID of a menu item
 * Returns null if item is at root level or not found
 */
export function findParentId(items: DockMenuItem[], targetId: string, parentId: string | null = null): string | null {
  for (const item of items) {
    if (item.id === targetId) return parentId;
    if (item.children) {
      const found = findParentId(item.children, targetId, item.id);
      if (found !== undefined) return found;
    }
  }
  return null;
}

/**
 * Update a menu item by ID using Immer for efficient immutable updates
 * Only creates new references for changed branches (structural sharing)
 */
export function updateMenuItem(
  items: DockMenuItem[],
  id: string,
  updates: Partial<DockMenuItem>
): DockMenuItem[] {
  return produce(items, draft => {
    const updateRecursive = (menuItems: DockMenuItem[]): boolean => {
      for (let i = 0; i < menuItems.length; i++) {
        if (menuItems[i].id === id) {
          Object.assign(menuItems[i], updates);
          return true;
        }
        if (menuItems[i].children) {
          if (updateRecursive(menuItems[i].children!)) {
            return true;
          }
        }
      }
      return false;
    };
    updateRecursive(draft);
  });
}

/**
 * Delete a menu item by ID using Immer
 * Recursively deletes the item and all its children
 */
export function deleteMenuItem(items: DockMenuItem[], id: string): DockMenuItem[] {
  return produce(items, draft => {
    const deleteRecursive = (menuItems: DockMenuItem[]): boolean => {
      for (let i = 0; i < menuItems.length; i++) {
        if (menuItems[i].id === id) {
          menuItems.splice(i, 1);
          return true;
        }
        if (menuItems[i].children) {
          if (deleteRecursive(menuItems[i].children!)) {
            return true;
          }
        }
      }
      return false;
    };
    deleteRecursive(draft);
  });
}

/**
 * Add a child item to a parent using Immer
 * If parentId is null, adds to root level
 */
export function addChildToParent(
  items: DockMenuItem[],
  parentId: string | null,
  child: DockMenuItem
): DockMenuItem[] {
  return produce(items, draft => {
    if (parentId === null) {
      draft.push(child);
      return;
    }

    const addRecursive = (menuItems: DockMenuItem[]): boolean => {
      for (let i = 0; i < menuItems.length; i++) {
        if (menuItems[i].id === parentId) {
          if (!menuItems[i].children) {
            menuItems[i].children = [];
          }
          menuItems[i].children!.push(child);
          return true;
        }
        if (menuItems[i].children) {
          if (addRecursive(menuItems[i].children!)) {
            return true;
          }
        }
      }
      return false;
    };
    addRecursive(draft);
  });
}

/**
 * Move an item to a new position in the tree
 * @param sourceId - ID of item to move
 * @param targetId - ID of target item
 * @param position - 'before', 'after', or 'inside' (as child)
 */
export function moveMenuItem(
  items: DockMenuItem[],
  sourceId: string,
  targetId: string,
  position: 'before' | 'after' | 'inside'
): DockMenuItem[] {
  // Find and extract the source item first
  const sourceItem = findMenuItem(items, sourceId);
  if (!sourceItem || sourceId === targetId) return items;

  return produce(items, draft => {
    // Step 1: Remove source item from its current location
    const removeRecursive = (menuItems: DockMenuItem[]): DockMenuItem | null => {
      for (let i = 0; i < menuItems.length; i++) {
        if (menuItems[i].id === sourceId) {
          const [removed] = menuItems.splice(i, 1);
          return removed;
        }
        if (menuItems[i].children) {
          const removed = removeRecursive(menuItems[i].children!);
          if (removed) return removed;
        }
      }
      return null;
    };

    const removed = removeRecursive(draft);
    if (!removed) return;

    // Step 2: Insert at new position
    if (position === 'inside') {
      // Add as child of target
      const insertAsChild = (menuItems: DockMenuItem[]): boolean => {
        for (const item of menuItems) {
          if (item.id === targetId) {
            if (!item.children) item.children = [];
            item.children.push(removed);
            return true;
          }
          if (item.children && insertAsChild(item.children)) {
            return true;
          }
        }
        return false;
      };
      insertAsChild(draft);
    } else {
      // Insert before/after target
      const insertAtPosition = (menuItems: DockMenuItem[]): boolean => {
        for (let i = 0; i < menuItems.length; i++) {
          if (menuItems[i].id === targetId) {
            const insertIndex = position === 'before' ? i : i + 1;
            menuItems.splice(insertIndex, 0, removed);
            return true;
          }
          if (menuItems[i].children && insertAtPosition(menuItems[i].children!)) {
            return true;
          }
        }
        return false;
      };
      insertAtPosition(draft);
    }
  });
}

/**
 * Duplicate a menu item (creates a copy at root level)
 * @param items - Current menu items
 * @param id - ID of item to duplicate
 * @param newItem - The new item with new ID and updated caption
 */
export function duplicateMenuItem(
  items: DockMenuItem[],
  newItem: DockMenuItem
): DockMenuItem[] {
  return produce(items, draft => {
    draft.push(newItem);
  });
}

/**
 * Get all item IDs in the tree (for expand all functionality)
 */
export function getAllItemIds(items: DockMenuItem[]): string[] {
  const ids: string[] = [];
  const collectIds = (menuItems: DockMenuItem[]) => {
    for (const item of menuItems) {
      ids.push(item.id);
      if (item.children) {
        collectIds(item.children);
      }
    }
  };
  collectIds(items);
  return ids;
}

/**
 * Get the depth of an item in the tree
 */
export function getItemDepth(items: DockMenuItem[], id: string, depth = 0): number {
  for (const item of items) {
    if (item.id === id) return depth;
    if (item.children) {
      const found = getItemDepth(item.children, id, depth + 1);
      if (found >= 0) return found;
    }
  }
  return -1;
}

/**
 * Count total items in tree
 */
export function countItems(items: DockMenuItem[]): number {
  let count = 0;
  const countRecursive = (menuItems: DockMenuItem[]) => {
    for (const item of menuItems) {
      count++;
      if (item.children) {
        countRecursive(item.children);
      }
    }
  };
  countRecursive(items);
  return count;
}
