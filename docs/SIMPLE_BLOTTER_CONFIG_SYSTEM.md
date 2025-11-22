# SimpleBlotter Configuration System

## Overview

This document describes the configuration system for SimpleBlotter components in the Stern Trading Platform. The system enables users to:

- Save and manage multiple **layouts** (presentation configurations) for each blotter
- Define **rules** (conditional formatting, editing, column groups) at the blotter level
- Apply different combinations of rules across layouts
- Export/import layouts for sharing and backup

## Architecture

### Parent-Child Configuration Model

The system uses a **parent-child relationship** via a `parentId` field in the `UnifiedConfig` schema:

```
┌─────────────────────────────────────────────────────────────────┐
│ SimpleBlotter (Parent Config)                                   │
│ ─────────────────────────────────────────────────────────────── │
│ configId: "blotter-uuid-001"                                    │
│ componentType: "SimpleBlotter"                                  │
│ parentId: null                                                  │
│                                                                 │
│ config: {                                                       │
│   dataProviderId: "provider-uuid",                              │
│   defaultLayoutId: "layout-uuid-001",                           │
│   toolbar: {...},                                               │
│   themeMode: "system",                                          │
│   conditionalFormattingRules: [...],                            │
│   editingRules: [...],                                          │
│   columnGroups: [...],                                          │
│   ...                                                           │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
        │
        │ parentId reference
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layout 1 (Child Config)                                         │
│ ─────────────────────────────────────────────────────────────── │
│ configId: "layout-uuid-001"                                     │
│ componentType: "SimpleBlotterLayout"                            │
│ parentId: "blotter-uuid-001"  ◄── Links to parent blotter       │
│ name: "Trading View"                                            │
│ isDefault: true                                                 │
│                                                                 │
│ config: {                                                       │
│   columnDefs: [...],                                            │
│   columnState: [...],                                           │
│   filterState: {...},                                           │
│   activeFormattingRuleIds: ["rule-1", "rule-2"],                │
│   activeEditingRuleIds: ["edit-1"],                             │
│   ...                                                           │
│ }                                                               │
├─────────────────────────────────────────────────────────────────┤
│ Layout 2 (Child Config)                                         │
│ ─────────────────────────────────────────────────────────────── │
│ configId: "layout-uuid-002"                                     │
│ componentType: "SimpleBlotterLayout"                            │
│ parentId: "blotter-uuid-001"                                    │
│ name: "Risk View"                                               │
│ isDefault: false                                                │
│                                                                 │
│ config: {                                                       │
│   columnDefs: [...],                                            │
│   activeFormattingRuleIds: ["rule-1", "rule-3"],                │
│   activeEditingRuleIds: [],  // read-only view                  │
│   ...                                                           │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Design Decisions

1. **Rules defined at Blotter level, applied at Layout level**
   - Define conditional formatting rules, editing rules, column groups once
   - Each layout specifies which rules are active via ID references
   - Benefit: Update a rule once, affects all layouts using it

2. **Data Provider at Blotter level**
   - Blotter is bound to one data source
   - Switching layouts changes presentation, not data
   - Faster layout switching (no reconnection needed)

3. **Parent-Child via `parentId` field**
   - Each layout is a separate `UnifiedConfig` row
   - Linked to parent blotter via `parentId` field
   - Enables cascade delete, easy querying

4. **Blotter configId = OpenFin View Instance ID**
   - The blotter's `configId` is derived from the OpenFin view instance ID
   - This ID is passed via URL query parameter: `?id=<viewInstanceId>`
   - Persists across workspace save/restore cycles
   - See [Blotter Identity from OpenFin](#blotter-identity-from-openfin) section below

---

## Blotter Identity from OpenFin

### How It Works

When a SimpleBlotter is launched from the OpenFin dock menu, the view instance ID is:

1. **Generated** when the dock menu item is created (e.g., `menu-item-1763706906725-g4ho2wlcr`)
2. **Passed via URL** as a query parameter: `/blotters/simple?id=menu-item-1763706906725-g4ho2wlcr`
3. **Extracted** in the component using `getViewInstanceId()` from `viewUtils.ts`
4. **Used as configId** for the blotter configuration

### URL Structure

```
http://localhost:5173/blotters/simple?id=menu-item-1763706906725-g4ho2wlcr
                                      └─────────────────────────────────┘
                                              viewInstanceId
                                              (becomes configId)
