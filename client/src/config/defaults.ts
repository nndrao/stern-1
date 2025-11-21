/**
 * Centralized configuration constants and default values
 * REFACTORED: Extracted magic values from throughout the codebase
 */

// ============================================================================
// API and Server URLs
// ============================================================================

export const API_DEFAULTS = {
  /** Base URL for configuration service API */
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',

  /** Development server URL for Vite */
  DEV_SERVER_URL: import.meta.env.VITE_DEV_URL || 'http://localhost:5173',
} as const;

// ============================================================================
// Timeout Values (in milliseconds)
// ============================================================================

export const TIMEOUT_MS = {
  /** Auto-save interval for dock configuration (30 seconds - matches AGV3 pattern) */
  AUTOSAVE_INTERVAL: 30_000,

  /** Default STOMP connection timeout (30 seconds - STOMP spec recommendation) */
  STOMP_CONNECTION: 30_000,

  /** STOMP snapshot timeout */
  STOMP_SNAPSHOT: 30_000,

  /** General API request timeout */
  API_REQUEST: 10_000,
} as const;

// ============================================================================
// Window and Layout Dimensions
// ============================================================================

export const DEFAULT_WINDOW_BOUNDS = {
  x: 200,
  y: 200,
  width: 1000,
  height: 600,
} as const;

export const DEFAULT_DOCK_WINDOW = {
  width: 800,
  height: 600,
} as const;

// ============================================================================
// Data Grid Constants
// ============================================================================

export const GRID_DEFAULTS = {
  /** Maximum decimal places for numeric formatting (trading precision standard) */
  MAX_DECIMAL_PLACES: 9,

  /** Default decimal formatter */
  DEFAULT_DECIMAL_FORMATTER: '2DecimalWithThousandSeparator',

  /** Default date format */
  DEFAULT_DATE_FORMAT: 'YYYY-MM-DD HH:mm:ss',
} as const;

/**
 * Decimal formatter options for numeric columns
 */
export const DECIMAL_FORMATTERS = [
  '0Decimal',
  '1Decimal',
  '2Decimal',
  '3Decimal',
  '4Decimal',
  '5Decimal',
  '6Decimal',
  '7Decimal',
  '8Decimal',
  '9Decimal',
] as const;

// ============================================================================
// Data Provider Events
// ============================================================================

export const DATA_PROVIDER_EVENTS = {
  SNAPSHOT: 'snapshot',
  UPDATE: 'update',
  ERROR: 'error',
  STATUS: 'status',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  SUBSCRIBED: 'subscribed',
  UNSUBSCRIBED: 'unsubscribed',
} as const;

// ============================================================================
// STOMP Configuration Defaults
// ============================================================================

export const STOMP_DEFAULTS = {
  /** Default key column for STOMP subscriptions */
  DEFAULT_KEY_COLUMN: 'positionId',

  /** Default broker URL */
  DEFAULT_BROKER_URL: 'ws://localhost:61614/stomp',

  /** Reconnect delay after disconnection (milliseconds) */
  RECONNECT_DELAY: 5_000,

  /** Heartbeat intervals (milliseconds) */
  HEARTBEAT_OUTGOING: 10_000,
  HEARTBEAT_INCOMING: 10_000,
} as const;

// ============================================================================
// Component Size Limits (for code quality)
// ============================================================================

export const CODE_QUALITY_LIMITS = {
  /** Maximum recommended lines for a React component */
  MAX_COMPONENT_LINES: 300,

  /** Maximum recommended lines for a function */
  MAX_FUNCTION_LINES: 50,

  /** Maximum recommended hook dependencies */
  MAX_HOOK_DEPENDENCIES: 5,
} as const;

// ============================================================================
// OpenFin Configuration
// ============================================================================

export const OPENFIN_DEFAULTS = {
  /** Minimum Workspace version for full feature support */
  MIN_WORKSPACE_VERSION: 17,

  /** Expected Workspace version */
  EXPECTED_WORKSPACE_VERSION: '22.3.27',

  /** Expected runtime major version */
  EXPECTED_RUNTIME_VERSION: '42',
} as const;
