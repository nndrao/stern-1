/**
 * Providers Index
 *
 * Centralized exports for all providers (platform and data).
 * Part of Phase 3 Architecture Refinement.
 */

// Platform Providers (Phase 3 Architecture Refinement)
export { SternPlatformProvider, useSternPlatform } from './SternPlatformProvider';
export type { SternPlatformContextValue, SternPlatformProviderProps } from './SternPlatformProvider';

export { AppDataProvider, useAppData } from './AppDataProvider';
export type { AppDataContextValue, AppDataProviderProps } from './AppDataProvider';

export { ApiConfigProvider, useApiConfig } from './ApiConfigProvider';
export type { ApiConfigContextValue, ApiConfigProviderProps } from './ApiConfigProvider';

// Data Providers
export * from './stomp';
