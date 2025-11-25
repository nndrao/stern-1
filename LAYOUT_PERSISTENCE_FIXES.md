# Layout Persistence Fixes - Complete Summary

## Problem Statement
Two views of the same component (e.g., "Positions/Blotter1") with different layout selections both load with the same layout after workspace restore.

## Root Causes Identified and Fixed

### 1. **Missing customData Update in `saveAsNewLayout`**
**File**: `client/src/components/widgets/blotters/simpleblotter/useBlotterLayoutManager.ts:556-590`

**Issue**: When a user created a new layout via "Save As New", the layout was created and selected locally, but the view's `customData.activeLayoutId` was never updated.

**Fix**: Added `setActiveLayoutId()` call after creating the new layout:
```typescript
// Select the new layout
setSelectedLayoutId(result.unified.configId);

// Save activeLayoutId to view customData (per-view, persisted with workspace)
try {
  await setActiveLayoutId(result.unified.configId);
  logger.debug('Saved new layout to view customData', { layoutId: result.unified.configId }, 'useBlotterLayoutManager');
} catch (error) {
  logger.debug('Could not save to view customData (may not be in OpenFin)', { error }, 'useBlotterLayoutManager');
}
```

### 2. **Missing customData Initialization for Default Layout**
**File**: `client/src/components/widgets/blotters/simpleblotter/useBlotterLayoutManager.ts:481-504`

**Issue**: When a new view was created and initialized with the `defaultLayoutId`, the activeLayoutId was never written to customData. This meant:
- First view: Loads defaultLayout, no customData → Falls back to defaultLayout again on restore
- Second view: Loads defaultLayout, no customData → Falls back to defaultLayout again on restore
- Both views ended up with the same layout because customData was never set

**Fix**: Added `setActiveLayoutId()` call when using default layout:
```typescript
if (layoutToSelect) {
  logger.info('Selecting initial layout', {
    layoutId: layoutToSelect,
    source: layoutSource,
    blotterConfigId,
  }, 'useBlotterLayoutManager');
  setSelectedLayoutId(layoutToSelect);

  // IMPORTANT: If we selected a layout from default (not from customData),
  // we need to save it to customData so future saves work correctly
  if (layoutSource === 'default') {
    try {
      await setActiveLayoutId(layoutToSelect);
      logger.debug('Saved defaultLayoutId to view customData for new view', {
        layoutId: layoutToSelect,
        blotterConfigId,
      }, 'useBlotterLayoutManager');
    } catch (error) {
      logger.debug('Could not save default layout to view customData (may not be in OpenFin)', { error }, 'useBlotterLayoutManager');
    }
  }
}
```

### 3. **Improved Delete Layout Behavior**
**File**: `client/src/components/widgets/blotters/simpleblotter/useBlotterLayoutManager.ts:591-625`

**Issue**: When deleting the currently selected layout, the selection was cleared but no next layout was automatically selected.

**Fix**: Added smart next-layout selection that prefers the default layout:
```typescript
// If we deleted the selected layout, select the next available layout
if (selectedLayoutId === layoutId) {
  // Find the next layout to select
  const remainingLayouts = layouts.filter(l => l.unified.configId !== layoutId);

  if (remainingLayouts.length > 0) {
    // Select the first remaining layout (or default if it exists)
    const nextLayoutId = defaultLayoutId && remainingLayouts.some(l => l.unified.configId === defaultLayoutId)
      ? defaultLayoutId
      : remainingLayouts[0].unified.configId;

    logger.debug('Selecting next layout after deletion', { nextLayoutId }, 'useBlotterLayoutManager');

    // Use selectLayout to ensure customData is properly updated
    await selectLayout(nextLayoutId);
  } else {
    // No layouts left, clear selection and customData
    setSelectedLayoutId(null);
    await updateViewCustomData({ activeLayoutId: undefined });
  }
}
```

### 4. **Enhanced Logging for Debugging**
**File**: `client/src/openfin/utils/viewUtils.ts`

**Changes**:
- Added view identity logging to `getViewCustomData()` (lines 148-157)
- Upgraded `updateViewCustomData()` logging from debug to info level (lines 194-200)
- Added view name and identity to all customData operations

This will help identify:
- Which view is reading/writing customData
- Whether multiple views have distinct identities
- The exact customData values before and after updates

## Complete Flow: How It Works Now

### Scenario: User Opens Two Views with Different Layouts

