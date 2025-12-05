/**
 * STOMP Data Provider SharedWorker
 *
 * A self-contained SharedWorker that handles STOMP connections, caching, and broadcasting.
 * Each unique providerId gets one shared connection across all subscribers.
 */

/// <reference lib="webworker" />

import { Client, IMessage } from '@stomp/stompjs';

// ============================================================================
// Types
// ============================================================================

interface StompConfig {
  websocketUrl: string;
  listenerTopic: string;
  requestMessage?: string;
  requestBody?: string;
  snapshotEndToken?: string;
  keyColumn: string;
  timeoutMs?: number;
  heartbeatMs?: number;
}

interface WorkerRequest {
  type: 'subscribe' | 'unsubscribe' | 'getSnapshot' | 'getStatus';
  providerId: string;
  portId: string;
  requestId?: string;
  config?: { providerId: string; name: string; config: StompConfig };
}

interface WorkerMessage {
  type: 'subscribed' | 'unsubscribed' | 'snapshot' | 'update' | 'snapshot-complete' | 'status' | 'error';
  providerId: string;
  requestId?: string;
  data?: any[];
  statistics?: ProviderStats;
  error?: string;
  timestamp: number;
}

interface ProviderStats {
  isConnected: boolean;
  mode: 'idle' | 'connecting' | 'snapshot' | 'realtime' | 'error';
  snapshotRowCount: number;
  updateCount: number;
  cacheSize: number;
  lastError?: string;
}

interface Subscriber {
  port: MessagePort;
  receivedLiveSnapshot: boolean;
}

// ============================================================================
// StompProvider Class (embedded in worker)
// ============================================================================

class StompProvider {
  private providerId: string;
  private config: Required<Pick<StompConfig, 'websocketUrl' | 'listenerTopic' | 'keyColumn'>> & StompConfig;
  private client: Client | null = null;
  private cache = new Map<string, any>();
  private subscribers = new Map<string, Subscriber>();
  private isSnapshotComplete = false;
  private isConnected = false;
  private isStopped = false;
  private stats: ProviderStats = {
    isConnected: false,
    mode: 'idle',
    snapshotRowCount: 0,
    updateCount: 0,
    cacheSize: 0,
  };

  constructor(providerId: string, config: StompConfig) {
    this.providerId = providerId;
    this.config = {
      timeoutMs: 30000,
      heartbeatMs: 4000,
      snapshotEndToken: 'Success',
      ...config,
    };
  }

