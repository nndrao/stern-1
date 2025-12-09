/**
 * ConfigSyncWorker - SharedWorker for Configuration Synchronization
 *
 * Manages configuration synchronization across multiple windows/views using MessagePort.
 * Maintains in-memory cache and routes messages to specific clients.
 */

import {
  ConfigSyncMessage,
  ConfigSyncMessageType,
  ClientRegistration,
  ToolbarConfig,
  createMessage,
  RegisterPayload,
  UnregisterPayload,
  UpdateToolbarConfigPayload,
  GetToolbarConfigPayload,
} from '../types/configSync';

/**
 * Connected client information
 */
interface ConnectedClient {
  port: MessagePort;
  registration: ClientRegistration;
}

/**
 * ConfigSyncWorker State
 */
class ConfigSyncWorkerState {
  // Map of viewId -> MessagePort
  private clients: Map<string, ConnectedClient> = new Map();

  // Configuration cache: viewId -> ToolbarConfig
  private toolbarConfigs: Map<string, ToolbarConfig> = new Map();

  /**
   * Register a new client
   */
  registerClient(port: MessagePort, registration: RegisterPayload): void {
    const { viewId } = registration;

    console.log(`[ConfigSyncWorker] Registering client: ${viewId}`, registration);

    // Store client connection
    this.clients.set(viewId, {
      port,
      registration,
    });

    console.log(`[ConfigSyncWorker] Total clients: ${this.clients.size}`);
  }

  /**
   * Unregister a client
   */
  unregisterClient(viewId: string): void {
    console.log(`[ConfigSyncWorker] Unregistering client: ${viewId}`);
    this.clients.delete(viewId);
    console.log(`[ConfigSyncWorker] Total clients: ${this.clients.size}`);
  }

  /**
   * Update toolbar configuration for a specific view
   */
  updateToolbarConfig(viewId: string, config: ToolbarConfig): void {
    console.log(`[ConfigSyncWorker] Updating toolbar config for: ${viewId}`, {
      buttonsCount: config.customButtons?.length || 0,
    });

    // Update cache
    this.toolbarConfigs.set(viewId, config);

    // Send update to the specific client (if connected)
    const client = this.clients.get(viewId);
    if (client) {
      const message = createMessage.toolbarConfigUpdated({
        viewId,
        config,
        source: 'worker',
      });

      console.log(`[ConfigSyncWorker] Sending config update to client: ${viewId}`);
      client.port.postMessage(message);
    } else {
      console.warn(`[ConfigSyncWorker] Client ${viewId} not connected, config cached only`);
    }
  }

  /**
   * Get toolbar configuration for a specific view
   */
  getToolbarConfig(viewId: string): ToolbarConfig | null {
    const config = this.toolbarConfigs.get(viewId) || null;
    console.log(`[ConfigSyncWorker] Get toolbar config for: ${viewId}`, {
      found: !!config,
      buttonsCount: config?.customButtons?.length || 0,
    });
    return config;
  }

  /**
   * Send message to a specific client
   */
  sendToClient(viewId: string, message: ConfigSyncMessage): void {
    const client = this.clients.get(viewId);
    if (client) {
      client.port.postMessage(message);
    } else {
      console.warn(`[ConfigSyncWorker] Cannot send to ${viewId}: client not found`);
    }
  }

  /**
   * Cleanup on port disconnect
   */
  handlePortDisconnect(port: MessagePort): void {
    // Find and remove the client with this port
    for (const [viewId, client] of this.clients.entries()) {
      if (client.port === port) {
        console.log(`[ConfigSyncWorker] Port disconnected for client: ${viewId}`);
        this.clients.delete(viewId);
        break;
      }
    }
  }
}

// Worker state
const state = new ConfigSyncWorkerState();

/**
 * Handle incoming messages from clients
 */
function handleMessage(port: MessagePort, message: ConfigSyncMessage): void {
  console.log(`[ConfigSyncWorker] Received message:`, message.type);

  try {
    switch (message.type) {
      case ConfigSyncMessageType.REGISTER: {
        const payload = message.payload as RegisterPayload;
        state.registerClient(port, payload);
        break;
      }

      case ConfigSyncMessageType.UNREGISTER: {
        const payload = message.payload as UnregisterPayload;
        state.unregisterClient(payload.viewId);
        break;
      }

      case ConfigSyncMessageType.UPDATE_TOOLBAR_CONFIG: {
        const payload = message.payload as UpdateToolbarConfigPayload;
        state.updateToolbarConfig(payload.viewId, payload.config);
        break;
      }

      case ConfigSyncMessageType.GET_TOOLBAR_CONFIG: {
        const payload = message.payload as GetToolbarConfigPayload;
        const config = state.getToolbarConfig(payload.viewId);
        const response = createMessage.toolbarConfigResponse({
          viewId: payload.viewId,
          config,
        });
        port.postMessage(response);
        break;
      }

      default:
        console.warn(`[ConfigSyncWorker] Unknown message type: ${message.type}`);
        const errorMsg = createMessage.error({
          code: 'UNKNOWN_MESSAGE_TYPE',
          message: `Unknown message type: ${message.type}`,
        });
        port.postMessage(errorMsg);
    }
  } catch (error) {
    console.error(`[ConfigSyncWorker] Error handling message:`, error);
    const errorMsg = createMessage.error({
      code: 'MESSAGE_HANDLER_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    });
    port.postMessage(errorMsg);
  }
}

/**
 * SharedWorker connection handler
 */
const ctx = self as unknown as SharedWorkerGlobalScope;

ctx.onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  console.log('[ConfigSyncWorker] New client connected');

  // Listen for messages from this client
  port.onmessage = (messageEvent: MessageEvent) => {
    const message = messageEvent.data as ConfigSyncMessage;
    handleMessage(port, message);
  };

  // Handle port errors
  port.onmessageerror = (errorEvent) => {
    console.error('[ConfigSyncWorker] Message error on port:', errorEvent);
  };

  // Start the port
  port.start();

  console.log('[ConfigSyncWorker] Client port started');
};

console.log('[ConfigSyncWorker] SharedWorker initialized');
