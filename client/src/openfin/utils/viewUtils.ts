/**
 * View Utilities
 *
 * Utilities for managing OpenFin view instance IDs.
 * Based on AGV3 production pattern where view IDs are passed via URL query parameters
 * and persist across workspace save/restore cycles.
 *
 * Pattern:
 * - Views created with URL: /component?id=${viewInstanceId}
 * - Component extracts ID using getViewInstanceId()
 * - ID used as key for component configuration
 * - Workspace snapshots preserve URL and customData automatically
 */

import { logger } from '@/utils/logger';

/**
 * Get the view instance ID from URL query parameters
 *
 * This is the primary method for getting the view instance ID.
 * The ID is passed as a query parameter when the view is created.
 *
 * Example: /customcomponents?id=abc-123-def-456
 *
 * @returns The view instance ID from URL, or generates a new UUID if not found
 */
export function getViewInstanceId(): string {
  if (typeof window === 'undefined') {
    logger.warn('getViewInstanceId called outside browser context', undefined, 'viewUtils');
    return generateViewId();
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
      logger.warn('No ID found in query parameters, generating default', undefined, 'viewUtils');
      return generateViewId();
    }

    logger.debug('View instance ID extracted from URL', { id }, 'viewUtils');
    return id;
  } catch (error) {
    logger.error('Failed to extract view instance ID from URL', error, 'viewUtils');
    return generateViewId();
  }
}

/**
 * Generate a new unique view instance ID
 *
 * Uses crypto.randomUUID() for generating RFC 4122 compliant UUIDs.
 * This is used when creating new views.
 *
 * @returns A new UUID string
 */
export function generateViewId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers (shouldn't be needed in OpenFin)
  logger.warn('crypto.randomUUID not available, using fallback UUID generation', undefined, 'viewUtils');
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Build a view URL with instance ID
 *
 * Constructs a URL for a view component with the viewInstanceId as a query parameter.
 * This ensures the ID is available to the component via getViewInstanceId().
 *
 * @param basePath - The base path of the component (e.g., '/customcomponents')
 * @param viewId - The view instance ID to include in the URL
 * @param baseUrl - Optional base URL (defaults to current origin)
 * @returns Complete URL with viewInstanceId parameter
 */
export function buildViewUrl(
  basePath: string,
  viewId: string,
  baseUrl?: string
): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
  const url = new URL(basePath, base);
  url.searchParams.set('id', viewId);

  logger.debug('Built view URL', { basePath, viewId, url: url.toString() }, 'viewUtils');
  return url.toString();
}

/**
 * Generate a view name from view ID
 *
 * Creates a standardized view name based on component type and instance ID.
 * Used for OpenFin view name property.
 *
 * @param componentType - Type of component (e.g., 'demo-component', 'blotter')
 * @param viewId - The view instance ID
 * @returns Formatted view name
 */
export function buildViewName(componentType: string, viewId: string): string {
  return `${componentType}-${viewId}`;
}

/**
 * Extract view type from view name
 *
 * Reverses buildViewName() to get the component type from a view name.
 *
 * @param viewName - The view name (e.g., 'demo-component-abc-123')
 * @returns The component type, or null if format doesn't match
 */
export function extractViewType(viewName: string): string | null {
  const parts = viewName.split('-');
  if (parts.length < 2) {
    return null;
  }

  // Remove the last part (which should be a UUID segment)
  // and rejoin the rest
  return parts.slice(0, -5).join('-'); // UUID has 5 segments
}

// ============================================================================
// View customData utilities for persisting state with workspace
// ============================================================================

import type { ViewCustomData, ViewCustomDataUpdate } from '../types/viewCustomData';
export type { ViewCustomData, ViewCustomDataUpdate };

/**
 * Get the current view's customData
 *
 * Reads from the view's options. Note that customData set via updateOptions()
 * will persist when the workspace is saved/restored.
 *
 * @returns The view's customData or undefined if not in OpenFin
 */
export async function getViewCustomData(): Promise<ViewCustomData | undefined> {
  if (typeof window === 'undefined' || !window.fin) {
    logger.warn('getViewCustomData called outside OpenFin context', undefined, 'viewUtils');
    return undefined;
  }

  try {
    const view = window.fin.View.getCurrentSync();
    const identity = view.identity;

    // Get the current view options which include customData
    const options = await view.getOptions();
    const customData = (options as any).customData as ViewCustomData | undefined;

    logger.debug('Retrieved view customData from options', {
      viewIdentity: identity,
      viewName: identity.name,
      customData
    }, 'viewUtils');
    return customData;
  } catch (error) {
    logger.error('Failed to get view customData', error, 'viewUtils');
    return undefined;
  }
}

/**
 * Update the current view's customData
 *
 * This merges the updates with existing customData, preserving existing fields.
 * The updated customData will persist when the workspace is saved.
 *
 * @param updates - Partial customData to merge with existing
 */
export async function updateViewCustomData(updates: ViewCustomDataUpdate): Promise<void> {
  if (typeof window === 'undefined' || !window.fin) {
    logger.warn('updateViewCustomData called outside OpenFin context', undefined, 'viewUtils');
    return;
  }

  try {
    const view = window.fin.View.getCurrentSync();
    const identity = view.identity;

    // Get existing customData from view options
    const options = await view.getOptions();
    const existingCustomData = (options as any).customData || {};

    // Merge updates with existing data
    const newCustomData = {
      ...existingCustomData,
      ...updates
    };

    // Update the view options with new customData
    // This will persist when the workspace snapshot is saved
    await view.updateOptions({
      customData: newCustomData
    } as any);

    logger.info('Updated view customData', {
      viewIdentity: identity,
      viewName: identity.name,
      updates,
      existingCustomData,
      newCustomData
    }, 'viewUtils');
  } catch (error) {
    logger.error('Failed to update view customData', error, 'viewUtils');
    throw error;
  }
}

/**
 * Get the active layout ID from the current view's customData
 *
 * @returns The active layout ID or undefined
 */
export async function getActiveLayoutId(): Promise<string | undefined> {
  const customData = await getViewCustomData();
  return customData?.activeLayoutId;
}

/**
 * Set the active layout ID in the current view's customData
 *
 * @param layoutId - The layout ID to set as active
 */
export async function setActiveLayoutId(layoutId: string): Promise<void> {
  await updateViewCustomData({ activeLayoutId: layoutId });
}
