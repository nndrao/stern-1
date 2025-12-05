/**
 * STOMP Data Provider
 *
 * Simplified STOMP data provider with SharedWorker for connection sharing.
 *
 * Usage:
 * ```tsx
 * const {
 *   isConnected,
 *   isLoading,
 *   error,
 *   statistics,
 *   getRowId,
 *   connect,
 *   disconnect,
 * } = useStompProvider(providerId, {
 *   onSnapshot: (rows) => gridApi.applyTransaction({ add: rows }),
 *   onUpdate: (rows) => gridApi.applyTransaction({ update: rows }),
 *   onSnapshotComplete: () => console.log('Ready'),
 *   onError: (err) => console.error(err),
 * });
 * ```
 */

export { SharedStompProvider } from './SharedStompProvider';
export type { StompProviderConfig, ProviderStatistics, ProviderMessage } from './SharedStompProvider';

export { useStompProvider } from './useStompProvider';
export type { UseStompProviderOptions, UseStompProviderResult } from './useStompProvider';
