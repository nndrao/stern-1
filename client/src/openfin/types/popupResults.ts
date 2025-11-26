/**
 * TypeScript interfaces for OpenFin popup window results
 *
 * These types provide type safety for data returned from popup dialogs
 * via fin.me.dispatchPopupResult() and received by showPopupWindow() callers.
 */

/**
 * Base interface for all popup results
 */
export interface PopupResultBase {
  identity: {
    name: string;
    uuid: string;
  };
  result: string;
}

/**
 * Result returned from the Rename View dialog
 */
export interface RenameViewPopupResult extends PopupResultBase {
  data: {
    newName: string;
  } | null;
}

/**
 * Union type for all possible popup results
 */
export type PopupResult = RenameViewPopupResult;
