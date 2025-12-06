/**
 * Dock Editor Context
 *
 * Provides centralized state management for the dock configuration editor
 * using React Context + useReducer with normalized flat state for O(1) performance.
 *
 * Key Features:
 * - Normalized state (Maps) for O(1) lookups instead of O(n) tree traversal
 * - Split contexts (State/Dispatch) to prevent unnecessary re-renders
 * - Pure reducer functions for predictable state updates
 * - Easy to extend with undo/redo, batch operations, etc.
 */

import React, { createContext, useContext, useReducer, useMemo, Dispatch } from 'react';
import { DockConfiguration, DockMenuItem, createMenuItem } from '@stern/openfin-platform';

// ============================================================================
// Types
// ============================================================================

/**
 * Normalized state structure for O(1) operations
 * Instead of nested tree, we use flat Maps with parent/child relationships
 */
export interface DockEditorState {
  // Entity storage (normalized for O(1) access)
  entities: {
    items: Map<string, DockMenuItem>;      // itemId -> item
    children: Map<string, string[]>;       // parentId -> childIds[]
    parents: Map<string, string | null>;   // childId -> parentId
  };

  // UI state
  ui: {
    rootIds: string[];           // Top-level item IDs (ordered)
    selectedId: string | null;   // Currently selected item
    expandedIds: Set<string>;    // Expanded tree nodes
  };

  // Configuration metadata
  config: {
    configId?: string;
    name: string;
    userId: string;
    appId: string;
    componentType: 'dock';
    isDirty: boolean;
  };
}

/**
 * All possible actions for the dock editor reducer
 */
export type DockEditorAction =
  // Item CRUD
  | { type: 'ADD_ITEM'; payload: { item: DockMenuItem; parentId?: string | null } }
  | { type: 'UPDATE_ITEM'; payload: { id: string; updates: Partial<DockMenuItem> } }
  | { type: 'DELETE_ITEM'; payload: { id: string } }
  | { type: 'DUPLICATE_ITEM'; payload: { id: string } }

  // Tree operations
  | { type: 'MOVE_ITEM'; payload: { itemId: string; targetParentId: string | null; index?: number } }
  | { type: 'REORDER_CHILDREN'; payload: { parentId: string | null; orderedChildIds: string[] } }

  // UI operations
  | { type: 'SELECT_ITEM'; payload: { id: string | null } }
  | { type: 'TOGGLE_EXPANDED'; payload: { id: string } }
  | { type: 'EXPAND_ALL' }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'SET_EXPANDED'; payload: { ids: Set<string> } }

  // Configuration operations
  | { type: 'LOAD_CONFIG'; payload: { config: DockConfiguration } }
  | { type: 'RESET_TO_SAVED' }
  | { type: 'MARK_CLEAN' }
  | { type: 'MARK_DIRTY' };

// ============================================================================
// State Conversion Utilities
// ============================================================================

/**
 * Convert nested DockConfiguration to normalized flat state
 * This is O(n) but only runs on initial load
 */
export function denormalizeConfig(config: DockConfiguration): DockEditorState {
  const items = new Map<string, DockMenuItem>();
  const children = new Map<string, string[]>();
  const parents = new Map<string, string | null>();
  const rootIds: string[] = [];

  function processItem(item: DockMenuItem, parentId: string | null) {
    // Store item without children property (stored separately)
    const { children: itemChildren, ...itemWithoutChildren } = item;
    items.set(item.id, itemWithoutChildren as DockMenuItem);
    parents.set(item.id, parentId);

    // Process children
    if (itemChildren && itemChildren.length > 0) {
      const childIds = itemChildren.map(child => child.id);
      children.set(item.id, childIds);
      itemChildren.forEach(child => processItem(child, item.id));
    }

    // Track root items
    if (parentId === null) {
      rootIds.push(item.id);
    }
  }

  // Process all menu items
  (config.config.menuItems || []).forEach(item => processItem(item, null));

  return {
    entities: { items, children, parents },
    ui: { rootIds, selectedId: null, expandedIds: new Set() },
    config: {
      configId: config.configId,
      name: config.name,
      userId: config.userId,
      appId: config.appId,
      componentType: 'dock',
      isDirty: false
    }
  };
}

