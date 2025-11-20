## SimpleBlotter Component

A fully-featured, enterprise-grade blotter component for displaying real-time trading data with advanced customization capabilities.

## Features

### Core Features
- ✅ **Real-time Data Provider Integration** - Connects to STOMP data providers via SharedWorker
- ✅ **OpenFin Channel API Support** - High-performance inter-window communication
- ✅ **Profile Management** - Save, load, import, export blotter configurations
- ✅ **Column Groups** - Hierarchical column organization
- ✅ **Conditional Formatting** - Expression-based cell styling
- ✅ **Calculated Columns** - Formula-based virtual columns
- ✅ **Grid Options Editor** - 200+ configurable AG-Grid settings
- ✅ **Export Functionality** - CSV and Excel export with options
- ✅ **Theme Support** - Light/dark theme with persistence
- ✅ **Immutable Data** - AG-Grid transaction updates for optimal performance

### Data Provider Architecture
The SimpleBlotter uses a 3-component data provider architecture:
1. **Config Component** - Stores data provider configuration
2. **Engine Component** - Runs in SharedWorker, manages connections and cache
3. **Adapter Component** - React hook interface for components

Benefits:
- Single WebSocket connection shared across all blotter instances
- Persistent cache for late-joining subscribers
- Automatic fallback from OpenFin Channel API to MessagePort
- Real-time transaction updates via `applyTransactionAsync`

## Usage

### Basic Example

```tsx
import { SimpleBlotter } from '@/components/widgets/blotters/simpleblotter';

function TradingScreen() {
  return (
    <SimpleBlotter
      blotterId="my-blotter"
      blotterName="My Trading Blotter"
      providerId="trades-provider"
      defaultTheme="light"
      useOpenFin={true}
      onError={(error) => console.error('Blotter error:', error)}
      onReady={() => console.log('Blotter ready')}
    />
  );
}
```

### With Initial Profile

```tsx
import { SimpleBlotter, createDefaultProfile } from '@/components/widgets/blotters/simpleblotter';

function TradingScreen() {
  const initialProfile = createDefaultProfile();

  // Customize profile
  initialProfile.theme = 'dark';
  initialProfile.columnGroups = [
    {
      groupId: 'pricing',
      groupName: 'Pricing',
      headerName: 'Pricing Information',
      children: ['price', 'quantity', 'total'],
      openByDefault: true,
    }
  ];

  return (
    <SimpleBlotter
      blotterId="my-blotter"
      blotterName="My Trading Blotter"
      providerId="trades-provider"
      initialProfile={initialProfile}
      onProfileChange={(profile) => console.log('Profile changed:', profile)}
    />
  );
}
```

## Architecture

### File Structure

```
simpleblotter/
├── SimpleBlotter.tsx          # Main component
├── types.ts                   # TypeScript interfaces
├── index.ts                   # Public exports
├── README.md                  # This file
│
├── config/                    # Configuration files
│   ├── constants.ts          # Component constants
│   ├── gridConfig.ts         # AG-Grid base configuration
│   ├── gridOptions.ts        # Grid options definitions
│   └── profileDefaults.ts    # Default profile helpers
│
├── hooks/                     # React hooks
│   ├── useBlotterState.ts    # Main state management
│   ├── useGridApi.ts         # AG-Grid API wrapper
│   ├── useEventHandlers.ts   # Grid event handlers
│   ├── useProfileManager.ts  # Profile CRUD operations
│   ├── useColumnGroups.ts    # Column grouping logic
│   ├── useConditionalFormatting.ts  # Formatting rules
│   ├── useCalculatedColumns.ts      # Formula evaluation
│   ├── useDataProvider.ts    # Data provider integration
│   └── useGridOptions.ts     # Grid options management
│
├── services/                  # Business logic services
│   ├── ProfileService.ts     # Profile persistence
│   ├── ExportService.ts      # Data export logic
│   └── ThemeService.ts       # Theme management
│
├── components/                # UI components
│   ├── Toolbar.tsx           # Main toolbar
│   └── StatusPanel.tsx       # Connection status panel
│
├── dialogs/                   # Dialog components
│   ├── ProfileManagerDialog.tsx     # Profile management
│   └── ExportDialog.tsx             # Export configuration
│
├── formatters/                # Cell formatting
│   ├── valueFormatters.ts    # Value formatters
│   └── cellStyler.ts         # Conditional styling
│
└── renderers/                 # Cell rendering
    └── cellRenderers.tsx     # Custom cell renderers
```

### Component Hierarchy

```
SimpleBlotter
├── Toolbar (controls)
├── AG-Grid (data display)
│   ├── Column Definitions (base + grouped + calculated)
│   ├── Grid Options (configurable)
│   ├── Cell Styles (conditional formatting)
│   └── Event Handlers
├── ProfileManagerDialog
├── ExportDialog
└── Data Provider (via useDataProvider hook)
    ├── OpenFin Channel API (preferred)
    └── SharedWorker MessagePort (fallback)
```

## Configuration

### Component Props

