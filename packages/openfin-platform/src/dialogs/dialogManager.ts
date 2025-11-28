/**
 * Dialog Manager
 *
 * Provides the main API for opening and managing OpenFin dialog windows.
 */

import type {
  DialogConfig,
  DialogRequest,
  DialogAction,
  DialogClose,
  OpenDialogOptions,
} from './types';

/**
 * Open a dialog in an OpenFin window
 *
 * @param dialogType - Unique identifier for the dialog type
 * @param config - Dialog configuration (dimensions, route, etc.)
 * @param props - Props to pass to the dialog component
 * @param options - Additional options
 * @returns Promise that resolves with the dialog result when closed
 *
 * @example
 * ```typescript
 * const result = await openDialog<MyDialogProps, MyDialogResult>(
 *   'MY_DIALOG',
 *   { route: '/dialogs/my-dialog', width: 500, height: 400, title: 'My Dialog' },
 *   { someData: 'value' }
 * );
 * ```
 */
export async function openDialog<TProps = any, TResult = any>(
  dialogType: string,
  config: DialogConfig,
  props: TProps,
  options: OpenDialogOptions = {}
): Promise<TResult | null> {
  const dialogId = `dialog-${dialogType}-${Date.now()}`;

  console.log(`[DialogManager] Opening dialog: ${dialogType}`, {
    dialogId,
    config,
    props,
  });

  // Merge config with options
  const finalConfig = { ...config, ...options };

  // Build window options
  const windowOptions: any = {
    name: dialogId,
    url: `${window.location.origin}${finalConfig.route}`,
    defaultWidth: finalConfig.width,
    defaultHeight: finalConfig.height,
    defaultCentered: finalConfig.center !== false,
    frame: finalConfig.frame !== false,
    resizable: finalConfig.resizable !== false,
    alwaysOnTop: finalConfig.alwaysOnTop === true,
    saveWindowState: false,
    autoShow: true,
    ...(finalConfig.title ? { defaultTitle: finalConfig.title } : {}),
    ...(finalConfig.windowOptions || {}),
  };

  try {
    // Create the OpenFin window
    const dialogWindow = await fin.Window.create(windowOptions);

    console.log(`[DialogManager] Window created:`, dialogId);

    // Set up IAB communication
    const requestTopic = `stern.dialog.${dialogType}.request`;
    const actionTopic = `stern.dialog.${dialogType}.action`;

    // Return a promise that resolves when dialog closes or sends a close action
    return new Promise<TResult | null>((resolve) => {
      let resolved = false;
      let actionUnsubscribe: (() => void) | null = null;

      // Handle actions from dialog
      const handleAction = (message: DialogAction<TResult>, identity: any) => {
        console.log(`[DialogManager] Received action from dialog:`, message);

        // Call optional action callback
        if (options.onAction) {
          options.onAction(message.action, message.payload);
        }

        // If action is 'close', resolve and cleanup
        if (message.action === 'close') {
          if (!resolved) {
            resolved = true;
            console.log(`[DialogManager] Dialog closing with result:`, message.payload);
            cleanup();
            resolve(message.payload || null);
          }
        }
      };

      // Subscribe to action messages
      fin.InterApplicationBus.subscribe(
        { uuid: '*' },
        actionTopic,
        handleAction
      );

      actionUnsubscribe = () => {
        fin.InterApplicationBus.unsubscribe(
          { uuid: '*' },
          actionTopic,
          handleAction
        );
      };

      // Handle window close event
      dialogWindow.on('closed', () => {
        if (!resolved) {
          resolved = true;
          console.log(`[DialogManager] Dialog window closed without result`);
          cleanup();
          resolve(null);
        }
      });

      // Cleanup function
      const cleanup = () => {
        if (actionUnsubscribe) {
          actionUnsubscribe();
          actionUnsubscribe = null;
        }
      };

      // Wait for window to load, then send props
      // We wait for the 'dialog.ready' message or use a timeout
      const sendProps = () => {
        const request: DialogRequest<TProps> = {
          type: 'init',
          dialogId,
          props,
          timestamp: Date.now(),
        };

        console.log(`[DialogManager] Sending props to dialog:`, request);

        fin.InterApplicationBus.publish(requestTopic, request);
      };

      // Listen for ready signal from dialog
      let readyUnsubscribe: (() => void) | null = null;
      const handleReady = (message: any, identity: any) => {
        if (message.dialogType === dialogType) {
          console.log(`[DialogManager] Dialog ready signal received`);
          if (readyUnsubscribe) {
            readyUnsubscribe();
            readyUnsubscribe = null;
          }
          // Send props immediately
          sendProps();
        }
      };

      fin.InterApplicationBus.subscribe(
        { uuid: '*' },
        'stern.dialog.ready',
        handleReady
      );

      readyUnsubscribe = () => {
        fin.InterApplicationBus.unsubscribe(
          { uuid: '*' },
          'stern.dialog.ready',
          handleReady
        );
      };

      // Fallback: send props after a short delay if no ready signal
      setTimeout(() => {
        if (readyUnsubscribe) {
          readyUnsubscribe();
          readyUnsubscribe = null;
        }
        sendProps();
      }, 1000);
    });
  } catch (error) {
    console.error(`[DialogManager] Error opening dialog:`, error);
    throw error;
  }
}

/**
 * Close a dialog programmatically
 *
 * @param dialogId - The dialog instance ID
 */
export async function closeDialog(dialogId: string): Promise<void> {
  try {
    const dialogWindow = await fin.Window.wrap({ uuid: fin.me.uuid, name: dialogId });
    await dialogWindow.close();
  } catch (error) {
    console.error(`[DialogManager] Error closing dialog ${dialogId}:`, error);
  }
}
