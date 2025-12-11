/**
 * useActionRegistry Hook
 *
 * React hook for accessing and using the action registry.
 * Provides reactive updates when actions are registered/unregistered.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  actionRegistry,
  RegisteredAction,
  ActionContext,
  ActionMetadata,
  createActionContext,
} from '@/registry/actionRegistry';

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to access the action registry
 */
export function useActionRegistry() {
  const [actions, setActions] = useState<RegisteredAction[]>(() =>
    actionRegistry.getAll()
  );

  // Subscribe to registry changes
  useEffect(() => {
    return actionRegistry.subscribe(() => {
      setActions(actionRegistry.getAll());
    });
  }, []);

  /**
   * Get all unique categories
   */
  const categories = useMemo(() => {
    const cats = new Set(actions.map((a) => a.category));
    return Array.from(cats).sort();
  }, [actions]);

  /**
   * Get actions filtered by category
   */
  const getByCategory = useCallback(
    (category: string): RegisteredAction[] => {
      return actions.filter((a) => a.category === category);
    },
    [actions]
  );

  /**
   * Get action by ID
   */
  const getAction = useCallback(
    (actionId: string): RegisteredAction | undefined => {
      return actionRegistry.get(actionId);
    },
    []
  );

  /**
   * Get action metadata by ID (without handler)
   */
  const getActionMetadata = useCallback(
    (actionId: string): ActionMetadata | undefined => {
      return actionRegistry.getMetadata(actionId);
    },
    []
  );

  /**
   * Check if action exists
   */
  const hasAction = useCallback((actionId: string): boolean => {
    return actionRegistry.has(actionId);
  }, []);

  /**
   * Execute an action
   */
  const executeAction = useCallback(
    async (
      actionId: string,
      context: ActionContext,
      actionData?: Record<string, unknown>
    ): Promise<void> => {
      return actionRegistry.execute(actionId, context, actionData);
    },
    []
  );

  return {
    /** All registered actions */
    actions,
    /** All unique categories */
    categories,
    /** Get actions by category */
    getByCategory,
    /** Get a single action by ID */
    getAction,
    /** Get action metadata (without handler) */
    getActionMetadata,
    /** Check if action exists */
    hasAction,
    /** Execute an action */
    executeAction,
    /** Total action count */
    count: actions.length,
  };
}

// ============================================================================
// Filtered Actions Hook
// ============================================================================

/**
 * Hook to get actions available in the current context
 */
export function useAvailableActions(context: ActionContext) {
  const { actions } = useActionRegistry();

  return useMemo(() => {
    return actions.filter((action) => {
      if (!action.isAvailable) return true;
      return action.isAvailable(context);
    });
  }, [actions, context]);
}

// ============================================================================
// Category Actions Hook
// ============================================================================

/**
 * Hook to get actions for a specific category
 */
export function useCategoryActions(category: string) {
  const { actions } = useActionRegistry();

  return useMemo(() => {
    return actions.filter((a) => a.category === category);
  }, [actions, category]);
}

// ============================================================================
// Action Execution Hook
// ============================================================================

interface UseActionExecutorOptions {
  gridApi: any | null;
  selectedRows?: any[];
  rowData?: any[];
  providerId?: string | null;
  layoutId?: string | null;
  openDialog?: (dialogId: string, props?: Record<string, unknown>) => Promise<unknown>;
  closeDialog?: (dialogId: string) => void;
  refreshData?: () => void;
  emit?: (event: string, data?: unknown) => void;
  isOpenFin?: boolean;
  platform?: any;
}

/**
 * Hook that provides an action executor bound to a context
 */
export function useActionExecutor(options: UseActionExecutorOptions) {
  const context = useMemo(
    () => createActionContext(options),
    [
      options.gridApi,
      options.selectedRows,
      options.rowData,
      options.providerId,
      options.layoutId,
      options.openDialog,
      options.closeDialog,
      options.refreshData,
      options.emit,
      options.isOpenFin,
      options.platform,
    ]
  );

  const execute = useCallback(
    async (actionId: string, actionData?: Record<string, unknown>) => {
      return actionRegistry.execute(actionId, context, actionData);
    },
    [context]
  );

  const isAvailable = useCallback(
    (actionId: string): boolean => {
      const action = actionRegistry.get(actionId);
      if (!action) return false;
      if (!action.isAvailable) return true;
      return action.isAvailable(context);
    },
    [context]
  );

  return {
    /** Execute an action by ID */
    execute,
    /** Check if an action is available */
    isAvailable,
    /** The current action context */
    context,
  };
}

// ============================================================================
// Re-exports
// ============================================================================

export { createActionContext, type ActionContext } from '@/registry/actionRegistry';
