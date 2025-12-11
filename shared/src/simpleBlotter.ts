/**
 * SimpleBlotter Configuration Types
 * Types for the SimpleBlotter parent config and child layout configs.
 *
 * Architecture:
 * - SimpleBlotterConfig: Parent config (componentType: 'simple-blotter')
 * - SimpleBlotterLayoutConfig: Child config (componentType: 'simple-blotter-layout')
 * - Linked via parentId field in UnifiedConfig
 */

// ============================================================================
// Toolbar Types
// ============================================================================

/**
 * Button placement zone within toolbar
 */
export type ToolbarZone = 'start' | 'left' | 'center' | 'right' | 'end';

/**
 * Button variant styling
 */
export type ToolbarButtonVariant = 'default' | 'outline' | 'ghost' | 'destructive';

/**
 * Menu item for dropdown buttons
 */
export interface ToolbarMenuItem {
  id: string;
  label: string;
  icon?: string;
  action: string;
  actionData?: Record<string, unknown>;
  disabled?: boolean;
  separator?: boolean;
}

/**
 * Custom toolbar button definition
 */
export interface ToolbarButton {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;

  /**
   * Action identifier - one of:
   * - Built-in action: 'grid:refresh', 'grid:export', etc.
   * - Custom action: 'custom:myAction' (handled via onAction callback)
   * - Dialog action: 'dialog:myDialog' (opens registered dialog)
   */
  action: string;

  /** Additional data passed to action handler */
  actionData?: Record<string, unknown>;

  /** Where in the toolbar to place this button */
  zone?: ToolbarZone;

  /** Visual variant */
  variant?: ToolbarButtonVariant;

  /** Show label text or icon-only */
  showLabel?: boolean;

  /** Disabled state */
  disabled?: boolean;

  /** Visibility (can be toggled) */
  visible?: boolean;

  /** Dropdown menu items (makes this a dropdown button) */
  menuItems?: ToolbarMenuItem[];

  /** Render order within zone (lower = first) */
  order?: number;
}

/**
 * Collapsible toolbar color options
 */
export type ToolbarColor = 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'cyan' | 'red' | 'yellow';

/**
 * Dynamic toolbar definition (for additional toolbars)
 */
export interface DynamicToolbar {
  id: string;

  /** Display name (for management UI) */
  name?: string;

  /** Position relative to main toolbar */
  position: 'above' | 'below';

  /** Render order (lower = closer to main toolbar) */
  order?: number;

  /** Collapsible toolbar color */
  color?: ToolbarColor;

  /** Initial collapsed state */
  defaultCollapsed?: boolean;

  /** Initial pinned state */
  defaultPinned?: boolean;

  /** Buttons to render in this toolbar */
  buttons?: ToolbarButton[];

  /** Custom React component reference (alternative to buttons) */
  componentRef?: string;

  /** Props to pass to custom component */
  componentProps?: Record<string, unknown>;
}

/**
 * Toolbar configuration for SimpleBlotter
 */
export interface BlotterToolbarConfig {
  showLayoutSelector?: boolean;
  showExportButton?: boolean;
  showFilterBar?: boolean;
  showColumnChooser?: boolean;
  showRefreshButton?: boolean;
  showSettingsButton?: boolean;

  /** Custom buttons in the main toolbar */
  customButtons?: ToolbarButton[];

  /** Additional toolbars (secondary, tertiary, etc.) */
  additionalToolbars?: DynamicToolbar[];

  /** Collapsed/pinned states for all toolbars (keyed by toolbar ID) */
  toolbarStates?: ToolbarStatesMap;
}

// ============================================================================
// Action Registry Types (for runtime action binding)
// ============================================================================

/**
 * Parameter definition for configurable actions
 */
export interface ActionParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  required?: boolean;
  default?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  description?: string;
}

/**
 * Registered action metadata (serializable part)
 */
export interface ActionMetadata {
  id: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  parameters?: ActionParameter[];
}

/**
 * Built-in action identifiers
 */
export const BUILT_IN_ACTIONS = {
  // Grid actions
  REFRESH: 'grid:refresh',
  EXPORT_CSV: 'grid:exportCsv',
  EXPORT_EXCEL: 'grid:exportExcel',
  RESET_COLUMNS: 'grid:resetColumns',
  RESET_FILTERS: 'grid:resetFilters',
  AUTO_SIZE_COLUMNS: 'grid:autoSizeColumns',

  // Selection actions
  SELECT_ALL: 'selection:all',
  DESELECT_ALL: 'selection:none',
  COPY_SELECTED: 'selection:copy',

  // Dialog actions
  COLUMN_CHOOSER: 'dialog:columnChooser',
  ADVANCED_FILTERS: 'dialog:advancedFilters',
  SETTINGS: 'dialog:settings',
} as const;

