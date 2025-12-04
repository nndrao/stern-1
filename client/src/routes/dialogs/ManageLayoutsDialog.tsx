/**
 * ManageLayoutsDialog Route
 *
 * OpenFin window route for managing SimpleBlotter layouts.
 * Dialog requests data from parent on mount - follows pull pattern instead of push.
 */

import React, { useEffect, useState } from 'react';
import { useOpenfinTheme } from '@stern/openfin-platform';
import { LayoutManageDialogContent, LayoutInfo } from '@/components/widgets/blotters/simpleblotter/LayoutManageDialogContent';
import { DIALOG_TYPES } from '@/config/dialogConfig';

/**
 * Data received from parent window via IAB
 */
export interface ManageLayoutsDialogData {
  /** List of available layouts */
  layouts: LayoutInfo[];
  /** ID of the default layout */
  defaultLayoutId?: string;
  /** Current blotter config ID */
  blotterConfigId: string;
  /** Component type from blotter config */
  componentType: string;
  /** Component subtype from blotter config */
  componentSubType?: string;
}

/**
 * Actions that can be sent back to parent
 */
export type ManageLayoutsAction =
  | { type: 'setDefault'; layoutId: string }
  | { type: 'delete'; layoutId: string }
  | { type: 'rename'; layoutId: string; newName: string }
  | { type: 'duplicate'; layoutId: string; newName: string }
  | { type: 'updateSubType'; newSubType: string }
  | { type: 'close' };

/**
 * ManageLayoutsDialog Component
 *
 * Hosted in OpenFin window, requests data from parent via IAB on mount
 */
export const ManageLayoutsDialog: React.FC = () => {
  const [data, setData] = useState<ManageLayoutsDialogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to OpenFin dock theme changes
  useOpenfinTheme();

  // Set the window title
  useEffect(() => {
    document.title = 'Layout Management';
  }, []);

  // Request data from parent on mount and listen for updates
  useEffect(() => {
    if (!window.fin) {
      console.error('[ManageLayoutsDialog] Not in OpenFin environment');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const requestTopic = `stern.dialog.${DIALOG_TYPES.MANAGE_LAYOUTS}.request`;
    const responseTopic = `stern.dialog.${DIALOG_TYPES.MANAGE_LAYOUTS}.response`;
    const actionTopic = `stern.dialog.${DIALOG_TYPES.MANAGE_LAYOUTS}.action`;

    console.log('[ManageLayoutsDialog] Setting up IAB communication');

    // Subscribe to response from parent (handles both initial data and updates)
    const handleResponse = (message: any) => {
      if (!isMounted) return;

      console.log('[ManageLayoutsDialog] Received data from parent:', message);
      setData(message.data);
      setIsLoading(false);
    };

    fin.InterApplicationBus.subscribe({ uuid: '*' }, responseTopic, handleResponse);
    console.log(`[ManageLayoutsDialog] Subscribed to ${responseTopic}`);

    // Request initial data from parent
    console.log('[ManageLayoutsDialog] Requesting initial data from parent');
    fin.InterApplicationBus.publish(requestTopic, {
      type: 'getData',
      timestamp: Date.now(),
    });

    // Cleanup
    return () => {
      isMounted = false;
      fin.InterApplicationBus.unsubscribe({ uuid: '*' }, responseTopic, handleResponse);
      console.log('[ManageLayoutsDialog] Unsubscribed from IAB');
    };
  }, []); // Empty dependencies - run once on mount, but handleResponse receives all updates

  // Send action to parent
  const sendAction = (action: string, payload?: any) => {
    if (!window.fin) return;

    const actionTopic = `stern.dialog.${DIALOG_TYPES.MANAGE_LAYOUTS}.action`;

    console.log('[ManageLayoutsDialog] Sending action to parent:', action, payload);
    fin.InterApplicationBus.publish(actionTopic, {
      type: 'action',
      action,
      payload,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-destructive">Failed to load layout data</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <LayoutManageDialogContent
        layouts={data.layouts}
        defaultLayoutId={data.defaultLayoutId}
        blotterConfigId={data.blotterConfigId}
        componentType={data.componentType}
        componentSubType={data.componentSubType}
        onSetDefault={(layoutId) => {
          sendAction('setDefault', { layoutId });
        }}
        onDelete={(layoutId) => {
          sendAction('delete', { layoutId });
        }}
        onRename={(layoutId, newName) => {
          sendAction('rename', { layoutId, newName });
        }}
        onDuplicate={(layoutId, newName) => {
          sendAction('duplicate', { layoutId, newName });
        }}
        onComponentSubTypeChange={(newSubType) => {
          sendAction('updateSubType', { newSubType });
        }}
        onClose={() => {
          sendAction('close');
        }}
      />
    </div>
  );
};

export default ManageLayoutsDialog;
