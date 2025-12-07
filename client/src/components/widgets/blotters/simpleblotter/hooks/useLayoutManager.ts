/**
 * useLayoutManager Hook
 *
 * Simplified layout management hook that composes smaller focused hooks.
 * Manages layout CRUD operations and state.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { GridApi } from 'ag-grid-community';
import {
  SimpleBlotterLayoutConfig,
  BlotterToolbarState,
  BlotterToolbarConfig,
  createDefaultLayoutConfig,
} from '@stern/shared-types';
import {
  useBlotterConfig,
  useBlotterLayouts,
  useGetOrCreateBlotterConfig,
  useUpdateBlotterConfig,
  useUpdateComponentSubType,
  useCreateLayout,
  useUpdateLayout,
  useDeleteLayout,
  useDuplicateLayout,
  useSetDefaultLayout,
} from '@/hooks/api/useSimpleBlotterQueries';
import { getActiveLayoutId, setActiveLayoutId, updateViewCustomData } from '@/openfin/utils/viewUtils';
import { useGridStateManager, LayoutApplyCallbacks } from './useGridStateManager';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface UseLayoutManagerOptions {
  blotterConfigId: string;
  userId: string;
  blotterName?: string;
  gridApi?: GridApi | null;
  selectedProviderId?: string;
  toolbarState?: BlotterToolbarState;
}

export interface LayoutManagerResult {
  // State
  selectedLayoutId: string | null;
  selectedLayout: LayoutInfo | undefined;
  layouts: LayoutInfo[];
  defaultLayoutId: string | undefined;
  blotterConfig: any;
  blotterUnified: any;
  isLoading: boolean;
  isSaving: boolean;

  // Dialog state
  isSaveDialogOpen: boolean;
  isManageDialogOpen: boolean;
  setIsSaveDialogOpen: (open: boolean) => void;
  setIsManageDialogOpen: (open: boolean) => void;

  // Actions
  initializeBlotter: () => Promise<any>;
  selectLayout: (layoutId: string, isInitialLoad?: boolean) => Promise<void>;
  saveCurrentLayout: () => Promise<void>;
  saveAsNewLayout: (name: string, setAsDefault: boolean) => Promise<any>;
  renameLayout: (layoutId: string, newName: string) => Promise<void>;
  deleteLayout: (layoutId: string) => Promise<void>;
  duplicateLayout: (layoutId: string, newName: string) => Promise<void>;
  setDefaultLayout: (layoutId: string) => Promise<void>;
  updateComponentSubType: (subType: string) => Promise<void>;
  updateToolbarConfig: (config: BlotterToolbarConfig) => Promise<void>;

  // Grid helpers
  captureGridState: () => Partial<SimpleBlotterLayoutConfig>;
  applyLayoutToGrid: (config: SimpleBlotterLayoutConfig, resetFirst?: boolean) => void;
  resetGridState: () => void;

  // Callback registration
  registerApplyCallbacks: (callbacks: LayoutApplyCallbacks) => void;
}

export interface LayoutInfo {
  config: SimpleBlotterLayoutConfig;
  unified: any;
}

// ============================================================================
// Hook
// ============================================================================

export function useLayoutManager({
  blotterConfigId,
  userId,
  blotterName = 'Blotter',
  gridApi,
  selectedProviderId,
  toolbarState,
}: UseLayoutManagerOptions): LayoutManagerResult {
  // ============================================================================
  // State
  // ============================================================================

  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  // Callbacks ref for layout application
  const applyCallbacksRef = useRef<LayoutApplyCallbacks>({});

  // Store mutation functions in refs to keep callbacks stable
  const getOrCreateBlotterRef = useRef<typeof getOrCreateBlotter | null>(null);

  // ============================================================================
  // Grid State Manager
  // ============================================================================

  const gridStateManager = useGridStateManager({
    gridApi: gridApi ?? null,
    selectedProviderId,
    toolbarState,
  });

  // ============================================================================
  // Queries
  // ============================================================================

  const blotterConfigQuery = useBlotterConfig(blotterConfigId);
  const layoutsQuery = useBlotterLayouts(blotterConfigId);

  // ============================================================================
  // Mutations
  // ============================================================================

  const getOrCreateBlotter = useGetOrCreateBlotterConfig();
  getOrCreateBlotterRef.current = getOrCreateBlotter;
  const updateBlotterConfig = useUpdateBlotterConfig();
  const updateComponentSubTypeMutation = useUpdateComponentSubType();
  const createLayoutMutation = useCreateLayout();
  const updateLayoutMutation = useUpdateLayout();
  const deleteLayoutMutation = useDeleteLayout();
  const duplicateLayoutMutation = useDuplicateLayout();
  const setDefaultLayoutMutation = useSetDefaultLayout();

  // ============================================================================
  // Derived State
  // ============================================================================

  const layouts = useMemo(() => layoutsQuery.data || [], [layoutsQuery.data]);
  const blotterData = blotterConfigQuery.data;
  const blotterConfig = blotterData?.config;
  const blotterUnified = blotterData?.unified;
  const defaultLayoutId = blotterConfig?.defaultLayoutId;

  const selectedLayout = useMemo(
    () => layouts.find((l) => l.unified.configId === selectedLayoutId),
    [layouts, selectedLayoutId]
  );

  const isLoading = blotterConfigQuery.isLoading || layoutsQuery.isLoading;
  const isSaving =
    createLayoutMutation.isPending ||
    updateLayoutMutation.isPending ||
    deleteLayoutMutation.isPending ||
    duplicateLayoutMutation.isPending ||
    setDefaultLayoutMutation.isPending;

  // ============================================================================
  // Callback Registration
  // ============================================================================

  const registerApplyCallbacks = useCallback((callbacks: LayoutApplyCallbacks) => {
    applyCallbacksRef.current = callbacks;
  }, []);

  // ============================================================================
  // Actions
  // ============================================================================

  const initializeBlotter = useCallback(async () => {
    try {
      const mutation = getOrCreateBlotterRef.current;
      if (!mutation) {
        throw new Error('Mutation not initialized');
      }
      const result = await mutation.mutateAsync({
        configId: blotterConfigId,
        userId,
        name: blotterName,
      });

      let layoutToSelect: string | null = null;
      let layoutSource: 'viewCustomData' | 'default' | 'none' = 'none';

      try {
        const viewActiveLayoutId = await getActiveLayoutId();
        if (viewActiveLayoutId) {
          logger.info('Found activeLayoutId in view customData', { activeLayoutId: viewActiveLayoutId }, 'useLayoutManager');
          layoutToSelect = viewActiveLayoutId;
          layoutSource = 'viewCustomData';
        }
      } catch (error) {
        logger.debug('Could not read view customData', { error }, 'useLayoutManager');
      }

      if (!layoutToSelect && result.config.defaultLayoutId) {
        layoutToSelect = result.config.defaultLayoutId;
        layoutSource = 'default';
      }

      if (layoutToSelect) {
        logger.info('Selecting initial layout', { layoutId: layoutToSelect, source: layoutSource }, 'useLayoutManager');
        setSelectedLayoutId(layoutToSelect);

        if (layoutSource === 'default') {
          try {
            await setActiveLayoutId(layoutToSelect);
          } catch (error) {
            logger.debug('Could not save default layout to customData', { error }, 'useLayoutManager');
          }
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to initialize blotter', error, 'useLayoutManager');
      throw error;
    }
  }, [blotterConfigId, userId, blotterName]);

  const selectLayout = useCallback(async (layoutId: string, isInitialLoad: boolean = false) => {
    setSelectedLayoutId(layoutId);

    const layout = layouts.find((l) => l.unified.configId === layoutId);
    if (layout) {
      gridStateManager.applyLayoutToGrid(layout.config, applyCallbacksRef.current, !isInitialLoad);
    }

    try {
      await setActiveLayoutId(layoutId);
    } catch (error) {
      logger.debug('Could not save to view customData', { error }, 'useLayoutManager');
    }

    updateBlotterConfig.mutate({
      configId: blotterConfigId,
      updates: { lastSelectedLayoutId: layoutId },
      userId,
    });
  }, [layouts, gridStateManager, updateBlotterConfig, blotterConfigId, userId]);

  const saveCurrentLayout = useCallback(async () => {
    if (!selectedLayoutId) {
      logger.warn('No layout selected for saving', {}, 'useLayoutManager');
      return;
    }

    const gridState = gridStateManager.captureGridState();
    await updateLayoutMutation.mutateAsync({
      layoutId: selectedLayoutId,
      updates: gridState,
      userId,
      blotterConfigId,
    });
  }, [selectedLayoutId, gridStateManager, updateLayoutMutation, userId, blotterConfigId]);

  const saveAsNewLayout = useCallback(async (name: string, setAsDefault: boolean) => {
    const gridState = gridStateManager.captureGridState();
    const layoutConfig = createDefaultLayoutConfig(gridState);

    const result = await createLayoutMutation.mutateAsync({
      blotterConfigId,
      userId,
      name,
      config: layoutConfig,
    });

    if (setAsDefault) {
      await setDefaultLayoutMutation.mutateAsync({
        blotterConfigId,
        layoutId: result.unified.configId,
        userId,
      });
    }

    setSelectedLayoutId(result.unified.configId);

    try {
      await setActiveLayoutId(result.unified.configId);
    } catch (error) {
      logger.debug('Could not save to view customData', { error }, 'useLayoutManager');
    }

    setIsSaveDialogOpen(false);
    return result;
  }, [gridStateManager, createLayoutMutation, blotterConfigId, userId, setDefaultLayoutMutation]);

  const renameLayout = useCallback(async (layoutId: string, newName: string) => {
    const layout = layouts.find((l) => l.unified.configId === layoutId);
    if (!layout) {
      logger.warn('Cannot rename - layout not found', { layoutId }, 'useLayoutManager');
      return;
    }
    // TODO: Implement rename API when available
    logger.warn('Layout rename not fully implemented', { layoutId, newName }, 'useLayoutManager');
  }, [layouts]);

  const handleDeleteLayout = useCallback(async (layoutId: string) => {
    await deleteLayoutMutation.mutateAsync({
      layoutId,
      blotterConfigId,
    });

    if (selectedLayoutId === layoutId) {
      const remainingLayouts = layouts.filter(l => l.unified.configId !== layoutId);
      if (remainingLayouts.length > 0) {
        const nextLayoutId = defaultLayoutId && remainingLayouts.some(l => l.unified.configId === defaultLayoutId)
          ? defaultLayoutId
          : remainingLayouts[0].unified.configId;
        await selectLayout(nextLayoutId);
      } else {
        setSelectedLayoutId(null);
        try {
          await updateViewCustomData({ activeLayoutId: undefined });
        } catch (error) {
          logger.debug('Could not clear view customData', { error }, 'useLayoutManager');
        }
      }
    }
  }, [deleteLayoutMutation, blotterConfigId, selectedLayoutId, layouts, defaultLayoutId, selectLayout]);

  const handleDuplicateLayout = useCallback(async (layoutId: string, newName: string) => {
    await duplicateLayoutMutation.mutateAsync({
      layoutId,
      newName,
      userId,
      blotterConfigId,
    });
  }, [duplicateLayoutMutation, userId, blotterConfigId]);

  const handleSetDefaultLayout = useCallback(async (layoutId: string) => {
    await setDefaultLayoutMutation.mutateAsync({
      blotterConfigId,
      layoutId,
      userId,
    });
  }, [setDefaultLayoutMutation, blotterConfigId, userId]);

  const handleUpdateComponentSubType = useCallback(async (subType: string) => {
    await updateComponentSubTypeMutation.mutateAsync({
      configId: blotterConfigId,
      componentSubType: subType,
      userId,
    });
  }, [updateComponentSubTypeMutation, blotterConfigId, userId]);

  const handleUpdateToolbarConfig = useCallback(async (config: BlotterToolbarConfig) => {
    if (!selectedLayoutId) {
      logger.warn('No layout selected for saving toolbar config', {}, 'useLayoutManager');
      return;
    }

    await updateLayoutMutation.mutateAsync({
      layoutId: selectedLayoutId,
      updates: { toolbarConfig: config },
      userId,
      blotterConfigId,
    });
  }, [selectedLayoutId, updateLayoutMutation, userId, blotterConfigId]);

  // Wrapper for applyLayoutToGrid that uses stored callbacks
  const applyLayoutToGrid = useCallback((config: SimpleBlotterLayoutConfig, resetFirst: boolean = false) => {
    gridStateManager.applyLayoutToGrid(config, applyCallbacksRef.current, resetFirst);
  }, [gridStateManager]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    selectedLayoutId,
    selectedLayout,
    layouts,
    defaultLayoutId,
    blotterConfig,
    blotterUnified,
    isLoading,
    isSaving,

    // Dialog state
    isSaveDialogOpen,
    isManageDialogOpen,
    setIsSaveDialogOpen,
    setIsManageDialogOpen,

    // Actions
    initializeBlotter,
    selectLayout,
    saveCurrentLayout,
    saveAsNewLayout,
    renameLayout,
    deleteLayout: handleDeleteLayout,
    duplicateLayout: handleDuplicateLayout,
    setDefaultLayout: handleSetDefaultLayout,
    updateComponentSubType: handleUpdateComponentSubType,
    updateToolbarConfig: handleUpdateToolbarConfig,

    // Grid helpers
    captureGridState: gridStateManager.captureGridState,
    applyLayoutToGrid,
    resetGridState: gridStateManager.resetGridState,

    // Callback registration
    registerApplyCallbacks,
  };
}

export default useLayoutManager;
