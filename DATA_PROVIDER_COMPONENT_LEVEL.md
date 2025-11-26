# Data Provider is Saved Per-Layout

## Summary

Data provider selection is **saved with each layout** as a grid-level attribute. When a layout is saved, it captures a snapshot of the current data provider selection. When that layout is loaded, it restores the data provider that was active when the layout was saved.

## Architecture Decision

### Before (Component-Level Only)
- ❌ `dataProviderId` was stored in `SimpleBlotterConfig` (component level)
- ❌ All layouts shared the same data provider
- ❌ Switching layouts only changed grid configuration, not the data source

### After (Layout-Level Snapshot)
- ✅ `selectedProviderId` is stored in `SimpleBlotterLayoutConfig` (layout level)
- ✅ Each layout saves a snapshot of the data provider that was active when saved
- ✅ Switching layouts restores the data provider selection along with grid configuration (columns, filters, etc.)

## Why Layout-Level?

1. **Complete State Capture**: Layouts capture the complete state of the grid including the data source
2. **User Flexibility**: Users can have different layouts that show different data providers if needed
3. **State Consistency**: When you switch to a layout, you get the exact same state that was saved, including the data provider
4. **Grid-Level Attribute**: Data provider is a grid-level attribute just like columns, filters, and sorting

## What Changed

### Type Definitions ([shared/src/simpleBlotter.ts](shared/src/simpleBlotter.ts))

```typescript
// Layout Config (per-layout settings)
export interface SimpleBlotterLayoutConfig {
  selectedProviderId?: string;  // ← Saved with each layout
  columnState: ColumnState[];
  filterState: Record<string, unknown>;
  sideBarState?: SideBarState;
  toolbarState: ToolbarState;
  // ...
}
```

### Layout Manager Changes ([useBlotterLayoutManager.ts](client/src/components/widgets/blotters/simpleblotter/useBlotterLayoutManager.ts))

**Added to `useBlotterLayoutManager.ts`:**

1. **Interface** (line 42):
   ```typescript
   export interface UseBlotterLayoutManagerOptions {
     selectedProviderId?: string;  // ← Added parameter
     // ...
   }
   ```

2. **Callbacks** (line 53):
   ```typescript
   export interface LayoutApplyCallbacks {
     onProviderChange?: (providerId: string) => void;  // ← Added callback
     onToolbarStateChange?: (state: ToolbarState) => void;
   }
   ```

3. **Capture Logic** (lines 185):
   ```typescript
   const captureGridState = useCallback((): SimpleBlotterLayoutConfig => {
     const baseState: Partial<SimpleBlotterLayoutConfig> = {
       selectedProviderId,  // ← Capture current provider
       toolbarState: toolbarState ?? { isCollapsed: true, isPinned: false },
     };
     // ...
   }, [gridApi, selectedProviderId, toolbarState]);
   ```

4. **Apply Logic** (lines 325-332):
   ```typescript
   // Apply data provider via callback (grid-level attribute)
   if (layoutConfig.selectedProviderId) {
     result.providerId = layoutConfig.selectedProviderId;
     if (callbacks.onProviderChange) {
       callbacks.onProviderChange(layoutConfig.selectedProviderId);
     }
     logger.debug('Applied data provider from layout', {
       providerId: layoutConfig.selectedProviderId,
     }, 'useBlotterLayoutManager');
   }
   ```

### SimpleBlotter Component Changes ([SimpleBlotter.tsx](client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx))

**Added to `SimpleBlotter.tsx`:**

1. **Hook call** (line 173):
   ```typescript
   const layoutManager = useBlotterLayoutManager({
     blotterConfigId: viewInstanceId,
     userId,
     blotterName: 'SimpleBlotter',
     gridApi: gridApiRef.current,
     toolbarState: {
       isCollapsed: isToolbarCollapsed,
       isPinned: isToolbarPinned,
     },
     selectedProviderId: selectedProviderId ?? undefined,  // ← Pass current provider
   });
   ```

2. **Callbacks** (line 189):
   ```typescript
   layoutManager.registerApplyCallbacks({
     onToolbarStateChange: (state) => {
       logger.debug('Layout applying toolbar state', { state }, 'SimpleBlotter');
       setIsToolbarCollapsed(state.isCollapsed);
       setIsToolbarPinned(state.isPinned);
     },
     onProviderChange: (providerId) => {  // ← Restore provider on layout load
       logger.debug('Layout applying provider selection', { providerId }, 'SimpleBlotter');
       setSelectedProviderId(providerId);
     },
   });
   ```

## Layout-Level Settings

All grid-level attributes are now saved with each layout:

| Setting | Storage Level | Scope |
|---------|---------------|-------|
| **Data Provider** | **Layout Level** | Saved per-layout as snapshot |
| Column Visibility | Layout Level | Which columns shown/hidden |
| Column Widths | Layout Level | Column widths and order |
| Filters | Layout Level | Active filters |
| Sorts | Layout Level | Sort configuration |
| Toolbar State | Layout Level | Collapsed/pinned state |
| Side Panel State | Layout Level | Visibility and tool panel |
| Row Grouping | Layout Level | Grouping configuration |
| | | |
| Active Layout | View customData | Per-view (workspace persistence) |
| Default Layout | Component Config | Which layout loads by default |

## Benefits of This Architecture

### 1. Complete State Capture
Layouts capture the complete state of the grid exactly as it was when saved, including the data provider.

### 2. Flexibility
Users can have different layouts that use different data providers if they want different data sources for different views.

### 3. Predictable Behavior
When you switch to a layout, you get exactly what was saved - the same data provider, columns, filters, and sorting.

### 4. Grid-Level Consistency
Data provider is treated the same as other grid-level attributes like columns, filters, and sorting - all are saved together.

## How It Works

1. **Saving a Layout**:
   - User configures the grid with a data provider, columns, filters, etc.
   - User clicks "Save Layout"
   - Current state is captured including `selectedProviderId`
   - Layout is saved to the database

2. **Loading a Layout**:
   - User selects a layout from the dropdown
   - Layout manager reads the saved state
   - `onProviderChange` callback is called with the saved `selectedProviderId`
   - SimpleBlotter updates its state with `setSelectedProviderId(providerId)`
   - Grid is re-rendered with the saved provider and other grid settings

3. **Switching Between Layouts**:
   - Each layout has its own saved data provider selection
   - Switching layouts changes the data provider if the saved provider is different
   - All other grid settings are also restored (columns, filters, etc.)

## Migration Notes

Any existing layouts without `selectedProviderId` will continue to work - the user will need to select a provider manually and re-save the layout to capture the provider selection.

## Related Documentation

- [LAYOUT_PERSISTENCE_FIXES.md](LAYOUT_PERSISTENCE_FIXES.md) - Layout persistence implementation
- [shared/src/simpleBlotter.ts](shared/src/simpleBlotter.ts) - Type definitions showing storage structure
