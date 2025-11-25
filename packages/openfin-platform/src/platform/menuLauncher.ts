/// <reference path="../types/openfin.d.ts" />

/**
 * Menu Launcher
 * Handles launching components from dock menu items
 *
 * Supports "reuse existing config" behavior where clicking the same dock menu item
 * loads an existing configuration instead of creating a new one each time.
 */

import { getCurrentSync } from '@openfin/workspace-platform';
import { DockMenuItem } from '../types/dockConfig';
import { buildUrl } from '../utils/urlHelper';
import { platformContext } from '../core/PlatformContext';

/**
 * Result of a config lookup operation
 */
export interface ConfigLookupResult {
  /** The configId to use (existing or newly generated) */
  configId: string;
  /** Whether the config already existed in the database */
  isExisting: boolean;
}

/**
 * Callback function type for looking up or creating configurations
 * This allows the dock to integrate with the client's config service
 * without the openfin-platform package depending on client code.
 *
 * @param menuItemId - The dock menu item ID
 * @param caption - The menu item caption (for display name)
 * @returns The configId to use and whether it's an existing config
 */
export type ConfigLookupCallback = (
  menuItemId: string,
  caption: string
) => Promise<ConfigLookupResult>;

/**
 * Module-level config lookup callback
 * Set by the client during initialization to enable config reuse behavior
 */
let configLookupCallback: ConfigLookupCallback | null = null;

/**
 * Register a config lookup callback
 * This should be called during platform initialization to enable
 * the "reuse existing config" behavior.
 *
 * @param callback - The callback function to use for config lookups
 */
export function registerConfigLookupCallback(callback: ConfigLookupCallback): void {
  configLookupCallback = callback;
  platformContext.logger.info('Config lookup callback registered', undefined, 'menuLauncher');
}

/**
 * Clear the config lookup callback (for cleanup/testing)
 */
export function clearConfigLookupCallback(): void {
  configLookupCallback = null;
}

/**
 * Launch a menu item as a window or view
 *
 * If a config lookup callback is registered, it will be used to determine
 * the configId to use. This enables "reuse existing config" behavior where
 * clicking the same dock menu item loads an existing configuration.
 */
export async function launchMenuItem(item: DockMenuItem): Promise<void> {
  if (!item.url) {
    platformContext.logger.warn('Menu item has no URL', item, 'menuLauncher');
    return;
  }

  try {
    const platform = getCurrentSync();

    // Determine the configId to use
    // If a config lookup callback is registered, use it to find/create the config
    // Otherwise, fall back to using the menu item ID (legacy behavior)
    let configId = item.id;
    let isExistingConfig = false;

    if (configLookupCallback) {
      try {
        platformContext.logger.debug('Looking up config for menu item', {
          menuItemId: item.id,
          caption: item.caption
        }, 'menuLauncher');

        const result = await configLookupCallback(item.id, item.caption);
        configId = result.configId;
        isExistingConfig = result.isExisting;

        platformContext.logger.info('Config lookup result', {
          menuItemId: item.id,
          configId,
          isExisting: isExistingConfig
        }, 'menuLauncher');
      } catch (error) {
        platformContext.logger.warn('Config lookup failed, using menu item ID as fallback', {
          menuItemId: item.id,
          error
        }, 'menuLauncher');
        configId = item.id;
      }
    }

    // Build the full URL with the configId as a query parameter
    const url = `${buildUrl(item.url)}?id=${encodeURIComponent(configId)}`;

    if (item.openMode === 'window') {
      // Launch as a new window
      const windowOptions = {
        name: `${item.id}-window-${Date.now()}`,
        url,
        defaultWidth: item.windowOptions?.width || 1200,
        defaultHeight: item.windowOptions?.height || 800,
        defaultCentered: item.windowOptions?.center ?? true,
        autoShow: true,
        frame: item.windowOptions?.frame ?? true,
        contextMenu: item.windowOptions?.contextMenu ?? true,
        resizable: item.windowOptions?.resizable ?? true,
        maximizable: item.windowOptions?.maximizable ?? true,
        minimizable: item.windowOptions?.minimizable ?? true,
        alwaysOnTop: item.windowOptions?.alwaysOnTop ?? false,
        minWidth: item.windowOptions?.minWidth,
        minHeight: item.windowOptions?.minHeight,
        maxWidth: item.windowOptions?.maxWidth,
        maxHeight: item.windowOptions?.maxHeight,
        accelerator: item.windowOptions?.accelerator || {
          zoom: true,
          reload: true,
          devtools: true
        }
      };

      await platform.createWindow(windowOptions);

      platformContext.logger.info(`Launched ${item.caption} as window`, { url, configId, isExistingConfig }, 'menuLauncher');
    } else {
      // Launch as a view in the current window
      const viewOptions = {
        name: `${item.id}-view-${Date.now()}`,
        url,
        bounds: {
          top: item.viewOptions?.bounds?.y || 0,
          left: item.viewOptions?.bounds?.x || 0,
          width: item.viewOptions?.bounds?.width || 800,
          height: item.viewOptions?.bounds?.height || 600
        },
        customData: {
          ...item.viewOptions?.customData,
          menuItemId: item.id,
          caption: item.caption,
          configId, // Include configId in customData for the view to use
          isExistingConfig
        }
      };

      await platform.createView(viewOptions as any);

      platformContext.logger.info(`Launched ${item.caption} as view`, { url, configId, isExistingConfig }, 'menuLauncher');
    }
  } catch (error) {
    platformContext.logger.error('Failed to launch menu item', error, 'menuLauncher');
    throw error;
  }
}

