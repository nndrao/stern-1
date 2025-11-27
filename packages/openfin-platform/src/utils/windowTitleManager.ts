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

    // Helper function to get the active page title
    const getActivePageTitle = async (): Promise<string> => {
      try {
        // Get all pages from storage
        const pages = await platform.Storage.getPages();

        console.log('[WindowTitleManager] Retrieved pages', {
          pageCount: pages.length
        });

        // Find the active page (the currently selected tab)
        const activePage = pages.find((p: any) => p.isActive === true);

        if (activePage?.title) {
          console.log('[WindowTitleManager] Found active page', {
            pageTitle: activePage.title,
            pageId: activePage.pageId,
            isActive: (activePage as any).isActive
          });
          return activePage.title;
        }

        // Fallback: use first page with a title
        const firstPageWithTitle = pages.find(p => p.title);
        if (firstPageWithTitle?.title) {
          console.log('[WindowTitleManager] Using first page with title (no active page)', {
            pageTitle: firstPageWithTitle.title,
            pageId: firstPageWithTitle.pageId
          });
          return firstPageWithTitle.title;
        }

        console.log('[WindowTitleManager] No pages with titles found, using default');
      } catch (error) {
        console.error('[WindowTitleManager] Failed to get active page title:', error);
      }

      return defaultTitle;
    };

    // Helper function to update window title
    const updateWindowTitle = async (windowIdentity: { uuid: string; name: string }) => {
      try {
        const window = fin.Window.wrapSync(windowIdentity);
        const title = await getActivePageTitle();

        // Update the window title
        await (window as any).updateOptions({ title });

        console.log('[WindowTitleManager] Updated window title', {
          window: windowIdentity.name,
          title
        });
      } catch (error: any) {
        // Ignore errors for windows that no longer exist
        if (!error?.message?.includes('Could not locate')) {
          console.error('[WindowTitleManager] Failed to update window title:', error);
        }
      }
    };

    // Helper to check if window should be managed
    const shouldManageWindow = (windowName: string): boolean => {
      const skipPatterns = [
        'provider',
        'process-manager',
        'Process Manager',
        'openfin-dock',
        'openfin-browser-menu',
        'openfin-browser-indicator'
      ];
      return !skipPatterns.some(pattern => windowName.includes(pattern));
    };

    // Listen for window created events
    await fin.System.addListener('window-created', async (event: any) => {
      try {
        if (event.name && shouldManageWindow(event.name)) {
          console.log('[WindowTitleManager] Window created', event.name);

          // Delay to let pages initialize
          setTimeout(() => {
            updateWindowTitle({ uuid: event.uuid, name: event.name });
          }, 1500);
        }
      } catch (error) {
        console.error('[WindowTitleManager] Failed to handle window-created:', error);
      }
    });

    // Listen for window focused events
    await fin.System.addListener('window-focused', async (event: any) => {
      try {
        if (event.name && shouldManageWindow(event.name)) {
          console.log('[WindowTitleManager] Window focused', event.name);
          await updateWindowTitle({ uuid: event.uuid, name: event.name });
        }
      } catch (error) {
        console.error('[WindowTitleManager] Failed to handle window-focused:', error);
      }
    });

    // Listen for workspace page changes (when user switches tabs)
    try {
      // Listen to workspace storage changes to detect page switches
      const originalSavePage = platform.Storage.savePage;
      platform.Storage.savePage = async function(page: any) {
        const result = await originalSavePage.call(platform.Storage, page);

        // If a page was marked as active, update all window titles
        if ((page as any).isActive === true) {
          console.log('[WindowTitleManager] Page activated, updating windows', {
            pageTitle: page.title,
            pageId: page.pageId
          });

          // Update all browser windows after a short delay
          setTimeout(async () => {
            const allWindows = await fin.System.getAllWindows();
            for (const windowInfo of allWindows) {
              const mainWindow = windowInfo.mainWindow;
              if (mainWindow.name && shouldManageWindow(mainWindow.name)) {
                await updateWindowTitle({
                  uuid: fin.me.identity.uuid,
                  name: mainWindow.name
                });
              }
            }
          }, 100);
        }

        return result;
      };

      console.log('[WindowTitleManager] Installed page change interceptor');
    } catch (interceptError) {
      console.warn('[WindowTitleManager] Could not install page change interceptor:', interceptError);
    }

    // Set initial titles for all existing windows
    const allWindows = await fin.System.getAllWindows();

    for (const windowInfo of allWindows) {
      try {
        const mainWindow = windowInfo.mainWindow;

        // Only manage user browser windows
        if (mainWindow.name && shouldManageWindow(mainWindow.name)) {
          // Delay to ensure pages are loaded
          setTimeout(() => {
            updateWindowTitle({
              uuid: fin.me.identity.uuid,
              name: mainWindow.name
            });
          }, 500);
        }
      } catch (error) {
        console.debug('[WindowTitleManager] Skipping window:', error);
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
