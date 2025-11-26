/// <reference path="../types/openfin.d.ts" />

/**
 * Browser Override
 *
 * Custom browser overrides for OpenFin workspace platform.
 * Adds custom context menu items for view tabs.
 */

import type {
  WorkspacePlatformProvider,
  ViewTabContextMenuTemplate,
  OpenViewTabContextMenuPayload,
  ViewTabMenuOptionType
} from '@openfin/workspace-platform';

/**
 * View identity type (matches OpenFin.Identity structure)
 */
export interface ViewIdentity {
  uuid: string;
  name: string;
}

/**
 * Custom action identifiers for view context menu
 */
export const VIEW_CONTEXT_MENU_ACTIONS = {
  DUPLICATE_VIEW_WITH_LAYOUTS: 'duplicate-view-with-layouts',
  RENAME_VIEW: 'rename-view'
} as const;

export type ViewContextMenuAction = typeof VIEW_CONTEXT_MENU_ACTIONS[keyof typeof VIEW_CONTEXT_MENU_ACTIONS];

/**
 * Handler for custom view context menu actions
 */
export type ViewContextMenuActionHandler = (
  action: ViewContextMenuAction,
  payload: {
    windowIdentity: ViewIdentity;
    selectedViews: ViewIdentity[];
    customData?: unknown;
  }
) => Promise<void>;

/**
 * Configuration for browser override
 */
export interface BrowserOverrideConfig {
  /** Handler for custom actions */
  onAction?: ViewContextMenuActionHandler;
  /** Enable duplicate view with layouts menu item */
  enableDuplicateWithLayouts?: boolean;
  /** Enable rename view menu item */
  enableRenameView?: boolean;
  /** ViewTabMenuOptionType enum for type safety - must be passed from client code */
  ViewTabMenuOptionType?: typeof ViewTabMenuOptionType;
}

/**
 * Creates a browser override callback that adds custom view tab context menu items
 *
 * @param config - Configuration for the browser override
 * @returns Override callback for workspace platform init
 */
export function createBrowserOverride(config: BrowserOverrideConfig = {}) {
  const { enableDuplicateWithLayouts = true, enableRenameView = true } = config;

  return async (
    WorkspacePlatformProviderClass: { new (): WorkspacePlatformProvider }
  ): Promise<{ new (): WorkspacePlatformProvider }> => {

    class CustomBrowserProvider extends WorkspacePlatformProviderClass {
      /**
       * Override openViewTabContextMenu to add custom menu items
       */
      async openViewTabContextMenu(
        payload: OpenViewTabContextMenuPayload,
        callerIdentity: ViewIdentity
      ): Promise<void> {
        // Build custom menu items to add
        const customItems: ViewTabContextMenuTemplate[] = [];

        if (enableDuplicateWithLayouts) {
          // Add separator before our custom item
          customItems.push({ type: 'separator' } as ViewTabContextMenuTemplate);

          // Add "Duplicate View with Layouts" option using Custom type
          customItems.push({
            type: 'normal',
            label: 'Duplicate View with Layouts',
            data: {
              type: 'Custom' as unknown as ViewTabMenuOptionType,
              action: {
                id: VIEW_CONTEXT_MENU_ACTIONS.DUPLICATE_VIEW_WITH_LAYOUTS,
                customData: {
                  selectedViews: payload.selectedViews
                }
              }
            }
          } as ViewTabContextMenuTemplate);
        }

        if (enableRenameView) {
          // Add separator if we haven't already
          if (!enableDuplicateWithLayouts) {
            customItems.push({ type: 'separator' } as ViewTabContextMenuTemplate);
          }

          // Add "Rename View" option using Custom type
          customItems.push({
            type: 'normal',
            label: 'Rename View',
            data: {
              type: 'Custom' as unknown as ViewTabMenuOptionType,
              action: {
                id: VIEW_CONTEXT_MENU_ACTIONS.RENAME_VIEW,
                customData: {
                  selectedViews: payload.selectedViews
                }
              }
            }
          } as ViewTabContextMenuTemplate);
        }

        // Find the standard "Duplicate View" option and insert after it
        const duplicateIndex = payload.template.findIndex(
          (item) => {
            const itemData = (item as { data?: { type?: string } }).data;
            return itemData?.type === 'DuplicateView' ||
                   (item as { label?: string }).label === 'Duplicate View';
          }
        );

        let modifiedTemplate: ViewTabContextMenuTemplate[];
        if (duplicateIndex !== -1) {
          // Insert after the standard duplicate option
          modifiedTemplate = [
            ...payload.template.slice(0, duplicateIndex + 1),
            ...customItems,
            ...payload.template.slice(duplicateIndex + 1)
          ];
        } else {
          // Just append to the end if we can't find the standard option
          modifiedTemplate = [...payload.template, ...customItems];
        }

        console.log('[BrowserOverride] Added custom context menu items', {
          selectedViews: payload.selectedViews,
          customItemsCount: customItems.length
        });

        // Call parent with modified template
        return super.openViewTabContextMenu(
          {
            ...payload,
            template: modifiedTemplate
          },
          callerIdentity
        );
      }
    }

    console.log('[BrowserOverride] Custom browser provider created');
    return CustomBrowserProvider;
  };
}

