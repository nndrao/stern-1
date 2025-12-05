/**
 * Shared Types for Layout Management Dialogs
 *
 * Common interfaces used by LayoutManageDialog, LayoutManageDialogContent,
 * and the OpenFin ManageLayoutsDialog route.
 */

import { UnifiedConfig, SimpleBlotterLayoutConfig } from '@stern/shared-types';

/**
 * Layout information combining config and unified metadata
 */
export interface LayoutInfo {
  config: SimpleBlotterLayoutConfig;
  unified: UnifiedConfig;
}

/**
 * Blotter configuration info displayed in the dialog
 */
export interface BlotterInfo {
  configId: string;
  componentType: string;
  componentSubType?: string;
}

/**
 * Props for the LayoutItem component
 */
export interface LayoutItemProps {
  /** Layout data */
  layout: LayoutInfo;
  /** Whether this is the default layout */
  isDefault: boolean;
  /** Whether this layout is currently selected */
  isSelected?: boolean;
  /** Whether this layout is being edited */
  isEditing: boolean;
  /** Current edit name value */
  editName: string;
  /** Whether an operation is in progress */
  isProcessing?: boolean;
  /** Start editing the layout name */
  onEditStart: () => void;
  /** Cancel editing */
  onEditCancel: () => void;
  /** Save the edited name */
  onEditSave: () => void;
  /** Handle edit name change */
  onEditNameChange: (name: string) => void;
  /** Set this layout as default */
  onSetDefault: () => void;
  /** Duplicate this layout */
  onDuplicate: () => void;
  /** Delete this layout */
  onDelete: () => void;
  /** Select this layout */
  onSelect?: () => void;
}

/**
 * Callbacks for layout management actions
 */
export interface LayoutManageCallbacks {
  /** Rename a layout */
  onRename: (layoutId: string, newName: string) => void | Promise<void>;
  /** Delete a layout */
  onDelete: (layoutId: string) => void | Promise<void>;
  /** Duplicate a layout */
  onDuplicate: (layoutId: string, newName: string) => void | Promise<void>;
  /** Set a layout as default */
  onSetDefault: (layoutId: string) => void | Promise<void>;
  /** Select a layout (optional) */
  onSelect?: (layoutId: string) => void;
  /** Save component subtype (optional) */
  onSaveComponentSubType?: (subType: string) => void | Promise<void>;
  /** Close the dialog (optional) */
  onClose?: () => void;
}

/**
 * Props for the LayoutManageDialogContent component
 */
export interface LayoutManageDialogContentProps extends LayoutManageCallbacks {
  /** List of available layouts */
  layouts: LayoutInfo[];
  /** ID of the default layout */
  defaultLayoutId?: string;
  /** Currently selected layout ID */
  selectedLayoutId?: string;
  /** Blotter configuration info */
  blotterInfo?: BlotterInfo;
  /** Whether operations are in progress */
  isLoading?: boolean;
}

/**
 * Props for the LayoutManageDialog wrapper component
 */
export interface LayoutManageDialogProps extends LayoutManageDialogContentProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
}
