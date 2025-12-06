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

const WORKER_VERSION = 'v2.3-heartbeat';

// Configuration constants
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 60000;  // 60 seconds - port considered dead if no response

// Extract blotter type from worker name (e.g., 'data-provider-worker-positions' -> 'positions')
const workerName = (self as any).name || 'unknown';
const blotterType = workerName.replace('data-provider-worker-', '') || 'default';

console.log(`[SharedWorker:${blotterType}] Data provider SharedWorker initializing... VERSION: ${WORKER_VERSION}`);

// Global instances
const broadcastManager = new BroadcastManager();
const engineRegistry = new EngineRegistry(broadcastManager);

// Port tracking with heartbeat state
interface PortInfo {
  port: MessagePort;
  lastHeartbeat: number;
  isAlive: boolean;
}
const ports = new Map<string, PortInfo>();
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
  const { type, providerId, requestId, portId } = request;

  // Update heartbeat timestamp on any message (client is alive)
  if (portId && ports.has(portId)) {
    const portInfo = ports.get(portId)!;
    portInfo.lastHeartbeat = Date.now();
    portInfo.isAlive = true;
  }

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

      case 'heartbeat':
        handleHeartbeat(port, request);
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

  console.log(`[SharedWorker:${blotterType}] Subscribe request from ${portId} for provider ${providerId}`);

  try {
    // Get or create engine
    const engine = await engineRegistry.getOrCreate(providerId, config);

    // Register port with broadcast manager
    broadcastManager.addSubscriber(providerId, portId, port);

    // Register subscriber with engine for snapshot tracking
    // If snapshot is still streaming, this marks the subscriber as receiving live data
    engine.registerSubscriber(portId);

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
    console.log(`[SharedWorker:${blotterType}] Subscriber added. Engine mode: ${stats.mode}, Rows: ${stats.snapshotRowsReceived}`);

  } catch (error) {
    console.error(`[SharedWorker:${blotterType}] Subscribe error:`, error);
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

  console.log(`[SharedWorker:${blotterType}] Unsubscribe request from ${portId} for provider ${providerId}`);

  // Remove subscriber from broadcast manager
  broadcastManager.removeSubscriber(providerId, portId);

  // Unregister subscriber from engine tracking
  const engine = engineRegistry.get(providerId);
  if (engine) {
    engine.unregisterSubscriber(portId);
  }

  // Stop engine if no more subscribers
  if (broadcastManager.getSubscriberCount(providerId) === 0) {
    console.log(`[SharedWorker:${blotterType}] No more subscribers for ${providerId}, stopping engine`);
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

  console.log(`[SharedWorker:${blotterType}] getSnapshot request from ${portId} for provider ${providerId}`);

  const engine = engineRegistry.get(providerId);

  if (!engine) {
    console.log(`[SharedWorker:${blotterType}] Engine not found for ${providerId}`);
    sendToPort(port, {
      type: 'error',
      providerId,
      requestId,
      error: 'Provider not found. Subscribe first.',
      timestamp: Date.now()
    });
    return;
  }

  // CRITICAL FIX: Check if this subscriber should receive cached data
  // Prevents double-delivery when subscriber already received live snapshot
  if (!engine.shouldSubscriberReceiveCachedSnapshot(portId)) {
    console.log(`[SharedWorker:${blotterType}] Subscriber ${portId} already received live snapshot, skipping cached data delivery`);

    // Send empty snapshot response to satisfy the request
    sendToPort(port, {
      type: 'snapshot',
      providerId,
      requestId,
      data: [],  // Empty - already received live data
      statistics: engine.getStatistics(),
      timestamp: Date.now()
    });

    sendToPort(port, {
      type: 'snapshot-complete',
      providerId,
      requestId: `${requestId}-complete`,
      timestamp: Date.now()
    });

    return;
  }

  // Subscriber needs cached data (late joiner scenario)
  const snapshot = engine.getSnapshotCache();
  const cacheSize = engine.getCacheSize();
  const keyColumn = engine.getKeyColumn();
  const stats = engine.getStatistics();

  console.log(`[SharedWorker:${blotterType}] getSnapshot: Late joiner ${portId} receiving cached snapshot. cacheSize=${cacheSize}, snapshotLength=${snapshot.length}, mode=${stats.mode}, rowsReceived=${stats.snapshotRowsReceived}, keyColumn=${keyColumn}`);

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

  console.log(`[SharedWorker:${blotterType}] Cached snapshot sent to late joiner ${portId}: ${snapshot.length} rows`);

  // Send snapshot-complete event immediately after cached data
  // This tells the client that all cached data has been sent
  sendToPort(port, {
    type: 'snapshot-complete',
    providerId,
    requestId: `${requestId}-complete`,
    timestamp: Date.now()
  });

  console.log(`[SharedWorker:${blotterType}] Snapshot-complete sent to ${portId}`);
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
 * Handle heartbeat request
 */
function handleHeartbeat(port: MessagePort, request: WorkerRequest): void {
  const { portId, requestId } = request;

  // Heartbeat timestamp already updated in handleMessage
  // Just send acknowledgment
  sendToPort(port, {
    type: 'heartbeat-ack',
    providerId: '',
    requestId,
    timestamp: Date.now()
  });
}

/**
 * Cleanup dead ports
 * Removes ports that haven't responded to heartbeat in HEARTBEAT_TIMEOUT
 */
function cleanupDeadPorts(): void {
  const now = Date.now();
  const deadPorts: string[] = [];

  for (const [portId, portInfo] of ports.entries()) {
    const timeSinceLastHeartbeat = now - portInfo.lastHeartbeat;

    if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.warn(`[SharedWorker:${blotterType}] Port ${portId} is dead (no heartbeat for ${timeSinceLastHeartbeat}ms)`);
      deadPorts.push(portId);
    }
  }

  // Cleanup dead ports
  for (const portId of deadPorts) {
    console.log(`[SharedWorker:${blotterType}] Cleaning up dead port: ${portId}`);

    // Remove from ports map
    ports.delete(portId);

    // Remove from all subscriptions
    broadcastManager.removePortFromAll(portId);

    // Check if any providers have no more subscribers and stop them
    const providersToCheck = engineRegistry.getActiveProviders();
    for (const providerId of providersToCheck) {
      if (broadcastManager.getSubscriberCount(providerId) === 0) {
        console.log(`[SharedWorker:${blotterType}] No more subscribers for ${providerId}, stopping engine`);
        engineRegistry.stop(providerId).catch(err =>
          console.error(`[SharedWorker:${blotterType}] Error stopping engine:`, err)
        );
      }
    }
  }

  if (deadPorts.length > 0) {
    console.log(`[SharedWorker:${blotterType}] Cleaned up ${deadPorts.length} dead ports. Active ports: ${ports.size}`);
  }
}

/**
 * SharedWorker connection handler
 */
(self as any).onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  let connectionPortId: string | undefined;

  console.log(`[SharedWorker:${blotterType}] New connection (Worker version: ${WORKER_VERSION})`);

  port.addEventListener('message', async (messageEvent: MessageEvent<WorkerRequest>) => {
    // Use portId from request if provided (client-generated), otherwise generate one
    // This allows the client to provide its own portId for consistent tracking
    const request = messageEvent.data;

    if (!request.portId) {
      // No portId in request, generate one
      if (!connectionPortId) {
        connectionPortId = generatePortId();
        console.log(`[SharedWorker:${blotterType}] Generated portId for connection: ${connectionPortId}`);
      }
      request.portId = connectionPortId;
    } else {
      // Use client-provided portId
      if (!connectionPortId) {
        connectionPortId = request.portId;
        console.log(`[SharedWorker:${blotterType}] Using client-provided portId: ${connectionPortId}`);
      }
    }

    // Track port by its ID with heartbeat info
    if (!ports.has(connectionPortId)) {
      console.log(`[SharedWorker:${blotterType}] Registering port: ${connectionPortId}`);
      ports.set(connectionPortId, {
        port,
        lastHeartbeat: Date.now(),
        isAlive: true
      });
    }

    await handleMessage(port, request);
  });

  port.addEventListener('messageerror', (error) => {
    console.error(`[SharedWorker:${blotterType}] Message error on port ${connectionPortId}:`, error);
  });

  // Handle port close
  port.addEventListener('close', () => {
    if (connectionPortId) {
      console.log(`[SharedWorker:${blotterType}] Port closed: ${connectionPortId}`);
      ports.delete(connectionPortId);
      // Remove port from all subscriptions
      broadcastManager.removePortFromAll(connectionPortId);
    }
  });

  port.start();
};

// Start heartbeat cleanup interval
setInterval(() => {
  cleanupDeadPorts();
}, HEARTBEAT_INTERVAL);

// Log worker startup
console.log(`[SharedWorker:${blotterType}] Data Provider SharedWorker started`);
console.log(`[SharedWorker:${blotterType}] Heartbeat interval: ${HEARTBEAT_INTERVAL}ms, timeout: ${HEARTBEAT_TIMEOUT}ms`);
console.log(`[SharedWorker:${blotterType}] Active engines:`, engineRegistry.getEngineCount());
console.log(`[SharedWorker:${blotterType}] Active providers:`, engineRegistry.getActiveProviders());