```

### Code Flow

```typescript
// 1. Dock menu launcher creates view with ID in URL
// File: packages/openfin-platform/src/platform/menuLauncher.ts
const url = `${buildUrl(item.url)}?id=${encodeURIComponent(item.id)}`;

// 2. SimpleBlotter extracts the ID
// File: client/src/openfin/utils/viewUtils.ts
export function getViewInstanceId(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || generateViewId();
}

// 3. SimpleBlotter uses it as configId
// File: client/src/components/widgets/blotters/simpleblotter/SimpleBlotter.tsx
const viewInstanceId = useMemo(() => getViewInstanceId(), []);

// viewInstanceId is used to:
// - Load/save blotter configuration
// - Link layouts to this blotter (layouts have parentId = viewInstanceId)
```

### Benefits of This Approach

| Benefit | Description |
|---------|-------------|
| **Unique per view** | Each blotter instance has its own config |
| **Persistent** | Survives workspace save/restore |
| **Automatic** | No manual ID assignment needed |
| **Traceable** | ID visible in URL for debugging |
| **Consistent** | Same ID used throughout the system |

### Database Relationship

```
┌─────────────────────────────────────────────────────────────────┐
│ SimpleBlotter Config                                            │
│ ─────────────────────────────────────────────────────────────── │
│ configId: "menu-item-1763706906725-g4ho2wlcr"  ◄── From URL     │
│ componentType: "SimpleBlotter"                                  │
│ parentId: null                                                  │
│ name: "Blotter 1"                                               │
└─────────────────────────────────────────────────────────────────┘
        │
        │ parentId = "menu-item-1763706906725-g4ho2wlcr"
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ Layout Config                                                   │
│ ─────────────────────────────────────────────────────────────── │
│ configId: "layout-uuid-001"  (server-generated UUID)            │
│ componentType: "SimpleBlotterLayout"                            │
│ parentId: "menu-item-1763706906725-g4ho2wlcr"  ◄── Links to     │
│ name: "Trading View"                                   blotter  │
└─────────────────────────────────────────────────────────────────┘
```

### First-Time Load Behavior

When a blotter loads for the first time (no config exists):

1. Check if config exists for `viewInstanceId`
2. If not found, create default blotter config with:
   - `configId` = `viewInstanceId`
   - Default toolbar settings
   - No data provider (user must configure)
   - No layouts (user can create)
3. If found, load existing config and default layout

---

## Data Structures

### UnifiedConfig Schema Update

Add `parentId` field to support parent-child relationships:

```typescript
interface UnifiedConfig {
  // ... existing fields ...

  /**
   * Optional parent configuration ID for hierarchical configs.
   * Used to link child configs (e.g., layouts) to parent (e.g., blotter).
   */
  parentId?: string | null;
}
```

### Component Types

```typescript
export const COMPONENT_TYPES = {
  // ... existing types ...
  SIMPLE_BLOTTER: 'simple-blotter',
  SIMPLE_BLOTTER_LAYOUT: 'simple-blotter-layout',
} as const;
```

### SimpleBlotter Config (Parent)

```typescript
/**
 * Configuration for a SimpleBlotter instance.
 * Stored as UnifiedConfig with componentType: 'SimpleBlotter'
 */
interface SimpleBlotterConfig {
  // === Data Source ===
  /** Reference to DataProvider configuration */
  dataProviderId: string;

  // === Default Layout ===
  /** ID of the layout to load on startup */
  defaultLayoutId?: string;

  // === Toolbar Configuration ===
  toolbar: {
    showLayoutSelector: boolean;
    showExportButton: boolean;
    showFilterBar: boolean;
    showColumnChooser: boolean;
    showRefreshButton: boolean;
    showSettingsButton: boolean;
    customButtons?: ToolbarButton[];
  };

  // === Theme ===
  /** Theme preference for this blotter */
  themeMode: 'system' | 'light' | 'dark';

