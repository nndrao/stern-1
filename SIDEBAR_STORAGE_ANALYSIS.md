# AG Grid Side Panel Storage Analysis

## Investigation Summary

This document analyzes where the AG Grid side panel (sidebar) visibility and state is stored in the SimpleBlotter component.

## Answer: Side Panel State is Stored at LAYOUT Level ✅

The AG Grid side panel configuration is **stored at the layout level**, not at the component level.

## Evidence

### 1. Type Definition (shared/src/simpleBlotter.ts)

```typescript
// Layout Config (child configuration - per layout)
export interface SimpleBlotterLayoutConfig {
  // ... other layout properties ...

  // === Side Panel State ===
  /** Side bar/panel state */
  sideBarState?: SideBarState;  // ← STORED IN LAYOUT
}

export interface SideBarState {
  /** Whether the side bar is visible */
  visible: boolean;
  /** Position of the side bar ('left' or 'right') */
  position?: 'left' | 'right';
  /** ID of the currently open tool panel (e.g., 'columns', 'filters') */
  openToolPanel?: string | null;
}

// Component Config (parent configuration - shared settings)
export interface SimpleBlotterConfig {
  dataProviderId: string;
  defaultLayoutId?: string;
  toolbar: BlotterToolbarConfig;
  themeMode: BlotterThemeMode;
  // ... other component settings ...
  // NO sideBarState here! ← NOT at component level
}
```

### 2. Capture Logic (useBlotterLayoutManager.ts:219-232)

When capturing grid state for a layout:

```typescript
// Get side bar state
let sideBarState: SideBarState | undefined;
try {
  const sideBar = gridApi.getSideBar();
  if (sideBar) {
    const openToolPanel = gridApi.getOpenedToolPanel();
    sideBarState = {
      visible: gridApi.isSideBarVisible(),
      openToolPanel: openToolPanel || null,
    };
  }
} catch {
  // Side bar may not be configured
  sideBarState = undefined;
}

return {
  // ... other state ...
  sideBarState,  // ← Saved to layout config
};
```

### 3. Apply Logic (useBlotterLayoutManager.ts:374-389)

When applying a layout to the grid:

```typescript
// Apply side bar state if specified
if (layoutConfig.sideBarState) {
  try {
    // Set side bar visibility
    gridApi.setSideBarVisible(layoutConfig.sideBarState.visible);

    // Open the tool panel if one was open
    if (layoutConfig.sideBarState.visible && layoutConfig.sideBarState.openToolPanel) {
      gridApi.openToolPanel(layoutConfig.sideBarState.openToolPanel);
    } else if (!layoutConfig.sideBarState.openToolPanel) {
      // Close any open tool panel
      gridApi.closeToolPanel();
    }
  } catch {
    // Side bar may not be configured
  }
}
```

## What This Means

### Per-Layout Storage
✅ **Each layout can have different side panel settings**
- Layout A might have side panel visible with columns tool open
- Layout B might have side panel hidden
- Layout C might have side panel visible with filters tool open

### Behavior
1. **Saving a Layout**: Current side panel state (visible/hidden, which tool panel is open) is saved with the layout
2. **Switching Layouts**: Side panel state is restored from the selected layout
3. **Creating New Layout**: Current side panel state is captured
4. **Independent Views**: Each view can have different layouts, therefore different side panel states

### What's Captured
The system captures:
- `visible`: Is the side panel visible or hidden?
- `openToolPanel`: Which tool panel is currently open? (e.g., 'columns', 'filters', 'aggregations')
- `position` (optional): Left or right side (not currently used in capture logic)

## Component Level vs Layout Level

| Configuration | Stored At | Scope |
|--------------|-----------|-------|
| Side Panel State | **Layout Level** | Per-layout, can differ between layouts |
| Data Provider ID | Layout Level | Which data source to use |
| Column Visibility | Layout Level | Which columns are shown/hidden |
| Column Widths | Layout Level | How wide each column is |
| Filters | Layout Level | What filters are applied |
| Sorts | Layout Level | How data is sorted |
| Toolbar State | Layout Level | Collapsed/pinned state |
| | | |
| Default Layout | Component Level | Which layout loads by default |
| Last Selected Layout | Component Level | Auto-saved preference |
| Theme Mode | Component Level | Light/dark theme |
| Formatting Rules | Component Level | Shared across all layouts |
| Editing Rules | Component Level | Shared across all layouts |

## Conclusion

The AG Grid side panel state is **definitively stored at the layout level**, not at the component level. This allows different layouts to have different side panel configurations, providing maximum flexibility for users to customize their workspace.

Each time a user:
- Toggles the side panel visibility
- Opens/closes a tool panel
- Saves the layout

The current side panel state is captured and stored with that specific layout configuration.