/**
 * Convert normalized state back to nested DockConfiguration
 * This is O(n) but only runs on save
 */
export function normalizeState(state: DockEditorState): DockConfiguration {
  function buildTree(itemIds: string[]): DockMenuItem[] {
    return itemIds.map(id => {
      const item = state.entities.items.get(id);
      if (!item) throw new Error(`Item ${id} not found in state`);

      const childIds = state.entities.children.get(id) || [];
      const children = childIds.length > 0 ? buildTree(childIds) : undefined;

      return { ...item, children };
    });
  }

  return {
    configId: state.config.configId || '',
    name: state.config.name,
    userId: state.config.userId,
    appId: state.config.appId,
    componentType: 'dock',
    componentSubType: 'default',
    config: {
      menuItems: buildTree(state.ui.rootIds)
    },
    settings: [],
    activeSetting: ''
  } as DockConfiguration;
}

/**
 * Create initial empty state
 */
function createInitialState(): DockEditorState {
  return {
    entities: {
      items: new Map(),
      children: new Map(),
      parents: new Map()
    },
    ui: {
      rootIds: [],
      selectedId: null,
      expandedIds: new Set()
    },
    config: {
      name: 'Dock Applications Menu',
      userId: 'System',
      appId: 'stern-platform',
      componentType: 'dock',
      isDirty: false
    }
  };
}

// ============================================================================
// Reducer
// ============================================================================

/**
 * Pure reducer function for all state updates
 * All operations are O(1) or O(k) where k = number of children
 */
