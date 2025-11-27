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

        // Find the page that:
        // 1. Has this window in its layout
        // 2. Has isActive = true (this is the currently selected page/tab in the browser window)
        for (const page of allPages) {
          const pageData = page as any;

          // Check if this page's layout contains our window
          if (page.layout) {
            const layoutStr = JSON.stringify(page.layout);
            const hasThisWindow = layoutStr.includes(windowName);

            if (hasThisWindow && pageData.isActive === true) {
              // This is the active page for this window
              const title = page.title || page.pageId || defaultTitle;
              console.log('[WindowTitleManager] Found active page for window', {
                window: windowName,
                pageTitle: title,
                pageId: page.pageId,
                isActive: pageData.isActive
              });
              return title;
            }
          }
        }

        // Fallback: find any page that has this window and return its title
        for (const page of allPages) {
          if (page.layout && page.title) {
            const layoutStr = JSON.stringify(page.layout);
            if (layoutStr.includes(windowName)) {
              console.log('[WindowTitleManager] Using fallback page title', {
                window: windowName,
                pageTitle: page.title
              });
              return page.title;
            }
          }
        }

        console.log('[WindowTitleManager] No page found for window, using default', {
          window: windowName,
          defaultTitle
        });
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

    // Listen for page changes using workspace platform events
    // This catches when user switches between page tabs
    try {
      const BrowserModule = (workspacePlatform as any).Browser;
      if (BrowserModule && typeof BrowserModule.addListener === 'function') {
        await BrowserModule.addListener('page-changed', async (event: any) => {
          try {
            console.log('[WindowTitleManager] Page changed', {
              window: event.windowIdentity?.name,
              pageId: event.pageId
            });

            if (event.windowIdentity?.name) {
              await updateWindowTitle(event.windowIdentity.name);
            }
          } catch (error) {
            console.error('[WindowTitleManager] Failed to handle page-changed:', error);
          }
        });

        console.log('[WindowTitleManager] Registered page-changed listener');
      }
    } catch (pageEventError) {
      console.debug('[WindowTitleManager] Page events not available, using window focus as fallback');
    }

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
