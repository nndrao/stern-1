# Re-render Loop Fix

**Date:** 2025-11-02
**Issue:** SimpleBlotter was subscribing/unsubscribing to OpenFin events continuously in a loop
**Status:** ✅ Fixed

---

## Problem Description

The SimpleBlotter component was caught in an infinite re-render loop, causing:

1. Continuous subscribe/unsubscribe cycles (~every 60ms)
2. Grid container remounting repeatedly
3. Excessive logging: `"Subscribing to OpenFin events"` → `"Unsubscribing from OpenFin events"`
4. Poor performance and unnecessary resource usage

### Console Evidence
```
logger.ts:59 INFO [SimpleBlotter] Subscribing to OpenFin events
logger.ts:55 DEBUG [SternPlatformProvider] Subscribing to event {topic: 'stern-platform:theme-change'}
logger.ts:55 DEBUG [SternPlatformProvider] Subscribing to event {topic: 'stern-platform:config-updated'}
logger.ts:55 DEBUG [SternPlatformProvider] Subscribing to event {topic: 'stern-platform:data-refresh'}
SimpleBlotter.tsx:815 DEBUG: Grid container mounted
logger.ts:59 INFO [SimpleBlotter] Unsubscribing from OpenFin events
useDataProvider.ts:52 [DataProvider] Setting up snapshot handler
[... repeats continuously ...]
```

---

## Root Cause Analysis

### Issue 1: SternPlatformProvider Context Recreation

**File:** [SternPlatformProvider.tsx](../client/src/providers/SternPlatformProvider.tsx)
**Lines:** 274-290 (original)

The `contextValue` object was being created on EVERY render without memoization:

```typescript
// ❌ BEFORE (BROKEN)
const contextValue: SternPlatformContextValue = {
  appData: {
    variables: appDataVariables,  // Changes frequently
    get: getAppDataVariable,
    has: hasAppDataVariable,
    isReady: isAppDataReady,
  },
  configService,
  dataProviderConfigService,
  apiBaseUrl,
  environment: isOpenFin ? 'openfin' : 'browser',
  isOpenFin,
  subscribeToEvent,
  broadcastEvent,
  isReady,
  error,
};
```

**Problem:** Every time `appDataVariables` changed, the entire context object got a new reference, causing all consumers to re-render.

---

### Issue 2: Over-broad useEffect Dependencies

**File:** [SimpleBlotter.tsx](../client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx)
**Lines:** 599-607 (original)

The OpenFin event subscription useEffect had overly broad dependencies:

```typescript
// ❌ BEFORE (BROKEN)
}, [
  useOpenFin,
  platform,              // ← Entire object (unstable reference)
  userId,
  configKey,
  dataProvider,          // ← Entire object (unstable reference)
  setTheme,
  setCurrentProfile,
]);
```

**Problem:**
- `platform` object reference changed on every context update
- This triggered the useEffect to re-run
- Which unsubscribed and re-subscribed to all OpenFin events
- Creating an infinite loop

---

### Issue 3: Unmemoized Callback Functions

**File:** [SimpleBlotter.tsx](../client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx)
**Lines:** 510-521 (original)

The `useDataProvider` hook was receiving an inline callback function:

```typescript
// ❌ BEFORE (BROKEN)
const dataProvider = useDataProvider({
  providerId: selectedProviderId,
  gridApi: gridApi.gridApiRef.current,
  onConnected: setConnected,
  onLoading: setLoading,
  onError: (error) => {        // ← New function on every render!
    setError(error);
    onError?.(error);
  },
  onStatistics: setStatistics,
  onRowCount: setRowCount,
});
```

**Problem:**
- Inline arrow function `(error) => { ... }` creates a new reference on every render
- `useDataProvider` has this function in its useEffect dependencies
- Every re-render creates a new function → triggers useEffect → causes re-render → repeat
- This created a continuous re-render loop during snapshot data loading

---

## Solution

### Fix 1: Memoize Platform Context

**File:** [SternPlatformProvider.tsx](../client/src/providers/SternPlatformProvider.tsx)
**Lines:** 273-301

```typescript
// ✅ AFTER (FIXED)
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,      // ← Added useMemo
  ReactNode
} from 'react';

// ...

// Context value - memoized to prevent unnecessary re-renders
const contextValue: SternPlatformContextValue = useMemo(() => ({
  appData: {
    variables: appDataVariables,
    get: getAppDataVariable,
    has: hasAppDataVariable,
    isReady: isAppDataReady,
  },
  configService,
  dataProviderConfigService,
  apiBaseUrl,
  environment: isOpenFin ? 'openfin' : 'browser',
  isOpenFin,
  subscribeToEvent,
  broadcastEvent,
  isReady,
  error,
}), [
  appDataVariables,
  getAppDataVariable,
  hasAppDataVariable,
  isAppDataReady,
  apiBaseUrl,
  isOpenFin,
  subscribeToEvent,
  broadcastEvent,
  isReady,
  error,
]);
```

