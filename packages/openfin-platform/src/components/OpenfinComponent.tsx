/**
 * OpenFin Component Wrapper
 *
 * Higher-order component (HOC) and hooks for creating OpenFin-aware React components
 * Handles:
 * - Window/View identity management
 * - IAB communication setup
 * - Configuration loading
 * - Lifecycle management
 * - Error boundaries
 */

import React, { useEffect, useState, useCallback, createContext, useContext } from 'react';
import { useOpenFinWorkspace } from '../hooks/useOpenfinWorkspace';
import { iabService } from '../services/OpenfinIABService';
import { useOpenfinTheme } from '../hooks/useOpenfinTheme';
import { platformContext } from '../core/PlatformContext';

// Generic config type - can be replaced with specific type when using the library
export type ComponentConfig = Record<string, any>;

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface OpenFinComponentIdentity {
  windowName: string;
  viewName?: string;
  uuid: string;
  configId?: string;
  componentType?: string;
  componentSubType?: string;
}

export interface OpenFinComponentContext {
  identity: OpenFinComponentIdentity;
  config: ComponentConfig | null;
  isOpenFin: boolean;
  isLoading: boolean;
  error: Error | null;

  // Configuration methods
  reloadConfig: () => Promise<void>;
  updateConfig: (updates: Partial<ComponentConfig>) => Promise<void>;

  // IAB communication
  broadcast: (topic: string, payload: any) => Promise<void>;
  subscribe: (topic: string, handler: (message: any) => void) => () => void;

  // Window/View operations
  closeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  setTitle: (title: string) => Promise<void>;
}

const OpenFinComponentContext = createContext<OpenFinComponentContext | null>(null);

// ============================================================================
// OpenFinComponent Provider
// ============================================================================

export interface OpenFinComponentProviderProps {
  children: React.ReactNode;

  // Configuration
  configId?: string;           // Pass directly or via URL param
  autoLoadConfig?: boolean;    // Auto-load config on mount (default: true)

  // IAB Setup
  autoSetupIAB?: boolean;      // Auto-setup IAB service (default: true)

  // Lifecycle callbacks
  onConfigLoaded?: (config: ComponentConfig) => void;
  onConfigError?: (error: Error) => void;
  onReady?: (identity: OpenFinComponentIdentity) => void;
}

