/**
 * Data Provider SharedWorker
 *
 * SharedWorker entry point for managing data provider engines.
 * Handles message routing between adapters and engines.
 * Provides single connection per provider shared across all grid instances.
 */

/// <reference lib="webworker" />

import { EngineRegistry } from './engine/EngineRegistry';
import { BroadcastManager } from './engine/BroadcastManager';
import { WorkerRequest, WorkerResponse } from './engine/types';

const WORKER_VERSION = 'v2.1-batch-cache';
console.log(`[SharedWorker] Data provider SharedWorker initializing... VERSION: ${WORKER_VERSION}`);

// Global instances
const broadcastManager = new BroadcastManager();
const engineRegistry = new EngineRegistry(broadcastManager);

// Port tracking
const ports = new Map<string, MessagePort>();
let portCounter = 0;

/**
 * Generate unique port ID
 */
function generatePortId(): string {
  return `port-${Date.now()}-${++portCounter}`;
}

/**
 * Send response to specific port
 */
function sendToPort(port: MessagePort, response: WorkerResponse): void {
  try {
    port.postMessage(response);
  } catch (error) {
    console.error('[SharedWorker] Error sending to port:', error);
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(port: MessagePort, request: WorkerRequest): Promise<void> {
  const { type, providerId, requestId } = request;

  try {
    switch (type) {
      case 'subscribe':
        await handleSubscribe(port, request);
        break;

      case 'unsubscribe':
        handleUnsubscribe(port, request);
        break;

      case 'getSnapshot':
        await handleGetSnapshot(port, request);
        break;

      case 'getStatus':
        handleGetStatus(port, request);
        break;

      default:
        sendToPort(port, {
          type: 'error',
          providerId,
          requestId,
          error: `Unknown request type: ${type}`,
          timestamp: Date.now()
        });
    }
  } catch (error) {
    console.error('[SharedWorker] Error handling message:', error);
    sendToPort(port, {
      type: 'error',
      providerId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now()
    });
  }
}

/**
 * Handle subscribe request
 */
async function handleSubscribe(port: MessagePort, request: WorkerRequest): Promise<void> {
  const { providerId, config, portId, requestId } = request;

  if (!portId) {
    sendToPort(port, {
      type: 'error',
      providerId,
      requestId,
      error: 'Port ID is required',
      timestamp: Date.now()
    });
    return;
  }

  if (!config) {
    sendToPort(port, {
      type: 'error',
      providerId,
      requestId,
      error: 'Configuration is required for new provider',
      timestamp: Date.now()
    });
    return;
  }

  console.log(`[SharedWorker] Subscribe request from ${portId} for provider ${providerId}`);

  try {
    // Get or create engine
    const engine = await engineRegistry.getOrCreate(providerId, config);

    // Register port with broadcast manager
    broadcastManager.addSubscriber(providerId, portId, port);

    // Send subscription confirmation
    sendToPort(port, {
      type: 'subscribed',
      providerId,
      requestId,
      statistics: engine.getStatistics(),
      timestamp: Date.now()
    });

    // Note: Following AGV3 pattern, we DON'T automatically send cached data during subscribe
    // Instead, the client will explicitly call getSnapshot after receiving 'subscribed' confirmation
    // This gives better control and avoids race conditions
    const stats = engine.getStatistics();
    console.log(`[SharedWorker] Subscriber added. Engine mode: ${stats.mode}, Rows: ${stats.snapshotRowsReceived}`);

  } catch (error) {
    console.error('[SharedWorker] Subscribe error:', error);
    sendToPort(port, {
      type: 'error',
      providerId,
      requestId,
      error: error instanceof Error ? error.message : 'Subscribe failed',
      timestamp: Date.now()
    });
  }
}

/**
 * Handle unsubscribe request
 */
function handleUnsubscribe(port: MessagePort, request: WorkerRequest): void {
  const { providerId, portId, requestId } = request;

  if (!portId) {
    sendToPort(port, {
      type: 'error',
      providerId,
      requestId,
      error: 'Port ID is required',
      timestamp: Date.now()
    });
    return;
  }

  console.log(`[SharedWorker] Unsubscribe request from ${portId} for provider ${providerId}`);

  // Remove subscriber
  broadcastManager.removeSubscriber(providerId, portId);

  // Stop engine if no more subscribers
  if (broadcastManager.getSubscriberCount(providerId) === 0) {
    console.log(`[SharedWorker] No more subscribers for ${providerId}, stopping engine`);
    engineRegistry.stop(providerId).catch(err =>
      console.error('[SharedWorker] Error stopping engine:', err)
    );
  }

  // Send unsubscribe confirmation
  sendToPort(port, {
    type: 'unsubscribed',
    providerId,
    requestId,
    timestamp: Date.now()
  });
}

/**
 * Handle get snapshot request
 * Following AGV3 pattern: send cached snapshot data to late subscribers
 */
async function handleGetSnapshot(port: MessagePort, request: WorkerRequest): Promise<void> {
  const { providerId, requestId, portId } = request;

  console.log(`[SharedWorker] getSnapshot request from ${portId} for provider ${providerId}`);

  const engine = engineRegistry.get(providerId);

  if (!engine) {
    console.log(`[SharedWorker] Engine not found for ${providerId}`);
    sendToPort(port, {
      type: 'error',
      providerId,
      requestId,
      error: 'Provider not found. Subscribe first.',
      timestamp: Date.now()
    });
    return;
  }

  const snapshot = engine.getSnapshotCache();
  const cacheSize = engine.getCacheSize();
  const keyColumn = engine.getKeyColumn();
  const stats = engine.getStatistics();

  console.log(`[SharedWorker] getSnapshot: cacheSize=${cacheSize}, snapshotLength=${snapshot.length}, mode=${stats.mode}, rowsReceived=${stats.snapshotRowsReceived}, keyColumn=${keyColumn}`);

  // Add cache diagnostics to statistics for client-side logging
  const statsWithDiagnostics = {
    ...stats,
    _cacheDiagnostics: {
      cacheSize,
      snapshotLength: snapshot.length,
      rowsReceived: stats.snapshotRowsReceived,
      keyColumn,  // Show which key column is configured
      message: cacheSize === 0 && stats.snapshotRowsReceived > 0
        ? `WARNING: Cache is empty despite receiving ${stats.snapshotRowsReceived} rows! Key column '${keyColumn}' not found in row data.`
        : `Cache OK: ${cacheSize} rows cached with key column '${keyColumn}'`
    }
  };

  // Send entire snapshot at once (AGV3 pattern)
  // The client will handle it in one batch
  sendToPort(port, {
    type: 'snapshot',
    providerId,
    requestId,
    data: snapshot,
    statistics: statsWithDiagnostics,
    timestamp: Date.now()
  });

  console.log(`[SharedWorker] Cached snapshot sent to ${portId}: ${snapshot.length} rows`);
}

/**
 * Handle get status request
 */
function handleGetStatus(port: MessagePort, request: WorkerRequest): void {
  const { providerId, requestId } = request;

  const engine = engineRegistry.get(providerId);

  if (!engine) {
    sendToPort(port, {
      type: 'error',
      providerId,
      requestId,
      error: 'Provider not found',
      timestamp: Date.now()
    });
    return;
  }

  sendToPort(port, {
    type: 'status',
    providerId,
    requestId,
    statistics: engine.getStatistics(),
    timestamp: Date.now()
  });
}

/**
 * SharedWorker connection handler
 */
(self as any).onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  let connectionPortId: string | undefined;

  console.log(`[SharedWorker] New connection (Worker version: ${WORKER_VERSION})`);

  port.addEventListener('message', async (messageEvent: MessageEvent<WorkerRequest>) => {
    // Use portId from request if provided (client-generated), otherwise generate one
    // This allows the client to provide its own portId for consistent tracking
    const request = messageEvent.data;

    if (!request.portId) {
      // No portId in request, generate one
      if (!connectionPortId) {
        connectionPortId = generatePortId();
        console.log(`[SharedWorker] Generated portId for connection: ${connectionPortId}`);
      }
      request.portId = connectionPortId;
    } else {
      // Use client-provided portId
      if (!connectionPortId) {
        connectionPortId = request.portId;
        console.log(`[SharedWorker] Using client-provided portId: ${connectionPortId}`);
      }
    }

    // Track port by its ID
    if (!ports.has(connectionPortId)) {
      console.log(`[SharedWorker] Registering port: ${connectionPortId}`);
      ports.set(connectionPortId, port);
    }

    await handleMessage(port, request);
  });

  port.addEventListener('messageerror', (error) => {
    console.error(`[SharedWorker] Message error on port ${connectionPortId}:`, error);
  });

  // Handle port close
  port.addEventListener('close', () => {
    if (connectionPortId) {
      console.log(`[SharedWorker] Port closed: ${connectionPortId}`);
      ports.delete(connectionPortId);
      // Remove port from all subscriptions
      broadcastManager.removePortFromAll(connectionPortId);
    }
  });

  port.start();
};

// Log worker startup
console.log('[SharedWorker] Data Provider SharedWorker started');
console.log('[SharedWorker] Active engines:', engineRegistry.getEngineCount());
console.log('[SharedWorker] Active providers:', engineRegistry.getActiveProviders());