// ============================================================================
// Rule Type Definitions
// ============================================================================

/**
 * Style object for conditional formatting
 */
export interface ConditionalFormatStyle {
  backgroundColor?: string;
  color?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
}

/**
 * Condition types for conditional formatting
 */
export type ConditionType =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'custom';

/**
 * Conditional formatting rule definition.
 * Defined at blotter level, activated per layout.
 */
export interface ConditionalFormatRule {
  id: string;
  name: string;
  description?: string;

  /** Column field to apply rule to, or '*' for all columns */
  field: string | '*';

  /** Condition type */
  condition: ConditionType;

  /** Condition value(s) */
  value: unknown;
  value2?: unknown; // For 'between' condition

  /** Custom condition function (serialized) */
  customCondition?: string;

  /** Styling to apply when condition is met */
  style: ConditionalFormatStyle;

  /** Priority (lower = higher priority) */
  priority: number;
}

/**
 * Condition for editing rule
 */
export interface EditingCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'in' | 'notIn';
  value: unknown;
}

/**
 * Validation options for editing rule
 */
export interface EditingValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  customValidator?: string;
}

/**
 * Editing rule definition.
 * Defined at blotter level, activated per layout.
 */
export interface EditingRule {
  id: string;
  name: string;
  description?: string;

  /** Column field this rule applies to */
  field: string;

  /** Whether editing is allowed */
  editable: boolean;

  /** Condition for when editing is allowed (optional) */
  condition?: EditingCondition;

  /** Validation rules */
  validation?: EditingValidation;
}

/**
 * Column group definition.
 * Defined at blotter level, activated per layout.
 */
export interface ColumnGroup {
  id: string;
  name: string;
  description?: string;

  /** Column fields in this group */
  columns: string[];

  /** Whether group is initially expanded */
  defaultExpanded: boolean;
}

/**
 * Formatter type options
 */
export type FormatterType = 'number' | 'currency' | 'percentage' | 'date' | 'custom';

/**
 * Value formatter options
 */
export interface FormatterOptions {
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
}

/**
 * Value formatter definition.
 * Defined at blotter level, activated per layout.
 */
export interface ValueFormatterDef {
  id: string;
  name: string;
  description?: string;

  /** Column field to apply formatter to */
  field: string;

  /** Formatter type */
  type: FormatterType;

  /** Format options */
  options: FormatterOptions;
}

/**
 * Result type for calculated columns
 */
export type CalculatedColumnResultType = 'number' | 'string' | 'boolean' | 'date';

/**
 * Calculated column definition.
 * Defined at blotter level, activated per layout.
 */
export interface CalculatedColumnDef {
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
  resultType: CalculatedColumnResultType;
}

// ============================================================================
// AG-Grid State Types (simplified, actual AG-Grid types are complex)
// ============================================================================

/**
 * Column state from AG-Grid (simplified)
 */
export interface ColumnState {
  colId: string;
  width?: number;
  hide?: boolean;
  pinned?: 'left' | 'right' | null;
  sort?: 'asc' | 'desc' | null;
  sortIndex?: number | null;
  aggFunc?: string | null;
  rowGroup?: boolean;
  rowGroupIndex?: number | null;
  pivot?: boolean;
  pivotIndex?: number | null;
  flex?: number | null;
}

/**
 * Sort model item from AG-Grid
 */
export interface SortModelItem {
  colId: string;
  sort: 'asc' | 'desc';
}

/**
 * Pinned columns configuration
 */
export interface PinnedColumnsConfig {
  left: string[];
  right: string[];
}

// ============================================================================
// SimpleBlotter Config (Parent)
// ============================================================================

/**
 * Theme mode for SimpleBlotter
 */
export type BlotterThemeMode = 'system' | 'light' | 'dark';

/**
 * Configuration for a SimpleBlotter instance.
 * Stored in UnifiedConfig.config with componentType: 'simple-blotter'
 *
 * This is the PARENT config - layouts are children linked via parentId.
 */
