/**
 * View Custom Data Types
 *
 * Defines the structure of customData stored in OpenFin view options.
 * This data persists with the workspace and enables per-view layout configuration.
 */

/**
 * Custom data stored in an OpenFin view's customData property.
 * This data is automatically saved/restored with workspace snapshots.
 */
export interface ViewCustomData {
  /** The dock menu item ID that launched this view */
  menuItemId: string;

  /** Display caption for the view */
  caption: string;

  /** Component type (e.g., 'simple-blotter', 'chart') */
  componentType: string;

  /** Blotter configuration ID (usually same as menuItemId for dock-launched views) */
  blotterConfigId: string;

  /** Currently active layout ID for this view instance */
  activeLayoutId?: string;

  /** User ID who owns this view's configuration */
  userId?: string;

  /** Source view ID if this was duplicated from another view */
  sourceViewId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Partial view custom data for updates
 */
export type ViewCustomDataUpdate = Partial<ViewCustomData>;

/**
 * Creates default view custom data
 */
export function createViewCustomData(
  menuItemId: string,
  caption: string,
  componentType: string,
  blotterConfigId?: string,
  userId?: string
): ViewCustomData {
  return {
    menuItemId,
    caption,
    componentType,
    blotterConfigId: blotterConfigId || menuItemId,
    userId
  };
}
