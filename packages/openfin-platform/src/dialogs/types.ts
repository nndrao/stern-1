/**
 * Dialog Infrastructure Types
 *
 * Type-safe dialog communication protocol for OpenFin windows
 */

/**
 * Dialog configuration options
 */
export interface DialogConfig {
  /** Dialog route path (e.g., '/dialogs/manage-layouts') */
  route: string;
  /** Window width in pixels */
  width: number;
  /** Window height in pixels */
  height: number;
  /** Window title */
  title: string;
  /** Whether to show window frame */
  frame?: boolean;
  /** Whether window is resizable */
  resizable?: boolean;
  /** Whether window stays on top */
  alwaysOnTop?: boolean;
  /** Whether to center window */
  center?: boolean;
  /** Additional OpenFin window options */
  windowOptions?: any;
}

/**
 * Base dialog message structure
 */
export interface BaseDialogMessage {
  /** Unique dialog instance ID */
  dialogId: string;
  /** Timestamp of message */
  timestamp: number;
}

/**
 * Message sent from parent to child dialog to initialize
 */
export interface DialogRequest<TProps = any> extends BaseDialogMessage {
  type: 'init';
  /** Props to pass to the dialog */
  props: TProps;
}

/**
 * Message sent from child dialog to parent when user takes action
 */
export interface DialogAction<TPayload = any> extends BaseDialogMessage {
  type: 'action';
  /** Action name (e.g., 'rename', 'delete', 'select') */
  action: string;
  /** Action payload/data */
  payload?: TPayload;
}

/**
 * Message sent when dialog is closing
 */
export interface DialogClose<TResult = any> extends BaseDialogMessage {
  type: 'close';
  /** Final result to return to caller */
  result?: TResult;
}

/**
 * Union of all dialog message types
 */
export type DialogMessage<TProps = any, TPayload = any, TResult = any> =
  | DialogRequest<TProps>
  | DialogAction<TPayload>
  | DialogClose<TResult>;

/**
 * Dialog action handler callback
 */
export type DialogActionHandler<TPayload = any> = (action: string, payload?: TPayload) => void;

/**
 * Props for DialogHost component
 */
export interface DialogHostProps<TProps = any> {
  /** Dialog type identifier */
  dialogType: string;
  /** Render function that receives props and action handler */
  children: (props: TProps, handleAction: DialogActionHandler) => React.ReactNode;
  /** Optional callback when action is sent */
  onAction?: DialogActionHandler;
}

/**
 * Options for opening a dialog
 */
export interface OpenDialogOptions extends Partial<DialogConfig> {
  /** Optional callback when dialog sends actions */
  onAction?: DialogActionHandler;
}
