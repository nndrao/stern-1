/**
 * Lightweight OpenFin Event Wrapper Hook
 *
 * This hook provides a simple, unified interface for:
 * 1. Subscribing to IAB custom events
 * 2. Broadcasting IAB custom events
 * 3. Accessing OpenFin platform/workspace utilities
 *
 * This is the foundational hook that all OpenFin-aware React components should use.
 * It handles event subscriptions, cleanup, and provides type-safe access to OpenFin functionality.
 *
 * @example
 * ```typescript
 * const { on, broadcast, platform } = useOpenFinEvents();
 *
 * // Listen to theme changes
 * useEffect(() => {
 *   return on(OpenFinCustomEvents.THEME_CHANGE, (data) => {
 *     setTheme(data.theme);
 *   });
 * }, [on]);
 *
 * // Broadcast a config update
 * broadcast(OpenFinCustomEvents.CONFIG_UPDATED, {
 *   configId: 'config-123',
 *   componentType: 'blotter',
 *   timestamp: Date.now()
 * });
 *
 * // Use platform utilities
 * platform.createWindow({ url: '/blotter', name: 'blotter-1' });
 * ```
 */

import { useCallback, useMemo } from 'react';
import { useOpenFinWorkspace } from './useOpenfinWorkspace';
import {
  OpenFinCustomEvents,
  OpenFinEventMap,
  OpenFinEventHandler,
  UnsubscribeFunction
} from '../types/openfinEvents';
import { platformContext } from '../core/PlatformContext';

/**
 * OpenFin platform utilities interface
 * Provides clean access to OpenFin platform/workspace functions
 */
export interface OpenFinPlatformUtilities {
  /** Check if running in OpenFin environment */
  isOpenFin: boolean;

  /** Create a new OpenFin window */
  createWindow: (options: any) => Promise<any>;

  /** Create a new OpenFin view */
  createView: (options: any) => Promise<any>;

  /** Get current window */
  getCurrentWindow: () => any;

  /** Close current view/window */
  closeCurrentView: () => Promise<void>;

  /** Maximize current view/window */
  maximizeCurrentView: () => Promise<void>;

  /** Minimize current view/window */
  minimizeCurrentView: () => Promise<void>;

  /** Rename current view */
  renameCurrentView: (name: string) => Promise<void>;

  /** Get current view info */
  getCurrentViewInfo: () => Promise<any>;
}

/**
 * OpenFin events hook return type
 */
export interface UseOpenFinEventsReturn {
  /**
   * Subscribe to an IAB custom event (type-safe)
   *
   * @param event - Event topic from OpenFinCustomEvents enum
   * @param handler - Event handler function
   * @returns Unsubscribe function (call to cleanup)
   *
   * @example
   * ```typescript
   * useEffect(() => {
   *   return on(OpenFinCustomEvents.THEME_CHANGE, (data) => {
   *     console.log('Theme changed to:', data.theme);
   *   });
   * }, [on]);
   * ```
   */
  on: <E extends keyof OpenFinEventMap>(
    event: E,
    handler: OpenFinEventHandler<E>
  ) => UnsubscribeFunction;

  /**
   * Broadcast an IAB custom event to all windows/views (type-safe)
   *
   * @param event - Event topic from OpenFinCustomEvents enum
   * @param data - Event payload (typed based on event)
   *
   * @example
   * ```typescript
   * broadcast(OpenFinCustomEvents.CONFIG_UPDATED, {
   *   configId: 'config-123',
   *   componentType: 'blotter',
   *   timestamp: Date.now()
   * });
   * ```
   */
  broadcast: <E extends keyof OpenFinEventMap>(
    event: E,
    data: OpenFinEventMap[E]
  ) => Promise<void>;

  /**
   * OpenFin platform utilities
   * Direct access to common OpenFin platform/workspace functions
   */
  platform: OpenFinPlatformUtilities;
}

