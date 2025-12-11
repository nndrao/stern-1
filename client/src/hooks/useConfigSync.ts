/**
 * useConfigSync Hook
 *
 * React hook for interacting with ConfigSyncWorker via MessagePort.
 * Provides type-safe methods for configuration synchronization across windows.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  ConfigSyncMessage,
  ConfigSyncMessageType,
  ToolbarConfig,
  createMessage,
  ToolbarConfigUpdatedPayload,
  ToolbarConfigResponsePayload,
  ErrorPayload,
} from '@/types/configSync';
import { logger } from '@/utils/logger';

/**
 * Hook configuration options
 */
export interface UseConfigSyncOptions {
  viewId: string;
  blotterId?: string;
  windowName?: string;
  onToolbarConfigUpdated?: (config: ToolbarConfig) => void;
  onError?: (error: ErrorPayload) => void;
}

/**
 * Hook return value
 */
export interface UseConfigSyncReturn {
  isConnected: boolean;
  updateToolbarConfig: (config: ToolbarConfig, targetViewId?: string) => void;
  getToolbarConfig: (targetViewId?: string) => Promise<ToolbarConfig | null>;
}

/**
 * useConfigSync - Connect to ConfigSyncWorker
 */
export function useConfigSync(options: UseConfigSyncOptions): UseConfigSyncReturn {
  const {
    viewId,
    blotterId,
    windowName,
    onToolbarConfigUpdated,
    onError,
  } = options;

  const workerRef = useRef<SharedWorker | null>(null);
  const portRef = useRef<MessagePort | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const pendingRequestsRef = useRef<Map<string, (value: any) => void>>(new Map());

  /**
   * Store callbacks in refs to avoid recreating handleMessage
   */
  const onToolbarConfigUpdatedRef = useRef(onToolbarConfigUpdated);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onToolbarConfigUpdatedRef.current = onToolbarConfigUpdated;
    onErrorRef.current = onError;
  }, [onToolbarConfigUpdated, onError]);

  /**
   * Handle incoming messages from worker
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    const message = event.data as ConfigSyncMessage;

    logger.info(`[useConfigSync] Received message: ${message.type}`, {
      viewId,
      messageType: message.type,
    }, 'useConfigSync');

    switch (message.type) {
      case ConfigSyncMessageType.TOOLBAR_CONFIG_UPDATED: {
        const payload = message.payload as ToolbarConfigUpdatedPayload;
        if (payload.viewId === viewId) {
          logger.info('[useConfigSync] Toolbar config updated', {
            viewId,
            buttonsCount: payload.config.customButtons?.length || 0,
          }, 'useConfigSync');
          onToolbarConfigUpdatedRef.current?.(payload.config);
        }
        break;
      }

      case ConfigSyncMessageType.TOOLBAR_CONFIG_RESPONSE: {
        const payload = message.payload as ToolbarConfigResponsePayload;
        // Resolve pending request for any viewId (not just this hook's viewId)
        const messageId = `get-config-${payload.viewId}`;
        const resolve = pendingRequestsRef.current.get(messageId);
        if (resolve) {
          resolve(payload.config);
          pendingRequestsRef.current.delete(messageId);
        }
        break;
      }

      case ConfigSyncMessageType.ERROR: {
        const payload = message.payload as ErrorPayload;
        logger.error('[useConfigSync] Worker error', payload, 'useConfigSync');
        onErrorRef.current?.(payload);
        break;
      }

      default:
        logger.warn(`[useConfigSync] Unknown message type: ${message.type}`, undefined, 'useConfigSync');
    }
  }, [viewId]);

  /**
   * Initialize SharedWorker connection
   */
  useEffect(() => {
    try {
      logger.info('[useConfigSync] Initializing SharedWorker connection', { viewId }, 'useConfigSync');

      // Create SharedWorker
      const worker = new SharedWorker(
        new URL('../workers/ConfigSyncWorker.ts', import.meta.url),
        { type: 'module', name: 'ConfigSyncWorker' }
      );

      workerRef.current = worker;
      portRef.current = worker.port;

      // Set up message handler
      worker.port.onmessage = handleMessage;

      // Handle errors
      worker.port.onmessageerror = (event) => {
        logger.error('[useConfigSync] Port message error', event, 'useConfigSync');
        onErrorRef.current?.({
          code: 'PORT_MESSAGE_ERROR',
          message: 'Failed to deserialize message from worker',
          details: event,
        });
      };

      worker.onerror = (event) => {
        logger.error('[useConfigSync] Worker error', event, 'useConfigSync');
        setIsConnected(false);
        onErrorRef.current?.({
          code: 'WORKER_ERROR',
          message: event.message || 'SharedWorker error',
          details: event,
        });
      };

      // Start the port
      worker.port.start();

      // Register this client
      const registrationMessage = createMessage.register({
        viewId,
        blotterId,
        windowName,
        timestamp: Date.now(),
      });

      worker.port.postMessage(registrationMessage);
      setIsConnected(true);

      logger.info('[useConfigSync] SharedWorker connection established', { viewId }, 'useConfigSync');

      // Cleanup on unmount
      return () => {
        logger.info('[useConfigSync] Cleaning up SharedWorker connection', { viewId }, 'useConfigSync');

        if (portRef.current) {
          // Unregister this client
          const unregisterMessage = createMessage.unregister({ viewId });
          portRef.current.postMessage(unregisterMessage);
        }

        // Close port
        worker.port.close();
        workerRef.current = null;
        portRef.current = null;
        setIsConnected(false);
      };
    } catch (error) {
      logger.error('[useConfigSync] Failed to initialize SharedWorker', error, 'useConfigSync');
      setIsConnected(false);
      onErrorRef.current?.({
        code: 'INIT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to initialize SharedWorker',
        details: error,
      });
    }
  }, [viewId, blotterId, windowName, handleMessage]);

  /**
   * Update toolbar configuration
   * @param config - The toolbar configuration to update
   * @param targetViewId - Optional target viewId (defaults to this hook's viewId)
   */
  const updateToolbarConfig = useCallback((config: ToolbarConfig, targetViewId?: string) => {
    if (!portRef.current) {
      logger.warn('[useConfigSync] Cannot update config: not connected', undefined, 'useConfigSync');
      return;
    }

    const targetId = targetViewId || viewId;

    logger.info('[useConfigSync] Updating toolbar config', {
      viewId,
      targetViewId: targetId,
      buttonsCount: config.customButtons?.length || 0,
    }, 'useConfigSync');

    const message = createMessage.updateToolbarConfig({
      viewId: targetId,
      config,
    });

    portRef.current.postMessage(message);
  }, [viewId]);

  /**
   * Get toolbar configuration (async)
   * @param targetViewId - Optional target viewId (defaults to this hook's viewId)
   */
  const getToolbarConfig = useCallback((targetViewId?: string): Promise<ToolbarConfig | null> => {
    return new Promise((resolve, reject) => {
      if (!portRef.current) {
        logger.warn('[useConfigSync] Cannot get config: not connected', undefined, 'useConfigSync');
        reject(new Error('Not connected to ConfigSyncWorker'));
        return;
      }

      const targetId = targetViewId || viewId;

      logger.info('[useConfigSync] Requesting toolbar config', {
        viewId,
        targetViewId: targetId
      }, 'useConfigSync');

      // Store resolver for when response arrives
      const messageId = `get-config-${targetId}`;
      pendingRequestsRef.current.set(messageId, resolve);

      // Send request
      const message = createMessage.getToolbarConfig({ viewId: targetId });
      portRef.current.postMessage(message);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (pendingRequestsRef.current.has(messageId)) {
          pendingRequestsRef.current.delete(messageId);
          reject(new Error('Timeout waiting for config response'));
        }
      }, 5000);
    });
  }, [viewId]);

  return {
    isConnected,
    updateToolbarConfig,
    getToolbarConfig,
  };
}
