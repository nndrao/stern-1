/// <reference types="@openfin/core" />

/**
 * View Actions
 *
 * Actions for managing OpenFin views, including duplication with configuration cloning.
 * These actions are triggered from the view tab context menu.
 */

import { generateViewId, buildViewUrl } from '../utils/viewUtils';
import { simpleBlotterConfigService } from '@/services/api/simpleBlotterConfigService';
import { logger } from '@/utils/logger';
import { COMPONENT_TYPES } from '@stern/shared-types';

const DEFAULT_USER_ID = 'default-user';

/**
 * Result of a view duplication operation
 */
export interface DuplicateViewResult {
  success: boolean;
  newViewId?: string;
  error?: string;
}

/**
 * Duplicate a SimpleBlotter view with all its layouts
 *
 * This function:
 * 1. Generates a new viewInstanceId
 * 2. Clones the blotter configuration and all layouts to the new ID
 * 3. Creates a new OpenFin view with the new URL
 *
 * @param sourceViewId - The source view's instance ID (from URL ?id= parameter)
 * @param userId - User performing the duplication
 * @returns Result of the duplication operation
 */
export async function duplicateSimpleBlotterView(
  sourceViewId: string,
  userId: string = DEFAULT_USER_ID
): Promise<DuplicateViewResult> {
  try {
    logger.info('Duplicating SimpleBlotter view', { sourceViewId }, 'viewActions');

    // 1. Generate new view instance ID
    const newViewId = generateViewId();
    logger.debug('Generated new view ID', { newViewId }, 'viewActions');

    // 2. Clone blotter configuration and all layouts
    const result = await simpleBlotterConfigService.duplicateBlotterWithLayouts(
      sourceViewId,
      newViewId,
      userId
    );

    logger.info('Blotter configs cloned', {
      sourceViewId,
      newViewId,
      layoutCount: result.layouts.length
    }, 'viewActions');

    // 3. Create new view in OpenFin
    if (typeof window !== 'undefined' && window.fin) {
      try {
        const platform = fin.Platform.getCurrentSync();

        // Build the URL for the new view
        const newViewUrl = buildViewUrl('/customcomponents', newViewId);
        logger.debug('Creating new view with URL', { newViewUrl }, 'viewActions');

        // Try to create in the same window/page as the source view
        const currentView = fin.View.getCurrentSync();
        const currentWindow = await currentView.getCurrentWindow();

        // Create the view
        const viewOptions = {
          url: newViewUrl,
          name: `simple-blotter-${newViewId}`,
          target: currentWindow.identity,
          customData: {
            viewInstanceId: newViewId,
            componentType: COMPONENT_TYPES.SIMPLE_BLOTTER,
            sourceViewId, // Track where this was cloned from
            userId
          }
        };

        await platform.createView(viewOptions);

        logger.info('New view created successfully', { newViewId, newViewUrl }, 'viewActions');

        return {
          success: true,
          newViewId
        };
      } catch (openfinError) {
        logger.error('Failed to create OpenFin view', openfinError, 'viewActions');
        // The configs were cloned successfully, but view creation failed
        // Return success since the data is ready - user can create view manually
        return {
          success: true,
          newViewId,
          error: 'View configs cloned but OpenFin view creation failed'
        };
      }
    } else {
      // Not in OpenFin environment - just return the new ID
      logger.warn('Not in OpenFin environment - configs cloned but no view created', { newViewId }, 'viewActions');
      return {
        success: true,
        newViewId,
        error: 'Not in OpenFin environment'
      };
    }
  } catch (error) {
    logger.error('Failed to duplicate SimpleBlotter view', error, 'viewActions');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get the view instance ID from a view's custom data or URL
 *
 * @param view - OpenFin View object
 * @returns The view instance ID or null if not found
 */
export async function getViewInstanceIdFromView(view: any): Promise<string | null> {
  try {
    const info = await view.getInfo();

    // First try custom data
    const customData = (info as any).customData;
    if (customData?.viewInstanceId) {
      return customData.viewInstanceId;
    }

    // Fall back to URL parameter
    const url = info.url;
    if (url) {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get('id');
      if (id) {
        return id;
      }
    }

    return null;
  } catch (error) {
    logger.error('Failed to get view instance ID', error, 'viewActions');
    return null;
  }
}

/**
 * Check if a view is a SimpleBlotter view
 *
 * @param view - OpenFin View object
 * @returns True if the view is a SimpleBlotter
 */
export async function isSimpleBlotterView(view: any): Promise<boolean> {
  try {
    const info = await view.getInfo();
    const customData = (info as any).customData;

    // Check custom data for component type
    if (customData?.componentType === COMPONENT_TYPES.SIMPLE_BLOTTER) {
      return true;
    }

    // Check URL for SimpleBlotter route
    const url = info.url;
    if (url && url.includes('/customcomponents')) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to check if view is SimpleBlotter', error, 'viewActions');
    return false;
  }
}

/**
 * Handle the "Duplicate View" action from context menu
 *
 * This is the main entry point called by the view tab context menu.
 *
 * @param viewIdentity - Identity of the view to duplicate (uuid and name)
 */
export async function handleDuplicateViewAction(
  viewIdentity: { uuid: string; name: string }
): Promise<DuplicateViewResult> {
  try {
    logger.info('Handling duplicate view action', { viewIdentity }, 'viewActions');

    if (!window.fin) {
      return { success: false, error: 'Not in OpenFin environment' };
    }

    // Get the view
    const view = fin.View.wrapSync(viewIdentity);

    // Check if it's a SimpleBlotter
    const isBlotter = await isSimpleBlotterView(view);
    if (!isBlotter) {
      logger.warn('View is not a SimpleBlotter - standard duplication not supported', { viewIdentity }, 'viewActions');
      return { success: false, error: 'Only SimpleBlotter views can be duplicated with layouts' };
    }

    // Get the source view instance ID
    const sourceViewId = await getViewInstanceIdFromView(view);
    if (!sourceViewId) {
      logger.error('Could not get view instance ID', { viewIdentity }, 'viewActions');
      return { success: false, error: 'Could not determine view instance ID' };
    }

    // Perform the duplication
    return await duplicateSimpleBlotterView(sourceViewId);
  } catch (error) {
    logger.error('Failed to handle duplicate view action', error, 'viewActions');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