/**
 * Lightweight OpenFin Event Wrapper Hook
 *
 * Provides a simple, type-safe interface for OpenFin IAB events and platform utilities.
 * This hook should be used by all React components that need to interact with OpenFin.
 *
 * @returns OpenFin event system and platform utilities
 */
export function useOpenFinEvents(): UseOpenFinEventsReturn {
  const workspace = useOpenFinWorkspace();

  /**
   * Subscribe to IAB custom event (type-safe)
   */
  const on = useCallback(<E extends keyof OpenFinEventMap>(
    event: E,
    handler: OpenFinEventHandler<E>
  ): UnsubscribeFunction => {
    // If not in OpenFin, return no-op unsubscribe
    if (!workspace.isOpenFin) {
      platformContext.logger.info(
        `[useOpenFinEvents] Not in OpenFin environment, skipping event subscription`,
        { event, isOpenFin: workspace.isOpenFin },
        'useOpenFinEvents'
      );
      return () => {};
    }

    platformContext.logger.info(`[useOpenFinEvents] Subscribing to IAB event: ${event}`, undefined, 'useOpenFinEvents');

    try {
      // Subscribe via workspace service (which handles IAB internally)
      const unsubscribe = workspace.subscribeToMessages(event as string, handler as any);

      platformContext.logger.info(`[useOpenFinEvents] Successfully subscribed to: ${event}`, undefined, 'useOpenFinEvents');

      return () => {
        unsubscribe();
        platformContext.logger.info(`[useOpenFinEvents] Unsubscribed from: ${event}`, undefined, 'useOpenFinEvents');
      };
    } catch (error) {
      platformContext.logger.error(`[useOpenFinEvents] Failed to subscribe to ${event}`, error, 'useOpenFinEvents');
      return () => {};
    }
  }, [workspace]);

  /**
   * Broadcast IAB event (type-safe)
   */
  const broadcast = useCallback(<E extends keyof OpenFinEventMap>(
    event: E,
    data: OpenFinEventMap[E]
  ): Promise<void> => {
    // If not in OpenFin, log and return immediately
    if (!workspace.isOpenFin) {
      platformContext.logger.debug(
        `Not in OpenFin environment, skipping event broadcast`,
        { event, data },
        'useOpenFinEvents'
      );
      return Promise.resolve();
    }

    platformContext.logger.info(`Broadcasting IAB event: ${event}`, data, 'useOpenFinEvents');

    try {
      // Broadcast via workspace service (which handles IAB internally)
      return workspace.broadcastToAllViews(data, event as string);
    } catch (error) {
      platformContext.logger.error(`Failed to broadcast ${event}`, error, 'useOpenFinEvents');
      return Promise.resolve();
    }
  }, [workspace]);

  /**
   * OpenFin platform utilities - MEMOIZED to prevent re-renders
   * Provides clean access to common OpenFin platform/workspace functions
   */
  const platform: OpenFinPlatformUtilities = useMemo(() => ({
    isOpenFin: workspace.isOpenFin,
    createWindow: workspace.createWindow,
    createView: workspace.createView,
    getCurrentWindow: workspace.getCurrentWindow,
    closeCurrentView: workspace.closeCurrentView,
    maximizeCurrentView: workspace.maximizeCurrentView,
    minimizeCurrentView: workspace.minimizeCurrentView,
    renameCurrentView: workspace.renameCurrentView,
    getCurrentViewInfo: workspace.getCurrentViewInfo,
  }), [
    workspace.isOpenFin,
    workspace.createWindow,
    workspace.createView,
    workspace.getCurrentWindow,
    workspace.closeCurrentView,
    workspace.maximizeCurrentView,
    workspace.minimizeCurrentView,
    workspace.renameCurrentView,
    workspace.getCurrentViewInfo,
  ]);

  // CRITICAL: Return object MUST be memoized to prevent infinite re-renders
  return useMemo(() => ({
    on,
    broadcast,
    platform,
  }), [on, broadcast, platform]);
}
