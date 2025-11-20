# Value Formatter Error Fix

## Problem
AG Grid error #16: "Processing of the expression failed" with formatter strings like `'2DecimalWithThousandSeparator'`

### Root Cause
- Column configurations stored formatter **names** as strings (e.g., `'2DecimalWithThousandSeparator'`)
- No implementation existed to resolve these strings to actual formatter **functions**
- AG Grid received strings and tried to evaluate them as JavaScript expressions
- This caused `SyntaxError: Invalid or unexpected token`

## Solution

### 1. Created Formatter Implementations

**File: `client/src/formatters/DecimalFormatters.ts`**
- 20 decimal formatters (0-9 decimals, with/without thousand separators)
- Performance-optimized with pre-compiled regex
- Registry object `decimalFormatters` for string-based lookup

**File: `client/src/formatters/DateFormatters.ts`**
- 18 date formatters (ISO, US, EU, Long, Short, Relative, Unix, etc.)
- Robust date parsing for various input formats
- Registry object `dateFormatters` for string-based lookup

**File: `client/src/formatters/index.ts`**
- Combined `agGridValueFormatters` object
- Helper function `resolveValueFormatter()` for string-to-function conversion
- Type-safe with TypeScript

### 2. Updated Column Processing

**File: `client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx`**

Added formatter resolution when loading provider columns:

```typescript
// Before (BROKEN)
const columns: ColDef[] = providerConfig.config?.columnDefinitions || [];

// After (FIXED)
const rawColumns: ColDef[] = providerConfig.config?.columnDefinitions || [];

// Resolve formatter strings to actual functions
const columns: ColDef[] = rawColumns.map(col => {
  if (col.valueFormatter && typeof col.valueFormatter === 'string') {
    const formatterFunc = resolveValueFormatter(col.valueFormatter);
    if (formatterFunc) {
      return { ...col, valueFormatter: formatterFunc };
    }
  }
  return col;
});
```

## How It Works

1. **Configuration stores formatter names as strings**
   ```json
   {
     "field": "price",
     "valueFormatter": "2DecimalWithThousandSeparator"
   }
   ```

2. **Resolution converts strings to functions**
   ```typescript
   const formatterFunc = resolveValueFormatter('2DecimalWithThousandSeparator');
   // Returns: (params) => '25,452,881.94'
   ```

3. **AG Grid receives function reference**
   ```typescript
   {
     field: 'price',
     valueFormatter: (params) => '25,452,881.94'  // Actual function
   }
   ```

## Testing

Before fix:
```
AG Grid: error #16 Processing of the expression failed
Expression = 2DecimalWithThousandSeparator
Exception = SyntaxError: Invalid or unexpected token
```

After fix:
- Values display correctly formatted: `25,452,881.94`
- No errors
- Performance optimized

## Implementation Notes

- ✅ Based on proven AGV3 implementation
- ✅ Zero anti-patterns
- ✅ Performance-optimized with caching
- ✅ Type-safe with full TypeScript support
- ✅ Handles edge cases (null, NaN, invalid dates)

## Available Formatters

### Decimal Formatters (20)
- `0Decimal` through `9Decimal`
- `0DecimalWithThousandSeparator` through `9DecimalWithThousandSeparator`

### Date Formatters (18)
- ISO: `ISODate`, `ISODateTime`, `ISODateTimeMillis`
- US: `USDate`, `USDateTime`, `USDateTime12Hour`
- EU: `EUDate`, `EUDateTime`
- Human: `LongDate`, `ShortDate`, `LongDateTime`, `ShortDateTime`
- Time: `Time24Hour`, `Time12Hour`, `TimeShort`
- Special: `DateFromNow`, `UnixTimestamp`, `UnixTimestampMillis`

## Next Steps (Optional)

If other configuration points create column definitions, they should also resolve formatters:

1. `StompConfigurationForm.tsx` - If it creates columns dynamically
2. `ColumnsTab.tsx` - If users can configure formatters
3. Any other component that builds `ColDef[]` from configuration

Use the same pattern:
```typescript
import { resolveValueFormatter } from '@/formatters';

const columns = rawColumns.map(col => {
  if (col.valueFormatter && typeof col.valueFormatter === 'string') {
    const formatterFunc = resolveValueFormatter(col.valueFormatter);
    if (formatterFunc) {
      return { ...col, valueFormatter: formatterFunc };
    }
  }
  return col;
});
```