  // === Window/Display ===
  title: string;

  // === Behavior ===
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  autoRefreshInterval?: number;
  /** Enable real-time data updates via subscription */
  enableRealTimeUpdates: boolean;

  // === Rule Definitions (define once, use in layouts) ===

  /** Conditional formatting rules */
  conditionalFormattingRules: ConditionalFormatRule[];

  /** Cell editing rules */
  editingRules: EditingRule[];

  /** Column group definitions */
  columnGroups: ColumnGroup[];

  /** Value formatter definitions */
  valueFormatters: ValueFormatterDef[];

  /** Calculated column definitions */
  calculatedColumns: CalculatedColumnDef[];
}
```

### SimpleBlotter Layout Config (Child)

```typescript
/**
 * Layout configuration for a SimpleBlotter.
 * Stored as UnifiedConfig with componentType: 'SimpleBlotterLayout'
 * Links to parent blotter via parentId field.
 */
interface SimpleBlotterLayoutConfig {
  // === AG-Grid Column Configuration ===
  /** Column definitions */
  columnDefs: ColumnDef[];

  /** Column state (widths, order, visibility, pinning) */
  columnState: ColumnState[];

  // === AG-Grid State ===
  /** Filter model */
  filterState: Record<string, any>;

  /** Sort model */
  sortState: SortModelItem[];

  // === Active Rules (references to parent's rule definitions) ===
  /** IDs of active conditional formatting rules */
  activeFormattingRuleIds: string[];

  /** IDs of active editing rules */
  activeEditingRuleIds: string[];

  /** IDs of active column groups */
  activeColumnGroupIds: string[];

  /** IDs of active value formatters */
  activeFormatterIds: string[];

  /** IDs of active calculated columns */
  activeCalculatedColumnIds: string[];

  // === Display Options ===
  /** Row height in pixels */
  rowHeight?: number;

  /** Header height in pixels */
  headerHeight?: number;

  /** Pinned columns configuration */
  pinnedColumns?: {
    left: string[];
    right: string[];
  };

  // === Row Grouping ===
  /** Columns used for row grouping */
  rowGroupColumns?: string[];

  /** Columns used for pivot */
  pivotColumns?: string[];
}
```

### Rule Type Definitions

```typescript
/**
 * Conditional formatting rule definition
 */
interface ConditionalFormatRule {
  id: string;
  name: string;
  description?: string;

  /** Column field to apply rule to, or '*' for all columns */
  field: string | '*';

  /** Condition type */
  condition: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' |
             'between' | 'contains' | 'startsWith' | 'endsWith' | 'custom';

  /** Condition value(s) */
  value: any;
  value2?: any; // For 'between' condition

  /** Custom condition function (serialized) */
  customCondition?: string;

  /** Styling to apply when condition is met */
  style: {
    backgroundColor?: string;
    color?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline' | 'line-through';
  };

  /** Priority (lower = higher priority) */
  priority: number;
}

/**
 * Editing rule definition
 */
interface EditingRule {
  id: string;
  name: string;
  description?: string;

  /** Column field this rule applies to */
  field: string;

  /** Whether editing is allowed */
  editable: boolean;

  /** Condition for when editing is allowed (optional) */
  condition?: {
    field: string;
    operator: 'equals' | 'notEquals' | 'in' | 'notIn';
    value: any;
  };

  /** Validation rules */
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    customValidator?: string;
  };
}

/**
 * Column group definition
 */
interface ColumnGroup {
  id: string;
  name: string;
  description?: string;

  /** Column fields in this group */
  columns: string[];

  /** Whether group is initially expanded */
  defaultExpanded: boolean;
}

/**
 * Value formatter definition
 */
interface ValueFormatterDef {
  id: string;
  name: string;
  description?: string;

  /** Column field to apply formatter to */
  field: string;

  /** Formatter type */
  type: 'number' | 'currency' | 'percentage' | 'date' | 'custom';

  /** Format options */
  options: {
    // Number/Currency
    decimals?: number;
    thousandsSeparator?: boolean;
    prefix?: string;
    suffix?: string;
    currency?: string;

    // Date
    dateFormat?: string;

    // Custom
    customFormatter?: string;
  };
}

