/**
 * STOMP Data Provider SharedWorker
 *
 * Minimal SharedWorker that manages SharedStompProvider instances.
 * Each unique providerId gets one shared connection.
 *
 * Message Protocol:
 * - subscribe: Connect to a provider (creates if doesn't exist)
 * - unsubscribe: Disconnect from a provider
 * - getSnapshot: Request cached snapshot (for late joiners)
 * - getStatus: Get provider statistics
 */

/// <reference lib="webworker" />

import { SharedStompProvider, StompProviderConfig, ProviderMessage } from './SharedStompProvider';

const WORKER_VERSION = '3.0.0';

// Provider instances: providerId -> provider
const providers = new Map<string, SharedStompProvider>();

// Port tracking: portId -> { port, providerIds }
const ports = new Map<string, { port: MessagePort; providerIds: Set<string> }>();

// ============================================================================
// Message Types
// ============================================================================

interface WorkerRequest {
  type: 'subscribe' | 'unsubscribe' | 'getSnapshot' | 'getStatus';
  providerId: string;
  portId: string;
  requestId?: string;
  config?: {
    providerId: string;
    name: string;
    config: StompProviderConfig;
  };
}

interface WorkerResponse {
  type: 'subscribed' | 'unsubscribed' | 'snapshot' | 'snapshot-complete' | 'status' | 'error';
  providerId: string;
  requestId?: string;
  data?: any[];
  statistics?: any;
  error?: string;
  timestamp: number;
}

// ============================================================================
// Message Handlers
// ============================================================================

async function handleSubscribe(port: MessagePort, request: WorkerRequest): Promise<void> {
  const { providerId, portId, config, requestId } = request;

  if (!config?.config) {
    sendError(port, providerId, requestId, 'Configuration required');
    return;
  }

  log(`Subscribe: ${portId} -> ${providerId}`);

  try {
    // Get or create provider
    let provider = providers.get(providerId);

    if (!provider) {
      log(`Creating new provider: ${providerId}`);
      provider = new SharedStompProvider(providerId, config.config);
      providers.set(providerId, provider);

      // Start connection
      await provider.start();
    }

    // Track port -> provider mapping
    let portInfo = ports.get(portId);
    if (!portInfo) {
      portInfo = { port, providerIds: new Set() };
      ports.set(portId, portInfo);
    }
    portInfo.providerIds.add(providerId);

    // Add subscriber to provider
    provider.addSubscriber(portId, port);

    // Send confirmation
    sendResponse(port, {
      type: 'subscribed',
      providerId,
      requestId,
      statistics: provider.getStatistics(),
      timestamp: Date.now(),
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Subscribe failed';
    log(`Subscribe error: ${message}`);
    sendError(port, providerId, requestId, message);
  }
}

function handleUnsubscribe(port: MessagePort, request: WorkerRequest): void {
  const { providerId, portId, requestId } = request;

  log(`Unsubscribe: ${portId} -> ${providerId}`);

  const provider = providers.get(providerId);
  if (provider) {
    provider.removeSubscriber(portId);

    // Stop provider if no more subscribers
    if (provider.getSubscriberCount() === 0) {
      log(`No subscribers left, stopping provider: ${providerId}`);
      provider.stop();
      providers.delete(providerId);
    }
  }

  // Update port tracking
  const portInfo = ports.get(portId);
  if (portInfo) {
    portInfo.providerIds.delete(providerId);
    if (portInfo.providerIds.size === 0) {
      ports.delete(portId);
    }
  }

  sendResponse(port, {
    type: 'unsubscribed',
    providerId,
    requestId,
    timestamp: Date.now(),
  });
}

function handleGetSnapshot(port: MessagePort, request: WorkerRequest): void {
  const { providerId, portId, requestId } = request;

  log(`GetSnapshot: ${portId} -> ${providerId}`);

  const provider = providers.get(providerId);

  if (!provider) {
    sendError(port, providerId, requestId, 'Provider not found. Subscribe first.');
    return;
  }

  // Get snapshot for this subscriber (handles late joiner logic)
  const data = provider.getSnapshotForSubscriber(portId);

  if (data === null) {
    // Subscriber already has data or will receive live stream
    sendResponse(port, {
      type: 'snapshot',
      providerId,
      requestId,
      data: [],
      statistics: provider.getStatistics(),
      timestamp: Date.now(),
    });
  } else {
    // Send cached snapshot to late joiner
    sendResponse(port, {
      type: 'snapshot',
      providerId,
      requestId,
      data,
      statistics: provider.getStatistics(),
      timestamp: Date.now(),
    });
  }

  // Always send snapshot-complete after snapshot response
  sendResponse(port, {
    type: 'snapshot-complete',
    providerId,
    requestId: requestId ? `${requestId}-complete` : undefined,
    timestamp: Date.now(),
  });
}

function handleGetStatus(port: MessagePort, request: WorkerRequest): void {
  const { providerId, requestId } = request;

  const provider = providers.get(providerId);

  if (!provider) {
    sendError(port, providerId, requestId, 'Provider not found');
    return;
  }

  sendResponse(port, {
    type: 'status',
    providerId,
    requestId,
    statistics: provider.getStatistics(),
    timestamp: Date.now(),
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function sendResponse(port: MessagePort, response: WorkerResponse): void {
  try {
    port.postMessage(response);
  } catch (error) {
    log('Error sending response', error);
  }
}

function sendError(port: MessagePort, providerId: string, requestId: string | undefined, message: string): void {
  sendResponse(port, {
    type: 'error',
    providerId,
    requestId,
    error: message,
    timestamp: Date.now(),
  });
}

function log(message: string, data?: any): void {
  const prefix = '[StompWorker]';
  if (data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

// ============================================================================
// SharedWorker Entry Point
// ============================================================================

(self as any).onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  let connectionPortId: string | undefined;

  log(`New connection (version: ${WORKER_VERSION})`);

  port.addEventListener('message', async (messageEvent: MessageEvent<WorkerRequest>) => {
    const request = messageEvent.data;

    // Use client-provided portId or assign from first request
    if (!connectionPortId && request.portId) {
      connectionPortId = request.portId;
    }

    // Ensure portId is set
    if (!request.portId && connectionPortId) {
      request.portId = connectionPortId;
    }

    if (!request.portId) {
      log('Error: No portId provided');
      sendError(port, request.providerId, request.requestId, 'portId required');
      return;
    }

    // Route to handler
    switch (request.type) {
      case 'subscribe':
        await handleSubscribe(port, request);
        break;
      case 'unsubscribe':
        handleUnsubscribe(port, request);
        break;
      case 'getSnapshot':
        handleGetSnapshot(port, request);
        break;
      case 'getStatus':
        handleGetStatus(port, request);
        break;
      default:
        sendError(port, request.providerId, request.requestId, `Unknown type: ${request.type}`);
    }
  });

  port.addEventListener('messageerror', (error) => {
    log('Message error', error);
  });

  port.start();
};

log(`SharedWorker started (version: ${WORKER_VERSION})`);
