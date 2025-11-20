# CRITICAL FIX NEEDED - Re-render Loop

## Problem
The re-render loop is STILL happening because `gridApi` is in the dependency arrays of useEffects in `useDataProvider.ts`.

Every time the component re-renders, it passes `gridApi.gridApiRef.current` which is a different object reference, causing ALL the useEffects with `gridApi` in dependencies to re-run.

## Files to Fix

### File: `client/src/components/widgets/blotters/simpleblotter/hooks/useDataProvider.ts`

**Changes needed:**

1. **Line 67** - Remove `gridApi` and `onRowCount` from dependency array:
```typescript
// BEFORE:
  }, [adapter, gridApi, onRowCount]);

// AFTER:
  }, [adapter]); // gridApi captured in closure
```

2. **Line 91** - Remove `gridApi` from dependency array:
```typescript
// BEFORE:
  }, [adapter, gridApi]);

// AFTER:
  }, [adapter]); // gridApi captured in closure
```

3. **Line 134** - Add `onRowCount` and `gridApi` since they ARE used:
```typescript
// BEFORE:
  }, [adapter, onLoading]);

// AFTER:
  }, [adapter, onLoading, onRowCount]); // gridApi captured in closure
```

4. **Line 236** - Remove `gridApi` from dependency array:
```typescript
// BEFORE:
  }, [providerId, gridApi, adapter.isConfigLoaded]);

// AFTER:
  }, [providerId, adapter.isConfigLoaded]); // gridApi captured in closure, don't need in deps
```

## Why This Works

React useEffect dependencies should only include:
1. Props/state that the effect READS and needs to react to changes
2. Functions that might change (should be memoized)

The `gridApi` object is:
- **Captured in the closure** when the effect runs
- **Used inside callbacks** that are registered with the adapter
- **Does NOT need to be in dependencies** because the grid API object itself doesn't change in a meaningful way that requires re-registering handlers

By removing `gridApi` from dependencies, the effects will only re-run when the `adapter` changes (which is stable), not on every render.

## Expected Result
- ✅ No more continuous subscribe/unsubscribe cycles
- ✅ Snapshot data loads smoothly without triggering re-renders
- ✅ Grid container mounts once and stays stable
- ✅ Clean console output

## Apply Fix
Manually edit the file and change the dependency arrays as shown above.