/**
 * Launch multiple menu items
 */
export async function launchMenuItems(items: DockMenuItem[]): Promise<void> {
  for (const item of items) {
    try {
      await launchMenuItem(item);
      // Small delay between launches to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      platformContext.logger.error(`Failed to launch ${item.caption}`, error, 'menuLauncher');
    }
  }
}

/**
 * Check if a component is already open
 */
export async function isComponentOpen(itemId: string): Promise<boolean> {
  try {
    const platform = getCurrentSync();
    const windows = await fin.System.getAllWindows();

    // Check if any window or view has this item ID in its name
    for (const window of windows) {
      const windowName = (window as any).name || (window as any).mainWindow?.name;
      if (windowName?.includes(itemId)) {
        return true;
      }

      // Check views within the window
      if (window.childWindows) {
        for (const child of window.childWindows) {
          if (child.name?.includes(itemId)) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    platformContext.logger.error('Error checking if component is open', error, 'menuLauncher');
    return false;
  }
}

/**
 * Focus an already open component
 */
export async function focusComponent(itemId: string): Promise<boolean> {
  try {
    const windows = await fin.System.getAllWindows();

    // Find and focus the window or view with this item ID
    for (const windowInfo of windows) {
      const windowName = (windowInfo as any).name || (windowInfo as any).mainWindow?.name;
      const windowUuid = (windowInfo as any).uuid || (windowInfo as any).mainWindow?.uuid;
      if (windowName?.includes(itemId)) {
        const window = fin.Window.wrapSync({
          uuid: windowUuid,
          name: windowName
        });
        await window.setAsForeground();
        await window.focus();
        return true;
      }

      // Check views within the window
      if (windowInfo.childWindows) {
        for (const child of windowInfo.childWindows) {
          const childName = (child as any).name;
          const childUuid = (child as any).uuid || (child as any).entityType;
          if (childName?.includes(itemId)) {
            const view = fin.View.wrapSync({
              uuid: childUuid,
              name: childName
            });
            await view.focus();
            return true;
          }
        }
      }
    }

    return false;
  } catch (error) {
    platformContext.logger.error('Error focusing component', error, 'menuLauncher');
    return false;
  }
}

/**
 * Launch or focus a component
 * If already open, brings it to focus. Otherwise launches it.
 */
export async function launchOrFocusComponent(item: DockMenuItem): Promise<void> {
  const isOpen = await isComponentOpen(item.id);

  if (isOpen) {
    const focused = await focusComponent(item.id);
    if (focused) {
      platformContext.logger.info(`Focused existing component: ${item.caption}`, undefined, 'menuLauncher');
      return;
    }
  }

  // Not open or couldn't focus, launch new instance
  await launchMenuItem(item);
}