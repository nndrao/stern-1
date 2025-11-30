/**
 * DialogHost Component
 *
 * Wrapper component for hosting React components in OpenFin dialog windows.
 * Handles IAB communication setup and provides dialog props and action handlers.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
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

  // Track active subscription to prevent double unsubscribe in React Strict Mode
  const subscriptionRef = useRef<{
    handler: (message: DialogRequest<TProps>, identity: any) => void;
    subscribed: boolean;
  } | null>(null);

  // Get IAB topic names
  const requestTopic = `stern.dialog.${dialogType}.request`;
  const actionTopic = `stern.dialog.${dialogType}.action`;

  useEffect(() => {
    let isMounted = true;

    // Subscribe to IAB for props
    const handleRequest = (message: DialogRequest<TProps>, identity: any) => {
      console.log(`[DialogHost:${dialogType}] Received props:`, message);
      // Only update state if component is still mounted
      if (isMounted) {
        setProps(message.props);
        setDialogId(message.dialogId);
        setIsReady(true);
      }
    };

    // Subscribe using OpenFin IAB
    fin.InterApplicationBus.subscribe(
      { uuid: '*' },
      requestTopic,
      handleRequest
    );

    // Track this subscription
    subscriptionRef.current = { handler: handleRequest, subscribed: true };

    console.log(`[DialogHost:${dialogType}] Subscribed to ${requestTopic}`);

    // Notify parent that we're ready to receive props
    console.log(`[DialogHost:${dialogType}] Publishing ready signal to stern.dialog.ready`);
    fin.InterApplicationBus.publish('stern.dialog.ready', {
      dialogType,
      timestamp: Date.now(),
    });

    return () => {
      // Mark as unmounted but DON'T unsubscribe immediately
      // This prevents race conditions with React Strict Mode
      isMounted = false;

      // Only unsubscribe if this is still the active subscription
      // This prevents React Strict Mode double-mounting from removing the active subscription
      if (subscriptionRef.current?.handler === handleRequest && subscriptionRef.current?.subscribed) {
        console.log(`[DialogHost:${dialogType}] Scheduling unsubscribe (100ms delay)`);

        // Delay unsubscribe to allow any in-flight messages to be processed
        setTimeout(() => {
          // Double-check this is still the active subscription before unsubscribing
          if (subscriptionRef.current?.handler === handleRequest && subscriptionRef.current?.subscribed) {
            console.log(`[DialogHost:${dialogType}] Unsubscribing from ${requestTopic}`);
            fin.InterApplicationBus.unsubscribe(
              { uuid: '*' },
              requestTopic,
              handleRequest
            );
            subscriptionRef.current.subscribed = false;
          } else {
            console.log(`[DialogHost:${dialogType}] Skipping unsubscribe - new subscription active`);
          }
        }, 100);
      } else {
        console.log(`[DialogHost:${dialogType}] Skipping unsubscribe - not active subscription`);
      }
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
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading dialog...</div>
      </div>
    );
  }

  // Render child with props and action handler
  return <>{children(props, handleAction)}</>;
}
