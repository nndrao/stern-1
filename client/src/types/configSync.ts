/**
 * ConfigSync Type Definitions
 *
 * Type-safe message contracts for SharedWorker-based configuration synchronization
 */

import { ToolbarButton } from '@/components/wizards/ToolbarCustomizationWizard';

/**
 * Message types for ConfigSync communication
 */
export enum ConfigSyncMessageType {
  // Client -> Worker
  REGISTER = 'REGISTER',
  UNREGISTER = 'UNREGISTER',
  UPDATE_TOOLBAR_CONFIG = 'UPDATE_TOOLBAR_CONFIG',
  GET_TOOLBAR_CONFIG = 'GET_TOOLBAR_CONFIG',

  // Worker -> Client
  TOOLBAR_CONFIG_UPDATED = 'TOOLBAR_CONFIG_UPDATED',
  TOOLBAR_CONFIG_RESPONSE = 'TOOLBAR_CONFIG_RESPONSE',
  ERROR = 'ERROR',
}

/**
 * Client registration information
 */
export interface ClientRegistration {
  viewId: string;
  blotterId?: string;
  windowName?: string;
  timestamp: number;
}

/**
 * Toolbar configuration payload
 */
export interface ToolbarConfig {
  customButtons: ToolbarButton[];
  additionalToolbars?: any[];
  toolbarStates?: Record<string, boolean>;
}

/**
 * Base message structure
 */
export interface ConfigSyncMessage<T = any> {
  type: ConfigSyncMessageType;
  payload: T;
  messageId?: string;
  timestamp: number;
}

/**
 * Registration message payload
 */
export interface RegisterPayload extends ClientRegistration {}

/**
 * Unregister message payload
 */
export interface UnregisterPayload {
  viewId: string;
}

/**
 * Update toolbar config message payload
 */
export interface UpdateToolbarConfigPayload {
  viewId: string;
  config: ToolbarConfig;
}

/**
 * Get toolbar config message payload
 */
export interface GetToolbarConfigPayload {
  viewId: string;
}

/**
 * Toolbar config updated event payload (broadcast to specific client)
 */
export interface ToolbarConfigUpdatedPayload {
  viewId: string;
  config: ToolbarConfig;
  source: 'worker' | 'peer';
}

/**
 * Toolbar config response payload
 */
export interface ToolbarConfigResponsePayload {
  viewId: string;
  config: ToolbarConfig | null;
}

/**
 * Error message payload
 */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: any;
}

/**
 * Type-safe message creators
 */
export const createMessage = {
  register: (payload: RegisterPayload): ConfigSyncMessage<RegisterPayload> => ({
    type: ConfigSyncMessageType.REGISTER,
    payload,
    timestamp: Date.now(),
  }),

  unregister: (payload: UnregisterPayload): ConfigSyncMessage<UnregisterPayload> => ({
    type: ConfigSyncMessageType.UNREGISTER,
    payload,
    timestamp: Date.now(),
  }),

  updateToolbarConfig: (payload: UpdateToolbarConfigPayload): ConfigSyncMessage<UpdateToolbarConfigPayload> => ({
    type: ConfigSyncMessageType.UPDATE_TOOLBAR_CONFIG,
    payload,
    timestamp: Date.now(),
  }),

  getToolbarConfig: (payload: GetToolbarConfigPayload): ConfigSyncMessage<GetToolbarConfigPayload> => ({
    type: ConfigSyncMessageType.GET_TOOLBAR_CONFIG,
    payload,
    timestamp: Date.now(),
  }),

  toolbarConfigUpdated: (payload: ToolbarConfigUpdatedPayload): ConfigSyncMessage<ToolbarConfigUpdatedPayload> => ({
    type: ConfigSyncMessageType.TOOLBAR_CONFIG_UPDATED,
    payload,
    timestamp: Date.now(),
  }),

  toolbarConfigResponse: (payload: ToolbarConfigResponsePayload): ConfigSyncMessage<ToolbarConfigResponsePayload> => ({
    type: ConfigSyncMessageType.TOOLBAR_CONFIG_RESPONSE,
    payload,
    timestamp: Date.now(),
  }),

  error: (payload: ErrorPayload): ConfigSyncMessage<ErrorPayload> => ({
    type: ConfigSyncMessageType.ERROR,
    payload,
    timestamp: Date.now(),
  }),
};
