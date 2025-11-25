# Configuration Management Design

This document describes the configuration management architecture for the Stern Trading Platform, including ownership models, persistence strategies, and OpenFin integration patterns.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Ownership Model](#configuration-ownership-model)
3. [Deferred Layout Persistence](#deferred-layout-persistence)
4. [View customData for Active Layout](#view-customdata-for-active-layout)
5. [OpenFin API Reference](#openfin-api-reference)
6. [Implementation Steps](#implementation-steps)
7. [Flow Diagrams](#flow-diagrams)

---

## Overview

The Stern platform has two categories of configurations:

| Category | Examples | Who Manages | userId |
|----------|----------|-------------|--------|
| **System Configs** | Dock menu items, Data providers | Admins/Developers | `'System'` |
| **User Configs** | Blotter layouts, Grid state | End users | Actual user ID |

### Key Principles

1. **System configs are shared** - All users see the same dock menu items and data providers
2. **User configs are personal** - Each user has their own layout preferences
3. **No orphaned data** - Configs only persist to DB when workspace is saved
4. **Multi-view support** - Same component can have different active layouts in different views

---

## Configuration Ownership Model

### System Configurations (userId = 'System')

These are administrative configurations managed by developers/admins:

#### Dock Menu Items
- Configured via `DockConfigEditor`
- Defines which components appear in the dock applications menu
- Shared across all platform users

```typescript
// DockConfigEditor saves with System userId
const { data: dockConfig } = useDockConfig('System');
saveMutation.mutateAsync({ userId: 'System', config: currentConfig });
```

#### Data Providers
- Configured via `DataProviderEditor`
- Defines STOMP/WebSocket/REST data sources
- Shared across all platform users

```typescript
// DataProviderEditor saves with System userId
createMutation.mutateAsync({ provider, userId: 'System' });
updateMutation.mutateAsync({ providerId, updates, userId: 'System' });
```

### User Configurations (userId = actual user)

These are end-user preferences:

#### Blotter Layouts
- Column order, widths, visibility
- Sort/filter state
- Toolbar preferences
- Per-user, per-blotter configurations

```typescript
// SimpleBlotter saves layouts with actual userId
const userId = getCurrentUserId(); // From platform context
layoutManager.saveCurrentLayout({ userId, blotterConfigId });
```

---

## Deferred Layout Persistence

### Problem: Orphaned Configurations

Without deferred persistence:
1. User opens blotter from dock
2. User customizes grid and clicks "Save Layout"
3. Layout is saved to DB immediately
4. User closes browser without saving workspace
5. **Result**: Layout exists in DB but no workspace references it = orphaned data

### Solution: Deferred Persistence

Layouts are stored locally until workspace is saved:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User clicks    │     │  Stored locally  │     │  Persisted to   │
│  "Save Layout"  │ ──► │  (memory/cache)  │ ──► │  DB on workspace│
│                 │     │                  │     │  save           │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Implementation Strategy

#### 1. Local Layout Cache

```typescript
// services/layoutCache.ts
interface PendingLayout {
  layoutId: string;
  blotterConfigId: string;
  userId: string;
  config: SimpleBlotterLayoutConfig;
  timestamp: number;
}

class LayoutCache {
  private pendingLayouts: Map<string, PendingLayout> = new Map();

  // Store layout locally (not in DB yet)
  savePending(layout: PendingLayout): void {
    this.pendingLayouts.set(layout.layoutId, layout);
  }

  // Get pending layout for a blotter
  getPending(layoutId: string): PendingLayout | undefined {
    return this.pendingLayouts.get(layoutId);
  }

  // Flush all pending layouts to DB
  async persistAll(userId: string): Promise<void> {
    for (const layout of this.pendingLayouts.values()) {
      await simpleBlotterConfigService.createLayout(
        layout.blotterConfigId,
        layout.userId,
        layout.config.name,
        layout.config
      );
    }
    this.pendingLayouts.clear();
  }

  // Discard pending layouts (user didn't save workspace)
  discardAll(): void {
    this.pendingLayouts.clear();
  }
}

export const layoutCache = new LayoutCache();
```

#### 2. Hook into Workspace Save Event

```typescript
// In WorkspaceStorageProvider.ts or a workspace event handler

// When workspace is being saved
async createSavedWorkspace(req: CreateSavedWorkspaceRequest): Promise<void> {
  // 1. Persist all pending layouts to DB
  await layoutCache.persistAll(this.userId);

  // 2. Then save workspace as normal
  await super.createSavedWorkspace(req);
}

async updateSavedWorkspace(req: UpdateSavedWorkspaceRequest): Promise<void> {
  // 1. Persist all pending layouts to DB
  await layoutCache.persistAll(this.userId);

  // 2. Then update workspace as normal
  await super.updateSavedWorkspace(req);
}
```

#### 3. Modified Save Layout Flow

```typescript
// In useBlotterLayoutManager.ts

const saveCurrentLayout = useCallback(async () => {
  const gridState = captureGridState();

  // Store locally instead of persisting to DB
  layoutCache.savePending({
    layoutId: selectedLayoutId,
    blotterConfigId,
    userId,
    config: gridState,
    timestamp: Date.now()
  });

  // Update local state for immediate UI feedback
  setLocalLayouts(prev => [...prev, gridState]);

  // Note: Actual DB persist happens on workspace save
}, [selectedLayoutId, captureGridState, blotterConfigId, userId]);
```

---

## View customData for Active Layout

### Purpose

When the same component (e.g., "Bonds Blotter") is opened in multiple views, each view can have a different active layout. The `activeLayoutId` is stored in the view's `customData` so it persists with the workspace.

### Data Structure

```typescript
// View customData structure
interface ViewCustomData {
  menuItemId: string;           // e.g., 'bonds-blotter'
  caption: string;              // e.g., 'Bonds Blotter'
  componentType: string;        // e.g., 'simple-blotter'

  // Layout reference for this specific view instance
  blotterConfigId: string;      // Config ID for this blotter
  activeLayoutId?: string;      // Currently selected layout
}
```

### Example Scenario

```
Workspace "Trading Desk"
├── Window 1
│   └── View A: Bonds Blotter
│       └── customData.activeLayoutId = 'compact-layout-uuid'
│
└── Window 2
    └── View B: Bonds Blotter
        └── customData.activeLayoutId = 'detailed-layout-uuid'
```

Both views show the same Bonds Blotter component but with different active layouts.

---

## OpenFin API Reference

### Reading customData from Current View

```typescript
// Method 1: Using fin.View.getCurrentSync()
const view = fin.View.getCurrentSync();
const info = await view.getInfo();
const customData = (info as any).customData;

// Method 2: Using window.getOptions() in component
const windowInfo = await window.getOptions?.();
const customData = windowInfo?.customData || {};
```

### Updating customData at Runtime

```typescript
// Update the current view's customData
const view = fin.View.getCurrentSync();
await view.updateOptions({
  customData: {
    ...existingCustomData,
    activeLayoutId: 'new-layout-uuid'
  }
});
```

### Creating a View with customData

```typescript
import { getCurrentSync } from '@openfin/workspace-platform';

const platform = getCurrentSync();

const viewOptions = {
  url: buildViewUrl('/simple-blotter', viewId),
  name: `simple-blotter-${viewId}`,
  customData: {
    menuItemId: item.id,
    caption: item.caption,
    componentType: 'simple-blotter',
    blotterConfigId: viewId,
    activeLayoutId: undefined  // Will be set when user selects a layout
  }
};

await platform.createView(viewOptions, parentWindow);
```

### Listening to Workspace Save Events

```typescript
// In platform initialization or a global handler
fin.Platform.getCurrentSync().on('workspace-saved', async (event) => {
  console.log('Workspace saved:', event);
  // Layouts have already been persisted in WorkspaceStorageProvider
});
```

### Getting All Views in Current Window

```typescript
const currentWindow = fin.Window.getCurrentSync();
const views = await currentWindow.getCurrentViews();

for (const view of views) {
  const info = await view.getInfo();
  console.log('View customData:', info.customData);
}
```

---

## Implementation Steps

### Phase 1: System userId for Admin Configs

**Files to modify:**

1. **`client/src/components/provider/forms/DockConfigEditor.tsx`**
   - Change `useDockConfig(userId)` → `useDockConfig('System')`
   - Change save mutation to use `userId: 'System'`

2. **`client/src/components/provider/editors/DataProviderEditor.tsx`**
   - Change default userId from `'default-user'` to `'System'`

3. **`client/src/components/provider/forms/ProviderForm.tsx`**
   - Ensure mutations use `'System'` userId

### Phase 2: Deferred Layout Persistence

**New files to create:**

1. **`client/src/services/cache/layoutCache.ts`**
   - Implement `LayoutCache` class for pending layouts

**Files to modify:**

2. **`packages/openfin-platform/src/storage/WorkspaceStorageProvider.ts`**
   - Hook into `createSavedWorkspace` and `updateSavedWorkspace`
   - Call `layoutCache.persistAll()` before saving workspace

3. **`client/src/hooks/blotter/useBlotterLayoutManager.ts`**
   - Modify `saveCurrentLayout` to use `layoutCache.savePending()`
   - Modify `saveAsNewLayout` to use cache instead of direct DB save

### Phase 3: View customData Integration

**Files to modify:**

1. **`packages/openfin-platform/src/platform/menuLauncher.ts`**
   - Add `blotterConfigId` and `activeLayoutId` to customData when creating view

2. **`client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx`**
   - Read `activeLayoutId` from view's customData on mount
   - Update view's customData when layout selection changes

3. **`client/src/openfin/utils/viewUtils.ts`**
   - Add helper functions for reading/writing view customData

**New types to add:**

4. **`client/src/openfin/types/viewCustomData.ts`**
   ```typescript
   export interface ViewCustomData {
     menuItemId: string;
     caption: string;
     componentType: string;
     blotterConfigId: string;
     activeLayoutId?: string;
   }
   ```

---

## Reuse Existing Config Behavior

### Problem: Duplicate Configurations

Without config reuse:
1. User clicks dock menu item "Bonds Blotter"
2. New view created with new configId (UUID)
3. User customizes the blotter and saves workspace
4. User closes and clicks "Bonds Blotter" again
5. **Result**: Another new configId created, user loses their customizations

### Solution: Config Lookup on Launch

When a dock menu item is clicked, the system checks if a config already exists for that menu item + user combination:

```
┌─────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│ User clicks     │     │ Config Lookup       │     │ View Created     │
│ dock menu item  │ ──► │ (menuItemId + user) │ ──► │ with configId    │
└─────────────────┘     └─────────────────────┘     └──────────────────┘
                                 │
                                 ▼
                        ┌───────────────────┐
                        │ Config exists?    │
                        └───────────────────┘
                           │           │
                       Yes │           │ No
                           ▼           ▼
                    Use existing   Create new
                    configId       configId (UUID)
```

### Implementation Details

1. **Menu Item ID as Lookup Key**: The `componentSubType` field of the UnifiedConfig stores the `menuItemId`
2. **Query**: `GET /by-user/:userId?componentType=simple-blotter&componentSubType=:menuItemId`
3. **First Click**: Creates new config with UUID, stores `menuItemId` in `componentSubType`
4. **Subsequent Clicks**: Finds existing config, reuses its `configId`

### Key Files

| File | Purpose |
|------|---------|
| `simpleBlotterConfigService.ts` | `getOrCreateConfigByMenuItem()` - lookup/create logic |
| `menuLauncher.ts` | `registerConfigLookupCallback()` - callback pattern |
| `OpenfinProvider.tsx` | Registers callback during platform init |

---

## Flow Diagrams

### Flow 1: User Opens Component from Dock (with Config Reuse)

```
┌──────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ User clicks  │     │ configLookup    │     │ menuLauncher    │     │ SimpleBlotter    │
│ dock menu    │ ──► │ callback checks │ ──► │ creates view    │ ──► │ component loads  │
│ item         │     │ for existing    │     │ with configId   │     │                  │
└──────────────┘     └─────────────────┘     └─────────────────┘     └──────────────────┘
                              │
                              ▼
                     ┌─────────────────────┐
                     │ Existing config?    │
                     │ (by menuItemId +    │
                     │  userId in DB)      │
                     └─────────────────────┘
                           │         │
                    Yes    │         │ No
                           ▼         ▼
                     Use existing   Create new UUID
                     configId       and save with
                                   componentSubType
                                   = menuItemId
                              │
                              ▼
                     customData: {
                       menuItemId: 'bonds-blotter',
                       configId: 'existing-or-new-uuid',
                       caption: 'Bonds Blotter'
                     }
```

### Flow 2: User Saves Layout (Deferred)

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ User clicks  │     │ Layout stored   │     │ View customData  │
│ "Save Layout"│ ──► │ in layoutCache  │ ──► │ updated with     │
│              │     │ (not DB yet)    │     │ activeLayoutId   │
└──────────────┘     └─────────────────┘     └──────────────────┘
                              │
                              ▼
                     layoutCache.savePending({
                       layoutId: 'layout-uuid',
                       config: { columns, filters, ... }
                     })
```

### Flow 3: User Saves Workspace (Triggers Persist)

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ User clicks  │     │ WorkspaceStorage│     │ Layouts persisted│
│ "Save        │ ──► │ Provider hooks  │ ──► │ to backend DB    │
│ Workspace"   │     │ workspace save  │     │                  │
└──────────────┘     └─────────────────┘     └──────────────────┘
                              │
                              ▼
                     1. layoutCache.persistAll()
                     2. super.createSavedWorkspace()
```

### Flow 4: Workspace Restore with Active Layout

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ OpenFin loads│     │ View created    │     │ SimpleBlotter    │
│ workspace    │ ──► │ with saved      │ ──► │ reads customData │
│              │     │ customData      │     │ loads layout     │
└──────────────┘     └─────────────────┘     └──────────────────┘
                              │
                              ▼
                     customData.activeLayoutId = 'layout-uuid'
                              │
                              ▼
                     layoutManager.selectLayout('layout-uuid')
```

**IMPORTANT**: Each view reads ONLY from its own `customData.activeLayoutId`.
The `lastSelectedLayoutId` field in the blotter config is NOT used for workspace restore
because it's shared between all views of the same component type (config reuse).
This ensures two views of "Bonds Blotter" can have different active layouts.

---

## Summary

This design provides:

1. **Clear separation** between system configs (shared) and user configs (personal)
2. **No orphaned data** through deferred persistence tied to workspace save
3. **Multi-view support** via activeLayoutId in view customData
4. **Config reuse** - clicking the same dock menu item loads existing configuration
5. **Standard patterns** using OpenFin's native customData and workspace APIs

### Complete Flow Summary

1. **First time user clicks "Bonds Blotter"**:
   - Config lookup finds no existing config
   - New configId (UUID) is generated
   - Config is created with `componentSubType = 'bonds-blotter'` (menuItemId)
   - View opens with new configId
   - User customizes and saves workspace
   - Config is persisted to DB

2. **Second time user clicks "Bonds Blotter"**:
   - Config lookup finds existing config (by menuItemId + userId)
   - Existing configId is reused
   - View opens with same configId
   - User's previous customizations are loaded

3. **Active layout per view**:
   - Each view can have different active layout (stored in view customData)
   - Same component in multiple views → different layouts possible
   - Layout selection persists with workspace save
