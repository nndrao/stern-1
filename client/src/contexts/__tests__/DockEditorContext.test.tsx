/**
 * DockEditorContext Tests
 *
 * Comprehensive tests for the dock editor reducer and state management
 */

import { describe, it, expect } from 'vitest';
import {
  dockEditorReducer,
  denormalizeConfig,
  normalizeState,
  type DockEditorState,
  type DockEditorAction
} from '../DockEditorContext';
import { createMenuItem, type DockConfiguration, type DockMenuItem } from '@stern/openfin-platform';

// ============================================================================
// Test Utilities
// ============================================================================

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
      name: 'Test Dock',
      userId: 'test-user',
      appId: 'test-app',
      componentType: 'dock',
      isDirty: false
    }
  };
}

function createTestMenuItem(caption: string, id?: string): DockMenuItem {
  return createMenuItem({ caption, id });
}

// ============================================================================
// Conversion Tests
// ============================================================================

describe('denormalizeConfig', () => {
  it('should convert empty config to empty state', () => {
    const config: DockConfiguration = {
      configId: 'test-id',
      name: 'Test Config',
      userId: 'user1',
      appId: 'app1',
      componentType: 'dock',
      componentSubType: 'default',
      config: { menuItems: [] },
      settings: [],
      activeSetting: ''
    };

    const state = denormalizeConfig(config);

    expect(state.entities.items.size).toBe(0);
    expect(state.ui.rootIds).toEqual([]);
    expect(state.config.name).toBe('Test Config');
    expect(state.config.isDirty).toBe(false);
  });

  it('should convert nested tree to flat structure', () => {
    const item1 = createTestMenuItem('Parent');
    const item2 = createTestMenuItem('Child 1');
    const item3 = createTestMenuItem('Child 2');

    const config: DockConfiguration = {
      configId: 'test-id',
      name: 'Test Config',
      userId: 'user1',
      appId: 'app1',
      componentType: 'dock',
      componentSubType: 'default',
      config: {
        menuItems: [{
          ...item1,
          children: [item2, item3]
        }]
      },
      settings: [],
      activeSetting: ''
    };

    const state = denormalizeConfig(config);

    // All items should be in flat map
    expect(state.entities.items.size).toBe(3);
    expect(state.entities.items.has(item1.id)).toBe(true);
    expect(state.entities.items.has(item2.id)).toBe(true);
    expect(state.entities.items.has(item3.id)).toBe(true);

    // Parent-child relationships
    expect(state.entities.children.get(item1.id)).toEqual([item2.id, item3.id]);
    expect(state.entities.parents.get(item2.id)).toBe(item1.id);
    expect(state.entities.parents.get(item3.id)).toBe(item1.id);

    // Root tracking
    expect(state.ui.rootIds).toEqual([item1.id]);
  });
});

describe('normalizeState', () => {
  it('should convert flat structure back to nested tree', () => {
    const item1 = createTestMenuItem('Parent');
    const item2 = createTestMenuItem('Child');

    const state: DockEditorState = {
      entities: {
        items: new Map([
          [item1.id, item1],
          [item2.id, item2]
        ]),
        children: new Map([[item1.id, [item2.id]]]),
        parents: new Map([
          [item1.id, null],
          [item2.id, item1.id]
        ])
      },
      ui: {
        rootIds: [item1.id],
        selectedId: null,
        expandedIds: new Set()
      },
      config: {
        configId: 'test-id',
        name: 'Test',
        userId: 'user1',
        appId: 'app1',
        componentType: 'dock',
        isDirty: false
      }
    };

    const config = normalizeState(state);

    expect(config.config.menuItems).toHaveLength(1);
    expect(config.config.menuItems[0].caption).toBe('Parent');
    expect(config.config.menuItems[0].children).toHaveLength(1);
    expect(config.config.menuItems[0].children![0].caption).toBe('Child');
  });
});

// ============================================================================
// Reducer Tests: Item CRUD
// ============================================================================

