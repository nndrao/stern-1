/**
 * API Versioning Strategy
 *
 * Provides consistent versioning for API requests with graceful fallback.
 * Supports multiple API versions and automatic version negotiation.
 *
 * Features:
 * - Centralized version configuration
 * - Version header injection
 * - Backward compatibility handling
 * - Version deprecation warnings
 */

import { logger } from '@/utils/logger';

// ============================================================================
// Version Configuration
// ============================================================================

export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2',
  LATEST: 'v2', // Points to latest version
} as const;

export type ApiVersion = typeof API_VERSIONS[keyof typeof API_VERSIONS];

export const DEFAULT_API_VERSION: ApiVersion = API_VERSIONS.V1;

// Deprecated versions that should show warnings
const DEPRECATED_VERSIONS: Set<ApiVersion> = new Set([]);

// ============================================================================
// Version Header Utilities
// ============================================================================

/**
 * Get the version prefix for API URLs
 * @param version - API version (defaults to V1)
 * @returns Version prefix (e.g., "/api/v1")
 */
export function getVersionPrefix(version: ApiVersion = DEFAULT_API_VERSION): string {
  return `/api/${version}`;
}

/**
 * Add version headers to request options
 * @param headers - Existing headers
 * @param version - API version
 * @returns Updated headers with version information
 */
export function addVersionHeaders(
  headers: Record<string, string> = {},
  version: ApiVersion = DEFAULT_API_VERSION
): Record<string, string> {
  // Check for deprecated version
  if (DEPRECATED_VERSIONS.has(version)) {
    logger.warn(
      `API version ${version} is deprecated. Please update to ${API_VERSIONS.LATEST}`,
      { version, latest: API_VERSIONS.LATEST },
      'apiVersion'
    );
  }

  return {
    ...headers,
    'X-API-Version': version,
    'Accept': `application/json;version=${version}`,
  };
}

/**
 * Build a versioned API URL
 * @param baseUrl - Base URL (e.g., "http://localhost:3001")
 * @param endpoint - Endpoint path (e.g., "/configs")
 * @param version - API version
 * @returns Full versioned URL
 */
export function buildVersionedUrl(
  baseUrl: string,
  endpoint: string,
  version: ApiVersion = DEFAULT_API_VERSION
): string {
  // Remove trailing slash from baseUrl
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');

  // Remove leading slash from endpoint if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

  // Build full URL with version prefix
  return `${cleanBaseUrl}${getVersionPrefix(version)}/${cleanEndpoint}`;
}

/**
 * Parse version from response headers
 * @param headers - Response headers
 * @returns Detected API version or null
 */
export function parseVersionFromHeaders(headers: Headers | Record<string, string>): ApiVersion | null {
  if (headers instanceof Headers) {
    return (headers.get('X-API-Version') as ApiVersion) || null;
  }
  return (headers['x-api-version'] as ApiVersion) || null;
}

/**
 * Check if a version is supported
 * @param version - Version to check
 * @returns Whether the version is supported
 */
export function isSupportedVersion(version: string): version is ApiVersion {
  return Object.values(API_VERSIONS).includes(version as ApiVersion);
}

// ============================================================================
// Version Migration Helpers
// ============================================================================

/**
 * Get migration path between versions
 * @param from - Source version
 * @param to - Target version
 * @returns Array of version steps for migration
 */
export function getVersionMigrationPath(from: ApiVersion, to: ApiVersion): ApiVersion[] {
  const versions = Object.values(API_VERSIONS);
  const fromIndex = versions.indexOf(from);
  const toIndex = versions.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) {
    logger.error('Invalid version in migration path', { from, to }, 'apiVersion');
    return [];
  }

  if (fromIndex < toIndex) {
    // Forward migration
    return versions.slice(fromIndex, toIndex + 1);
  } else {
    // Backward migration (rare)
    return versions.slice(toIndex, fromIndex + 1).reverse();
  }
}

/**
 * Get the latest available version
 * @returns Latest API version
 */
export function getLatestVersion(): ApiVersion {
  return API_VERSIONS.LATEST;
}
