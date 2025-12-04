/**
 * Data Provider Hook Types
 * Simplified - no adapter interfaces needed
 */

import { GetRowIdParams } from 'ag-grid-community';
import { BlotterType } from '@/types/blotter';

// Hook options
export interface AdapterOptions {
  autoConnect?: boolean;      // Default: true
  preferOpenFin?: boolean;     // Default: true (used by SharedWorker internally)
  blotterType?: BlotterType | string;  // Blotter type for worker isolation (default: 'default')
}

// Hook result - public API
export interface UseDataProviderAdapterResult {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  isConfigLoaded: boolean;
  error: Error | null;

  // Data
  snapshotData: any[];
  statistics: any;
  config: any;  // Provider configuration (includes keyColumn, etc.)

  // AG-Grid integration
  getRowId: (params: GetRowIdParams) => string;

  // Lifecycle
  connect: () => Promise<void>;
  disconnect: () => void;
  requestSnapshot: () => Promise<void>;  // Explicitly request cached snapshot (for late subscribers)

  // Event handler setters
  setOnSnapshot: (handler: (rows: any[]) => void) => void;
  setOnUpdate: (handler: (rows: any[]) => void) => void;
  setOnSnapshotComplete: (handler: () => void) => void;
  setOnError: (handler: (error: Error) => void) => void;
}
