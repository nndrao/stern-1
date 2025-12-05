/**
 * STOMP Data Provider
 *
 * Simplified 2-file STOMP data provider:
 * - stompDataWorker.ts: SharedWorker with embedded STOMP connection + cache
 * - useBlotterData.ts: React hook for blotter data connection
 *
 * Usage:
 * ```tsx
 * const dataConnection = useBlotterData({
 *   providerId,
 *   gridApi,
 *   gridReady,
 *   onRowCountChange: setRowCount,
 *   onLoadingChange: setIsLoading,
 *   onLoadComplete: setLoadTimeMs,
 *   onError: handleError,
 * });
 * ```
 */

export { useBlotterData } from './useBlotterData';
export type { UseBlotterDataOptions, UseBlotterDataResult } from './useBlotterData';

// Legacy exports (for backwards compatibility during migration)
export { SharedStompProvider } from './SharedStompProvider';
export { useStompProvider } from './useStompProvider';
