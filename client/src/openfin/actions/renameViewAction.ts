/**
 * Rename View Action Handler
 *
 * Handles the logic for renaming OpenFin view tabs via a popup dialog.
 * This module is extracted from OpenfinProvider for better code organization.
 */

import { logger } from '@/utils/logger';
import { DIALOG_DIMENSIONS, DEFAULT_POPUP_OPTIONS, POPUP_BEHAVIOR, DIALOG_ROUTES } from '../constants/dialogConfig';
import { RenameViewPopupResult } from '../types/popupResults';
import { updateViewCustomData } from '../utils/viewUtils';

/**
 * View identity interface
 */
export interface ViewIdentity {
  uuid: string;
  name: string;
}

/**
 * Result of rename action
 */
export interface RenameViewResult {
  success: boolean;
  newName?: string;
  error?: Error;
}

/**
 * Handle the rename view action
 *
 * Opens a centered popup dialog for renaming a view tab, then updates
 * the tab caption using executeJavaScript to set document.title.
 *
 * @param viewIdentity - The view to rename
 * @param baseUrl - Application base URL for constructing dialog URL
 * @returns Result indicating success/failure and the new name if successful
 */
export async function handleRenameViewAction(
  viewIdentity: ViewIdentity,
  baseUrl: string = window.location.origin
): Promise<RenameViewResult> {
  try {
    // Get the view and calculate centered position
    const view = fin.View.wrapSync({
      uuid: viewIdentity.uuid,
      name: viewIdentity.name,
    });

    // Get the host window bounds (screen coordinates)
    const hostWindow = await view.getCurrentWindow();
    const windowBounds = await hostWindow.getBounds();

    // Get view bounds (relative to window)
    const viewBounds = await view.getBounds();

    // Calculate center position in screen coordinates
    const { width: dialogWidth, height: dialogHeight } = DIALOG_DIMENSIONS.RENAME_VIEW;
    const viewScreenX = windowBounds.left + viewBounds.left;
    const viewScreenY = windowBounds.top + viewBounds.top;
    const centerX = viewScreenX + (viewBounds.width - dialogWidth) / 2;
    const centerY = viewScreenY + (viewBounds.height - dialogHeight) / 2;

    // Construct dialog URL with current name as query parameter
    const dialogUrl = `${baseUrl}${DIALOG_ROUTES.RENAME_VIEW}?currentName=${encodeURIComponent(viewIdentity.name)}`;

    // Open popup dialog
    const result = (await (fin.me as any).showPopupWindow({
      initialOptions: DEFAULT_POPUP_OPTIONS,
      url: dialogUrl,
      ...POPUP_BEHAVIOR,
      height: dialogHeight,
      width: dialogWidth,
      x: Math.round(centerX),
      y: Math.round(centerY),
    })) as RenameViewPopupResult;

    // Handle the result - extract newName from result.data
    const newName = result?.data?.newName;

    if (!newName || newName === viewIdentity.name) {
      // User cancelled or no change
      logger.info('Rename cancelled or no change', {
        viewIdentity,
        newName,
      }, 'renameViewAction');
      return { success: false };
    }

    // Update the tab caption using executeJavaScript to set document.title
    // This is the correct way per OpenFin documentation
    const escapedName = newName.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
    await view.executeJavaScript(`document.title = "${escapedName}";`);

    // Also persist to customData so the caption survives workspace restore
    await updateViewCustomData({ caption: newName });

    logger.info('View renamed successfully', {
      oldName: viewIdentity.name,
      newName,
      method: 'executeJavaScript + customData',
    }, 'renameViewAction');

    return {
      success: true,
      newName,
    };
  } catch (error) {
    logger.error('Failed to rename view', {
      error,
      viewIdentity,
    }, 'renameViewAction');

    return {
      success: false,
      error: error as Error,
    };
  }
}
