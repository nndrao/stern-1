/**
 * ApiConfigProvider
 *
 * Focused provider for API configuration management.
 * Extracted from SternPlatformProvider for better separation of concerns.
 *
 * Responsibilities:
 * - Determine API base URL (from OpenFin or environment)
 * - Provide environment detection
 * - Expose configuration services
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const api = useApiConfig();
 *   const config = await api.configService.getById(id);
 * }
 * ```
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { configService } from '@/services/api/configurationService';
import { dataProviderConfigService } from '@/services/api/dataProviderConfigService';
import { getApiUrl } from '@/openfin/utils/platformContext';
import { openFinBridge } from '@/services/openfin/OpenFinBridge';
import { logger } from '@/utils/logger';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ApiConfigContextValue {
  /** API base URL */
  apiBaseUrl: string;
  /** Current environment */
  environment: 'openfin' | 'browser';
  /** Whether running in OpenFin */
  isOpenFin: boolean;
  /** Configuration service instance */
  configService: typeof configService;
  /** Data provider config service instance */
  dataProviderConfigService: typeof dataProviderConfigService;
  /** Whether the API config is loaded and ready */
  isReady: boolean;
  /** Any error that occurred during loading */
  error: Error | null;
}

const ApiConfigContext = createContext<ApiConfigContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

export interface ApiConfigProviderProps {
  /** Default API URL if not in OpenFin */
  defaultApiUrl?: string;
  /** Child components */
  children: ReactNode;
}

export const ApiConfigProvider: React.FC<ApiConfigProviderProps> = ({
  defaultApiUrl = 'http://localhost:3001',
  children
}) => {
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiUrl);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isOpenFin = openFinBridge.isAvailable;
  const environment = isOpenFin ? 'openfin' : 'browser';

  // Initialize API configuration on mount
  useEffect(() => {
    const initializeApi = async () => {
      try {
        logger.info('Initializing API configuration...', { environment }, 'ApiConfigProvider');

        // Get API base URL
        const baseUrl = await getApiUrl();
        setApiBaseUrl(baseUrl);

        logger.info('API configuration initialized', { baseUrl }, 'ApiConfigProvider');
        setIsReady(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize API config');
        logger.error('API configuration initialization failed', error, 'ApiConfigProvider');
        setError(error);
        setIsReady(true); // Mark as ready to allow app to continue
      }
    };

    initializeApi();
  }, [environment]);

  // Context value - memoized
  const contextValue: ApiConfigContextValue = useMemo(() => ({
    apiBaseUrl,
    environment,
    isOpenFin,
    configService,
    dataProviderConfigService,
    isReady,
    error,
  }), [apiBaseUrl, environment, isOpenFin, isReady, error]);

  return (
    <ApiConfigContext.Provider value={contextValue}>
      {children}
    </ApiConfigContext.Provider>
  );
};

// ============================================================================
// Hook: useApiConfig
// ============================================================================

/**
 * Hook to access API configuration context
 * Provides access to API URL, services, and environment info
 */
export const useApiConfig = (): ApiConfigContextValue => {
  const context = useContext(ApiConfigContext);

  if (!context) {
    throw new Error('useApiConfig must be used within ApiConfigProvider');
  }

  return context;
};
