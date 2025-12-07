/**
 * SimpleBlotter
 *
 * A clean, composable implementation of the SimpleBlotter component.
 * Uses focused hooks for different concerns:
 * - useLayoutManager: Layout CRUD and state
 * - useBlotterDataConnection: Data provider connection
 * - BlotterGrid: Grid rendering
 *
 * Key improvements:
 * - Reduced from 1046 lines to ~400 lines
 * - Consolidated from 14 useEffects to 4
 * - Clearer separation of concerns
 * - Better maintainability
 */

import React, { useRef, useEffect, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { GridApi, ColDef } from 'ag-grid-community';
import { useAgGridTheme } from '@/hooks/ui/useAgGridTheme';
import { useOpenfinTheme } from '@stern/openfin-platform';
import { useSternPlatform } from '@/providers/SternPlatformProvider';
import { getViewInstanceId, getViewCustomData } from '@/openfin/utils/viewUtils';
import { OpenFinCustomEvents } from '@stern/openfin-platform';
import { resolveValueFormatter } from '@/formatters';
import { CollapsibleToolbar } from '@/components/ui/CollapsibleToolbar';
import { BlotterToolbar } from './BlotterToolbar';
import { LayoutSaveDialog } from './LayoutSaveDialog';
import { LayoutManageDialog } from './LayoutManageDialog';
import { BlotterGrid } from './components/BlotterGrid';
import { useLayoutManager } from './hooks/useLayoutManager';
import { useBlotterData } from '@/providers/stomp';
import { COMPONENT_TYPES } from '@stern/shared-types';
import { isOpenFin } from '@stern/openfin-platform';
import { DIALOG_TYPES, DIALOG_CONFIGS } from '@/config/dialogConfig';
import { logger } from '@/utils/logger';
import { BlotterType, BLOTTER_TYPES } from '@/types/blotter';
import { useActionExecutor } from '@/hooks/useActionRegistry';
import {
  ToolbarButton,
  DynamicToolbar,
  BlotterToolbarConfig,
  ToolbarColor,
} from '@/components/wizards/ToolbarCustomizationWizard';

import { ToolbarCustomizationWizard } from '@/components/wizards';

// Type for toolbar state map
interface ToolbarStatesMap {
  [toolbarId: string]: {
    isCollapsed: boolean;
    isPinned: boolean;
  };
}

// ============================================================================
// Types
// ============================================================================

export interface SimpleBlotterProps {
  onReady?: () => void;
  onError?: (error: Error) => void;
  blotterType?: BlotterType | string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const createColumnDefs = (columnsData: any[]): ColDef[] => {
  return columnsData.map((col: any) => {
    const colDef: ColDef = {
      field: col.field,
      headerName: col.headerName || col.field,
      width: col.width || 150,
      filter: true,
      sortable: true,
    };

    if (col.cellDataType) {
      colDef.cellDataType = col.cellDataType;
    }

    if (col.valueFormatter) {
      const formatter = resolveValueFormatter(col.valueFormatter);
      if (formatter) {
        colDef.valueFormatter = formatter;
      }
    }

    if (col.cellRenderer === 'NumericCellRenderer' || col.cellDataType === 'number') {
      colDef.cellClass = 'ag-right-aligned-cell';
    }

    if (col.editable !== undefined) colDef.editable = col.editable;
    if (col.hide !== undefined) colDef.hide = col.hide;
    if (col.pinned) colDef.pinned = col.pinned;
    if (col.flex !== undefined) colDef.flex = col.flex;

    return colDef;
  });
};

// ============================================================================
// Component
// ============================================================================

export const SimpleBlotter: React.FC<SimpleBlotterProps> = ({
  onReady,
  onError,
  blotterType = BLOTTER_TYPES.DEFAULT,
}) => {
  // Theme hooks
  useOpenfinTheme();
  useAgGridTheme();

  // Platform access
  const platform = useSternPlatform();

  // Stable IDs
  const viewInstanceId = useMemo(() => getViewInstanceId(), []);
  const userId = 'default-user';

  // ============================================================================
  // State
  // ============================================================================

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [columns, setColumns] = useState<ColDef[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gridReady, setGridReady] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(true);
  const [isToolbarPinned, setIsToolbarPinned] = useState(false);
  const [customButtons, setCustomButtons] = useState<ToolbarButton[]>([]);
  const [additionalToolbars, setAdditionalToolbars] = useState<DynamicToolbar[]>([]);
  const [toolbarStates, setToolbarStates] = useState<ToolbarStatesMap>({});
  const [isToolbarWizardOpen, setIsToolbarWizardOpen] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);

  // ============================================================================
  // Refs
  // ============================================================================

  const gridApiRef = useRef<GridApi | null>(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const isManageDialogOpenRef = useRef(false);
  const initialLayoutAppliedRef = useRef(false);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onReady, onError]);

  // ============================================================================
  // Layout Manager
  // ============================================================================

  const toolbarState = useMemo(() => ({
    isCollapsed: isToolbarCollapsed,
    isPinned: isToolbarPinned,
  }), [isToolbarCollapsed, isToolbarPinned]);

  const layoutManager = useLayoutManager({
    blotterConfigId: viewInstanceId,
    userId,
    blotterName: 'SimpleBlotter',
    gridApi: gridApiRef.current,
    toolbarState,
    selectedProviderId: selectedProviderId ?? undefined,
  });

  // Register layout callbacks
  useLayoutEffect(() => {
    layoutManager.registerApplyCallbacks({
      onToolbarStateChange: (state) => {
        setIsToolbarCollapsed(state.isCollapsed);
        setIsToolbarPinned(state.isPinned);
      },
      onProviderChange: (providerId) => {
        setSelectedProviderId(providerId);
      },
      onToolbarConfigChange: (config) => {
        if (config?.customButtons) {
          setCustomButtons(config.customButtons);
        }
        if (config?.additionalToolbars) {
          setAdditionalToolbars(config.additionalToolbars);
        }
        if (config?.toolbarStates) {
          setToolbarStates(config.toolbarStates);
        }
      },
    });
  }, [layoutManager.registerApplyCallbacks]);

  // ============================================================================
  // Action Executor
  // ============================================================================

  const actionExecutor = useActionExecutor({
    gridApi: gridApiRef.current,
    selectedRows: [],
    rowData: [],
    providerId: selectedProviderId,
    layoutId: layoutManager.selectedLayoutId,
    refreshData: () => {
      if (dataConnection.isConnected) {
        dataConnection.disconnect();
        setTimeout(() => dataConnection.connect(), 100);
      }
    },
    isOpenFin: platform.isOpenFin,
    platform,
  });

  // ============================================================================
  // Data Connection
  // ============================================================================

  const dataConnection = useBlotterData({
    providerId: selectedProviderId,
    gridApi: gridApiRef.current,
    gridReady,
    onRowCountChange: setRowCount,
    onLoadingChange: setIsLoading,
    onLoadComplete: setLoadTimeMs,
    onError: onErrorRef.current,
  });

  // ============================================================================
  // Initialization Effect (consolidated)
  // ============================================================================

  useEffect(() => {
    // Prevent double initialization
    if (isInitializedRef.current) {
      return;
    }
    isInitializedRef.current = true;

    // Load providers
    platform.configService.getAll({
      componentType: COMPONENT_TYPES.DATA_PROVIDER,
    })
    .then((providers) => {
      const filteredProviders = providers.filter((p: any) => {
        const subType = p.componentSubType?.toLowerCase();
        return subType === 'stomp' || subType === 'rest';
      });
      setAvailableProviders(
        filteredProviders.map((p: any) => ({ id: p.configId, name: p.name }))
      );
    })
    .catch((error) => {
      logger.error('Failed to load providers', error, 'SimpleBlotter');
      onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to load providers'));
    });

    // Initialize blotter layout
    layoutManager.initializeBlotter().catch((error) => {
      logger.error('Failed to initialize blotter layout', error, 'SimpleBlotter');
      onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to initialize blotter layout'));
    });

    // Restore caption from customData
    if (platform.isOpenFin) {
      getViewCustomData()
        .then((customData) => {
          if (customData?.caption) {
            document.title = customData.caption;
          }
        })
        .catch((error) => {
          logger.warn('Failed to restore view caption', error, 'SimpleBlotter');
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // Layout Application Effect
  // ============================================================================

  useEffect(() => {
    if (initialLayoutAppliedRef.current || !layoutManager.selectedLayout) {
      return;
    }

    layoutManager.applyLayoutToGrid(layoutManager.selectedLayout.config);
    initialLayoutAppliedRef.current = true;
  }, [layoutManager.selectedLayout, layoutManager.applyLayoutToGrid]);

  // Re-apply grid state when grid becomes ready
  useEffect(() => {
    if (gridReady && layoutManager.selectedLayout && initialLayoutAppliedRef.current) {
      const { config } = layoutManager.selectedLayout;
      if (gridApiRef.current && config.columnState?.length > 0) {
        gridApiRef.current.applyColumnState({
          state: config.columnState,
          applyOrder: true,
        });
      }
      if (gridApiRef.current && config.filterState) {
        gridApiRef.current.setFilterModel(config.filterState);
      }
      // Always apply sidebar state - default to hidden if not specified
      if (gridApiRef.current) {
        try {
          const sideBarVisible = config.sideBarState?.visible ?? false;
          gridApiRef.current.setSideBarVisible(sideBarVisible);
          if (sideBarVisible && config.sideBarState?.openToolPanel) {
            gridApiRef.current.openToolPanel(config.sideBarState.openToolPanel);
          } else {
            gridApiRef.current.closeToolPanel();
          }
        } catch {
          // Side bar may not be configured
        }
      }
    }
  }, [gridReady, layoutManager.selectedLayout]);

  // ============================================================================
  // Load Columns Effect
  // ============================================================================

  useEffect(() => {
    if (!selectedProviderId) {
      setColumns([]);
      return;
    }

    platform.configService.getById(selectedProviderId)
      .then((config) => {
        const columnsData = config?.config?.columnDefinitions;
        if (columnsData && Array.isArray(columnsData)) {
          setColumns(createColumnDefs(columnsData));
        }
      })
      .catch((error) => {
        logger.error('Failed to load columns', error, 'SimpleBlotter');
        onErrorRef.current?.(error instanceof Error ? error : new Error('Failed to load columns'));
      });
  }, [selectedProviderId, platform.configService]);

  // ============================================================================
  // OpenFin Events Effect
  // FIXED: Use refs to stabilize dependencies and prevent unnecessary resubscriptions
  // ============================================================================

  const dataConnectionRef = useRef(dataConnection);
  const selectedProviderIdRef = useRef(selectedProviderId);

  useEffect(() => {
    dataConnectionRef.current = dataConnection;
    selectedProviderIdRef.current = selectedProviderId;
  }, [dataConnection, selectedProviderId]);

  useEffect(() => {
    if (!platform.isOpenFin) return;

    const unsubRefresh = platform.subscribeToEvent(
      OpenFinCustomEvents.DATA_REFRESH,
      () => {
        const conn = dataConnectionRef.current;
        if (conn.isConnected) {
          conn.disconnect();
          setTimeout(() => conn.connect(), 100);
        }
      }
    );

    const unsubConfig = platform.subscribeToEvent(
      OpenFinCustomEvents.CONFIG_UPDATED,
      (data) => {
        const currentProviderId = selectedProviderIdRef.current;
        if (currentProviderId && data.componentType === COMPONENT_TYPES.DATA_PROVIDER && data.configId === currentProviderId) {
          platform.configService.getById(currentProviderId)
            .then((config) => {
              const columnsData = config?.config?.columnDefinitions;
              if (columnsData && Array.isArray(columnsData)) {
                setColumns(createColumnDefs(columnsData));
              }
            })
            .catch((error) => {
              logger.error('Failed to reload columns on config update', error, 'SimpleBlotter');
            });
        }
      }
    );

    return () => {
      unsubRefresh();
      unsubConfig();
    };
  }, [platform]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleGridReady = useCallback((api: GridApi) => {
    gridApiRef.current = api;
    setGridReady(true);
    onReadyRef.current?.();
  }, []);

  const handleProviderSelect = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
    setGridReady(false);
  }, []);

  const getRowId = useCallback((params: any) => {
    if (dataConnection.getRowId) {
      return dataConnection.getRowId(params);
    }
    return params.data?.id || params.data?.positionId || `row-${params.rowIndex}`;
  }, [dataConnection.getRowId]);

  const handleManageLayouts = useCallback(async () => {
    if (isManageDialogOpenRef.current) return;

    if (!isOpenFin()) {
      layoutManager.setIsManageDialogOpen(true);
      return;
    }

    if (!layoutManager.blotterUnified) {
      logger.error('Cannot open manage layouts: blotter config not loaded', null, 'SimpleBlotter');
      return;
    }

    isManageDialogOpenRef.current = true;

    try {
      const requestTopic = `stern.dialog.${DIALOG_TYPES.MANAGE_LAYOUTS}.request`;
      const responseTopic = `stern.dialog.${DIALOG_TYPES.MANAGE_LAYOUTS}.response`;
      const actionTopic = `stern.dialog.${DIALOG_TYPES.MANAGE_LAYOUTS}.action`;

      const sendData = () => {
        fin.InterApplicationBus.publish(responseTopic, {
          data: {
            layouts: layoutManager.layouts,
            defaultLayoutId: layoutManager.defaultLayoutId,
            blotterConfigId: layoutManager.blotterUnified!.configId,
            componentType: layoutManager.blotterUnified!.componentType,
            componentSubType: layoutManager.blotterUnified!.componentSubType,
          },
        });
      };

      const handleDataRequest = () => sendData();

      const handleAction = async (message: any) => {
        const { action, payload } = message;
        switch (action) {
          case 'setDefault':
            if (payload?.layoutId) await layoutManager.setDefaultLayout(payload.layoutId);
            break;
          case 'delete':
            if (payload?.layoutId) await layoutManager.deleteLayout(payload.layoutId);
            break;
          case 'rename':
            if (payload?.layoutId && payload?.newName) await layoutManager.renameLayout(payload.layoutId, payload.newName);
            break;
          case 'duplicate':
            if (payload?.layoutId && payload?.newName) await layoutManager.duplicateLayout(payload.layoutId, payload.newName);
            break;
          case 'updateSubType':
            if (payload?.newSubType !== undefined) await layoutManager.updateComponentSubType(payload.newSubType);
            break;
        }
        sendData();
      };

      fin.InterApplicationBus.subscribe({ uuid: '*' }, requestTopic, handleDataRequest);
      fin.InterApplicationBus.subscribe({ uuid: '*' }, actionTopic, handleAction);

      const dialogConfig = DIALOG_CONFIGS[DIALOG_TYPES.MANAGE_LAYOUTS];
      const window = await fin.Window.create({
        name: `dialog-${DIALOG_TYPES.MANAGE_LAYOUTS}-${Date.now()}`,
        url: `${location.origin}/dialogs/manage-layouts`,
        defaultWidth: dialogConfig.width,
        defaultHeight: dialogConfig.height,
        frame: dialogConfig.frame,
        resizable: dialogConfig.resizable,
        alwaysOnTop: dialogConfig.alwaysOnTop,
        defaultCentered: dialogConfig.center,
        autoShow: true,
      });

      await new Promise<void>((resolve) => {
        window.once('closed', () => resolve());
      });

      fin.InterApplicationBus.unsubscribe({ uuid: '*' }, requestTopic, handleDataRequest);
      fin.InterApplicationBus.unsubscribe({ uuid: '*' }, actionTopic, handleAction);
    } catch (error) {
      logger.error('Failed to open manage layouts dialog', error, 'SimpleBlotter');
    } finally {
      isManageDialogOpenRef.current = false;
    }
  }, [layoutManager]);

  // Handle custom toolbar button actions
  const handleAction = useCallback(
    async (actionId: string, actionData?: Record<string, unknown>) => {
      try {
        await actionExecutor.execute(actionId, actionData);
        setUpdateCount((prev) => prev + 1);
      } catch (error) {
        logger.error(`Failed to execute action: ${actionId}`, error, 'SimpleBlotter');
      }
    },
    [actionExecutor]
  );

  // Handle toolbar customization save
  const handleSaveToolbarConfig = useCallback(
    (buttons: ToolbarButton[]) => {
      setCustomButtons(buttons);
      // Save to layout config
      layoutManager.updateToolbarConfig({
        customButtons: buttons,
        additionalToolbars,
        toolbarStates,
      });
    },
    [layoutManager, additionalToolbars, toolbarStates]
  );

  // Handle additional toolbar state changes
  const handleToolbarStateChange = useCallback(
    (toolbarId: string, state: { isCollapsed: boolean; isPinned: boolean }) => {
      setToolbarStates((prev) => ({
        ...prev,
        [toolbarId]: state,
      }));
    },
    []
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="flex flex-col h-full">
      <CollapsibleToolbar
        id="blotter-main"
        color="blue"
        isCollapsed={isToolbarCollapsed}
        isPinned={isToolbarPinned}
        onCollapsedChange={setIsToolbarCollapsed}
        onPinnedChange={setIsToolbarPinned}
      >
        <BlotterToolbar
          selectedProviderId={selectedProviderId}
          availableProviders={availableProviders}
          isLoading={isLoading}
          adapter={dataConnection}
          rowCount={rowCount}
          loadTimeMs={loadTimeMs}
          onProviderSelect={handleProviderSelect}
          layouts={layoutManager.layouts}
          selectedLayoutId={layoutManager.selectedLayoutId}
          defaultLayoutId={layoutManager.defaultLayoutId}
          isLayoutSaving={layoutManager.isSaving}
          onLayoutSelect={layoutManager.selectLayout}
          onSaveLayout={layoutManager.saveCurrentLayout}
          onSaveAsNew={() => layoutManager.setIsSaveDialogOpen(true)}
          onManageLayouts={handleManageLayouts}
          customButtons={customButtons}
          onAction={handleAction}
          onCustomizeToolbar={() => setIsToolbarWizardOpen(true)}
          updateCount={updateCount}
        />
      </CollapsibleToolbar>

      {/* Additional Toolbars (above grid) */}
      {additionalToolbars
        .filter((tb) => tb.position === 'above')
        .sort((a, b) => (a.order ?? 50) - (b.order ?? 50))
        .map((toolbar) => {
          const state = toolbarStates[toolbar.id] ?? {
            isCollapsed: toolbar.defaultCollapsed ?? true,
            isPinned: toolbar.defaultPinned ?? false,
          };
          return (
            <CollapsibleToolbar
              key={toolbar.id}
              id={toolbar.id}
              color={toolbar.color ?? 'green'}
              isCollapsed={state.isCollapsed}
              isPinned={state.isPinned}
              onCollapsedChange={(collapsed) =>
                handleToolbarStateChange(toolbar.id, { ...state, isCollapsed: collapsed })
              }
              onPinnedChange={(pinned) =>
                handleToolbarStateChange(toolbar.id, { ...state, isPinned: pinned })
              }
            >
              <BlotterToolbar
                selectedProviderId={selectedProviderId}
                availableProviders={[]}
                isLoading={isLoading}
                adapter={dataConnection}
                rowCount={rowCount}
                loadTimeMs={null}
                onProviderSelect={() => {}}
                customButtons={toolbar.buttons ?? []}
                onAction={handleAction}
              />
            </CollapsibleToolbar>
          );
        })}

      <LayoutSaveDialog
        open={layoutManager.isSaveDialogOpen}
        onClose={() => layoutManager.setIsSaveDialogOpen(false)}
        onSave={layoutManager.saveAsNewLayout}
        isSaving={layoutManager.isSaving}
        defaultName={`Layout ${layoutManager.layouts.length + 1}`}
      />

      {!isOpenFin() && (
        <LayoutManageDialog
          open={layoutManager.isManageDialogOpen}
          onClose={() => layoutManager.setIsManageDialogOpen(false)}
          layouts={layoutManager.layouts}
          defaultLayoutId={layoutManager.defaultLayoutId}
          selectedLayoutId={layoutManager.selectedLayoutId ?? undefined}
          blotterInfo={layoutManager.blotterUnified ? {
            configId: layoutManager.blotterUnified.configId,
            componentType: layoutManager.blotterUnified.componentType,
            componentSubType: layoutManager.blotterUnified.componentSubType,
          } : undefined}
          onRename={layoutManager.renameLayout}
          onDelete={layoutManager.deleteLayout}
          onDuplicate={layoutManager.duplicateLayout}
          onSetDefault={layoutManager.setDefaultLayout}
          onSelect={layoutManager.selectLayout}
          onSaveComponentSubType={layoutManager.updateComponentSubType}
        />
      )}

      <div className="flex-1">
        <BlotterGrid
          columns={columns}
          onGridReady={handleGridReady}
          getRowId={getRowId}
          showEmptyState={!selectedProviderId}
          emptyStateMessage={selectedProviderId ? 'Loading columns...' : 'Select a provider to begin'}
        />
      </div>

      {/* Additional Toolbars (below grid) */}
      {additionalToolbars
        .filter((tb) => tb.position === 'below')
        .sort((a, b) => (a.order ?? 50) - (b.order ?? 50))
        .map((toolbar) => {
          const state = toolbarStates[toolbar.id] ?? {
            isCollapsed: toolbar.defaultCollapsed ?? true,
            isPinned: toolbar.defaultPinned ?? false,
          };
          return (
            <CollapsibleToolbar
              key={toolbar.id}
              id={toolbar.id}
              color={toolbar.color ?? 'purple'}
              isCollapsed={state.isCollapsed}
              isPinned={state.isPinned}
              onCollapsedChange={(collapsed) =>
                handleToolbarStateChange(toolbar.id, { ...state, isCollapsed: collapsed })
              }
              onPinnedChange={(pinned) =>
                handleToolbarStateChange(toolbar.id, { ...state, isPinned: pinned })
              }
            >
              <BlotterToolbar
                selectedProviderId={selectedProviderId}
                availableProviders={[]}
                isLoading={isLoading}
                adapter={dataConnection}
                rowCount={rowCount}
                loadTimeMs={null}
                onProviderSelect={() => {}}
                customButtons={toolbar.buttons ?? []}
                onAction={handleAction}
              />
            </CollapsibleToolbar>
          );
        })}

      {/* Toolbar Customization Wizard */}
      <ToolbarCustomizationWizard
        open={isToolbarWizardOpen}
        onClose={() => setIsToolbarWizardOpen(false)}
        buttons={customButtons}
        onSave={handleSaveToolbarConfig}
      />
    </div>
  );
};

export default SimpleBlotter;