/**
 * Calculated column definition
 */
interface CalculatedColumnDef {
  id: string;
  name: string;
  description?: string;

  /** Field name for the calculated column */
  field: string;

  /** Header name to display */
  headerName: string;

  /** Calculation expression or function */
  expression: string;

  /** Dependencies (fields used in calculation) */
  dependencies: string[];

  /** Result type */
  resultType: 'number' | 'string' | 'boolean' | 'date';
}
```

---

## Database Schema

### UnifiedConfig Table Update

Add `parentId` column:

```sql
ALTER TABLE unified_configs
ADD COLUMN parent_id VARCHAR(36) NULL,
ADD INDEX idx_parent_id (parent_id),
ADD CONSTRAINT fk_parent_config
    FOREIGN KEY (parent_id)
    REFERENCES unified_configs(config_id)
    ON DELETE CASCADE;
```

For MongoDB:

```javascript
// Add index for parentId queries
db.configurations.createIndex({ parentId: 1 });

// Add index for component type + parent queries
db.configurations.createIndex({ componentType: 1, parentId: 1 });
```

---

## API Endpoints

### New Endpoint: Get Configs by Parent

```
GET /api/v1/configurations/by-parent/:parentId
```

**Query Parameters:**
- `includeDeleted` (boolean): Include soft-deleted configs
- `componentType` (string): Filter by component type

**Response:**
```json
{
  "data": [
    {
      "configId": "layout-uuid-001",
      "componentType": "simple-blotter-layout",
      "parentId": "blotter-uuid-001",
      "name": "Trading View",
      "config": { ... }
    }
  ],
  "total": 3
}
```

### Cascade Delete Behavior

When deleting a parent config:
- Option 1: Cascade delete all children (default)
- Option 2: Orphan children (set parentId to null)

```
DELETE /api/v1/configurations/:configId?cascade=true
```

---

## Service Layer

### SimpleBlotterConfigService

```typescript
class SimpleBlotterConfigService {
  private readonly baseUrl = '/configurations';

  /**
   * Create a new SimpleBlotter configuration
   */
  async createBlotter(config: SimpleBlotterConfig, userId: string): Promise<SimpleBlotterConfig>;

  /**
   * Update an existing SimpleBlotter configuration
   */
  async updateBlotter(configId: string, updates: Partial<SimpleBlotterConfig>, userId: string): Promise<SimpleBlotterConfig>;

  /**
   * Delete a SimpleBlotter and optionally its layouts
   */
  async deleteBlotter(configId: string, cascade?: boolean): Promise<void>;

  /**
   * Get a SimpleBlotter by ID
   */
  async getBlotter(configId: string): Promise<SimpleBlotterConfig | null>;

  /**
   * Get all SimpleBlotters for a user
   */
  async getBlottersByUser(userId: string): Promise<SimpleBlotterConfig[]>;
}
```

### SimpleBlotterLayoutService

```typescript
class SimpleBlotterLayoutService {
  private readonly baseUrl = '/configurations';

  /**
   * Create a new layout for a blotter
   */
  async createLayout(
    parentId: string,
    layout: SimpleBlotterLayoutConfig,
    userId: string
  ): Promise<SimpleBlotterLayoutConfig>;

  /**
   * Update an existing layout
   */
  async updateLayout(
    layoutId: string,
    updates: Partial<SimpleBlotterLayoutConfig>,
    userId: string
  ): Promise<SimpleBlotterLayoutConfig>;

  /**
   * Delete a layout
   */
  async deleteLayout(layoutId: string): Promise<void>;

  /**
   * Get all layouts for a blotter
   */
  async getLayoutsByBlotter(blotterConfigId: string): Promise<SimpleBlotterLayoutConfig[]>;

  /**
   * Get the default layout for a blotter
   */
  async getDefaultLayout(blotterConfigId: string): Promise<SimpleBlotterLayoutConfig | null>;

  /**
   * Set a layout as the default
   */
  async setDefaultLayout(layoutId: string, blotterConfigId: string): Promise<void>;

