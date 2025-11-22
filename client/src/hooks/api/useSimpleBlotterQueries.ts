/**
 * React Query hooks for SimpleBlotter configuration operations
 * Manages both blotter configs (parent) and layout configs (child)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SimpleBlotterConfig,
  SimpleBlotterLayoutConfig,
  UnifiedConfig
} from '@stern/shared-types';
import { simpleBlotterConfigService } from '@/services/api/simpleBlotterConfigService';
import { logger } from '@/utils/logger';
import { useToast } from '@/hooks/ui/use-toast';

// ============================================================================
// Query Key Factories
// ============================================================================

/**
 * Query key factory for blotter configs
 */
export const blotterConfigKeys = {
  all: ['blotterConfigs'] as const,
  details: () => [...blotterConfigKeys.all, 'detail'] as const,
  detail: (configId: string) => [...blotterConfigKeys.details(), configId] as const,
};

/**
 * Query key factory for layout configs
 */
export const layoutConfigKeys = {
  all: ['layoutConfigs'] as const,
  lists: () => [...layoutConfigKeys.all, 'list'] as const,
  list: (blotterConfigId: string) => [...layoutConfigKeys.lists(), blotterConfigId] as const,
  details: () => [...layoutConfigKeys.all, 'detail'] as const,
  detail: (layoutId: string) => [...layoutConfigKeys.details(), layoutId] as const,
};

// ============================================================================
// Blotter Config Hooks
// ============================================================================

/**
 * Hook to fetch a blotter configuration
 */
export function useBlotterConfig(configId: string | null) {
  return useQuery({
    queryKey: blotterConfigKeys.detail(configId || ''),
    queryFn: async () => {
      if (!configId) return null;
      logger.debug('Fetching blotter config', { configId }, 'useBlotterConfig');
      const result = await simpleBlotterConfigService.getBlotterConfig(configId);
      logger.debug('Blotter config fetched', { configId, found: !!result }, 'useBlotterConfig');
      return result;
    },
    enabled: !!configId,
  });
}

/**
 * Hook to get or create a blotter configuration
 * Useful for first-time load scenarios
 */
export function useGetOrCreateBlotterConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      configId,
      userId,
      name
    }: {
      configId: string;
      userId: string;
      name: string;
    }) => {
      logger.info('Getting or creating blotter config', { configId, name }, 'useGetOrCreateBlotterConfig');
      const result = await simpleBlotterConfigService.getOrCreateBlotterConfig(configId, userId, name);
      logger.info('Blotter config ready', { configId, isNew: result.isNew }, 'useGetOrCreateBlotterConfig');
      return result;
    },
    onSuccess: (result) => {
      // Update cache with the blotter config
      queryClient.setQueryData(
        blotterConfigKeys.detail(result.unified.configId),
        { config: result.config, unified: result.unified }
      );
    },
    onError: (error: Error) => {
      logger.error('Failed to get/create blotter config', error, 'useGetOrCreateBlotterConfig');
    },
  });
}

/**
 * Hook to update a blotter configuration
 */
