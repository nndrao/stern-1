# Debug Layout Persistence Issue

## Problem
Two views of "Positions/Blotter1" with different layout selections both load with the same layout after workspace restore.

## What Should Happen

### Scenario
1. User opens View A of "Positions/Blotter1" → Loads default layout
2. User selects "Layout 1" in View A → customData.activeLayoutId = "layout-1-uuid"
3. User opens View B of "Positions/Blotter1" → Loads default layout
4. User selects "Layout 2" in View B → customData.activeLayoutId = "layout-2-uuid"
5. User saves workspace
6. User restores workspace
7. **Expected**: View A loads "Layout 1", View B loads "Layout 2"
8. **Actual**: Both views load the same layout

## Key Code Paths

### 1. View Creation (menuLauncher.ts:145-162)
```typescript
customData: {
  menuItemId: item.id,
  caption: item.caption,
  configId,           // SAME for both views (config reuse)
  isExistingConfig
  // activeLayoutId NOT set here - correct!
}
```

### 2. Layout Selection (useBlotterLayoutManager.ts:selectLayout)
```typescript
await setActiveLayoutId(layoutId);  // Updates view.customData
```

### 3. Workspace Restore (useBlotterLayoutManager.ts:initializeBlotter)
```typescript
const viewActiveLayoutId = await getActiveLayoutId();  // Reads from view.customData
```

## Debugging Steps

### Step 1: Verify customData is being written
Add logging in `selectLayout` to confirm `setActiveLayoutId` is called:
```typescript
logger.info('Calling setActiveLayoutId', { layoutId, blotterConfigId });
await setActiveLayoutId(layoutId);
logger.info('setActiveLayoutId completed', { layoutId, blotterConfigId });
```

### Step 2: Verify customData persists with workspace
After selecting different layouts in two views, check the workspace JSON to see if customData contains different activeLayoutIds for each view.

### Step 3: Verify customData is being read on restore
Add logging in `initializeBlotter` to see what's read from customData:
```typescript
logger.info('Reading activeLayoutId from customData', { blotterConfigId });
const viewActiveLayoutId = await getActiveLayoutId();
logger.info('Got activeLayoutId from customData', { viewActiveLayoutId, blotterConfigId });
```

### Step 4: Check if both views share the same view instance
The issue might be that both views are actually using the same view ID somehow, so they share the same customData.

## Potential Root Causes

1. **Both views reading same customData** - If `fin.View.getCurrentSync()` returns the same view for both instances
2. **customData not persisting** - OpenFin not saving customData with workspace
3. **customData being overwritten** - Something is clearing/resetting activeLayoutId after it's set
4. **Race condition** - Layout initialization happening before customData is fully loaded

## Fix Applied

1. ✅ Added customData update in `saveAsNewLayout`
2. ✅ Added customData update in `handleDeleteLayout`
3. ✅ Added customData initialization for default layout in `initializeBlotter`

## Next Steps

1. Add detailed logging to track customData read/write operations
2. Add view identity logging (view.name, view.identity) to confirm different views
3. Check OpenFin workspace snapshot JSON to verify customData structure
4. Test with explicit logging of `fin.View.getCurrentSync()` identity
