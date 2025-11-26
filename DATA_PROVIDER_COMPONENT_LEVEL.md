# Data Provider is Component-Level Only

## Summary

Data provider selection is **component-level only** and cannot be changed per-layout. This ensures all layouts for a given SimpleBlotter instance use the same data source.

## Architecture Decision

### Before (Incorrect)
- ❌ `selectedProviderId` was stored in `SimpleBlotterLayoutConfig` (layout level)
- ❌ Each layout could use a different data provider
- ❌ Switching layouts would change the data source

### After (Correct)
- ✅ `dataProviderId` is stored in `SimpleBlotterConfig` (component level)
- ✅ All layouts share the same data provider
- ✅ Switching layouts only changes grid configuration (columns, filters, etc.)

## Why Component-Level Only?

1. **Data Consistency**: All layouts should show the same underlying data
2. **User Expectations**: Users expect layout changes to affect appearance, not data source
3. **Simplicity**: One data provider per blotter component is clearer and easier to manage
4. **Performance**: Avoids unnecessary data provider disconnections/reconnections when switching layouts

## What Changed

### Type Definitions ([shared/src/simpleBlotter.ts](shared/src/simpleBlotter.ts))

```typescript
// Component Config (shared across all layouts)
export interface SimpleBlotterConfig {
  dataProviderId: string;  // ← Component-level only
  // ...
}

// Layout Config (per-layout settings)
export interface SimpleBlotterLayoutConfig {
  // selectedProviderId removed - NOT stored here anymore
  columnState: ColumnState[];
  filterState: Record<string, unknown>;
  sideBarState?: SideBarState;
  // ...
}
```

### Layout Manager Changes

**Removed from `useBlotterLayoutManager.ts`:**

1. **Interface**:
   - Removed `selectedProviderId` parameter from `UseBlotterLayoutManagerOptions`
   - Removed `onProviderChange` callback from `LayoutApplyCallbacks`

2. **Capture Logic** (lines 181-186):
   ```typescript
   // Before: captured selectedProviderId
   const baseState = {
     selectedProviderId: selectedProviderId ?? null,  // ❌ Removed
     toolbarState: toolbarState ?? { isCollapsed: true, isPinned: false },
   };

   // After: only captures toolbar state
   const baseState = {
     toolbarState: toolbarState ?? { isCollapsed: true, isPinned: false },
   };
   ```

3. **Apply Logic** (lines 309-322):
   ```typescript
   // Before: applied provider from layout
   if (layoutConfig.selectedProviderId !== undefined) {
     callbacks.onProviderChange(layoutConfig.selectedProviderId);  // ❌ Removed
   }

   // After: only applies toolbar state
   // NOTE: We do NOT apply selectedProviderId from layout
   // Data provider is component-level only
   ```

### SimpleBlotter Component Changes

**Removed from `SimpleBlotter.tsx`:**

1. **Hook call** (line 173):
   ```typescript
   // Before:
   const layoutManager = useBlotterLayoutManager({
     selectedProviderId,  // ❌ Removed
     // ...
   });

   // After:
   const layoutManager = useBlotterLayoutManager({
     blotterConfigId: viewInstanceId,
     userId,
     gridApi: gridApiRef.current,
     toolbarState: { isCollapsed, isPinned },
   });
   ```

2. **Callbacks** (line 189):
   ```typescript
   // Before:
   layoutManager.registerApplyCallbacks({
     onProviderChange: (providerId) => {  // ❌ Removed
       setSelectedProviderId(providerId);
     },
     onToolbarStateChange: (state) => { ... },
   });

   // After:
   layoutManager.registerApplyCallbacks({
     onToolbarStateChange: (state) => { ... },
   });
   ```

## Component-Level vs Layout-Level Settings

| Setting | Storage Level | Scope |
|---------|---------------|-------|
| **Data Provider** | **Component Level** | Shared across ALL layouts |
| Default Layout | Component Level | Which layout loads by default |
| Last Selected Layout | Component Level | Auto-saved preference |
| Theme Mode | Component Level | Light/dark theme |
| Formatting Rules | Component Level | Shared rule definitions |
| Editing Rules | Component Level | Shared rule definitions |
| | | |
| Active Layout | View customData | Per-view (workspace persistence) |
| Column Visibility | Layout Level | Which columns shown/hidden |
| Column Widths | Layout Level | Column widths and order |
| Filters | Layout Level | Active filters |
| Sorts | Layout Level | Sort configuration |
| Toolbar State | Layout Level | Collapsed/pinned state |
| Side Panel State | Layout Level | Visibility and tool panel |
| Row Grouping | Layout Level | Grouping configuration |

## Benefits of This Architecture

### 1. Data Consistency
All layouts show the same data source, ensuring consistency across different views of the same blotter.

### 2. Clear Separation of Concerns
- **Component level**: What data to show
- **Layout level**: How to display that data

### 3. Better User Experience
Users understand that:
- Changing data provider = different blotter instance
- Changing layout = different view of the same data

### 4. Simplified State Management
No need to manage data provider changes when switching layouts, reducing complexity and potential bugs.

## Migration Notes

Any existing layouts with `selectedProviderId` will simply ignore that field. The component's `dataProviderId` will always be used instead.

## Related Documentation

- [SIDEBAR_STORAGE_ANALYSIS.md](SIDEBAR_STORAGE_ANALYSIS.md) - Analysis of sidebar storage (layout level)
- [shared/src/simpleBlotter.ts](shared/src/simpleBlotter.ts) - Type definitions showing storage levels
