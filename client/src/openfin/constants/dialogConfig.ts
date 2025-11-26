/**
 * OpenFin Dialog Configuration
 *
 * Centralized configuration for OpenFin popup dialogs including dimensions,
 * behavior settings, and URLs.
 */

/**
 * Dialog dimensions for various popup types
 */
export const DIALOG_DIMENSIONS = {
  RENAME_VIEW: {
    width: 300,
    height: 120,
  },
} as const;

/**
 * Common popup window options for dialogs
 */
export const DEFAULT_POPUP_OPTIONS = {
  frame: false,
  saveWindowState: false,
  showTaskbarIcon: false,
  resizable: false,
  maximizable: false,
  minimizable: false,
  contextMenu: false,
  alwaysOnTop: true,
  opacity: 1,
} as const;

/**
 * Popup behavior configuration
 */
export const POPUP_BEHAVIOR = {
  resultDispatchBehavior: 'close' as const,  // Close popup when result dispatched
  blurBehavior: 'close' as const,            // Close on blur
  focus: true,
} as const;

/**
 * Dialog routes (relative to application base URL)
 */
export const DIALOG_ROUTES = {
  RENAME_VIEW: '/dialogs/rename-view',
} as const;
