/**
 * OpenFin Dialog Infrastructure
 *
 * Reusable infrastructure for hosting React components in OpenFin dialog windows
 * with type-safe IAB communication.
 */

export { DialogHost } from './DialogHost';
export { openDialog, closeDialog } from './dialogManager';
export type {
  DialogConfig,
  DialogRequest,
  DialogAction,
  DialogClose,
  DialogMessage,
  DialogActionHandler,
  DialogHostProps,
  OpenDialogOptions,
  BaseDialogMessage,
} from './types';