  /**
   * Clone/duplicate a layout
   */
  async cloneLayout(layoutId: string, newName: string, userId: string): Promise<SimpleBlotterLayoutConfig>;

  /**
   * Export layout as JSON
   */
  async exportLayout(layoutId: string): Promise<string>;

  /**
   * Import layout from JSON
   */
  async importLayout(
    parentId: string,
    layoutJson: string,
    userId: string
  ): Promise<SimpleBlotterLayoutConfig>;
}
```

---

## React Query Hooks

### Blotter Hooks

```typescript
// Get blotter configuration
function useSimpleBlotter(configId: string): UseQueryResult<SimpleBlotterConfig>;

// Get all blotters for user
function useSimpleBlotters(userId: string): UseQueryResult<SimpleBlotterConfig[]>;

// Create blotter mutation
function useCreateBlotter(): UseMutationResult<SimpleBlotterConfig, Error, CreateBlotterParams>;

// Update blotter mutation
function useUpdateBlotter(): UseMutationResult<SimpleBlotterConfig, Error, UpdateBlotterParams>;

// Delete blotter mutation
function useDeleteBlotter(): UseMutationResult<void, Error, DeleteBlotterParams>;
```

### Layout Hooks

```typescript
// Get all layouts for a blotter
function useBlotterLayouts(blotterConfigId: string): UseQueryResult<SimpleBlotterLayoutConfig[]>;

// Get single layout
function useBlotterLayout(layoutId: string): UseQueryResult<SimpleBlotterLayoutConfig>;

// Create layout mutation
function useCreateLayout(): UseMutationResult<SimpleBlotterLayoutConfig, Error, CreateLayoutParams>;

// Update layout mutation
function useUpdateLayout(): UseMutationResult<SimpleBlotterLayoutConfig, Error, UpdateLayoutParams>;

// Delete layout mutation
function useDeleteLayout(): UseMutationResult<void, Error, DeleteLayoutParams>;

// Set default layout mutation
function useSetDefaultLayout(): UseMutationResult<void, Error, SetDefaultLayoutParams>;

// Import layout mutation
function useImportLayout(): UseMutationResult<SimpleBlotterLayoutConfig, Error, ImportLayoutParams>;
```

---

## UI Components

### LayoutToolbar

Location: `client/src/components/blotter/LayoutToolbar.tsx`

```tsx
interface LayoutToolbarProps {
  blotterConfigId: string;
  currentLayoutId: string | null;
  onLayoutChange: (layoutId: string) => void;
  onSave: () => void;
  isDirty: boolean;
}
```

Features:
- Layout dropdown selector (shows all layouts, star for default)
- Save button (saves current state to selected layout)
- Save As button (creates new layout from current state)
- Manage button (opens LayoutManageDialog)
- Export/Import buttons

### LayoutSaveDialog

Location: `client/src/components/blotter/LayoutSaveDialog.tsx`

```tsx
interface LayoutSaveDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, setAsDefault: boolean) => void;
  isLoading: boolean;
}
```

Fields:
- Name (required)
- Description (optional)
- Set as default checkbox

### LayoutManageDialog

Location: `client/src/components/blotter/LayoutManageDialog.tsx`

```tsx
interface LayoutManageDialogProps {
  open: boolean;
  onClose: () => void;
  blotterConfigId: string;
  currentLayoutId: string | null;
  onLayoutSelect: (layoutId: string) => void;
}
```

Features:
- List of all layouts
- Rename (inline edit)
- Set as default (star toggle)
- Duplicate
- Delete (with confirmation)

---

## SimpleBlotter Integration

### Component Props

```tsx
interface SimpleBlotterProps {
  /** Configuration ID of the blotter (required for config system) */
  configId: string;

  /** User ID for fetching user-specific configs */
  userId: string;

  /** Optional: Override initial layout */
  initialLayoutId?: string;

