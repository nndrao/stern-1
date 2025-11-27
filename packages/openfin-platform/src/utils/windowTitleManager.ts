/**
 * Window Title Manager
 *
 * Manages dynamic window titles in OpenFin platform to show the active page's title
 * instead of "internal-generated-window". Updates window title when pages change.
 *
 * Based on: https://openfin.zendesk.com/hc/en-us/articles/14396418368532
 */

/**
 * Initialize window title management for all platform windows
 *
 * This sets up event listeners that update window titles to match the active page title.
 * Call this after platform initialization.
 *
 * @param defaultTitle - Default title to use when no page is active
 */
export async function initializeWindowTitleManager(defaultTitle: string = 'Stern Platform'): Promise<void> {
  if (!window.fin) {
    console.warn('[WindowTitleManager] Not in OpenFin environment');
    return;
  }

  console.log('[WindowTitleManager] Initializing window title management');

  try {
    // Import workspace platform
    const workspacePlatform = await import('@openfin/workspace-platform');
    const platform = workspacePlatform.getCurrentSync();

    // Helper function to get the active page title for a window
    const getActivePageTitle = async (windowName: string): Promise<string> => {
      try {
        const allPages = await platform.Storage.getPages();

        // Find pages that belong to this window
        for (const page of allPages) {
          if (page.pageId && page.title) {
            // Check if this page's layout references our window
            const layout = page.layout as any;
            if (layout?.content) {
              // Search through the layout to find our window
              const hasWindow = JSON.stringify(layout).includes(windowName);
              if (hasWindow && (page as any).isActive) {
                return page.title;
              }
            }
          }
        }

        // Try first page with title as fallback
        const firstPageWithTitle = allPages.find(p => p.title);
        if (firstPageWithTitle) {
          return firstPageWithTitle.title!;
        }
      } catch (error) {
        console.error('[WindowTitleManager] Failed to get active page title:', error);
      }

      return defaultTitle;
    };

    // Helper function to update window title
    const updateWindowTitle = async (windowName: string) => {
      try {
        const window = fin.Window.wrapSync({
          uuid: fin.me.identity.uuid,
          name: windowName
        });

        const title = await getActivePageTitle(windowName);
        await (window as any).updateOptions({ title });

        console.log('[WindowTitleManager] Updated window title', {
          window: windowName,
          title
        });
      } catch (error) {
        console.error('[WindowTitleManager] Failed to update window title:', error);
      }
    };

    // Listen for window created events
    await fin.System.addListener('window-created', async (event: any) => {
      try {
        // Skip provider windows
        if (event.name && !event.name.includes('provider')) {
          console.log('[WindowTitleManager] Window created', event.name);

          // Small delay to let window initialize
          setTimeout(() => updateWindowTitle(event.name), 500);
        }
      } catch (error) {
        console.error('[WindowTitleManager] Failed to handle window-created:', error);
      }
    });

    // Listen for window focused events
    await fin.System.addListener('window-focused', async (event: any) => {
      try {
        if (event.name && !event.name.includes('provider')) {
          console.log('[WindowTitleManager] Window focused', event.name);
          await updateWindowTitle(event.name);
        }
      } catch (error) {
        console.error('[WindowTitleManager] Failed to handle window-focused:', error);
      }
    });

    // Set initial titles for all existing windows
    const allWindows = await fin.System.getAllWindows();

    for (const windowInfo of allWindows) {
      try {
        const mainWindow = windowInfo.mainWindow;
        const windowName = mainWindow.name;

        // Skip provider window
        if (windowName && !windowName.includes('provider')) {
          await updateWindowTitle(windowName);
        }
      } catch (error) {
        console.error('[WindowTitleManager] Failed to set initial title:', error);
      }
    }

    console.log('[WindowTitleManager] Window title management initialized');
  } catch (error) {
    console.error('[WindowTitleManager] Failed to initialize:', error);
  }
}

/**
 * Update the title of a specific window
 *
 * @param windowIdentity - Window identity or name
 * @param title - New title for the window
 */
export async function setWindowTitle(
  windowIdentity: { uuid: string; name: string } | string,
  title: string
): Promise<void> {
  if (!window.fin) {
    return;
  }

  try {
    const identity = typeof windowIdentity === 'string'
      ? { uuid: fin.me.identity.uuid, name: windowIdentity }
      : windowIdentity;

    const window = fin.Window.wrapSync(identity);
    await (window as any).updateOptions({ title });

    console.log('[WindowTitleManager] Window title updated', { window: identity.name, title });
  } catch (error) {
    console.error('[WindowTitleManager] Failed to set window title:', error);
  }
}