**Benefits:**
- Context object only recreated when dependencies actually change
- Prevents cascade of re-renders in all consuming components
- Stable reference for useEffect dependencies

---

### Fix 2: Refine useEffect Dependencies

**File:** [SimpleBlotter.tsx](../client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx)
**Lines:** 599-607

```typescript
// ✅ AFTER (FIXED)
}, [
  useOpenFin,
  platform.isReady,         // ← Only the specific property needed
  platform.subscribeToEvent,// ← Only the specific function needed
  platform.configService,   // ← Only the specific service needed
  userId,
  configKey,
  dataProvider.connect,     // ← Only the specific function needed
]);
```

**Benefits:**
- Only depend on specific properties/functions that are actually used
- Memoized functions (`subscribeToEvent`, `dataProvider.connect`) have stable references
- useEffect only re-runs when meaningful values change
- Breaks the re-render loop

---

### Fix 3: Memoize Callback Functions

**File:** [SimpleBlotter.tsx](../client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx)
**Lines:** 510-524

```typescript
// ✅ AFTER (FIXED)
// Import useCallback
import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';

// ...

// Memoize error handler to prevent re-render loop
const handleDataProviderError = useCallback((error: Error) => {
  setError(error);
  onError?.(error);
}, [onError]);

const dataProvider = useDataProvider({
  providerId: selectedProviderId,
  gridApi: gridApi.gridApiRef.current,
  onConnected: setConnected,
  onLoading: setLoading,
  onError: handleDataProviderError,  // ← Memoized callback with stable reference
  onStatistics: setStatistics,
  onRowCount: setRowCount,
});
```

**Benefits:**
- Callback function has stable reference (only changes if `onError` prop changes)
- Prevents useEffect in `useDataProvider` from re-running on every render
- Eliminates re-render loop during snapshot data loading
- Performance improvement during high-frequency updates

---

## Testing & Verification

### Before Fix
```
[SimpleBlotter] Subscribing to OpenFin events       @ 15:15:38.714
[SimpleBlotter] Unsubscribing from OpenFin events   @ 15:15:39.641
[SimpleBlotter] Subscribing to OpenFin events       @ 15:15:39.647
[SimpleBlotter] Unsubscribing from OpenFin events   @ 15:15:39.701
[SimpleBlotter] Subscribing to OpenFin events       @ 15:15:39.706
[SimpleBlotter] Unsubscribing from OpenFin events   @ 15:15:40.628
[... continues infinitely ...]
```

### After Fix
```
[SimpleBlotter] Subscribing to OpenFin events       @ 15:18:45.234
[... stable, no more unsubscribe/resubscribe loop ...]
```

✅ **Verified:**
- Component subscribes once on mount
- No continuous unsubscribe/resubscribe cycles
- Grid container mounts once and stays stable
- Performance dramatically improved

---

## Best Practices Applied

### 1. Memoize Context Values
```typescript
// Always wrap context values in useMemo
const contextValue = useMemo(() => ({
  // ... context properties
}), [/* only necessary dependencies */]);
```

### 2. Minimal useEffect Dependencies
```typescript
// ❌ BAD - Entire object
useEffect(() => { ... }, [platform, dataProvider]);

// ✅ GOOD - Specific properties
useEffect(() => { ... }, [
  platform.isReady,
  platform.subscribeToEvent,
  dataProvider.connect,
]);
```

### 3. Stable Function References
```typescript
// Use useCallback for functions passed to children
const handleEvent = useCallback((data) => {
  // ... logic
}, [/* minimal dependencies */]);
```

---

## Related Issues

This fix also resolves:
- Excessive AG Grid re-initialization
- Snapshot handler being reset repeatedly
- Data provider connection instability
- Unnecessary IAB subscribe/unsubscribe overhead

---

## Impact

**Performance Improvements:**
- ✅ Eliminated ~15-20 re-renders per second during snapshot loading
- ✅ Reduced IAB event churn (no more continuous subscribe/unsubscribe)
- ✅ Stable grid container (no remounting)
- ✅ Lower CPU usage
- ✅ Smooth data loading without render loop interruptions

**Code Quality:**
- ✅ Proper React hook dependency management
- ✅ Memoization pattern for context providers
- ✅ Memoized callbacks with `useCallback`
- ✅ Cleaner console logs (no spam)

---

## References

- [React useMemo Documentation](https://react.dev/reference/react/useMemo)
- [React Context Best Practices](https://react.dev/learn/passing-data-deeply-with-context#optimizing-re-renders-when-passing-objects-and-functions)
- [useEffect Dependency Rules](https://react.dev/learn/removing-effect-dependencies)
