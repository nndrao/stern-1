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
    const mountId = Date.now();
    console.log(`[LOADING_LAYOUT] DialogHost useEffect START - mountId: ${mountId}, dialogType: ${dialogType}`);

    let isMounted = true;
    let readySignalTimeoutId: NodeJS.Timeout | null = null;

    // Subscribe to IAB for props
    const handleRequest = (message: DialogRequest<TProps>, identity: any) => {
      console.log(`[LOADING_LAYOUT] handleRequest CALLED - mountId: ${mountId}`);
      console.log(`[LOADING_LAYOUT] Message received:`, JSON.stringify(message, null, 2));
      console.log(`[LOADING_LAYOUT] isMounted: ${isMounted}`);
      console.log(`[LOADING_LAYOUT] Current state - props: ${!!props}, dialogId: ${dialogId}, isReady: ${isReady}`);

      // Only update state if component is still mounted
      if (isMounted) {
        console.log(`[LOADING_LAYOUT] Setting state - props, dialogId, isReady`);
        setProps(message.props);
        setDialogId(message.dialogId);
        setIsReady(true);
        console.log(`[LOADING_LAYOUT] State set complete`);
      } else {
        console.error(`[LOADING_LAYOUT] Component NOT mounted! Props lost!`);
      }
    };

    console.log(`[LOADING_LAYOUT] About to subscribe to IAB topic: ${requestTopic}`);

    // Subscribe using OpenFin IAB
    fin.InterApplicationBus.subscribe(
      { uuid: '*' },
      requestTopic,
      handleRequest
    );

    // Track this subscription
    subscriptionRef.current = { handler: handleRequest, subscribed: true };

    console.log(`[LOADING_LAYOUT] ✅ Subscribed to ${requestTopic} - mountId: ${mountId}`);
    console.log(`[LOADING_LAYOUT] subscriptionRef set:`, { handlerExists: !!subscriptionRef.current?.handler, subscribed: subscriptionRef.current?.subscribed });

    // Notify parent that we're ready to receive props
    // IMPORTANT: Add small delay to ensure IAB connection is fully established
    // This prevents race conditions where the signal is sent before the parent can receive it
    console.log(`[LOADING_LAYOUT] 📢 Scheduling ready signal publication (50ms delay)`);

    readySignalTimeoutId = setTimeout(() => {
      // Only send if still mounted (prevents StrictMode first mount from sending signal)
      if (!isMounted) {
        console.log(`[LOADING_LAYOUT] ⏭️ Component unmounted before ready signal - skipping publish - mountId: ${mountId}`);
        return;
      }

      console.log(`[LOADING_LAYOUT] 📢 Publishing ready signal to stern.dialog.ready`);
      console.log(`[LOADING_LAYOUT] Ready signal payload:`, { dialogType, timestamp: Date.now(), mountId });

      fin.InterApplicationBus.publish('stern.dialog.ready', {
        dialogType,
        timestamp: Date.now(),
        mountId, // Add mountId to track which mount sent this
      });

      console.log(`[LOADING_LAYOUT] ✅ Ready signal published - mountId: ${mountId}`);
    }, 50);

    return () => {
      console.log(`[LOADING_LAYOUT] ❌ Cleanup START - mountId: ${mountId}`);

      // Cancel ready signal timeout if component unmounts before it fires
      if (readySignalTimeoutId) {
        console.log(`[LOADING_LAYOUT] Canceling ready signal timeout - mountId: ${mountId}`);
        clearTimeout(readySignalTimeoutId);
        readySignalTimeoutId = null;
      }

      // Mark as unmounted but DON'T unsubscribe immediately
      // This prevents race conditions with React Strict Mode
      isMounted = false;
      console.log(`[LOADING_LAYOUT] isMounted set to false - mountId: ${mountId}`);

      // Only unsubscribe if this is still the active subscription
      // This prevents React Strict Mode double-mounting from removing the active subscription
      const isActiveSubscription = subscriptionRef.current?.handler === handleRequest && subscriptionRef.current?.subscribed;
      console.log(`[LOADING_LAYOUT] Is active subscription? ${isActiveSubscription} - mountId: ${mountId}`);

      if (isActiveSubscription) {
        console.log(`[LOADING_LAYOUT] Scheduling unsubscribe (100ms delay) - mountId: ${mountId}`);

        // Delay unsubscribe to allow any in-flight messages to be processed
        setTimeout(() => {
          // Double-check this is still the active subscription before unsubscribing
          const stillActive = subscriptionRef.current?.handler === handleRequest && subscriptionRef.current?.subscribed;
          console.log(`[LOADING_LAYOUT] Delayed unsubscribe check - stillActive: ${stillActive}, mountId: ${mountId}`);

          if (stillActive) {
            console.log(`[LOADING_LAYOUT] ❌ UNSUBSCRIBING from ${requestTopic} - mountId: ${mountId}`);
            fin.InterApplicationBus.unsubscribe(
              { uuid: '*' },
              requestTopic,
              handleRequest
            );
            if (subscriptionRef.current) {
              subscriptionRef.current.subscribed = false;
            }
            console.log(`[LOADING_LAYOUT] Unsubscribe complete - mountId: ${mountId}`);
          } else {
            console.log(`[LOADING_LAYOUT] ⏭️ Skipping unsubscribe - NEW subscription active - mountId: ${mountId}`);
          }
        }, 100);
      } else {
        console.log(`[LOADING_LAYOUT] ⏭️ Skipping unsubscribe - NOT active subscription - mountId: ${mountId}`);
      }

      console.log(`[LOADING_LAYOUT] Cleanup END - mountId: ${mountId}`);
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
