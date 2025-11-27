/**
 * Window Title Manager
 *
 * Manages dynamic window titles in OpenFin platform to show the active view's title
 * instead of "internal-generated-window". Updates window title when views are focused.
 */

/**
 * Initialize window title management for all platform windows
 *
 * This sets up event listeners that update window titles when views are focused.
 * Call this after platform initialization.
 *
 * @param defaultTitle - Default title to use when no view is active
 */
export async function initializeWindowTitleManager(defaultTitle: string = 'Stern Platform'): Promise<void> {
  if (!window.fin) {
    console.warn('[WindowTitleManager] Not in OpenFin environment');
    return;
  }

  console.log('[WindowTitleManager] Initializing window title management');

  try {
    // Get the current platform
    const platform = fin.Platform.getCurrentSync();

    // Listen for view-focused events on all windows
    await platform.Application.addListener('view-focused', async (event: any) => {
      try {
        const { viewIdentity, previousViewIdentity } = event;

        console.log('[WindowTitleManager] View focused', {
          newView: viewIdentity?.name,
          previousView: previousViewIdentity?.name
        });

        // Get the view that was focused
        const view = fin.View.wrapSync(viewIdentity);
        const viewInfo: any = await view.getInfo();

        // Get the window containing the view
        const window = await view.getCurrentWindow();

        // Determine the title to use
        let windowTitle = defaultTitle;

        // Try to get title from view's custom data
        if (viewInfo.customData?.title) {
          windowTitle = viewInfo.customData.title;
        }
        // Fall back to view name
        else if (viewInfo.title) {
          windowTitle = viewInfo.title;
        }
        // Use view name as last resort
        else if (viewIdentity.name) {
          windowTitle = viewIdentity.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        }

        // Update the window title
        await (window as any).updateOptions({ title: windowTitle });

        console.log('[WindowTitleManager] Updated window title', {
          window: window.identity.name,
          title: windowTitle
        });
      } catch (error) {
        console.error('[WindowTitleManager] Failed to update window title on view-focused:', error);
      }
    });

    // Also set initial titles for existing windows
    const allWindows = await platform.Application.getChildWindows();

    for (const windowInfo of allWindows) {
      try {
        const window = fin.Window.wrapSync(windowInfo.identity);
        const views = await window.getCurrentViews();

        if (views.length > 0) {
          // Get the first view's info
          const firstView = views[0];
          const viewInfo: any = await firstView.getInfo();

          // Determine title
          let windowTitle = defaultTitle;
          if (viewInfo.customData?.title) {
            windowTitle = viewInfo.customData.title;
          } else if (viewInfo.title) {
            windowTitle = viewInfo.title;
          } else if (viewInfo.name) {
            windowTitle = viewInfo.name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          }

          // Update window title
          await (window as any).updateOptions({ title: windowTitle });

          console.log('[WindowTitleManager] Set initial window title', {
            window: windowInfo.identity.name,
            title: windowTitle
          });
        }
      } catch (error) {
        console.error('[WindowTitleManager] Failed to set initial window title:', error);
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
