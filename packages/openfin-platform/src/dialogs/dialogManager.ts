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
    // Set up IAB communication topics
    const requestTopic = `stern.dialog.${dialogType}.request`;
    const actionTopic = `stern.dialog.${dialogType}.action`;

    // Return a promise that resolves when dialog closes or sends a close action
    return new Promise<TResult | null>(async (resolve) => {
      let resolved = false;
      let actionUnsubscribe: (() => void) | null = null;
      let readyUnsubscribe: (() => void) | null = null;
      let propsSent = false;

      // Wait for window to load, then send props
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

      // Handle ready signal from dialog - MUST be subscribed BEFORE window creation
      const handleReady = (message: any, identity: any) => {
        if (message.dialogType === dialogType && !propsSent) {
          console.log(`[DialogManager] Dialog ready signal received`);
          propsSent = true;

          if (readyUnsubscribe) {
            readyUnsubscribe();
            readyUnsubscribe = null;
          }

          // Send props immediately
          sendProps();
        }
      };

      // Subscribe to ready signal BEFORE creating window to ensure we don't miss it
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

      // Cleanup function
      const cleanup = () => {
        if (actionUnsubscribe) {
          actionUnsubscribe();
          actionUnsubscribe = null;
        }
        if (readyUnsubscribe) {
          readyUnsubscribe();
          readyUnsubscribe = null;
        }
      };

      // NOW create the OpenFin window (after subscriptions are set up)
      const dialogWindow = await fin.Window.create(windowOptions);

      console.log(`[DialogManager] Window created:`, dialogId);

      // Handle window close event
      dialogWindow.on('closed', () => {
        if (!resolved) {
          resolved = true;
          console.log(`[DialogManager] Dialog window closed without result`);
          cleanup();
          resolve(null);
        }
      });

      // Fallback: send props after a short delay if no ready signal
      // Reduced from 1000ms to 200ms for faster loading
      setTimeout(() => {
        if (readyUnsubscribe) {
          readyUnsubscribe();
          readyUnsubscribe = null;
        }
        if (!propsSent) {
          console.log(`[DialogManager] Fallback timeout reached, sending props`);
          propsSent = true;
          sendProps();
        }
      }, 200);
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
