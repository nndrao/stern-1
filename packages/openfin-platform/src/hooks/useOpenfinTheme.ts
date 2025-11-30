/**
 * OpenFin Theme Hook
 * Listens to theme changes from OpenFin Dock and applies them to DOM
 *
 * SIMPLIFIED APPROACH: Direct IAB event listeners with zero dependencies
 * This follows basic React principles to avoid infinite re-render loops
 *
 * IMPORTANT: This hook ONLY listens to theme changes - it NEVER broadcasts changes.
 * Theme control is one-way: Dock → Components (never Components → Dock)
 */

import { useEffect } from 'react';
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
 * ARCHITECTURE: Uses direct fin.InterApplicationBus.subscribe() with ZERO dependencies
 * to avoid complex hook chains that cause infinite re-renders.
 *
 * NOTE: Components using this hook will ONLY listen and apply themes.
 * They will NEVER broadcast theme changes back to avoid circular updates.
 */
export function useOpenfinTheme() {
  // Listen for theme change events from dock via IAB
  // CRITICAL: Empty dependency array [] means this only runs ONCE on mount
  useEffect(() => {
    // Guard: Only subscribe in OpenFin environment
    if (typeof window === 'undefined' || !window.fin) {
      platformContext.logger.debug('Not in OpenFin, skipping theme listener', undefined, 'useOpenfinTheme');
      return;
    }

    const topic = OpenFinCustomEvents.THEME_CHANGE;

    platformContext.logger.info('[useOpenfinTheme] Setting up direct IAB theme listener', {
      topic,
      isOpenFin: true
    }, 'useOpenfinTheme');

    // Direct IAB subscription - no hook chain, no dependencies
    const listener = (message: any, identity: any) => {
      platformContext.logger.info(`[useOpenfinTheme] ✅ Received theme change event: ${message.theme}`, undefined, 'useOpenfinTheme');

      // PERFORMANCE OPTIMIZATION (following agv3 pattern):
      // Apply theme changes immediately via direct DOM manipulation
      const root = document.documentElement;

      // Update Tailwind classes
      root.classList.remove('light', 'dark');
      root.classList.add(message.theme);

      // Update AG Grid theme mode
      if (document.body) {
        document.body.dataset.agThemeMode = message.theme;
      }

      platformContext.logger.info(`[useOpenfinTheme] ✅ Applied DOM theme changes immediately (${message.theme})`, undefined, 'useOpenfinTheme');
    };

    // Subscribe to IAB
    fin.InterApplicationBus.subscribe({ uuid: '*' }, topic, listener);

    platformContext.logger.info('[useOpenfinTheme] ✅ Direct IAB subscription complete', { topic }, 'useOpenfinTheme');

    // Cleanup on unmount
    return () => {
      platformContext.logger.info('[useOpenfinTheme] Unsubscribing from IAB', { topic }, 'useOpenfinTheme');
      fin.InterApplicationBus.unsubscribe({ uuid: '*' }, topic, listener);
    };
  }, []); // EMPTY DEPENDENCIES - only subscribe once on mount, unsubscribe on unmount

  // Get initial platform theme on mount (sync DOM with OpenFin)
  // CRITICAL: Empty dependency array [] means this only runs ONCE on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !window.fin) {
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
  }, []); // EMPTY DEPENDENCIES - only sync initial theme once on mount
}