export function dockEditorReducer(
  state: DockEditorState,
  action: DockEditorAction
): DockEditorState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { item, parentId } = action.payload;
      const newItems = new Map(state.entities.items);
      const newChildren = new Map(state.entities.children);
      const newParents = new Map(state.entities.parents);

      // Add item to entities (without children property)
      const { children: _, ...itemWithoutChildren } = item;
      newItems.set(item.id, itemWithoutChildren as DockMenuItem);
      newParents.set(item.id, parentId || null);

      // Update parent's children list or root
      if (parentId) {
        const siblings = newChildren.get(parentId) || [];
        newChildren.set(parentId, [...siblings, item.id]);
      } else {
        // Add to root
        return {
          ...state,
          entities: { items: newItems, children: newChildren, parents: newParents },
          ui: { ...state.ui, rootIds: [...state.ui.rootIds, item.id] },
          config: { ...state.config, isDirty: true }
        };
      }

      return {
        ...state,
        entities: { items: newItems, children: newChildren, parents: newParents },
        config: { ...state.config, isDirty: true }
      };
    }

    case 'UPDATE_ITEM': {
      const { id, updates } = action.payload;
      const item = state.entities.items.get(id);
      if (!item) return state;

      const newItems = new Map(state.entities.items);
      newItems.set(id, { ...item, ...updates });

      return {
        ...state,
        entities: { ...state.entities, items: newItems },
        config: { ...state.config, isDirty: true }
      };
    }

    case 'DELETE_ITEM': {
      const { id } = action.payload;
      const newItems = new Map(state.entities.items);
      const newChildren = new Map(state.entities.children);
      const newParents = new Map(state.entities.parents);

      // Recursively delete all children
      const deleteRecursive = (itemId: string) => {
        const childIds = newChildren.get(itemId) || [];
        childIds.forEach(deleteRecursive);

        newItems.delete(itemId);
        newChildren.delete(itemId);
        newParents.delete(itemId);
      };

      deleteRecursive(id);

      // Remove from parent's children list or root
      const parentId = state.entities.parents.get(id);
      if (parentId) {
        const siblings = newChildren.get(parentId) || [];
        newChildren.set(parentId, siblings.filter(childId => childId !== id));
      } else {
        const newRootIds = state.ui.rootIds.filter(rootId => rootId !== id);
        return {
          ...state,
          entities: { items: newItems, children: newChildren, parents: newParents },
          ui: { ...state.ui, rootIds: newRootIds, selectedId: state.ui.selectedId === id ? null : state.ui.selectedId },
          config: { ...state.config, isDirty: true }
        };
      }

      return {
        ...state,
        entities: { items: newItems, children: newChildren, parents: newParents },
        ui: { ...state.ui, selectedId: state.ui.selectedId === id ? null : state.ui.selectedId },
        config: { ...state.config, isDirty: true }
      };
    }

    case 'DUPLICATE_ITEM': {
      const { id } = action.payload;
      const item = state.entities.items.get(id);
      if (!item) return state;

      const parentId = state.entities.parents.get(id);
      const newItem = createMenuItem({
        ...item,
        caption: `${item.caption} (Copy)`
      });

      return dockEditorReducer(state, {
        type: 'ADD_ITEM',
        payload: { item: newItem, parentId }
      });
    }

    case 'MOVE_ITEM': {
      const { itemId, targetParentId, index } = action.payload;

      // Remove from current parent
      let newState = dockEditorReducer(state, {
        type: 'DELETE_ITEM',
        payload: { id: itemId }
      });

      // Add to new parent
      const item = state.entities.items.get(itemId);
      if (!item) return state;

      newState = dockEditorReducer(newState, {
        type: 'ADD_ITEM',
        payload: { item, parentId: targetParentId }
      });

      // Reorder if index specified
      if (index !== undefined) {
        const childIds = targetParentId
          ? newState.entities.children.get(targetParentId) || []
          : newState.ui.rootIds;

        const reorderedIds = [...childIds];
        const currentIndex = reorderedIds.indexOf(itemId);
        if (currentIndex !== -1) {
          reorderedIds.splice(currentIndex, 1);
          reorderedIds.splice(index, 0, itemId);

          newState = dockEditorReducer(newState, {
            type: 'REORDER_CHILDREN',
            payload: { parentId: targetParentId, orderedChildIds: reorderedIds }
          });
        }
      }

      return newState;
    }

    case 'REORDER_CHILDREN': {
      const { parentId, orderedChildIds } = action.payload;

      if (parentId === null) {
        return {
          ...state,
          ui: { ...state.ui, rootIds: orderedChildIds },
          config: { ...state.config, isDirty: true }
        };
      } else {
        const newChildren = new Map(state.entities.children);
        newChildren.set(parentId, orderedChildIds);

        return {
          ...state,
          entities: { ...state.entities, children: newChildren },
          config: { ...state.config, isDirty: true }
        };
      }
    }

    case 'SELECT_ITEM':
      return {
        ...state,
        ui: { ...state.ui, selectedId: action.payload.id }
      };

    case 'TOGGLE_EXPANDED': {
      const newExpanded = new Set(state.ui.expandedIds);
      if (newExpanded.has(action.payload.id)) {
        newExpanded.delete(action.payload.id);
      } else {
        newExpanded.add(action.payload.id);
      }
      return {
        ...state,
        ui: { ...state.ui, expandedIds: newExpanded }
      };
    }

    case 'EXPAND_ALL': {
      const allIds = new Set<string>();
      state.entities.items.forEach((_, id) => allIds.add(id));
      return {
        ...state,
        ui: { ...state.ui, expandedIds: allIds }
      };
    }

    case 'COLLAPSE_ALL':
      return {
        ...state,
        ui: { ...state.ui, expandedIds: new Set() }
      };

    case 'SET_EXPANDED':
      return {
        ...state,
        ui: { ...state.ui, expandedIds: action.payload.ids }
      };

    case 'LOAD_CONFIG':
      return denormalizeConfig(action.payload.config);

    case 'RESET_TO_SAVED':
      // Would need to store original config to reset - TODO if needed
      return state;

    case 'MARK_CLEAN':
      return {
        ...state,
        config: { ...state.config, isDirty: false }
      };

    case 'MARK_DIRTY':
      return {
        ...state,
        config: { ...state.config, isDirty: true }
      };

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const DockEditorStateContext = createContext<DockEditorState | null>(null);
const DockEditorDispatchContext = createContext<Dispatch<DockEditorAction> | null>(null);

// ============================================================================
// Provider
// ============================================================================

export interface DockEditorProviderProps {
  children: React.ReactNode;
  initialConfig?: DockConfiguration;
}