```typescript
interface SimpleBlotterProps {
  // Identity
  blotterId: string;           // Unique identifier
  blotterName: string;         // Display name

  // Data provider
  providerId: string;          // Data provider ID

  // Initial configuration
  initialProfile?: BlotterProfile;
  defaultTheme?: 'light' | 'dark';

  // OpenFin integration
  useOpenFin?: boolean;

  // Callbacks
  onProfileChange?: (profile: BlotterProfile) => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
}
```

### Profile Structure

```typescript
interface BlotterProfile {
  profileId: string;
  profileName: string;
  version: number;
  created: string;
  modified: string;
  isDefault: boolean;

  // Grid state
  columnState: ColumnState[];
  filterModel: any;
  sortModel: any[];

  // Features
  columnGroups: ColumnGroup[];
  conditionalFormats: ConditionalFormat[];
  calculatedColumns: CalculatedColumn[];
  gridOptions: Partial<GridOptions>;

  // Theme
  theme: 'light' | 'dark';
}
```

## Data Provider Integration

### Requirements

1. **Data Provider Configuration**
   - Must be configured in Configuration Service
   - componentType: 'datasource'
   - componentSubType: 'stomp'
   - Must include `keyColumn` for `getRowId`

2. **Column Definitions**
   - Always stored with provider configuration
   - Used to build base column definitions
   - Can be extended with calculated columns

### Real-time Updates

The blotter uses AG-Grid transaction updates for optimal performance:

```typescript
// Snapshot data (initial load)
gridApi.setRowData(rows);

// Real-time updates (incremental)
gridApi.applyTransactionAsync({ update: rows });
```

Requirements:
- `getRowId` function REQUIRED (provided by data provider)
- Immutable data objects (new references for updates)
- Batched updates (50ms default via `asyncTransactionWaitMillis`)

## Advanced Usage

### Custom Column Groups

```typescript
const profile = createDefaultProfile();
profile.columnGroups = [
  {
    groupId: 'group1',
    groupName: 'Pricing',
    headerName: 'Pricing Information',
    children: ['price', 'quantity', 'total'],
    marryChildren: false,
    openByDefault: true,
  }
];
```

### Conditional Formatting

```typescript
const profile = createDefaultProfile();
profile.conditionalFormats = [
  {
    formatId: 'format1',
    name: 'Negative Prices',
    enabled: true,
    columnId: 'price',
    condition: {
      type: 'expression',
      expression: 'value < 0',
    },
    style: {
      backgroundColor: '#ffebee',
      color: '#c62828',
      fontWeight: 'bold',
    },
    priority: 10,
  }
];
```

### Calculated Columns

```typescript
const profile = createDefaultProfile();
profile.calculatedColumns = [
  {
    columnId: 'calc_total',
    headerName: 'Total Value',
    field: 'calc_total',
    formula: 'data.price * data.quantity',
    valueType: 'number',
    width: 150,
  }
];
```

## Performance Optimization

### AG-Grid Settings
- **Row Virtualization**: Only renders visible rows
- **Column Virtualization**: Only renders visible columns
- **Transaction Updates**: Incremental updates via `applyTransactionAsync`
- **Batch Updates**: 50ms batching for high-frequency updates
- **Cell Flash**: Visual feedback for changed values

### Data Provider
- **SharedWorker**: Single connection for all instances
- **Cache Management**: O(1) lookups via Map
- **Immutable Updates**: New objects for AG-Grid compatibility
- **OpenFin Channel**: Up to 40MB/s throughput

## Testing

### Unit Tests
```bash
npm test -- simpleblotter
```

### Integration Tests
```bash
npm run test:integration -- simpleblotter
```

### Manual Testing
1. Start development server: `npm run dev`
2. Navigate to blotter component
3. Test data provider connection
4. Test profile save/load
5. Test export functionality
6. Test theme switching

## Troubleshooting

### Data not loading
- Check provider configuration in Configuration Service
- Verify `keyColumn` is configured correctly
- Check browser console for connection errors
- Verify SharedWorker is supported

### Grid not updating
- Ensure `getRowId` returns unique, stable IDs
- Check that data objects are immutable (new references)
- Verify transaction updates are being called
- Check AG-Grid console warnings

### Profile not saving
- Check Configuration Service connection
- Verify userId is set correctly
- Check browser console for errors
- Ensure profile structure is valid

### Performance issues
- Reduce `asyncTransactionWaitMillis` for faster updates
- Enable column virtualization
- Reduce number of conditional formats
- Simplify calculated column formulas

## Future Enhancements

- [ ] Additional dialogs (Column Groups, Formatting, Calculated Columns, Grid Options)
- [ ] Advanced filtering UI
- [ ] Chart integration
- [ ] Audit trail for profile changes
- [ ] Keyboard shortcuts
- [ ] Context menu customization
- [ ] Cell editing support
- [ ] Row grouping/pivoting UI
- [ ] Additional export formats (PDF, JSON)
- [ ] REST data provider support
- [ ] WebSocket data provider support
- [ ] Mock data provider for testing

## License

Internal use only - Stern Trading Platform
