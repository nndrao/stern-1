/**
 * DialogHost Component
 *
 * Wrapper component for hosting React components in OpenFin dialog windows.
 * Handles IAB communication setup and provides dialog props and action handlers.
 */

import React, { useEffect, useState, useCallback } from 'react';
import type { DialogHostProps, DialogActionHandler, DialogRequest, DialogAction } from './types';

/**
 * DialogHost - Generic component for hosting dialogs in OpenFin windows
 *
 * Usage:
 * ```tsx
 * <DialogHost dialogType="MANAGE_LAYOUTS">
 *   {(props, handleAction) => (
 *     <MyDialogContent
 *       {...props}
 *       onSave={() => handleAction('save', data)}
 *       onClose={() => handleAction('close')}
 *     />
 *   )}
 * </DialogHost>
 * ```
 */
export function DialogHost<TProps = any>({
  dialogType,
  children,
  onAction,
}: DialogHostProps<TProps>): JSX.Element {
  const [props, setProps] = useState<TProps | null>(null);
  const [dialogId, setDialogId] = useState<string>('');
  const [isReady, setIsReady] = useState(false);

  // Get IAB topic names
  const requestTopic = `stern.dialog.${dialogType}.request`;
  const actionTopic = `stern.dialog.${dialogType}.action`;

  useEffect(() => {
    // Subscribe to IAB for props
    const handleRequest = (message: DialogRequest<TProps>, identity: any) => {
      console.log(`[DialogHost:${dialogType}] Received props:`, message);
      setProps(message.props);
      setDialogId(message.dialogId);
      setIsReady(true);
    };

    // Subscribe using OpenFin IAB
    fin.InterApplicationBus.subscribe(
      { uuid: '*' },
      requestTopic,
      handleRequest
    );

    console.log(`[DialogHost:${dialogType}] Subscribed to ${requestTopic}`);

    // Notify parent that we're ready to receive props
    fin.InterApplicationBus.publish('stern.dialog.ready', {
      dialogType,
      timestamp: Date.now(),
    });

    return () => {
      // Cleanup subscription
      fin.InterApplicationBus.unsubscribe(
        { uuid: '*' },
        requestTopic,
        handleRequest
      );
    };
  }, [dialogType, requestTopic]);

  // Action handler that sends messages back to parent
  const handleAction: DialogActionHandler = useCallback(
    (action: string, payload?: any) => {
      const message: DialogAction = {
        type: 'action',
        dialogId,
        action,
        payload,
        timestamp: Date.now(),
      };

      console.log(`[DialogHost:${dialogType}] Sending action:`, message);

      // Broadcast action via IAB
      fin.InterApplicationBus.publish(actionTopic, message);

      // Call optional callback
      onAction?.(action, payload);

      // If action is 'close', close the window
      if (action === 'close') {
        setTimeout(() => {
          fin.Window.getCurrentSync().close();
        }, 100);
      }
    },
    [dialogId, dialogType, actionTopic, onAction]
  );

  // Show loading state while waiting for props
  if (!isReady || !props) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#666',
      }}>
        Loading dialog...
      </div>
    );
  }

  // Render child with props and action handler
  return <>{children(props, handleAction)}</>;
}