export function useUpdateBlotterConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      configId,
      updates,
      userId
    }: {
      configId: string;
      updates: Partial<SimpleBlotterConfig>;
      userId: string;
    }) => {
      logger.info('Updating blotter config', { configId }, 'useUpdateBlotterConfig');
      const result = await simpleBlotterConfigService.updateBlotterConfig(configId, updates, userId);
      logger.info('Blotter config updated', { configId }, 'useUpdateBlotterConfig');
      return result;
    },
    onSuccess: (result, variables) => {
      // Update cache
      queryClient.setQueryData(
        blotterConfigKeys.detail(variables.configId),
        { config: result.config, unified: result.unified }
      );
      toast({
        title: 'Settings Saved',
        description: 'Blotter settings updated successfully',
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to update blotter config', error, 'useUpdateBlotterConfig');
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save blotter settings',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a blotter configuration (and all its layouts)
 */
export function useDeleteBlotterConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ configId }: { configId: string }) => {
      logger.info('Deleting blotter config', { configId }, 'useDeleteBlotterConfig');
      await simpleBlotterConfigService.deleteBlotterConfig(configId);
      logger.info('Blotter config deleted', { configId }, 'useDeleteBlotterConfig');
    },
    onSuccess: (_, variables) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: blotterConfigKeys.detail(variables.configId) });
      queryClient.invalidateQueries({ queryKey: layoutConfigKeys.list(variables.configId) });
      toast({
        title: 'Blotter Deleted',
        description: 'Blotter and all layouts deleted successfully',
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to delete blotter config', error, 'useDeleteBlotterConfig');
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete blotter',
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// Layout Config Hooks
// ============================================================================

/**
 * Hook to fetch all layouts for a blotter
 */
export function useBlotterLayouts(blotterConfigId: string | null) {
  return useQuery({
    queryKey: layoutConfigKeys.list(blotterConfigId || ''),
    queryFn: async () => {
      if (!blotterConfigId) return [];
      logger.debug('Fetching layouts for blotter', { blotterConfigId }, 'useBlotterLayouts');
      const layouts = await simpleBlotterConfigService.getLayoutsByBlotter(blotterConfigId);
      logger.debug('Layouts fetched', { blotterConfigId, count: layouts.length }, 'useBlotterLayouts');
      return layouts;
    },
    enabled: !!blotterConfigId,
  });
}

/**
 * Hook to fetch a single layout
 */
export function useLayoutConfig(layoutId: string | null) {
  return useQuery({
    queryKey: layoutConfigKeys.detail(layoutId || ''),
    queryFn: async () => {
      if (!layoutId) return null;
      logger.debug('Fetching layout config', { layoutId }, 'useLayoutConfig');
      const result = await simpleBlotterConfigService.getLayoutConfig(layoutId);
      logger.debug('Layout config fetched', { layoutId, found: !!result }, 'useLayoutConfig');
      return result;
    },
    enabled: !!layoutId,
  });
}

/**
 * Hook to get the default layout for a blotter
 */
export function useDefaultLayout(blotterConfigId: string | null) {
  return useQuery({
    queryKey: [...layoutConfigKeys.list(blotterConfigId || ''), 'default'] as const,
    queryFn: async () => {
      if (!blotterConfigId) return null;
      logger.debug('Fetching default layout', { blotterConfigId }, 'useDefaultLayout');
      const result = await simpleBlotterConfigService.getDefaultLayout(blotterConfigId);
      logger.debug('Default layout fetched', { blotterConfigId, found: !!result }, 'useDefaultLayout');
      return result;
    },
    enabled: !!blotterConfigId,
  });
}

/**
 * Hook to create a new layout
 */
export function useCreateLayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      blotterConfigId,
      userId,
      name,
      config
    }: {
      blotterConfigId: string;
      userId: string;
      name: string;
      config?: Partial<SimpleBlotterLayoutConfig>;
    }) => {
      logger.info('Creating layout', { blotterConfigId, name }, 'useCreateLayout');
      const result = await simpleBlotterConfigService.createLayout(blotterConfigId, userId, name, config);
      logger.info('Layout created', { layoutId: result.unified.configId }, 'useCreateLayout');
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate layouts list
      queryClient.invalidateQueries({ queryKey: layoutConfigKeys.list(variables.blotterConfigId) });
      toast({
        title: 'Layout Created',
        description: `Layout "${variables.name}" created successfully`,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to create layout', error, 'useCreateLayout');
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create layout',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to update a layout
 */
export function useUpdateLayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      layoutId,
      updates,
      userId,
      blotterConfigId
    }: {
      layoutId: string;
      updates: Partial<SimpleBlotterLayoutConfig>;
      userId: string;
      blotterConfigId: string; // Needed for cache invalidation
    }) => {
      logger.info('Updating layout', { layoutId }, 'useUpdateLayout');
      const result = await simpleBlotterConfigService.updateLayout(layoutId, updates, userId);
      logger.info('Layout updated', { layoutId }, 'useUpdateLayout');
      return result;
    },
    onSuccess: (result, variables) => {
      // Update cache
      queryClient.setQueryData(
        layoutConfigKeys.detail(variables.layoutId),
        { config: result.config, unified: result.unified }
      );
      // Also invalidate layouts list
      queryClient.invalidateQueries({ queryKey: layoutConfigKeys.list(variables.blotterConfigId) });
      toast({
        title: 'Layout Saved',
        description: 'Layout updated successfully',
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to update layout', error, 'useUpdateLayout');
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save layout',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to delete a layout
 */
export function useDeleteLayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      layoutId,
      blotterConfigId
    }: {
      layoutId: string;
      blotterConfigId: string;
    }) => {
      logger.info('Deleting layout', { layoutId }, 'useDeleteLayout');
      await simpleBlotterConfigService.deleteLayout(layoutId);
      logger.info('Layout deleted', { layoutId }, 'useDeleteLayout');
    },
    onSuccess: (_, variables) => {
      // Invalidate layouts list
      queryClient.invalidateQueries({ queryKey: layoutConfigKeys.list(variables.blotterConfigId) });
      queryClient.removeQueries({ queryKey: layoutConfigKeys.detail(variables.layoutId) });
      toast({
        title: 'Layout Deleted',
        description: 'Layout deleted successfully',
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to delete layout', error, 'useDeleteLayout');
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete layout',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to duplicate a layout
 */
export function useDuplicateLayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      layoutId,
      newName,
      userId,
      blotterConfigId
    }: {
      layoutId: string;
      newName: string;
      userId: string;
      blotterConfigId: string;
    }) => {
      logger.info('Duplicating layout', { layoutId, newName }, 'useDuplicateLayout');
      const result = await simpleBlotterConfigService.duplicateLayout(layoutId, newName, userId);
      logger.info('Layout duplicated', { newLayoutId: result.unified.configId }, 'useDuplicateLayout');
      return result;
    },
    onSuccess: (_, variables) => {
      // Invalidate layouts list
      queryClient.invalidateQueries({ queryKey: layoutConfigKeys.list(variables.blotterConfigId) });
      toast({
        title: 'Layout Duplicated',
        description: `Layout "${variables.newName}" created successfully`,
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to duplicate layout', error, 'useDuplicateLayout');
      toast({
        title: 'Duplication Failed',
        description: error.message || 'Failed to duplicate layout',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook to set the default layout for a blotter
 */
export function useSetDefaultLayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      blotterConfigId,
      layoutId,
      userId
    }: {
      blotterConfigId: string;
      layoutId: string;
      userId: string;
    }) => {
      logger.info('Setting default layout', { blotterConfigId, layoutId }, 'useSetDefaultLayout');
      await simpleBlotterConfigService.setDefaultLayout(blotterConfigId, layoutId, userId);
      logger.info('Default layout set', { blotterConfigId, layoutId }, 'useSetDefaultLayout');
    },
    onSuccess: (_, variables) => {
      // Invalidate blotter config to reflect new default
      queryClient.invalidateQueries({ queryKey: blotterConfigKeys.detail(variables.blotterConfigId) });
      toast({
        title: 'Default Layout Set',
        description: 'Default layout updated successfully',
      });
    },
    onError: (error: Error) => {
      logger.error('Failed to set default layout', error, 'useSetDefaultLayout');
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to set default layout',
        variant: 'destructive',
      });
    },
  });
}
