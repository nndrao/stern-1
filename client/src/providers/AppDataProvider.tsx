/**
 * AppDataProvider
 *
 * Focused provider for AppData variable management.
 * Extracted from SternPlatformProvider for better separation of concerns.
 *
 * Responsibilities:
 * - Load AppData providers from backend
 * - Subscribe to AppData updates via OpenFin IAB
 * - Provide access to AppData variables
 * - Automatic cleanup on unmount
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const appData = useAppData();
 *   const token = appData.get('AppData.Tokens.rest-token');
 * }
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { appDataService } from '@/services/appDataService';
import { openFinBridge } from '@/services/openfin/OpenFinBridge';
import { OpenFinCustomEvents } from '@stern/openfin-platform';
import { logger } from '@/utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AppDataContextValue {
  /** All AppData variables (access via ref - no re-renders) */
  variables: Record<string, any>;
  /** Get a variable by key */
  get: (key: string) => any;
  /** Check if a variable exists */
  has: (key: string) => boolean;
  /** Whether AppData is loaded and ready */
  isReady: boolean;
  /** Any error that occurred during loading */
  error: Error | null;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface AppDataProviderProps {
  /** User ID for loading user-specific AppData */
  userId?: string;
  /** Whether to load AppData (default: true in OpenFin, false in browser) */
  enabled?: boolean;
  /** Child components */
  children: ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({
  userId = 'default-user',
  enabled,
  children
}) => {
  // Use ref for variables to prevent re-renders when they change
  const variablesRef = useRef<Record<string, any>>({});
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Determine if we should load AppData
  const shouldLoad = enabled ?? openFinBridge.isAvailable;

  // Initialize AppData on mount
  useEffect(() => {
    if (!shouldLoad) {
      logger.info('AppData loading disabled or browser mode', undefined, 'AppDataProvider');
      setIsReady(true);
      return;
    }

    const loadAppData = async () => {
      try {
        logger.info('Loading AppData providers...', { userId }, 'AppDataProvider');

        await appDataService.loadAllProviders(userId);

        const allVars = appDataService.getAllVariables();
        variablesRef.current = allVars;

        logger.info('AppData loaded successfully', {
          variableCount: Object.keys(allVars).length,
          variables: Object.keys(allVars)
        }, 'AppDataProvider');

        setIsReady(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load AppData');
        logger.error('AppData loading failed', error, 'AppDataProvider');
        setError(error);
        setIsReady(true); // Mark as ready to allow app to continue
      }
    };

    loadAppData();
  }, [shouldLoad, userId]);

  // Subscribe to AppData updates via OpenFin IAB
  useEffect(() => {
    if (!shouldLoad) return;

    let cleanup: (() => void) | null = null;

    const subscribeToUpdates = async () => {
      try {
        logger.debug('Subscribing to AppData updates...', undefined, 'AppDataProvider');

        const unsubscribe = await openFinBridge.subscribe(
          OpenFinCustomEvents.APPDATA_UPDATED,
          (data: any) => {
            logger.info('AppData update received', {
              providerId: data.providerId,
              providerName: data.providerName,
              updatedKeys: data.updatedKeys
            }, 'AppDataProvider');

            // Merge updated variables into ref (no re-render)
            for (const key of data.updatedKeys) {
              const fullKey = `AppData.${data.providerName}.${key}`;
              variablesRef.current[fullKey] = data.variables[key];
            }
          }
        );

        cleanup = unsubscribe;
        logger.debug('Subscribed to AppData updates', undefined, 'AppDataProvider');
      } catch (error) {
        logger.error('Failed to subscribe to AppData updates', error, 'AppDataProvider');
      }
    };

    subscribeToUpdates();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [shouldLoad]);

  // Get variable by key (stable reference)
  const get = useCallback((key: string): any => {
    return variablesRef.current[key];
  }, []);

  // Check if variable exists (stable reference)
  const has = useCallback((key: string): boolean => {
    return key in variablesRef.current;
  }, []);

  // Context value - memoized
  const contextValue: AppDataContextValue = useMemo(() => ({
    get variables() {
      // Return ref value on access - no re-renders
      return variablesRef.current;
    },
    get,
    has,
    isReady,
    error,
  }), [get, has, isReady, error]);

  return (
    <AppDataContext.Provider value={contextValue}>
      {children}
    </AppDataContext.Provider>
  );
};

// ============================================================================
// Hook: useAppData
// ============================================================================

/**
 * Hook to access AppData context
 * Provides access to AppData variables and loading state
 */
export const useAppData = (): AppDataContextValue => {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }

  return context;
};