```
1. User clicks "Positions/Blotter1" → View A created
   - menuLauncher creates view with configId (from config reuse)
   - SimpleBlotter mounts, calls initializeBlotter()
   - No customData.activeLayoutId exists
   - Falls back to defaultLayoutId = "layout-default-uuid"
   - ✅ NEW: Saves "layout-default-uuid" to customData
   - View A customData: { activeLayoutId: "layout-default-uuid" }

2. User selects "Layout 1" in View A
   - selectLayout("layout-1-uuid") called
   - ✅ Calls setActiveLayoutId("layout-1-uuid")
   - View A customData: { activeLayoutId: "layout-1-uuid" }

3. User clicks "Positions/Blotter1" again → View B created
   - menuLauncher creates view with SAME configId (config reuse)
   - SimpleBlotter mounts, calls initializeBlotter()
   - No customData.activeLayoutId exists (View B is separate)
   - Falls back to defaultLayoutId = "layout-default-uuid"
   - ✅ NEW: Saves "layout-default-uuid" to customData
   - View B customData: { activeLayoutId: "layout-default-uuid" }

4. User selects "Layout 2" in View B
   - selectLayout("layout-2-uuid") called
   - ✅ Calls setActiveLayoutId("layout-2-uuid")
   - View B customData: { activeLayoutId: "layout-2-uuid" }

5. User saves workspace
   - OpenFin saves workspace snapshot with all view customData
   - View A stored with: { activeLayoutId: "layout-1-uuid" }
   - View B stored with: { activeLayoutId: "layout-2-uuid" }

6. User restores workspace
   - View A restores, initializeBlotter() reads customData
   - ✅ Finds activeLayoutId = "layout-1-uuid"
   - Loads "Layout 1"

   - View B restores, initializeBlotter() reads customData
   - ✅ Finds activeLayoutId = "layout-2-uuid"
   - Loads "Layout 2"

✅ SUCCESS: Each view loads with its own layout!
```

## Debug Display

The toolbar now shows debug information:
- **Config ID**: The blotter configuration ID (truncated to 8 chars)
- **Layout ID**: The activeLayoutId from view customData
- **Layout Name**: The human-readable layout name

This helps verify:
- Both views have the same configId (config reuse working)
- Both views have different activeLayoutIds (per-view layouts working)

## Testing Instructions

### Test 1: Basic Per-View Layout
1. Open two views of "Positions/Blotter1"
2. Select "Layout A" in View 1
3. Select "Layout B" in View 2
4. Check toolbar debug display - should show different layout IDs
5. Save workspace
6. Reload workspace
7. ✅ View 1 should load "Layout A", View 2 should load "Layout B"

### Test 2: Save As New Layout
1. Open a view, customize the grid
2. Click "Save As New" → Name it "My Custom Layout"
3. Check toolbar debug display - should show new layout ID
4. Save workspace
5. Reload workspace
6. ✅ View should load "My Custom Layout"

### Test 3: Delete Current Layout
1. Open a view with multiple layouts
2. Select a non-default layout
3. Delete the selected layout
4. ✅ View should automatically switch to default layout (or first remaining)
5. Check toolbar debug display - should show new layout ID

## Log Messages to Watch For

When testing, look for these log messages in the browser console:

**On Layout Selection**:
```
[INFO] Updated view customData
  viewName: "positions-blotter-view-12345"
  updates: { activeLayoutId: "layout-uuid-abc" }
  newCustomData: { ...full customData... }
```

**On Workspace Restore**:
```
[INFO] Found activeLayoutId in view customData (workspace restore)
  activeLayoutId: "layout-uuid-abc"
  blotterConfigId: "config-uuid-xyz"
```

**On Default Layout Initialization**:
```
[DEBUG] Saved defaultLayoutId to view customData for new view
  layoutId: "layout-default-uuid"
  blotterConfigId: "config-uuid-xyz"
```

## Files Modified

1. **useBlotterLayoutManager.ts**
   - Added customData update in `saveAsNewLayout` (line 561)
   - Added customData initialization in `initializeBlotter` (line 493)
   - Enhanced `handleDeleteLayout` with smart next-layout selection (line 611)
   - Added `updateViewCustomData` import (line 29)

2. **viewUtils.ts**
   - Added view identity logging to `getViewCustomData()` (line 149)
   - Upgraded logging level in `updateViewCustomData()` to info (line 194)
   - Added comprehensive logging context (identity, names, before/after values)

3. **BlotterToolbar.tsx**
   - Added debug props: `debugConfigId`, `debugActiveLayoutId`, `debugLayoutName`
   - Added debug display section showing config ID and layout info

4. **SimpleBlotter.tsx**
   - Added debug state: `debugActiveLayoutId`, `debugLayoutName`
   - Added useEffect to fetch debug info from customData
   - Passed debug props to BlotterToolbar

## Expected Behavior

✅ **Correct**: Each view maintains its own activeLayoutId in customData
✅ **Correct**: Config reuse - all views of same component share configId
✅ **Correct**: Layout persistence - activeLayoutId persists with workspace
✅ **Correct**: Smart fallbacks - defaultLayout used for truly new views
✅ **Correct**: Automatic layout selection after delete

## If Still Not Working

If the issue persists, check the logs for:

1. **View Identity Mismatch**: Do both views have different `viewName` in logs?
2. **CustomData Not Persisting**: Is `view.updateOptions()` being called successfully?
3. **Workspace Not Saving CustomData**: Check OpenFin workspace JSON for customData
4. **Race Condition**: Is initializeBlotter running before customData is set?

Use the debug display on the toolbar to immediately see what customData each view has.
