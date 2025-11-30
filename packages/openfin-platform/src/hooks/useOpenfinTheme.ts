/**
 * OpenFin Theme Hook
 * Listens to theme changes from OpenFin Dock and applies them to DOM
 *
 * IMPORTANT: This hook ONLY listens to theme changes - it NEVER broadcasts changes.
 * Theme control is one-way: Dock → Components (never Components → Dock)
 *
 * This is a specialized hook built on top of useOpenFinEvents for theme management.
 */

import { useEffect } from 'react';
import { useOpenFinEvents } from './useOpenFinEvents';
import { OpenFinCustomEvents } from '../types/openfinEvents';
import { platformContext } from '../core/PlatformContext';

/**
 * Hook to receive theme changes from OpenFin Dock
 *
 * This hook:
 * 1. Listens to theme change messages via IAB (when user changes theme from dock)
 * 2. Updates the DOM to match the dock's theme
 * 3. Syncs initial theme from OpenFin platform on mount
 *
 * NOTE: Components using this hook will ONLY listen and apply themes.
 * They will NEVER broadcast theme changes back to avoid circular updates.
 */
export function useOpenfinTheme() {
  platformContext.logger.info('[useOpenfinTheme] Hook called', undefined, 'useOpenfinTheme');

  const { on, platform } = useOpenFinEvents();
  platformContext.logger.info('[useOpenfinTheme] useOpenFinEvents() returned', {
    isOpenFin: platform.isOpenFin,
    hasOn: typeof on === 'function',
    hasPlatform: !!platform
  }, 'useOpenfinTheme');

  // Listen for theme change events from dock via IAB
  useEffect(() => {
    platformContext.logger.info('[useOpenfinTheme] Setting up theme change listener', {
      event: OpenFinCustomEvents.THEME_CHANGE,
      isOpenFin: platform.isOpenFin
    }, 'useOpenfinTheme');

    // Subscribe to theme change events using the lightweight event wrapper
    const unsubscribe = on(OpenFinCustomEvents.THEME_CHANGE, (data) => {
      platformContext.logger.info(`[useOpenfinTheme] ✅ Received theme change event: ${data.theme}`, undefined, 'useOpenfinTheme');

      // PERFORMANCE OPTIMIZATION (following agv3 pattern):
      // Apply theme changes immediately via direct DOM manipulation
      const root = document.documentElement;

      // Update Tailwind classes
      root.classList.remove('light', 'dark');
      root.classList.add(data.theme);

      // Update AG Grid theme mode
      if (document.body) {
        document.body.dataset.agThemeMode = data.theme;
      }

      platformContext.logger.info(`[useOpenfinTheme] ✅ Applied DOM theme changes immediately (${data.theme})`, undefined, 'useOpenfinTheme');
    });

    platformContext.logger.info('[useOpenfinTheme] Theme listener setup complete, unsubscribe function created', undefined, 'useOpenfinTheme');

    return unsubscribe;
  }, [on, platform]);

  // Get initial platform theme on mount (sync DOM with OpenFin)
  useEffect(() => {
    if (!platform.isOpenFin) {
      platformContext.logger.debug('Not in OpenFin, skipping initial theme sync', undefined, 'useOpenfinTheme');
      return;
    }

    const syncInitialTheme = async () => {
      try {
        const { getCurrentSync } = await import('@openfin/workspace-platform');
        const platformInstance = getCurrentSync();
        const currentScheme = await platformInstance.Theme.getSelectedScheme();

        if (currentScheme && (currentScheme === 'light' || currentScheme === 'dark')) {
          platformContext.logger.info(`Initial platform theme: ${currentScheme}`, undefined, 'useOpenfinTheme');

          // Apply to DOM
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          root.classList.add(currentScheme);

          if (document.body) {
            document.body.dataset.agThemeMode = currentScheme;
          }

          platformContext.logger.info(`Synced DOM theme to platform: ${currentScheme}`, undefined, 'useOpenfinTheme');
        }
      } catch (error) {
        platformContext.logger.warn('Could not get initial platform theme, using default', error, 'useOpenfinTheme');
      }
    };

    syncInitialTheme();
  }, [platform]);
}