export const OpenFinComponentProvider: React.FC<OpenFinComponentProviderProps> = ({
  children,
  configId: configIdProp,
  autoLoadConfig = true,
  autoSetupIAB = true,
  onConfigLoaded,
  onConfigError,
  onReady,
}) => {
  const workspace = useOpenFinWorkspace();

  // Sync OpenFin platform theme with React theme provider
  useOpenfinTheme();

  // State
  const [identity, setIdentity] = useState<OpenFinComponentIdentity | null>(null);
  const [config, setConfig] = useState<ComponentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Get configId from props (library users should handle URL params themselves)
  const configId = configIdProp;

  // Initialize component identity
  useEffect(() => {
    const initializeIdentity = async () => {
      try {
        let componentIdentity: OpenFinComponentIdentity;

        if (workspace.isOpenFin) {
          // Get OpenFin identity
          const window = workspace.getCurrentWindow();
          const viewInfo = await workspace.getCurrentViewInfo();

          if (!window) {
            throw new Error('Unable to get OpenFin window or view context');
          }

          // @ts-ignore - identity may not exist on all OpenFin window types
          const windowName = window.identity?.name || 'unknown-window';
          const viewName = viewInfo?.name;
          // @ts-ignore
          const uuid = window.identity?.uuid || 'unknown-uuid';

          // Try to get component info from window or view options
          let customData: any = {};
          try {
            // @ts-ignore - getOptions may not exist on all window types
            const windowInfo = await window.getOptions?.();
            customData = windowInfo?.customData || {};
          } catch (error) {
            platformContext.logger.warn('Unable to get custom data from OpenFin options', error, 'OpenFinComponent');
          }

          componentIdentity = {
            windowName,
            viewName,
            uuid,
            configId: configId || customData.configId,
            componentType: customData.componentType,
            componentSubType: customData.componentSubType,
          };

          platformContext.logger.info('OpenFin component identity initialized', componentIdentity, 'OpenFinComponent');
        } else {
          // Mock identity for browser
          componentIdentity = {
            windowName: `browser-window-${Date.now()}`,
            uuid: 'browser',
            configId,
          };

          platformContext.logger.info('Browser component identity initialized', componentIdentity, 'OpenFinComponent');
        }

        setIdentity(componentIdentity);

        // Setup IAB if enabled and configId is available
        if (autoSetupIAB && componentIdentity.configId) {
          // @ts-ignore - setConfigId may not exist on all IABService versions
          iabService.setConfigId?.(componentIdentity.configId);
          platformContext.logger.info('IAB service configured', { configId: componentIdentity.configId }, 'OpenFinComponent');
        }

        // Callback
        if (onReady) {
          onReady(componentIdentity);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize identity');
        platformContext.logger.error('Identity initialization failed', error, 'OpenFinComponent');
        setError(error);
      }
    };

    initializeIdentity();
  }, [workspace, configId, autoSetupIAB, onReady]);

  // Load configuration
  useEffect(() => {
    if (!autoLoadConfig || !identity?.configId) {
      setIsLoading(false);
      return;
    }

    loadConfiguration();
  }, [identity?.configId, autoLoadConfig]);

  const loadConfiguration = async () => {
    if (!identity?.configId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      platformContext.logger.info('Loading configuration', { configId: identity.configId }, 'OpenFinComponent');

      // @ts-ignore - loadAppConfig may not exist on all ConfigService versions
      const loadedConfig = await platformContext.configService?.loadAppConfig?.(identity.configId);

      setConfig(loadedConfig);
      setIsLoading(false);

      platformContext.logger.info('Configuration loaded successfully', { configId: identity.configId }, 'OpenFinComponent');

      if (onConfigLoaded) {
        onConfigLoaded(loadedConfig);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load configuration');
      platformContext.logger.error('Configuration load failed', error, 'OpenFinComponent');

      setError(error);
      setIsLoading(false);

      if (onConfigError) {
        onConfigError(error);
      }
    }
  };

  // Reload configuration
  const reloadConfig = useCallback(async () => {
    await loadConfiguration();
  }, [identity?.configId]);

  // Update configuration
  const updateConfig = useCallback(async (updates: Partial<ComponentConfig>) => {
    if (!identity?.configId) {
      throw new Error('No configId available');
    }

    try {
      await platformContext.configService?.saveAppConfig?.(identity.configId, updates);

      // Reload to get updated config
      await loadConfiguration();

      platformContext.logger.info('Configuration updated', { configId: identity.configId }, 'OpenFinComponent');
    } catch (err) {
      platformContext.logger.error('Configuration update failed', err, 'OpenFinComponent');
      throw err;
    }
  }, [identity?.configId, loadConfiguration]);

  // IAB broadcast
  const broadcast = useCallback(async (topic: string, payload: any) => {
    await iabService.broadcast(topic, payload);
  }, []);

  // IAB subscribe
  const subscribe = useCallback((topic: string, handler: (message: any) => void) => {
    return iabService.subscribe(topic, handler);
  }, []);

  // Window operations
  const closeWindow = useCallback(async () => {
    await workspace.closeCurrentView();
  }, [workspace]);

  const maximizeWindow = useCallback(async () => {
    await workspace.maximizeCurrentView();
  }, [workspace]);

  const minimizeWindow = useCallback(async () => {
    await workspace.minimizeCurrentView();
  }, [workspace]);

  const setTitle = useCallback(async (title: string) => {
    await workspace.renameCurrentView(title);
  }, [workspace]);

  // Context value
  const contextValue: OpenFinComponentContext = {
    identity: identity!,
    config,
    isOpenFin: workspace.isOpenFin,
    isLoading,
    error,
    reloadConfig,
    updateConfig,
    broadcast,
    subscribe,
    closeWindow,
    maximizeWindow,
    minimizeWindow,
    setTitle,
  };

  // Don't render children until identity is initialized
  if (!identity) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Initializing component...</p>
        </div>
      </div>
    );
  }

  return (
    <OpenFinComponentContext.Provider value={contextValue}>
      {children}
    </OpenFinComponentContext.Provider>
  );
};

// ============================================================================
// Hook: useOpenFinComponent
// ============================================================================

/**
 * Hook to access OpenFin component context
 */
export const useOpenFinComponent = (): OpenFinComponentContext => {
  const context = useContext(OpenFinComponentContext);

  if (!context) {
    throw new Error('useOpenFinComponent must be used within OpenFinComponentProvider');
  }

  return context;
};

// ============================================================================
// Hook: useOpenFinConfig
// ============================================================================

/**
 * Hook to access configuration with loading/error states
 */
export const useOpenFinConfig = <T = any>() => {
  const { config, isLoading, error, reloadConfig, updateConfig } = useOpenFinComponent();

  return {
    config: config?.config as T | null,
    fullConfig: config,
    isLoading,
    error,
    reload: reloadConfig,
    update: updateConfig,
  };
};
