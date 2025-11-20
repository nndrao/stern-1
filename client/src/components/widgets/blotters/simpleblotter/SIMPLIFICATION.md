# SimpleBlotter v2 - Simplified Implementation

## Problem

The original SimpleBlotter had become too complex with:
- **Too many hooks** (15+ custom hooks)
- **Circular dependencies** (hooks depending on other hooks)
- **Complex memoization** (nested useMemo/useCallback everywhere)
- **Unclear data flow** (hard to trace what triggers re-renders)
- **Re-render loops** (component remounting on every data batch)

## Solution

Created a new, simplified implementation (`SimpleBlotter.v2.tsx`) following these principles:

### 1. Minimal State
Only 4 pieces of state:
- `selectedProviderId` - Which provider is selected
- `availableProviders` - List of providers
- `columns` - Grid column definitions
- `isLoading` - Loading indicator

### 2. Stable References
Used refs for values that change but shouldn't trigger re-renders:
- `gridApiRef` - Grid API instance
- `snapshotRowsRef` - Accumulated snapshot data
- `snapshotLoadedRef` - Whether snapshot has loaded
- `viewInstanceId` - Never changes
- `userId` - Never changes

### 3. Clear Data Flow
```
User selects provider
  ↓
Load provider config/columns
  ↓
Setup data handlers (snapshot, update, error)
  ↓
Connect to provider
  ↓
Accumulate snapshot batches in ref
  ↓
On snapshot complete, load all rows into grid at once
  ↓
Apply real-time updates via transaction API
```

### 4. No Circular Dependencies
Each useEffect has a clear, single purpose:
- **Effect 1**: Load available providers (runs once)
- **Effect 2**: Load columns when provider changes
- **Effect 3**: Setup data handlers when adapter changes
- **Effect 4**: Connect to provider when ready

## Key Differences from Original

### Original Implementation
```typescript
// 15+ custom hooks
const state = useBlotterState();
const gridApi = useGridApi();
const eventHandlers = useEventHandlers();
const profileManager = useProfileManager();
const columnGroups = useColumnGroups();
const calculatedColumns = useCalculatedColumns();
const dataProvider = useDataProvider();
const gridOptions = useGridOptions();
// ... many more

// Complex memoization everywhere
const memoizedValue = useMemo(() => {
  return useMemo(() => {
    // nested complexity
  }, [dep1, dep2]);
}, [dep3, dep4]);

// Circular dependencies
dataProvider depends on gridApi
gridApi depends on eventHandlers
eventHandlers depend on state
state depends on dataProvider
```

### New Implementation
```typescript
// Direct useState/useRef
const [selectedProviderId, setSelectedProviderId] = useState(null);
const gridApiRef = useRef(null);

// Simple, linear effects
useEffect(() => {
  // Load providers once
}, []);

useEffect(() => {
  // Load columns when provider changes
}, [selectedProviderId]);

// No circular dependencies
```

## Benefits

1. **Predictable** - Easy to trace what happens when
2. **Debuggable** - No mystery re-renders
3. **Maintainable** - Less code, clearer purpose
4. **Performant** - No unnecessary re-renders
5. **Deterministic** - Same inputs always produce same outputs

## Testing

The new implementation can be tested by updating the import in `main.tsx`:

```typescript
// Old
const SimpleBlotter = lazy(() => import('./components/widgets/blotters/simpleblotter/SimpleBlotter'));

// New
const SimpleBlotter = lazy(() => import('./components/widgets/blotters/simpleblotter/SimpleBlotter.v2'));
```

## Migration Plan

Once the new implementation is verified:

1. Test with all data providers
2. Add back essential features (if any were removed)
3. Keep the simplified architecture
4. Replace original implementation
5. Delete old complex hooks

## What Was Removed

Features intentionally removed for simplicity (can be added back if needed):
- Profile management
- Column groups
- Calculated columns
- Conditional formatting
- Grid options customization
- Export functionality
- OpenFin event subscriptions (for theme changes, etc.)
- Multiple dialog systems

**Note:** These can be added back one at a time, maintaining the simplified architecture.

## Core Architecture

```
SimpleBlotter.v2.tsx (300 lines)
  ├─ Uses useDataProviderAdapter (existing)
  ├─ Uses useSternPlatform (existing)
  ├─ Direct useState for simple state
  ├─ Direct useRef for non-rendering values
  └─ Simple useEffect for side effects

NO custom hooks cascade
NO complex memoization patterns
NO circular dependencies
```

## Next Steps

1. Test the new implementation with real data
2. Verify no re-render loops
3. Add back essential features incrementally
4. Keep the architecture simple
