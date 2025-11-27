# Workspace Save Error Fix

## Problem

When users saved a workspace using the OpenFin workspace save feature, they encountered the error:

```
Error: workspace not found
at async CustomBrowserProvider.updateSavedWorkspace (WorkspaceStorageProvider.ts:210:11)
```

This prevented workspace snapshots from being saved to IndexedDB, which caused:
- Renamed view tab captions to revert to old names on workspace reload
- Any other customData changes to be lost
- Layout configuration changes to not persist

## Root Cause

The issue was in [WorkspaceStorageProvider.ts](packages/openfin-platform/src/storage/WorkspaceStorageProvider.ts) in the `updateSavedWorkspace()` method.

When OpenFin called `updateSavedWorkspace()` for a workspace that wasn't yet in IndexedDB, the parent class (`super.updateSavedWorkspace(req)`) threw "workspace not found" error.

**Why this happened:**

1. OpenFin creates workspaces in memory first when user opens the application
2. When user clicks "Save Workspace", OpenFin calls `updateSavedWorkspace()` assuming the workspace already exists
3. But if the workspace hasn't been explicitly saved before, IndexedDB has no record of it
4. The parent class (default OpenFin storage) throws an error instead of creating the workspace
5. The error prevented the workspace from being saved at all

## Solution

Check if the workspace/page exists in IndexedDB before attempting to update it:

```typescript
// updateSavedWorkspace() - lines 210-223
const existingWorkspace = await super.getSavedWorkspace(req.workspace.workspaceId);

if (existingWorkspace) {
  // Update existing workspace
  console.log('[WorkspaceStorage] Updating existing workspace in IndexedDB');
  await super.updateSavedWorkspace(req);
} else {
  // Workspace doesn't exist yet, create it instead
  console.log('[WorkspaceStorage] Workspace not found in IndexedDB, creating new workspace');
  await super.createSavedWorkspace({
    workspace: req.workspace
  });
}
```

The same fix was applied to `updateSavedPage()` (lines 349-362) to prevent the same issue with pages.

## Impact

This fix enables proper workspace persistence, which unblocks several features:

1. **View Caption Persistence**:
   - ✅ User renames view tab
   - ✅ Caption saved to view's customData
   - ✅ **Workspace save succeeds** (was failing before)
   - ✅ Caption restored from workspace snapshot on reload

2. **Layout Configuration Persistence**:
   - Layout changes are now properly saved with workspace
   - Active layout ID persists across workspace reload

3. **Other customData Persistence**:
   - Any view customData changes are preserved
   - Toolbar state, sidebar state, etc. all persist correctly

## Testing

To test the fix:

1. **Rename a view tab** using the "Rename View" action
2. **Save the workspace** using OpenFin's workspace save feature
3. **Close and reopen the workspace**
4. **Verify** the renamed caption persists

Expected logs on workspace save (SUCCESS):
```
[WorkspaceStorage] updateSavedWorkspace { workspaceId: '...', title: '...' }
[WorkspaceStorage] Workspace not found in IndexedDB, creating new workspace
[WorkspaceStorage] Workspace updated in API
```

Or for existing workspaces:
```
[WorkspaceStorage] updateSavedWorkspace { workspaceId: '...', title: '...' }
[WorkspaceStorage] Updating existing workspace in IndexedDB
[WorkspaceStorage] Workspace updated in API
```

## Files Changed

- [packages/openfin-platform/src/storage/WorkspaceStorageProvider.ts](packages/openfin-platform/src/storage/WorkspaceStorageProvider.ts)
  - `updateSavedWorkspace()` - Added existence check before update (lines 210-223)
  - `updateSavedPage()` - Added existence check before update (lines 349-362)

## Related Issues

This fix was required to complete the View Caption Persistence feature, which involves:

1. **Rename Action** ([renameViewAction.ts](client/src/openfin/actions/renameViewAction.ts))
   - Updates view tab caption via `executeJavaScript("document.title = ...")`
   - Persists caption to view's customData

2. **Caption Restoration** ([SimpleBlotter.tsx](client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx))
   - Reads caption from customData on mount
   - Restores `document.title` to saved caption

3. **Workspace Save** (this fix)
   - Ensures customData changes are captured in workspace snapshot
   - Enables end-to-end caption persistence workflow