describe('dockEditorReducer - ADD_ITEM', () => {
  it('should add item to root when no parent specified', () => {
    const state = createInitialState();
    const item = createTestMenuItem('New Item');

    const newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    expect(newState.entities.items.get(item.id)).toBeDefined();
    expect(newState.entities.items.get(item.id)?.caption).toBe('New Item');
    expect(newState.ui.rootIds).toContain(item.id);
    expect(newState.entities.parents.get(item.id)).toBeNull();
    expect(newState.config.isDirty).toBe(true);
  });

  it('should add item as child when parent specified', () => {
    const state = createInitialState();
    const parent = createTestMenuItem('Parent');
    const child = createTestMenuItem('Child');

    // Add parent first
    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item: parent }
    });

    // Add child to parent
    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: child, parentId: parent.id }
    });

    expect(newState.entities.items.has(child.id)).toBe(true);
    expect(newState.entities.children.get(parent.id)).toContain(child.id);
    expect(newState.entities.parents.get(child.id)).toBe(parent.id);
  });

  it('should handle multiple children for same parent', () => {
    const state = createInitialState();
    const parent = createTestMenuItem('Parent');
    const child1 = createTestMenuItem('Child 1');
    const child2 = createTestMenuItem('Child 2');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item: parent }
    });

    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: child1, parentId: parent.id }
    });

    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: child2, parentId: parent.id }
    });

    const children = newState.entities.children.get(parent.id);
    expect(children).toHaveLength(2);
    expect(children).toContain(child1.id);
    expect(children).toContain(child2.id);
  });
});

describe('dockEditorReducer - UPDATE_ITEM', () => {
  it('should update item properties', () => {
    const state = createInitialState();
    const item = createTestMenuItem('Original Caption');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'UPDATE_ITEM',
      payload: { id: item.id, updates: { caption: 'Updated Caption' } }
    });

    expect(newState.entities.items.get(item.id)?.caption).toBe('Updated Caption');
    expect(newState.config.isDirty).toBe(true);
  });

  it('should handle non-existent item gracefully', () => {
    const state = createInitialState();

    const newState = dockEditorReducer(state, {
      type: 'UPDATE_ITEM',
      payload: { id: 'non-existent', updates: { caption: 'Test' } }
    });

    expect(newState).toBe(state); // Should return same state
  });

  it('should update complex properties', () => {
    const state = createInitialState();
    const item = createTestMenuItem('Item');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'UPDATE_ITEM',
      payload: {
        id: item.id,
        updates: {
          url: '/new-url',
          icon: '/new-icon.svg',
          windowOptions: { width: 1000, height: 600 }
        }
      }
    });

    const updatedItem = newState.entities.items.get(item.id);
    expect(updatedItem?.url).toBe('/new-url');
    expect(updatedItem?.icon).toBe('/new-icon.svg');
    expect(updatedItem?.windowOptions?.width).toBe(1000);
  });
});

describe('dockEditorReducer - DELETE_ITEM', () => {
  it('should delete root item', () => {
    const state = createInitialState();
    const item = createTestMenuItem('To Delete');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'DELETE_ITEM',
      payload: { id: item.id }
    });

    expect(newState.entities.items.has(item.id)).toBe(false);
    expect(newState.ui.rootIds).not.toContain(item.id);
    expect(newState.config.isDirty).toBe(true);
  });

  it('should delete item and all children recursively', () => {
    const state = createInitialState();
    const parent = createTestMenuItem('Parent');
    const child1 = createTestMenuItem('Child 1');
    const child2 = createTestMenuItem('Child 2');
    const grandchild = createTestMenuItem('Grandchild');

    // Build tree: parent -> [child1 -> [grandchild], child2]
    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item: parent }
    });
    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: child1, parentId: parent.id }
    });
    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: child2, parentId: parent.id }
    });
    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: grandchild, parentId: child1.id }
    });

    // Delete parent (should cascade delete all children)
    newState = dockEditorReducer(newState, {
      type: 'DELETE_ITEM',
      payload: { id: parent.id }
    });

    expect(newState.entities.items.has(parent.id)).toBe(false);
    expect(newState.entities.items.has(child1.id)).toBe(false);
    expect(newState.entities.items.has(child2.id)).toBe(false);
    expect(newState.entities.items.has(grandchild.id)).toBe(false);
  });

  it('should remove deleted item from parent children list', () => {
    const state = createInitialState();
    const parent = createTestMenuItem('Parent');
    const child1 = createTestMenuItem('Child 1');
    const child2 = createTestMenuItem('Child 2');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item: parent }
    });
    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: child1, parentId: parent.id }
    });
    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: child2, parentId: parent.id }
    });

    // Delete child1
    newState = dockEditorReducer(newState, {
      type: 'DELETE_ITEM',
      payload: { id: child1.id }
    });

    const children = newState.entities.children.get(parent.id);
    expect(children).toHaveLength(1);
    expect(children).toContain(child2.id);
    expect(children).not.toContain(child1.id);
  });

  it('should clear selection if deleted item was selected', () => {
    const state = createInitialState();
    const item = createTestMenuItem('Item');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'SELECT_ITEM',
      payload: { id: item.id }
    });

    expect(newState.ui.selectedId).toBe(item.id);

    newState = dockEditorReducer(newState, {
      type: 'DELETE_ITEM',
      payload: { id: item.id }
    });

    expect(newState.ui.selectedId).toBeNull();
  });
});

