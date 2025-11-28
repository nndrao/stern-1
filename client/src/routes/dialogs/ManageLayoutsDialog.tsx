/**
 * ManageLayoutsDialog Route
 *
 * OpenFin window route for managing SimpleBlotter layouts.
 * Uses DialogHost infrastructure for IAB communication.
 */

import React, { useEffect } from 'react';
import { DialogHost, useOpenfinTheme } from '@stern/openfin-platform';
import { LayoutManageDialogContent, LayoutInfo } from '@/components/widgets/blotters/simpleblotter/LayoutManageDialogContent';
import { DIALOG_TYPES } from '@/config/dialogConfig';

/**
 * Props passed from parent window via IAB
 */
export interface ManageLayoutsDialogProps {
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
 * Hosted in OpenFin window, communicates with parent via IAB
 */
export const ManageLayoutsDialog: React.FC = () => {
  // Listen to OpenFin dock theme changes
  useOpenfinTheme();

  // Set the window title using document.title
  useEffect(() => {
    document.title = 'Layout Management';
  }, []);

  return (
    <DialogHost<ManageLayoutsDialogProps>
      dialogType={DIALOG_TYPES.MANAGE_LAYOUTS}
    >
      {(props, sendAction) => {
        if (!props) {
          return (
            <div className="flex items-center justify-center h-screen">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          );
        }

        return (
          <div className="p-6">
            <LayoutManageDialogContent
              layouts={props.layouts}
              defaultLayoutId={props.defaultLayoutId}
              blotterConfigId={props.blotterConfigId}
              componentType={props.componentType}
              componentSubType={props.componentSubType}
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
      }}
    </DialogHost>
  );
};

export default ManageLayoutsDialog;