  /** Callback when layout changes */
  onLayoutChange?: (layoutId: string) => void;
}
```

### State Management

```tsx
function SimpleBlotter({ configId, userId, initialLayoutId, onLayoutChange }: SimpleBlotterProps) {
  // Fetch blotter config
  const { data: blotterConfig } = useSimpleBlotter(configId);

  // Fetch layouts
  const { data: layouts } = useBlotterLayouts(configId);

  // Current layout state
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(
    initialLayoutId || blotterConfig?.defaultLayoutId || null
  );

  // Track if current state differs from saved layout
  const [isDirty, setIsDirty] = useState(false);

  // Grid API reference for state extraction
  const gridRef = useRef<AgGridReact>(null);

  // Extract current grid state for saving
  const extractCurrentState = useCallback((): Partial<SimpleBlotterLayoutConfig> => {
    const api = gridRef.current?.api;
    if (!api) return {};

    return {
      columnState: api.getColumnState(),
      filterState: api.getFilterModel(),
      sortState: api.getSortModel(),
      // ... extract other state
    };
  }, []);

  // Apply layout to grid
  const applyLayout = useCallback((layout: SimpleBlotterLayoutConfig) => {
    const api = gridRef.current?.api;
    if (!api) return;

    api.applyColumnState({ state: layout.columnState });
    api.setFilterModel(layout.filterState);
    api.setSortModel(layout.sortState);
    // ... apply other state

    setIsDirty(false);
  }, []);

  // ... rest of component
}
```

---

## File Structure

```
shared/
├── src/
│   ├── configuration.ts          # Add parentId to UnifiedConfig
│   └── simpleBlotter.ts          # NEW: Type definitions
│
server/
├── src/
│   ├── types/
│   │   └── configuration.ts      # Add parentId
│   ├── storage/
│   │   ├── SQLiteStorage.ts      # Add parentId column
│   │   └── MongoStorage.ts       # Add parentId index
│   └── routes/
│       └── configurations.ts     # Add by-parent endpoint
│
client/
├── src/
│   ├── services/
│   │   └── api/
│   │       ├── simpleBlotterConfigService.ts   # NEW
│   │       └── simpleBlotterLayoutService.ts   # NEW
│   ├── hooks/
│   │   └── api/
│   │       ├── useSimpleBlotterQueries.ts      # NEW
│   │       └── useSimpleBlotterLayoutQueries.ts # NEW
│   └── components/
│       └── blotter/
│           ├── LayoutToolbar.tsx       # NEW
│           ├── LayoutSelector.tsx      # NEW
│           ├── LayoutSaveDialog.tsx    # NEW
│           └── LayoutManageDialog.tsx  # NEW
```

---

## Implementation Phases

### Phase 1: Schema Updates
1. Add `parentId` to `UnifiedConfig` in shared types
2. Add `SIMPLE_BLOTTER` and `SIMPLE_BLOTTER_LAYOUT` to component types
3. Update server types

### Phase 2: Type Definitions
1. Create `shared/src/simpleBlotter.ts` with all interfaces
2. Export from shared package index

### Phase 3: Backend Updates
1. Add `parentId` column to SQLite schema
2. Add `parentId` index to MongoDB
3. Add `GET /configurations/by-parent/:parentId` endpoint
4. Implement cascade delete option

### Phase 4: Service Layer
1. Create `simpleBlotterConfigService.ts`
2. Create `simpleBlotterLayoutService.ts`

### Phase 5: React Query Hooks
1. Create `useSimpleBlotterQueries.ts`
2. Create `useSimpleBlotterLayoutQueries.ts`

### Phase 6: UI Components
1. Create `LayoutToolbar.tsx`
2. Create `LayoutSelector.tsx`
3. Create `LayoutSaveDialog.tsx`
4. Create `LayoutManageDialog.tsx`

### Phase 7: SimpleBlotter Integration
1. Add `configId` prop to SimpleBlotter
2. Integrate layout loading/saving
3. Wire up toolbar actions
4. Add dirty state tracking

---

## Usage Example

```tsx
// In OpenFin window or standalone app
<SimpleBlotter
  configId="blotter-uuid-001"
  userId="user-123"
  onLayoutChange={(layoutId) => console.log('Layout changed:', layoutId)}
/>
```

The blotter will:
1. Load its configuration (data provider, rules, toolbar settings)
2. Load all available layouts
3. Apply the default layout (or first available)
4. Render the toolbar with layout selector
5. Allow users to switch, create, save, and manage layouts