describe('dockEditorReducer - DUPLICATE_ITEM', () => {
  it('should create copy of item with "(Copy)" suffix', () => {
    const state = createInitialState();
    const item = createTestMenuItem('Original');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'DUPLICATE_ITEM',
      payload: { id: item.id }
    });

    expect(newState.entities.items.size).toBe(2);
    const items = Array.from(newState.entities.items.values());
    const duplicate = items.find(i => i.id !== item.id);
    expect(duplicate?.caption).toBe('Original (Copy)');
  });
});

// ============================================================================
// Reducer Tests: UI Operations
// ============================================================================

describe('dockEditorReducer - SELECT_ITEM', () => {
  it('should select an item', () => {
    const state = createInitialState();
    const item = createTestMenuItem('Item');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'SELECT_ITEM',
      payload: { id: item.id }
    });

    expect(newState.ui.selectedId).toBe(item.id);
  });

  it('should clear selection when id is null', () => {
    const state = createInitialState();
    const item = createTestMenuItem('Item');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'SELECT_ITEM',
      payload: { id: item.id }
    });

    newState = dockEditorReducer(newState, {
      type: 'SELECT_ITEM',
      payload: { id: null }
    });

    expect(newState.ui.selectedId).toBeNull();
  });
});

describe('dockEditorReducer - TOGGLE_EXPANDED', () => {
  it('should expand collapsed item', () => {
    const state = createInitialState();
    const item = createTestMenuItem('Item');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'TOGGLE_EXPANDED',
      payload: { id: item.id }
    });

    expect(newState.ui.expandedIds.has(item.id)).toBe(true);
  });

  it('should collapse expanded item', () => {
    const state = createInitialState();
    const item = createTestMenuItem('Item');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item }
    });

    newState = dockEditorReducer(newState, {
      type: 'TOGGLE_EXPANDED',
      payload: { id: item.id }
    });

    newState = dockEditorReducer(newState, {
      type: 'TOGGLE_EXPANDED',
      payload: { id: item.id }
    });

    expect(newState.ui.expandedIds.has(item.id)).toBe(false);
  });
});

describe('dockEditorReducer - EXPAND_ALL / COLLAPSE_ALL', () => {
  it('should expand all items', () => {
    const state = createInitialState();
    const item1 = createTestMenuItem('Item 1');
    const item2 = createTestMenuItem('Item 2');

    let newState = dockEditorReducer(state, {
      type: 'ADD_ITEM',
      payload: { item: item1 }
    });
    newState = dockEditorReducer(newState, {
      type: 'ADD_ITEM',
      payload: { item: item2 }
    });

    newState = dockEditorReducer(newState, {
      type: 'EXPAND_ALL'
    });

    expect(newState.ui.expandedIds.has(item1.id)).toBe(true);
    expect(newState.ui.expandedIds.has(item2.id)).toBe(true);
  });

  it('should collapse all items', () => {
    const state = createInitialState();

    let newState = dockEditorReducer(state, {
      type: 'EXPAND_ALL'
    });

    newState = dockEditorReducer(newState, {
      type: 'COLLAPSE_ALL'
    });

    expect(newState.ui.expandedIds.size).toBe(0);
  });
});

// ============================================================================
// Reducer Tests: Configuration Operations
// ============================================================================

describe('dockEditorReducer - MARK_DIRTY / MARK_CLEAN', () => {
  it('should mark configuration as dirty', () => {
    const state = createInitialState();

    const newState = dockEditorReducer(state, {
      type: 'MARK_DIRTY'
    });

    expect(newState.config.isDirty).toBe(true);
  });

  it('should mark configuration as clean', () => {
    const state = { ...createInitialState(), config: { ...createInitialState().config, isDirty: true } };

    const newState = dockEditorReducer(state, {
      type: 'MARK_CLEAN'
    });

    expect(newState.config.isDirty).toBe(false);
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should handle 100 items efficiently', () => {
    let state = createInitialState();

    const startTime = performance.now();

    // Add 100 items
    for (let i = 0; i < 100; i++) {
      const item = createTestMenuItem(`Item ${i}`);
      state = dockEditorReducer(state, {
        type: 'ADD_ITEM',
        payload: { item }
      });
    }

    const addTime = performance.now() - startTime;

    // Update all items
    const updateStartTime = performance.now();
    const itemIds = Array.from(state.entities.items.keys());
    itemIds.forEach(id => {
      state = dockEditorReducer(state, {
        type: 'UPDATE_ITEM',
        payload: { id, updates: { caption: 'Updated' } }
      });
    });
    const updateTime = performance.now() - updateStartTime;

    // All operations should be fast (< 100ms total)
    expect(addTime + updateTime).toBeLessThan(100);
    expect(state.entities.items.size).toBe(100);
  });
});