  async start(): Promise<void> {
    if (this.client?.connected) return;

    this.isStopped = false;
    this.stats.mode = 'connecting';

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (!this.isConnected) {
          this.handleError(new Error(`Connection timeout after ${this.config.timeoutMs}ms`));
          reject(new Error('Connection timeout'));
        }
      }, this.config.timeoutMs);

      this.client = new Client({
        brokerURL: this.config.websocketUrl,
        reconnectDelay: 5000,
        heartbeatIncoming: this.config.heartbeatMs,
        heartbeatOutgoing: this.config.heartbeatMs,
        debug: () => {},
        onConnect: () => {
          clearTimeout(timeoutId);
          this.handleConnect();
          resolve();
        },
        onStompError: (frame) => {
          clearTimeout(timeoutId);
          this.handleError(new Error(frame.headers['message'] || 'STOMP error'));
          reject(new Error('STOMP error'));
        },
        onWebSocketError: () => {
          clearTimeout(timeoutId);
          this.handleError(new Error('WebSocket connection failed'));
          reject(new Error('WebSocket error'));
        },
        onDisconnect: () => this.handleDisconnect(),
      });

      this.client.activate();
    });
  }

  async stop(): Promise<void> {
    this.isStopped = true;
    if (this.client) {
      try { await this.client.deactivate(); } catch {}
      this.client = null;
    }
    this.isConnected = false;
    this.isSnapshotComplete = false;
    this.cache.clear();
    this.stats.mode = 'idle';
    this.stats.isConnected = false;
  }

  addSubscriber(portId: string, port: MessagePort): void {
    this.subscribers.set(portId, { port, receivedLiveSnapshot: !this.isSnapshotComplete });
    this.sendTo(portId, { type: 'status', providerId: this.providerId, statistics: this.getStats(), timestamp: Date.now() });
  }

  removeSubscriber(portId: string): void {
    this.subscribers.delete(portId);
  }

  getSnapshotForSubscriber(portId: string): any[] | null {
    const sub = this.subscribers.get(portId);
    if (!sub || !this.isSnapshotComplete || sub.receivedLiveSnapshot) return null;
    return Array.from(this.cache.values());
  }

  getStats(): ProviderStats {
    return { ...this.stats, cacheSize: this.cache.size };
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  private handleConnect(): void {
    this.isConnected = true;
    this.stats.isConnected = true;
    this.stats.mode = 'snapshot';

    // Subscribe to topic
    const topic = this.config.listenerTopic.replace(/{clientId}/g, `client-${Date.now()}`);
    this.client!.subscribe(topic, (msg: IMessage) => this.handleMessage(msg));

    // Request snapshot if configured
    if (this.config.requestMessage) {
      const dest = this.config.requestMessage.replace(/{clientId}/g, `client-${Date.now()}`);
      this.client!.publish({ destination: dest, body: this.config.requestBody || '' });
    }

    this.broadcast({ type: 'status', providerId: this.providerId, statistics: this.getStats(), timestamp: Date.now() });
  }

  private handleDisconnect(): void {
    this.isConnected = false;
    this.stats.isConnected = false;
    if (!this.isStopped) {
      this.stats.mode = 'error';
      this.stats.lastError = 'Disconnected';
    }
    this.broadcast({ type: 'status', providerId: this.providerId, statistics: this.getStats(), timestamp: Date.now() });
  }

  private handleError(error: Error): void {
    this.stats.mode = 'error';
    this.stats.lastError = error.message;
    this.stats.isConnected = false;
    this.broadcast({ type: 'error', providerId: this.providerId, error: error.message, statistics: this.getStats(), timestamp: Date.now() });
  }

  private handleMessage(message: IMessage): void {
    try {
      const body = message.body.trim();

      // Check for snapshot end
      if (this.isSnapshotEnd(body)) {
        this.handleSnapshotComplete();
        return;
      }

      // Parse JSON
      let data: any;
      try { data = JSON.parse(body); } catch { return; }

      // Extract rows
      const rows = Array.isArray(data) ? data
        : data.rows && Array.isArray(data.rows) ? data.rows
        : data.data && Array.isArray(data.data) ? data.data
        : typeof data === 'object' && !data.status ? [data] : [];

      if (rows.length === 0) return;

      // Update cache
      const keyCol = this.config.keyColumn;
      for (const row of rows) {
        const key = row[keyCol];
        if (key != null) this.cache.set(String(key), { ...row });
      }

      // Update stats
      if (this.isSnapshotComplete) {
        this.stats.updateCount += rows.length;
      } else {
        this.stats.snapshotRowCount += rows.length;
      }

      // Broadcast
      this.broadcast({
        type: this.isSnapshotComplete ? 'update' : 'snapshot',
        providerId: this.providerId,
        data: rows,
        statistics: this.getStats(),
        timestamp: Date.now(),
      });
    } catch {}
  }

  private handleSnapshotComplete(): void {
    if (this.isSnapshotComplete) return;
    this.isSnapshotComplete = true;
    this.stats.mode = 'realtime';
    this.subscribers.forEach(sub => { sub.receivedLiveSnapshot = true; });
    this.broadcast({ type: 'snapshot-complete', providerId: this.providerId, statistics: this.getStats(), timestamp: Date.now() });
  }

  private isSnapshotEnd(body: string): boolean {
    if (!this.config.snapshotEndToken) return false;
    const token = this.config.snapshotEndToken.toLowerCase();
    const lower = body.toLowerCase();
    return lower.includes(token) || lower.includes(`"status":"${token}"`);
  }

  private broadcast(msg: WorkerMessage): void {
    const dead: string[] = [];
    this.subscribers.forEach((sub, id) => {
      try { sub.port.postMessage(msg); } catch { dead.push(id); }
    });
    dead.forEach(id => this.subscribers.delete(id));
  }

  private sendTo(portId: string, msg: WorkerMessage): void {
    const sub = this.subscribers.get(portId);
    if (sub) try { sub.port.postMessage(msg); } catch { this.subscribers.delete(portId); }
  }
}

