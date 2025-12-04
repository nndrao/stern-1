/**
 * Dialog Configuration
 *
 * Centralized configuration for all OpenFin dialog windows
 */

import type { DialogConfig } from '@stern/openfin-platform';

/**
 * Dialog type identifiers
 */
export const DIALOG_TYPES = {
  MANAGE_LAYOUTS: 'MANAGE_LAYOUTS',
  SAVE_LAYOUT: 'SAVE_LAYOUT',
} as const;

export type DialogType = typeof DIALOG_TYPES[keyof typeof DIALOG_TYPES];

/**
 * Dialog configurations
 */
export const DIALOG_CONFIGS: Record<DialogType, DialogConfig> = {
  [DIALOG_TYPES.MANAGE_LAYOUTS]: {
    route: '/dialogs/manage-layouts',
    width: 700,
    height: 700,
    title: 'Layout Management',
    frame: true,
    resizable: true,
    alwaysOnTop: false,
    center: true,
  },
  [DIALOG_TYPES.SAVE_LAYOUT]: {
    route: '/dialogs/save-layout',
    width: 400,
    height: 250,
    title: 'Save Layout',
    frame: true,
    resizable: false,
    alwaysOnTop: true,
    center: true,
  },
};
