/**
 * Blotter Type Definitions
 *
 * Defines the different types of blotters in the application.
 * Each blotter type gets its own isolated SharedWorker instance.
 */

/**
 * Available blotter types
 * Each type represents a different category of trading data
 */
export const BLOTTER_TYPES = {
  POSITIONS: 'positions',
  ORDERS: 'orders',
  TRADES: 'trades',
  EXECUTIONS: 'executions',
  ALLOCATIONS: 'allocations',
  DEFAULT: 'default', // Fallback for untyped blotters
} as const;

/**
 * Blotter type - used to determine which SharedWorker instance to connect to
 * Different blotter types get separate workers for isolation
 * Same blotter types share a single worker instance
 */
export type BlotterType = typeof BLOTTER_TYPES[keyof typeof BLOTTER_TYPES];

/**
 * Helper to validate if a string is a valid blotter type
 */
export function isValidBlotterType(value: string): value is BlotterType {
  return Object.values(BLOTTER_TYPES).includes(value as BlotterType);
}

/**
 * Get blotter type from string with fallback to default
 */
export function normalizeBlotterType(value?: string | null): BlotterType {
  if (!value) return BLOTTER_TYPES.DEFAULT;
  return isValidBlotterType(value) ? value : BLOTTER_TYPES.DEFAULT;
}