/**
 * Creates customActions object to register with workspace platform init
 *
 * @param onAction - Handler for custom actions
 * @returns Custom actions object for workspace platform init
 */
export function createCustomActions(onAction?: ViewContextMenuActionHandler) {
  return {
    [VIEW_CONTEXT_MENU_ACTIONS.DUPLICATE_VIEW_WITH_LAYOUTS]: async (payload: {
      callerType: string;
      customData: unknown;
      windowIdentity: ViewIdentity;
      selectedViews: ViewIdentity[];
    }) => {
      console.log('[BrowserOverride] Custom action triggered', {
        action: VIEW_CONTEXT_MENU_ACTIONS.DUPLICATE_VIEW_WITH_LAYOUTS,
        selectedViews: payload.selectedViews,
        customData: payload.customData
      });

      if (onAction) {
        await onAction(VIEW_CONTEXT_MENU_ACTIONS.DUPLICATE_VIEW_WITH_LAYOUTS, {
          windowIdentity: payload.windowIdentity,
          selectedViews: payload.selectedViews,
          customData: payload.customData
        });
      } else {
        console.warn('[BrowserOverride] No action handler registered for duplicate-view-with-layouts');
      }
    },
    [VIEW_CONTEXT_MENU_ACTIONS.RENAME_VIEW]: async (payload: {
      callerType: string;
      customData: unknown;
      windowIdentity: ViewIdentity;
      selectedViews: ViewIdentity[];
    }) => {
      console.log('[BrowserOverride] Custom action triggered', {
        action: VIEW_CONTEXT_MENU_ACTIONS.RENAME_VIEW,
        selectedViews: payload.selectedViews,
        customData: payload.customData
      });

      if (onAction) {
        await onAction(VIEW_CONTEXT_MENU_ACTIONS.RENAME_VIEW, {
          windowIdentity: payload.windowIdentity,
          selectedViews: payload.selectedViews,
          customData: payload.customData
        });
      } else {
        console.warn('[BrowserOverride] No action handler registered for rename-view');
      }
    }
  };
}

/**
 * Combines workspace storage override with browser override
 *
 * Use this when you need both workspace storage and browser customizations.
 *
 * @param workspaceStorageOverride - The workspace storage override function (returns instance)
 * @param browserConfig - Configuration for browser override
 * @returns Combined override callback (returns instance)
 */
export function combineOverrides(
  workspaceStorageOverride: (
    WorkspacePlatformProvider: { new (): WorkspacePlatformProvider }
  ) => Promise<WorkspacePlatformProvider>,
  browserConfig: BrowserOverrideConfig
) {
  return async (
    WorkspacePlatformProviderClass: { new (): WorkspacePlatformProvider }
  ): Promise<WorkspacePlatformProvider> => {
    // First apply workspace storage override
    const storageProviderInstance = await workspaceStorageOverride(WorkspacePlatformProviderClass);

    // Get the constructor of the storage provider instance
    const StorageProviderClass = storageProviderInstance.constructor as { new (): WorkspacePlatformProvider };

    // Then apply browser override on top
    const browserOverride = createBrowserOverride(browserConfig);
    const BrowserProviderClass = await browserOverride(StorageProviderClass);

    // Return instance of the combined provider
    return new BrowserProviderClass();
  };
}