// ============================================================================
// Worker State
// ============================================================================

const providers = new Map<string, StompProvider>();
const ports = new Map<string, { port: MessagePort; providerIds: Set<string> }>();

// ============================================================================
// Message Handlers
// ============================================================================

async function handleSubscribe(port: MessagePort, req: WorkerRequest): Promise<void> {
  const { providerId, portId, config, requestId } = req;

  if (!config?.config) {
    sendError(port, providerId, requestId, 'Configuration required');
    return;
  }

  try {
    let provider = providers.get(providerId);
    if (!provider) {
      provider = new StompProvider(providerId, config.config);
      providers.set(providerId, provider);
      await provider.start();
    }

    let portInfo = ports.get(portId);
    if (!portInfo) {
      portInfo = { port, providerIds: new Set() };
      ports.set(portId, portInfo);
    }
    portInfo.providerIds.add(providerId);

    provider.addSubscriber(portId, port);
    send(port, { type: 'subscribed', providerId, requestId, statistics: provider.getStats(), timestamp: Date.now() });
  } catch (e) {
    sendError(port, providerId, requestId, e instanceof Error ? e.message : 'Subscribe failed');
  }
}

function handleUnsubscribe(port: MessagePort, req: WorkerRequest): void {
  const { providerId, portId, requestId } = req;

  const provider = providers.get(providerId);
  if (provider) {
    provider.removeSubscriber(portId);
    if (provider.getSubscriberCount() === 0) {
      provider.stop();
      providers.delete(providerId);
    }
  }

  const portInfo = ports.get(portId);
  if (portInfo) {
    portInfo.providerIds.delete(providerId);
    if (portInfo.providerIds.size === 0) ports.delete(portId);
  }

  send(port, { type: 'unsubscribed', providerId, requestId, timestamp: Date.now() });
}

function handleGetSnapshot(port: MessagePort, req: WorkerRequest): void {
  const { providerId, portId, requestId } = req;
  const provider = providers.get(providerId);

  if (!provider) {
    sendError(port, providerId, requestId, 'Provider not found');
    return;
  }

  const data = provider.getSnapshotForSubscriber(portId);
  send(port, { type: 'snapshot', providerId, requestId, data: data || [], statistics: provider.getStats(), timestamp: Date.now() });
  send(port, { type: 'snapshot-complete', providerId, requestId: requestId ? `${requestId}-complete` : undefined, timestamp: Date.now() });
}

function handleGetStatus(port: MessagePort, req: WorkerRequest): void {
  const { providerId, requestId } = req;
  const provider = providers.get(providerId);
  if (!provider) {
    sendError(port, providerId, requestId, 'Provider not found');
    return;
  }
  send(port, { type: 'status', providerId, requestId, statistics: provider.getStats(), timestamp: Date.now() });
}

function send(port: MessagePort, msg: WorkerMessage): void {
  try { port.postMessage(msg); } catch {}
}

function sendError(port: MessagePort, providerId: string, requestId: string | undefined, message: string): void {
  send(port, { type: 'error', providerId, requestId, error: message, timestamp: Date.now() });
}

// ============================================================================
// SharedWorker Entry
// ============================================================================

(self as any).onconnect = (event: MessageEvent) => {
  const port = event.ports[0];
  let connectionPortId: string | undefined;

  port.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
    const req = e.data;
    if (!connectionPortId && req.portId) connectionPortId = req.portId;
    if (!req.portId && connectionPortId) req.portId = connectionPortId;

    if (!req.portId) {
      sendError(port, req.providerId, req.requestId, 'portId required');
      return;
    }

    switch (req.type) {
      case 'subscribe': await handleSubscribe(port, req); break;
      case 'unsubscribe': handleUnsubscribe(port, req); break;
      case 'getSnapshot': handleGetSnapshot(port, req); break;
      case 'getStatus': handleGetStatus(port, req); break;
      default: sendError(port, req.providerId, req.requestId, `Unknown type: ${req.type}`);
    }
  });

  port.start();
};

console.log('[StompDataWorker] Started');