export interface SimpleBlotterConfig {
  // === Data Source ===
  /** Reference to DataProvider configuration ID */
  dataProviderId: string;

  // === Default Layout ===
  /** ID of the layout to load on startup (user preference) */
  defaultLayoutId?: string;

  /** ID of the last selected layout (auto-saved) */
  lastSelectedLayoutId?: string;

  // === Toolbar Configuration ===
  toolbar: BlotterToolbarConfig;

  // === Theme ===
  /** Theme preference for this blotter */
  themeMode: BlotterThemeMode;

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

// ============================================================================
// SimpleBlotter Layout Config (Child)
// ============================================================================

/**
 * Toolbar state for SimpleBlotter layout
 */
export interface BlotterToolbarState {
  /** Whether the toolbar is collapsed */
  isCollapsed: boolean;
  /** Whether the toolbar is pinned (stays visible) */
  isPinned: boolean;
}

/**
 * Toolbar states map (collapsed/pinned per toolbar)
 */
export interface ToolbarStatesMap {
  [toolbarId: string]: BlotterToolbarState;
}

/**
 * Layout configuration for a SimpleBlotter.
 * Stored in UnifiedConfig.config with componentType: 'simple-blotter-layout'
 * Links to parent blotter via UnifiedConfig.parentId field.
 */
export interface SimpleBlotterLayoutConfig {
  // === Data Provider Selection ===
  /** Selected data provider ID for this layout */
  selectedProviderId?: string | null;

  // === Toolbar State ===
  /** Toolbar collapsed/pinned state (legacy - main toolbar only) */
  toolbarState?: BlotterToolbarState;

  // === Extended Toolbar Configuration ===
  /** Custom toolbar configuration for this layout */
  toolbarConfig?: BlotterToolbarConfig;

  /** Toolbar states (collapsed/pinned) for all toolbars */
  toolbarStates?: ToolbarStatesMap;

  // === AG-Grid Column Configuration ===
  /** Column definitions (simplified - actual ColDef is complex) */
  columnDefs: Record<string, unknown>[];

  /** Column state (widths, order, visibility, pinning) */
  columnState: ColumnState[];

  // === AG-Grid State ===
  /** Filter model */
  filterState: Record<string, unknown>;

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
  pinnedColumns?: PinnedColumnsConfig;

  // === Row Grouping ===
  /** Columns used for row grouping */
  rowGroupColumns?: string[];

  /** Columns used for pivot */
  pivotColumns?: string[];

  // === Side Panel State ===
  /** Side bar/panel state */
  sideBarState?: SideBarState;
}

/**
 * Side bar state for AG Grid
 */
export interface SideBarState {
  /** Whether the side bar is visible */
  visible: boolean;
  /** Position of the side bar ('left' or 'right') */
  position?: 'left' | 'right';
  /** ID of the currently open tool panel (e.g., 'columns', 'filters') */
  openToolPanel?: string | null;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a default SimpleBlotterConfig
 */
export function createDefaultBlotterConfig(overrides?: Partial<SimpleBlotterConfig>): SimpleBlotterConfig {
  return {
    dataProviderId: '',
    defaultLayoutId: undefined,
    toolbar: {
      showLayoutSelector: true,
      showExportButton: true,
      showFilterBar: true,
      showColumnChooser: true,
      showRefreshButton: true,
      showSettingsButton: true,
      customButtons: []
    },
    themeMode: 'system',
    title: 'Simple Blotter',
    autoRefreshInterval: 0,
    enableRealTimeUpdates: true,
    conditionalFormattingRules: [],
    editingRules: [],
    columnGroups: [],
    valueFormatters: [],
    calculatedColumns: [],
    ...overrides
  };
}

/**
 * Create a default SimpleBlotterLayoutConfig
 */
export function createDefaultLayoutConfig(overrides?: Partial<SimpleBlotterLayoutConfig>): SimpleBlotterLayoutConfig {
  return {
    columnDefs: [],
    columnState: [],
    filterState: {},
    sortState: [],
    activeFormattingRuleIds: [],
    activeEditingRuleIds: [],
    activeColumnGroupIds: [],
    activeFormatterIds: [],
    activeCalculatedColumnIds: [],
    rowHeight: undefined,
    headerHeight: undefined,
    pinnedColumns: undefined,
    rowGroupColumns: [],
    pivotColumns: [],
    sideBarState: { visible: false, openToolPanel: null },
    ...overrides
  };
}
