/**
 * ManageLayoutsDialog Route
 *
 * OpenFin window route for managing SimpleBlotter layouts.
 * Uses LayoutManageDialogContent for consistent UI across inline and OpenFin contexts.
 */

import React, { useEffect, useState } from 'react';
import { useOpenfinTheme } from '@stern/openfin-platform';
import { LayoutManageDialogContent } from '@/components/widgets/blotters/simpleblotter/LayoutManageDialogContent';
import type { LayoutInfo, BlotterInfo } from '@/components/widgets/blotters/simpleblotter/layout-dialogs';
import { DIALOG_TYPES } from '@/config/dialogConfig';

/**
 * Data received from parent window via IAB
 * Note: Parent sends flat fields, we transform to blotterInfo
 */
interface RawDialogData {
  /** List of available layouts */
  layouts: LayoutInfo[];
  /** ID of the default layout */
  defaultLayoutId?: string;
  /** Currently selected layout ID */
  selectedLayoutId?: string;
  /** Blotter config ID (flat field from parent) */
  blotterConfigId?: string;
  /** Component type (flat field from parent) */
  componentType?: string;
  /** Component subtype (flat field from parent) */
  componentSubType?: string;
  /** Or nested blotterInfo (if sent that way) */
  blotterInfo?: BlotterInfo;
}

/**
 * Normalized data structure used by the component
 */
export interface ManageLayoutsDialogData {
  layouts: LayoutInfo[];
  defaultLayoutId?: string;
  selectedLayoutId?: string;
  blotterInfo?: BlotterInfo;
}

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

      const rawData: RawDialogData = message.data;

      // Normalize: transform flat fields to blotterInfo if needed
      const normalizedData: ManageLayoutsDialogData = {
        layouts: rawData.layouts || [],
        defaultLayoutId: rawData.defaultLayoutId,
        selectedLayoutId: rawData.selectedLayoutId,
        blotterInfo: rawData.blotterInfo || (rawData.blotterConfigId ? {
          configId: rawData.blotterConfigId,
          componentType: rawData.componentType || 'SimpleBlotter',
          componentSubType: rawData.componentSubType,
        } : undefined),
      };

      console.log('[ManageLayoutsDialog] Normalized data:', normalizedData);
      setData(normalizedData);
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
  }, []);

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

  // Close the dialog window
  const handleClose = () => {
    sendAction('close');
    if (window.fin) {
      fin.Window.getCurrentSync().close();
    }
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
      <h1 className="text-lg font-semibold mb-1">Manage Layouts</h1>
      <p className="text-xs text-muted-foreground mb-4">
        View, edit, and organize your saved layouts.
      </p>

      <LayoutManageDialogContent
        layouts={data.layouts}
        defaultLayoutId={data.defaultLayoutId}
        selectedLayoutId={data.selectedLayoutId}
        blotterInfo={data.blotterInfo}
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
        onSaveComponentSubType={(newSubType) => {
          sendAction('updateSubType', { newSubType });
        }}
        onSelect={(layoutId) => {
          sendAction('select', { layoutId });
          handleClose();
        }}
        onClose={handleClose}
      />
    </div>
  );
};

export default ManageLayoutsDialog;
