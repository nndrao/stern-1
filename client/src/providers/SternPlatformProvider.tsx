/**
 * SternPlatformProvider - Refactored (Phase 3 Architecture Refinement)
 *
 * Composition-based platform provider that wraps focused sub-providers.
 * Provides unified access to all platform services while maintaining
 * backward compatibility with the original API.
 *
 * ARCHITECTURE IMPROVEMENTS:
 * - Composed from focused providers (AppDataProvider, ApiConfigProvider)
 * - Uses OpenFinBridge abstraction layer
 * - Better separation of concerns
 * - Easier to test and maintain
 * - Fully backward compatible
 *
 * Usage remains unchanged:
 * ```tsx
 * function MyComponent() {
 *   const platform = useSternPlatform();
 *   const token = platform.appData.get('AppData.Tokens.rest-token');
 *   platform.subscribeToEvent(OpenFinCustomEvents.THEME_CHANGE, handler);
 * }
 * ```
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { AppDataProvider, useAppData } from './AppDataProvider';
import { ApiConfigProvider, useApiConfig } from './ApiConfigProvider';
import { openFinBridge } from '@/services/openfin/OpenFinBridge';
import { OpenFinEventMap } from '@stern/openfin-platform';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SternPlatformContextValue {
  // AppData
  appData: {
    variables: Record<string, any>;
    get: (key: string) => any;
    has: (key: string) => boolean;
    isReady: boolean;
  };

  // Config Services
  configService: ReturnType<typeof useApiConfig>['configService'];
  dataProviderConfigService: ReturnType<typeof useApiConfig>['dataProviderConfigService'];

  // API Configuration
  apiBaseUrl: string;
  environment: string;

  // OpenFin
  isOpenFin: boolean;
  subscribeToEvent: <K extends keyof OpenFinEventMap>(
    topic: K,
    handler: (data: OpenFinEventMap[K]) => void
  ) => () => void;
  broadcastEvent: <K extends keyof OpenFinEventMap>(
    topic: K,
    data: OpenFinEventMap[K]
  ) => Promise<void>;

  // Platform State
  isReady: boolean;
  error: Error | null;
}

const SternPlatformContext = createContext<SternPlatformContextValue | null>(null);

// ============================================================================
// Inner Provider (has access to composed providers)
// ============================================================================

interface SternPlatformInnerProps {
  children: ReactNode;
}

const SternPlatformInner: React.FC<SternPlatformInnerProps> = ({ children }) => {
  // Access composed providers
  const appData = useAppData();
  const apiConfig = useApiConfig();

  // Compute overall ready state
  const isReady = appData.isReady && apiConfig.isReady;
  const error = appData.error || apiConfig.error;

  // OpenFin event subscription (uses abstraction layer)
  const subscribeToEvent = <K extends keyof OpenFinEventMap>(
    topic: K,
    handler: (data: OpenFinEventMap[K]) => void
  ): (() => void) => {
    let cleanup: (() => void) | null = null;

    // Subscribe asynchronously
    openFinBridge.subscribe(topic, handler).then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    // Return synchronous cleanup that calls async cleanup when available
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  };

  // OpenFin event broadcast (uses abstraction layer)
  const broadcastEvent = async <K extends keyof OpenFinEventMap>(
    topic: K,
    data: OpenFinEventMap[K]
  ): Promise<void> => {
    await openFinBridge.publish(topic, data);
  };

  // Context value - memoized
  const contextValue: SternPlatformContextValue = useMemo(() => ({
    // AppData from AppDataProvider
    appData: {
      get variables() {
        return appData.variables;
      },
      get: appData.get,
      has: appData.has,
      isReady: appData.isReady,
    },

    // API Config from ApiConfigProvider
    configService: apiConfig.configService,
    dataProviderConfigService: apiConfig.dataProviderConfigService,
    apiBaseUrl: apiConfig.apiBaseUrl,
    environment: apiConfig.environment,
    isOpenFin: apiConfig.isOpenFin,

    // OpenFin methods (using abstraction)
    subscribeToEvent,
    broadcastEvent,

    // Platform state
    isReady,
    error,
  }), [
    appData.variables,
    appData.get,
    appData.has,
    appData.isReady,
    apiConfig.configService,
    apiConfig.dataProviderConfigService,
    apiConfig.apiBaseUrl,
    apiConfig.environment,
    apiConfig.isOpenFin,
    isReady,
    error,
  ]);

  // Show loading state while initializing
  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Initializing STERN Platform...</p>
        </div>
      </div>
    );
  }

  return (
    <SternPlatformContext.Provider value={contextValue}>
      {children}
    </SternPlatformContext.Provider>
  );
};

// ============================================================================
// Outer Provider (composes focused providers)
// ============================================================================

export interface SternPlatformProviderProps {
  children: ReactNode;
}

export const SternPlatformProvider: React.FC<SternPlatformProviderProps> = ({ children }) => {
  return (
    <ApiConfigProvider>
      <AppDataProvider>
        <SternPlatformInner>
          {children}
        </SternPlatformInner>
      </AppDataProvider>
    </ApiConfigProvider>
  );
};

// ============================================================================
// Hook: useSternPlatform
// ============================================================================

/**
 * Hook to access Stern Platform context
 * Provides unified access to all platform services
 */
export const useSternPlatform = (): SternPlatformContextValue => {
  const context = useContext(SternPlatformContext);

  if (!context) {
    throw new Error('useSternPlatform must be used within SternPlatformProvider');
  }

  return context;
};
