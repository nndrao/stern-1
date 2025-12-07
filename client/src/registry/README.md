# Action Registry Documentation

This document explains how to implement custom actions for the SimpleBlotter toolbar system. Actions registered here will appear in the **Customize Toolbar** wizard, allowing users to add them to toolbar buttons at runtime.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Action Structure](#action-structure)
4. [Registration Methods](#registration-methods)
5. [Action Context](#action-context)
6. [Action Parameters](#action-parameters)
7. [Best Practices](#best-practices)
8. [Examples](#examples)

---

## Overview

The Action Registry is a singleton that manages all available toolbar actions. When users open the **Customize Toolbar** wizard (Settings → Customize Toolbar), they can browse and select from registered actions to attach to buttons.

```
┌─────────────────────────────────────────────────────────────────┐
│                    How Actions Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Register Actions (at app startup)                           │
│     └── actionRegistry.register({ id, handler, ... })           │
│                                                                 │
│  2. User Opens Customize Toolbar Wizard                         │
│     └── Sees all registered actions organized by category       │
│                                                                 │
│  3. User Assigns Action to Button                               │
│     └── Button config stores action ID (string)                 │
│                                                                 │
│  4. User Clicks Button on Toolbar                               │
│     └── actionRegistry.execute(id, context, data)               │
│     └── Handler function runs with context                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Step 1: Create Your Action File

Create a new file for your domain-specific actions:

```typescript
// client/src/registry/tradingActions.ts

import { RegisterActionOptions } from './actionRegistry';

export const tradingActions: RegisterActionOptions[] = [
  {
    id: 'trading:submitOrder',
    name: 'Submit Order',
    description: 'Submit selected rows as orders',
    category: 'Trading',
    icon: 'Send',
    handler: async (ctx) => {
      const selectedRows = ctx.selectedRows;
      if (selectedRows.length === 0) {
        alert('Please select rows to submit');
        return;
      }
      // Your order submission logic here
      console.log('Submitting orders:', selectedRows);
    },
    isAvailable: (ctx) => ctx.selectedRows.length > 0,
  },
];
```

### Step 2: Register Actions at Startup

Add your actions to `main.tsx`:

```typescript
// client/src/main.tsx

import { registerBuiltInActions } from './registry/builtInActions';
import { actionRegistry } from './registry/actionRegistry';
import { tradingActions } from './registry/tradingActions';

// Register AG-Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Register built-in toolbar actions
registerBuiltInActions();

// Register your custom actions
actionRegistry.registerMany(tradingActions);
```

### Step 3: Use in Toolbar

Open the blotter → Settings (gear icon) → **Customize Toolbar** → Add Button → Select your action from the "Trading" category.

---

## Action Structure

Each action must conform to the `RegisterActionOptions` interface:

```typescript
interface RegisterActionOptions {
  // Required fields
  id: string;           // Unique identifier (e.g., 'trading:submitOrder')
  name: string;         // Display name shown in wizard
  category: string;     // Category for grouping (e.g., 'Trading', 'Grid')
  handler: ActionHandler; // Function to execute

  // Optional fields
  description?: string;           // Tooltip/help text
  icon?: string;                  // Lucide icon name (e.g., 'Send', 'Download')
  parameters?: ActionParameter[]; // Configurable parameters
  isAvailable?: (ctx) => boolean; // When is this action available?
}
```

### Action ID Naming Convention

Use a namespaced format: `category:actionName`

```typescript
// Good examples
'grid:refresh'
'grid:exportCsv'
'trading:submitOrder'
'trading:cancelOrder'
'reporting:generatePdf'
'custom:myAction'

// Avoid
'refresh'           // No namespace
'my-action'         // Use camelCase after colon
'GRID:REFRESH'      // Use lowercase
```

---

## Registration Methods

### Method 1: Register Single Action

```typescript
import { actionRegistry } from '@/registry/actionRegistry';

actionRegistry.register({
  id: 'custom:singleAction',
  name: 'My Single Action',
  category: 'Custom',
  icon: 'Star',
  handler: (ctx) => {
    console.log('Action executed!');
  },
});
```

### Method 2: Register Multiple Actions

```typescript
import { actionRegistry } from '@/registry/actionRegistry';

const myActions = [
  { id: 'custom:action1', name: 'Action 1', category: 'Custom', handler: () => {} },
  { id: 'custom:action2', name: 'Action 2', category: 'Custom', handler: () => {} },
];

// Returns unsubscribe function
const unsubscribe = actionRegistry.registerMany(myActions);

// Later, to remove all these actions:
unsubscribe();
```

### Method 3: Dynamic Registration (Runtime)

```typescript
// Register when a feature module loads
useEffect(() => {
  const unsubscribe = actionRegistry.register({
    id: 'feature:dynamicAction',
    name: 'Dynamic Action',
    category: 'Feature',
    handler: handleAction,
  });

  return () => unsubscribe(); // Cleanup on unmount
}, []);
```

---

## Action Context

Every action handler receives a context object with useful properties and methods:

```typescript
interface ActionContext {
  // Grid Access
  gridApi: GridApi | null;       // AG Grid API instance
  selectedRows: any[];           // Currently selected row data
  rowData: any[];                // All row data in grid

  // Current State
  providerId: string | null;     // Selected data provider ID
  layoutId: string | null;       // Current layout ID

  // Methods
  refreshData: () => void;       // Refresh data from provider
  openDialog: (id: string, props?: Record<string, unknown>) => Promise<unknown>;
  closeDialog: (id: string) => void;
  emit: (event: string, data?: unknown) => void;

  // Platform
  isOpenFin: boolean;            // Running in OpenFin?
  platform: any;                 // Platform services
}
```

### Using Context in Handlers

```typescript
{
  id: 'example:contextDemo',
  name: 'Context Demo',
  category: 'Examples',
  handler: async (ctx, actionData) => {
    // Access grid API
    if (ctx.gridApi) {
      ctx.gridApi.deselectAll();
      ctx.gridApi.exportDataAsCsv();
    }

    // Work with selected rows
    if (ctx.selectedRows.length > 0) {
      console.log('Selected:', ctx.selectedRows);
    }

    // Refresh data
    ctx.refreshData();

    // Open a dialog
    const result = await ctx.openDialog('confirmation', {
      title: 'Confirm Action',
      message: 'Are you sure?',
    });

    // Check platform
    if (ctx.isOpenFin) {
      // OpenFin-specific logic
    }
  },
}
```

---

## Action Parameters

Actions can define configurable parameters that users set when adding the button:

```typescript
{
  id: 'export:customExport',
  name: 'Custom Export',
  category: 'Export',
  icon: 'Download',
  parameters: [
    {
      name: 'format',
      label: 'Export Format',
      type: 'select',
      required: true,
      default: 'csv',
      options: [
        { label: 'CSV', value: 'csv' },
        { label: 'Excel', value: 'xlsx' },
        { label: 'JSON', value: 'json' },
      ],
    },
    {
      name: 'includeHeaders',
      label: 'Include Headers',
      type: 'boolean',
      default: true,
    },
    {
      name: 'filename',
      label: 'Filename',
      type: 'string',
      default: 'export',
      description: 'Name of the exported file (without extension)',
    },
  ],
  handler: (ctx, actionData) => {
    const format = actionData?.format as string;
    const includeHeaders = actionData?.includeHeaders as boolean;
    const filename = actionData?.filename as string;

    switch (format) {
      case 'csv':
        ctx.gridApi?.exportDataAsCsv({ fileName: `${filename}.csv` });
        break;
      case 'xlsx':
        ctx.gridApi?.exportDataAsExcel({ fileName: `${filename}.xlsx` });
        break;
      case 'json':
        const data = JSON.stringify(ctx.rowData, null, 2);
        // Download as JSON file
        break;
    }
  },
}
```

### Parameter Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text input | Filename, URL |
| `number` | Numeric input | Count, limit |
| `boolean` | Toggle switch | Enable/disable |
| `select` | Single selection dropdown | Format, mode |
| `multiselect` | Multiple selection | Columns, tags |

---

## Best Practices

### 1. Check Availability

Use `isAvailable` to disable actions when they can't be used:

```typescript
{
  id: 'selection:process',
  name: 'Process Selected',
  category: 'Selection',
  handler: (ctx) => { /* ... */ },
  isAvailable: (ctx) => {
    // Only available when rows are selected
    return ctx.selectedRows.length > 0;
  },
}
```

### 2. Handle Errors Gracefully

```typescript
{
  id: 'api:fetchData',
  name: 'Fetch External Data',
  category: 'API',
  handler: async (ctx) => {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      // Process data
    } catch (error) {
      console.error('Action failed:', error);
      // Show user-friendly error
      ctx.openDialog('error', {
        title: 'Error',
        message: 'Failed to fetch data. Please try again.',
      });
    }
  },
}
```

### 3. Use Descriptive Names and Icons

```typescript
// Good
{
  id: 'trading:submitOrder',
  name: 'Submit Order',
  description: 'Submit selected positions as new orders to the exchange',
  icon: 'Send',
  category: 'Trading',
}

// Avoid
{
  id: 'action1',
  name: 'Do Thing',
  category: 'Misc',
}
```

### 4. Group Related Actions

Organize actions into logical categories:

```typescript
// tradingActions.ts
export const tradingActions = [
  { id: 'trading:buy', category: 'Trading', ... },
  { id: 'trading:sell', category: 'Trading', ... },
  { id: 'trading:cancel', category: 'Trading', ... },
];

// reportingActions.ts
export const reportingActions = [
  { id: 'reporting:daily', category: 'Reporting', ... },
  { id: 'reporting:weekly', category: 'Reporting', ... },
  { id: 'reporting:custom', category: 'Reporting', ... },
];
```

---

## Examples

### Example 1: Grid Operations

```typescript
// client/src/registry/gridActions.ts

export const gridActions: RegisterActionOptions[] = [
  {
    id: 'grid:selectVisible',
    name: 'Select Visible Rows',
    description: 'Select all rows currently visible in the viewport',
    category: 'Grid',
    icon: 'CheckSquare',
    handler: (ctx) => {
      ctx.gridApi?.selectAllFiltered();
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
  {
    id: 'grid:invertSelection',
    name: 'Invert Selection',
    description: 'Deselect selected rows and select unselected rows',
    category: 'Grid',
    icon: 'RefreshCw',
    handler: (ctx) => {
      if (!ctx.gridApi) return;

      const selectedIds = new Set(
        ctx.selectedRows.map(row => row.id)
      );

      ctx.gridApi.forEachNode(node => {
        const shouldSelect = !selectedIds.has(node.data?.id);
        node.setSelected(shouldSelect);
      });
    },
    isAvailable: (ctx) => !!ctx.gridApi,
  },
];
```

### Example 2: Trading Actions

```typescript
// client/src/registry/tradingActions.ts

export const tradingActions: RegisterActionOptions[] = [
  {
    id: 'trading:submitOrder',
    name: 'Submit Order',
    description: 'Submit selected positions as market orders',
    category: 'Trading',
    icon: 'Send',
    parameters: [
      {
        name: 'orderType',
        label: 'Order Type',
        type: 'select',
        required: true,
        default: 'market',
        options: [
          { label: 'Market', value: 'market' },
          { label: 'Limit', value: 'limit' },
          { label: 'Stop', value: 'stop' },
        ],
      },
    ],
    handler: async (ctx, actionData) => {
      const orderType = actionData?.orderType;
      const positions = ctx.selectedRows;

      if (positions.length === 0) {
        await ctx.openDialog('alert', {
          title: 'No Selection',
          message: 'Please select positions to submit.',
        });
        return;
      }

      const confirmed = await ctx.openDialog('confirm', {
        title: 'Confirm Order Submission',
        message: `Submit ${positions.length} ${orderType} order(s)?`,
      });

      if (confirmed) {
        // Submit orders via API
        for (const position of positions) {
          await submitOrder(position, orderType);
        }
        ctx.refreshData();
      }
    },
    isAvailable: (ctx) => ctx.selectedRows.length > 0,
  },
  {
    id: 'trading:cancelOrder',
    name: 'Cancel Order',
    description: 'Cancel selected pending orders',
    category: 'Trading',
    icon: 'XCircle',
    handler: async (ctx) => {
      const orders = ctx.selectedRows.filter(
        row => row.status === 'pending'
      );

      if (orders.length === 0) {
        await ctx.openDialog('alert', {
          title: 'No Pending Orders',
          message: 'No pending orders selected to cancel.',
        });
        return;
      }

      // Cancel orders
      for (const order of orders) {
        await cancelOrder(order.orderId);
      }
      ctx.refreshData();
    },
    isAvailable: (ctx) =>
      ctx.selectedRows.some(row => row.status === 'pending'),
  },
];
```

### Example 3: Reporting Actions

```typescript
// client/src/registry/reportingActions.ts

export const reportingActions: RegisterActionOptions[] = [
  {
    id: 'reporting:generatePdf',
    name: 'Generate PDF Report',
    description: 'Generate a PDF report of the current grid data',
    category: 'Reporting',
    icon: 'FileText',
    parameters: [
      {
        name: 'title',
        label: 'Report Title',
        type: 'string',
        required: true,
        default: 'Grid Report',
      },
      {
        name: 'orientation',
        label: 'Page Orientation',
        type: 'select',
        default: 'landscape',
        options: [
          { label: 'Portrait', value: 'portrait' },
          { label: 'Landscape', value: 'landscape' },
        ],
      },
      {
        name: 'includeFiltered',
        label: 'Include Only Filtered Rows',
        type: 'boolean',
        default: true,
      },
    ],
    handler: async (ctx, actionData) => {
      const title = actionData?.title as string;
      const orientation = actionData?.orientation as string;
      const includeFiltered = actionData?.includeFiltered as boolean;

      const data = includeFiltered
        ? getFilteredRows(ctx.gridApi)
        : ctx.rowData;

      await generatePdfReport({
        title,
        orientation,
        data,
        columns: ctx.gridApi?.getColumnDefs(),
      });
    },
    isAvailable: (ctx) => ctx.rowData.length > 0,
  },
  {
    id: 'reporting:emailReport',
    name: 'Email Report',
    description: 'Email the current grid data as an attachment',
    category: 'Reporting',
    icon: 'Mail',
    parameters: [
      {
        name: 'recipients',
        label: 'Recipients',
        type: 'string',
        required: true,
        description: 'Comma-separated email addresses',
      },
      {
        name: 'format',
        label: 'Attachment Format',
        type: 'select',
        default: 'xlsx',
        options: [
          { label: 'Excel', value: 'xlsx' },
          { label: 'CSV', value: 'csv' },
          { label: 'PDF', value: 'pdf' },
        ],
      },
    ],
    handler: async (ctx, actionData) => {
      const recipients = (actionData?.recipients as string).split(',');
      const format = actionData?.format as string;

      await sendEmailReport({
        recipients,
        format,
        data: ctx.rowData,
      });

      await ctx.openDialog('success', {
        title: 'Email Sent',
        message: `Report sent to ${recipients.length} recipient(s).`,
      });
    },
  },
];
```

---

## File Structure

Recommended organization for action files:

```
client/src/registry/
├── README.md                 # This documentation
├── index.ts                  # Module exports
├── actionRegistry.ts         # Core registry singleton
├── builtInActions.ts         # Standard grid/selection/view actions
├── tradingActions.ts         # Trading-specific actions
├── reportingActions.ts       # Reporting-specific actions
└── customActions.ts          # Your custom actions
```

---

## Troubleshooting

### Actions Not Appearing in Wizard

1. **Check registration**: Ensure `actionRegistry.register()` or `registerMany()` is called
2. **Check timing**: Registration must happen before the wizard opens (ideally at app startup in `main.tsx`)
3. **Check for errors**: Look for console errors during registration

### Action Not Executing

1. **Check `isAvailable`**: If defined, ensure it returns `true`
2. **Check handler errors**: Wrap handler in try/catch to see errors
3. **Check context**: Ensure required context properties are available (e.g., `gridApi`)

### Parameters Not Saving

1. **Check parameter names**: Must be valid JavaScript identifiers
2. **Check `actionData` access**: Use correct type assertions

---

## API Reference

### `actionRegistry.register(options)`

Register a single action. Returns unsubscribe function.

### `actionRegistry.registerMany(options[])`

Register multiple actions. Returns unsubscribe function that removes all.

### `actionRegistry.unregister(id)`

Remove an action by ID.

### `actionRegistry.get(id)`

Get a registered action by ID.

### `actionRegistry.getAll()`

Get all registered actions.

### `actionRegistry.getByCategory(category)`

Get all actions in a category.

### `actionRegistry.getCategories()`

Get list of all category names.

### `actionRegistry.execute(id, context, data?)`

Execute an action by ID with context and optional data.
