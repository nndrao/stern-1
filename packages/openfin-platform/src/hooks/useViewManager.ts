/**
 * useViewManager Hook
 *
 * React hook for creating and managing OpenFin views with persistent instance IDs.
 * Wraps the viewManager service in a React-friendly API.
 */

import { useCallback, useState, useEffect } from 'react';
import { platformContext } from '../core/PlatformContext';

// Re-export types that were imported from viewManager
export interface ViewInstance {
  id: string;
  type: string;
  title?: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface CreateViewOptions {
  type: string;
  basePath?: string;
  title?: string;
  config?: any;
}

export interface UseViewManagerReturn {
  /** Create a new view with persistent ID */
  createView: (options: CreateViewOptions) => Promise<{ view: any; instance: ViewInstance }>;

  /** Get all registered view instances */
  getViews: () => Promise<ViewInstance[]>;

  /** Get a specific view instance by ID */
  getView: (viewId: string) => Promise<ViewInstance | null>;

  /** Delete a view instance from registry */
  deleteView: (viewId: string) => Promise<void>;

  /** Currently registered view instances */
  views: ViewInstance[];

  /** Loading state */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Refresh the view list */
  refreshViews: () => Promise<void>;
}

/**
 * Hook for managing OpenFin views with persistent instance IDs
 *
 * @example
 * ```tsx
 * const { createView, views, isLoading } = useViewManager();
 *
 * const handleCreateDemoView = async () => {
 *   const { view, instance } = await createView({
 *     type: 'demo-component',
 *     basePath: '/customcomponents',
 *     title: 'My Demo Component'
 *   });
 *   console.log('Created view:', instance.id);
 * };
 * ```
 */
export function useViewManager(): UseViewManagerReturn {
  const [views, setViews] = useState<ViewInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load view instances from storage
   */
  const loadViews = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const instances = await platformContext.viewManager?.getViewInstances() || [];
      setViews(instances);
      platformContext.logger.debug('Loaded view instances', { count: instances.length }, 'useViewManager');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load views');
      setError(error);
      platformContext.logger.error('Failed to load views', error, 'useViewManager');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new view
   */
  const createView = useCallback(async (options: CreateViewOptions) => {
    try {
      setIsLoading(true);
      setError(null);

      platformContext.logger.info('Creating view via hook', { type: options.type }, 'useViewManager');

      const result = await platformContext.viewManager?.createView(options);

      if (!result) {
        throw new Error('Failed to create view - no result returned');
      }

      // Refresh the view list
      await loadViews();

      platformContext.logger.info('View created successfully', { viewId: result.instance.id }, 'useViewManager');
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create view');
      setError(error);
      platformContext.logger.error('Failed to create view', error, 'useViewManager');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadViews]);

  /**
   * Get all view instances
   */
  const getViews = useCallback(async (): Promise<ViewInstance[]> => {
    try {
      return await platformContext.viewManager?.getViewInstances() || [];
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get views');
      setError(error);
      platformContext.logger.error('Failed to get views', error, 'useViewManager');
      return [];
    }
  }, []);

  /**
   * Get a specific view instance
   */
  const getView = useCallback(async (viewId: string): Promise<ViewInstance | null> => {
    try {
      return await platformContext.viewManager?.getViewInstance(viewId) || null;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get view');
      setError(error);
      platformContext.logger.error('Failed to get view', error, 'useViewManager');
      return null;
    }
  }, []);

  /**
   * Delete a view instance
   */
  const deleteView = useCallback(async (viewId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      platformContext.logger.info('Deleting view via hook', { viewId }, 'useViewManager');

      await platformContext.viewManager?.deleteViewInstance(viewId);

      // Refresh the view list
      await loadViews();

      platformContext.logger.info('View deleted successfully', { viewId }, 'useViewManager');
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete view');
      setError(error);
      platformContext.logger.error('Failed to delete view', error, 'useViewManager');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loadViews]);

  /**
   * Refresh the view list
   */
  const refreshViews = useCallback(async () => {
    await loadViews();
  }, [loadViews]);

  // Load views on mount only (empty deps prevents infinite loop)
  useEffect(() => {
    loadViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    createView,
    getViews,
    getView,
    deleteView,
    views,
    isLoading,
    error,
    refreshViews
  };
}