export const DockEditorProvider: React.FC<DockEditorProviderProps> = ({
  children,
  initialConfig
}) => {
  const [state, dispatch] = useReducer(
    dockEditorReducer,
    initialConfig ? denormalizeConfig(initialConfig) : createInitialState()
  );

  return (
    <DockEditorStateContext.Provider value={state}>
      <DockEditorDispatchContext.Provider value={dispatch}>
        {children}
      </DockEditorDispatchContext.Provider>
    </DockEditorStateContext.Provider>
  );
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get the full dock editor state
 * Use sparingly - prefer specific selector hooks to avoid unnecessary re-renders
 */
export function useDockEditorState(): DockEditorState {
  const state = useContext(DockEditorStateContext);
  if (!state) {
    throw new Error('useDockEditorState must be used within DockEditorProvider');
  }
  return state;
}

/**
 * Get the dispatch function (stable reference, never changes)
 * Components using only dispatch won't re-render on state changes
 */
export function useDockEditorDispatch(): Dispatch<DockEditorAction> {
  const dispatch = useContext(DockEditorDispatchContext);
  if (!dispatch) {
    throw new Error('useDockEditorDispatch must be used within DockEditorProvider');
  }
  return dispatch;
}

/**
 * Get the currently selected item (memoized)
 */
export function useSelectedItem(): DockMenuItem | null {
  const state = useDockEditorState();
  return useMemo(() => {
    if (!state.ui.selectedId) return null;
    return state.entities.items.get(state.ui.selectedId) || null;
  }, [state.ui.selectedId, state.entities.items]);
}

/**
 * Get a specific item by ID (memoized)
 */
export function useItem(id: string): DockMenuItem | null {
  const state = useDockEditorState();
  return useMemo(() =>
    state.entities.items.get(id) || null,
    [id, state.entities.items]
  );
}

/**
 * Get children IDs of an item (memoized)
 * Pass null to get root items
 */
export function useItemChildrenIds(id: string | null): string[] {
  const state = useDockEditorState();
  return useMemo(() => {
    return id
      ? state.entities.children.get(id) || []
      : state.ui.rootIds;
  }, [id, state.entities.children, state.ui.rootIds]);
}

/**
 * Get children items of an item (memoized)
 * Pass null to get root items
 */
export function useItemChildren(id: string | null): DockMenuItem[] {
  const state = useDockEditorState();
  return useMemo(() => {
    const childIds = id
      ? state.entities.children.get(id) || []
      : state.ui.rootIds;

    return childIds
      .map(childId => state.entities.items.get(childId))
      .filter((item): item is DockMenuItem => item !== undefined);
  }, [id, state.entities.children, state.entities.items, state.ui.rootIds]);
}

/**
 * Get parent ID of an item (memoized)
 */
export function useItemParentId(id: string): string | null {
  const state = useDockEditorState();
  return useMemo(() =>
    state.entities.parents.get(id) || null,
    [id, state.entities.parents]
  );
}

/**
 * Check if an item is selected
 */
export function useIsSelected(id: string): boolean {
  const state = useDockEditorState();
  return state.ui.selectedId === id;
}

/**
 * Check if an item is expanded
 */
export function useIsExpanded(id: string): boolean {
  const state = useDockEditorState();
  return state.ui.expandedIds.has(id);
}

/**
 * Check if configuration has unsaved changes
 */
export function useIsDirty(): boolean {
  const state = useDockEditorState();
  return state.config.isDirty;
}

/**
 * Get configuration metadata
 */
export function useConfigMetadata() {
  const state = useDockEditorState();
  return useMemo(() => state.config, [state.config]);
}

/**
 * Convert current state to DockConfiguration for saving
 */
export function useDockConfiguration(): DockConfiguration {
  const state = useDockEditorState();
  return useMemo(() => normalizeState(state), [state]);
}

/**
 * Get all menu items as a flat array (useful for search, validation, etc.)
 */
export function useAllItems(): DockMenuItem[] {
  const state = useDockEditorState();
  return useMemo(() =>
    Array.from(state.entities.items.values()),
    [state.entities.items]
  );
}

/**
 * Get total count of menu items
 */
export function useItemCount(): number {
  const state = useDockEditorState();
  return state.entities.items.size;
}
