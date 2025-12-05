/**
 * BlotterContext
 *
 * Provides shared state and services for the SimpleBlotter component tree.
 * This context eliminates prop drilling and centralizes state management.
 */

import React, { createContext, useContext, useRef, useMemo, ReactNode } from 'react';
import { GridApi, ColDef } from 'ag-grid-community';
import { BlotterType, BLOTTER_TYPES } from '@/types/blotter';

// ============================================================================
// Types
// ============================================================================

export interface BlotterState {
  /** Selected data provider ID */
  selectedProviderId: string | null;
  /** Available data providers */
  availableProviders: Array<{ id: string; name: string }>;
  /** Column definitions */
  columns: ColDef[];
  /** Loading state */
  isLoading: boolean;
  /** Grid ready state */
  gridReady: boolean;
  /** Row count */
  rowCount: number;
  /** Load time in milliseconds */
  loadTimeMs: number | null;
  /** Toolbar collapsed state */
  isToolbarCollapsed: boolean;
  /** Toolbar pinned state */
  isToolbarPinned: boolean;
}

export interface BlotterActions {
  setSelectedProviderId: (id: string | null) => void;
  setAvailableProviders: (providers: Array<{ id: string; name: string }>) => void;
  setColumns: (columns: ColDef[]) => void;
  setIsLoading: (loading: boolean) => void;
  setGridReady: (ready: boolean) => void;
  setRowCount: (count: number) => void;
  setLoadTimeMs: (ms: number | null) => void;
  setIsToolbarCollapsed: (collapsed: boolean) => void;
  setIsToolbarPinned: (pinned: boolean) => void;
}

export interface BlotterRefs {
  gridApi: React.MutableRefObject<GridApi | null>;
  snapshotRows: React.MutableRefObject<any[]>;
  snapshotLoaded: React.MutableRefObject<boolean>;
  loadStartTime: React.MutableRefObject<number | null>;
  receivedRowKeys: React.MutableRefObject<Set<string>>;
  isConnected: React.MutableRefObject<boolean>;
}

export interface BlotterConfig {
  /** Unique view instance ID */
  viewInstanceId: string;
  /** User ID */
  userId: string;
  /** Blotter name */
  blotterName: string;
  /** Blotter type for worker isolation */
  blotterType: BlotterType | string;
}

export interface BlotterContextValue {
  state: BlotterState;
  actions: BlotterActions;
  refs: BlotterRefs;
  config: BlotterConfig;
}

// ============================================================================
// Context
// ============================================================================

const BlotterContext = createContext<BlotterContextValue | null>(null);

// ============================================================================
// Provider Props
// ============================================================================

export interface BlotterProviderProps {
  children: ReactNode;
  viewInstanceId: string;
  userId?: string;
  blotterName?: string;
  blotterType?: BlotterType | string;
  /** Initial state values */
  initialState: BlotterState;
  /** State setters from parent */
  actions: BlotterActions;
}

// ============================================================================
// Provider Component
// ============================================================================

export const BlotterProvider: React.FC<BlotterProviderProps> = ({
  children,
  viewInstanceId,
  userId = 'default-user',
  blotterName = 'SimpleBlotter',
  blotterType = BLOTTER_TYPES.DEFAULT,
  initialState,
  actions,
}) => {
  // Refs are stable and never change
  const gridApiRef = useRef<GridApi | null>(null);
  const snapshotRowsRef = useRef<any[]>([]);
  const snapshotLoadedRef = useRef(false);
  const loadStartTimeRef = useRef<number | null>(null);
  const receivedRowKeysRef = useRef<Set<string>>(new Set());
  const isConnectedRef = useRef(false);

  const refs: BlotterRefs = useMemo(() => ({
    gridApi: gridApiRef,
    snapshotRows: snapshotRowsRef,
    snapshotLoaded: snapshotLoadedRef,
    loadStartTime: loadStartTimeRef,
    receivedRowKeys: receivedRowKeysRef,
    isConnected: isConnectedRef,
  }), []);

  const config: BlotterConfig = useMemo(() => ({
    viewInstanceId,
    userId,
    blotterName,
    blotterType,
  }), [viewInstanceId, userId, blotterName, blotterType]);

  const contextValue: BlotterContextValue = useMemo(() => ({
    state: initialState,
    actions,
    refs,
    config,
  }), [initialState, actions, refs, config]);

  return (
    <BlotterContext.Provider value={contextValue}>
      {children}
    </BlotterContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access blotter context
 * Must be used within a BlotterProvider
 */
export const useBlotterContext = (): BlotterContextValue => {
  const context = useContext(BlotterContext);
  if (!context) {
    throw new Error('useBlotterContext must be used within a BlotterProvider');
  }
  return context;
};

export default BlotterContext;
