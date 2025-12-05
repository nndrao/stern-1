/**
 * SharedStompProvider
 *
 * A simplified, robust STOMP data provider that:
 * - Maintains a single connection per data source
 * - Caches snapshot data for late joiners
 * - Broadcasts updates to all subscribers
 * - Handles reconnection and error recovery
 *
 * This replaces the complex 6-layer architecture with a single cohesive class.
 */

import { Client, IMessage } from '@stomp/stompjs';

// ============================================================================
// Types
// ============================================================================

export interface StompProviderConfig {
  /** WebSocket URL for STOMP broker */
  websocketUrl: string;
  /** Topic to subscribe for data */
  listenerTopic: string;
  /** Optional topic to send snapshot request */
  requestMessage?: string;
  /** Optional body for snapshot request */
  requestBody?: string;
  /** Token that signals snapshot is complete (e.g., "Success") */
  snapshotEndToken?: string;
  /** Column used as unique row identifier */
  keyColumn: string;
  /** Connection timeout in milliseconds */
  timeoutMs?: number;
  /** Heartbeat interval in milliseconds */
  heartbeatMs?: number;
  /** Enable auto-reconnect */
  autoReconnect?: boolean;
  /** Reconnect delay in milliseconds */
  reconnectDelayMs?: number;
}

export interface ProviderStatistics {
  isConnected: boolean;
  mode: 'idle' | 'connecting' | 'snapshot' | 'realtime' | 'error';
  snapshotRowCount: number;
  updateCount: number;
  cacheSize: number;
  connectionAttempts: number;
  lastError?: string;
  connectedAt?: number;
  snapshotCompletedAt?: number;
}

export interface ProviderMessage {
  type: 'snapshot' | 'update' | 'snapshot-complete' | 'status' | 'error';
  providerId: string;
  data?: any[];
  statistics?: ProviderStatistics;
  error?: string;
  timestamp: number;
}

interface Subscriber {
  port: MessagePort;
  receivedLiveSnapshot: boolean;
}

// ============================================================================
// SharedStompProvider Class
// ============================================================================

export class SharedStompProvider {
  private providerId: string;
  private config: StompProviderConfig;
  private client: Client | null = null;

  // Cache: key -> row data
  private cache = new Map<string, any>();

  // Subscribers: portId -> subscriber info
  private subscribers = new Map<string, Subscriber>();

  // State
  private isSnapshotComplete = false;
  private isConnected = false;
  private isStopped = false;

  // Statistics
  private stats: ProviderStatistics = {
    isConnected: false,
    mode: 'idle',
    snapshotRowCount: 0,
    updateCount: 0,
    cacheSize: 0,
    connectionAttempts: 0,
  };

  constructor(providerId: string, config: StompProviderConfig) {
    this.providerId = providerId;
    this.config = {
      timeoutMs: 30000,
      heartbeatMs: 4000,
      autoReconnect: true,
      reconnectDelayMs: 5000,
      snapshotEndToken: 'Success',
      ...config,
    };

    this.log('Created with config', {
      websocketUrl: this.config.websocketUrl,
      listenerTopic: this.config.listenerTopic,
      keyColumn: this.config.keyColumn,
    });
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the STOMP connection
   */
  async start(): Promise<void> {
    if (this.client?.connected) {
      this.log('Already connected');
      return;
    }

    this.isStopped = false;
    this.stats.mode = 'connecting';
    this.stats.connectionAttempts++;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (!this.isConnected) {
          const error = new Error(`Connection timeout after ${this.config.timeoutMs}ms`);
          this.handleError(error);
          reject(error);
        }
      }, this.config.timeoutMs);

      this.client = new Client({
        brokerURL: this.config.websocketUrl,
        reconnectDelay: this.config.autoReconnect ? this.config.reconnectDelayMs : 0,
        heartbeatIncoming: this.config.heartbeatMs,
        heartbeatOutgoing: this.config.heartbeatMs,

        debug: (msg) => {
          // Only log errors/warnings to reduce noise
          if (msg.includes('ERROR') || msg.includes('WARN')) {
            console.warn(`[StompProvider:${this.providerId}]`, msg);
          }
        },

        onConnect: () => {
          clearTimeout(timeoutId);
          this.handleConnect();
          resolve();
        },

        onStompError: (frame) => {
          clearTimeout(timeoutId);
          const error = new Error(frame.headers['message'] || 'STOMP error');
          this.handleError(error);
          reject(error);
        },

        onWebSocketError: (event) => {
          clearTimeout(timeoutId);
          const error = new Error('WebSocket connection failed');
          this.handleError(error);
          reject(error);
        },

        onDisconnect: () => {
          this.handleDisconnect();
        },
      });

      this.client.activate();
    });
  }

  /**
   * Stop the connection and clean up
   */
  async stop(): Promise<void> {
    this.log('Stopping');
    this.isStopped = true;

    if (this.client) {
      try {
        await this.client.deactivate();
      } catch (e) {
        this.log('Error during deactivate', e);
      }
      this.client = null;
    }

    this.isConnected = false;
    this.isSnapshotComplete = false;
    this.cache.clear();
    this.stats.mode = 'idle';
    this.stats.isConnected = false;
  }

  /**
   * Add a subscriber to receive data updates
   */
  addSubscriber(portId: string, port: MessagePort): void {
    this.log(`Adding subscriber: ${portId}`);

    // Track if they're joining during live snapshot
    const receivedLiveSnapshot = !this.isSnapshotComplete;

    this.subscribers.set(portId, { port, receivedLiveSnapshot });

    // Send current status
    this.sendToSubscriber(portId, {
      type: 'status',
      providerId: this.providerId,
      statistics: this.getStatistics(),
      timestamp: Date.now(),
    });

    this.log(`Subscriber ${portId} added. Total: ${this.subscribers.size}`);
  }

  /**
   * Remove a subscriber
   */
  removeSubscriber(portId: string): void {
    this.subscribers.delete(portId);
    this.log(`Subscriber ${portId} removed. Remaining: ${this.subscribers.size}`);
  }

  /**
   * Get cached snapshot for late joiners
   * Returns null if subscriber already received live data
   */
  getSnapshotForSubscriber(portId: string): any[] | null {
    const subscriber = this.subscribers.get(portId);

    if (!subscriber) {
      this.log(`Subscriber ${portId} not found`);
      return null;
    }

    // If snapshot isn't complete yet, they'll get live data via broadcasts
    if (!this.isSnapshotComplete) {
      this.log(`Snapshot not complete, ${portId} will receive live data`);
      return null;
    }

    // If they already received live snapshot data, don't send again
    if (subscriber.receivedLiveSnapshot) {
      this.log(`Subscriber ${portId} already received live snapshot`);
      return null;
    }

    // Late joiner - send cached data
    const data = Array.from(this.cache.values());
    this.log(`Sending cached snapshot to late joiner ${portId}: ${data.length} rows`);
    return data;
  }

  /**
   * Get current statistics
   */
  getStatistics(): ProviderStatistics {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
    };
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Check if snapshot is complete
   */
  isReady(): boolean {
    return this.isSnapshotComplete;
  }

  // ==========================================================================
  // Connection Handlers
  // ==========================================================================

  private handleConnect(): void {
    this.log('Connected');
    this.isConnected = true;
    this.stats.isConnected = true;
    this.stats.mode = 'snapshot';
    this.stats.connectedAt = Date.now();

    // Subscribe to data topic
    this.subscribeToTopic();

    // Request snapshot if configured
    if (this.config.requestMessage) {
      this.requestSnapshot();
    }

    // Notify subscribers
    this.broadcastStatus();
  }

  private handleDisconnect(): void {
    this.log('Disconnected');
    this.isConnected = false;
    this.stats.isConnected = false;

    if (!this.isStopped) {
      this.stats.mode = 'error';
      this.stats.lastError = 'Disconnected from server';
    }

    this.broadcastStatus();
  }

  private handleError(error: Error): void {
    this.log('Error', error.message);
    this.stats.mode = 'error';
    this.stats.lastError = error.message;
    this.stats.isConnected = false;

    this.broadcast({
      type: 'error',
      providerId: this.providerId,
      error: error.message,
      statistics: this.getStatistics(),
      timestamp: Date.now(),
    });
  }

  // ==========================================================================
  // STOMP Message Handling
  // ==========================================================================

  private subscribeToTopic(): void {
    if (!this.client) return;

    const topic = this.resolveTemplate(this.config.listenerTopic);
    this.log(`Subscribing to topic: ${topic}`);

    this.client.subscribe(topic, (message: IMessage) => {
      this.handleMessage(message);
    });
  }

  private requestSnapshot(): void {
    if (!this.client || !this.config.requestMessage) return;

    const destination = this.resolveTemplate(this.config.requestMessage);
    this.log(`Requesting snapshot: ${destination}`);

    this.client.publish({
      destination,
      body: this.config.requestBody || '',
    });
  }

  private handleMessage(message: IMessage): void {
    try {
      const body = message.body.trim();

      // Check for snapshot end token
      if (this.isSnapshotEndToken(body)) {
        this.handleSnapshotComplete();
        return;
      }

      // Parse JSON
      let data: any;
      try {
        data = JSON.parse(body);
      } catch {
        // Not JSON - might be a status message, ignore
        return;
      }

      // Extract rows from various formats
      const rows = this.extractRows(data);
      if (rows.length === 0) return;

      // Update cache
      this.updateCache(rows);

      // Update statistics
      if (this.isSnapshotComplete) {
        this.stats.updateCount += rows.length;
      } else {
        this.stats.snapshotRowCount += rows.length;
      }

      // Broadcast to subscribers
      this.broadcast({
        type: this.isSnapshotComplete ? 'update' : 'snapshot',
        providerId: this.providerId,
        data: rows,
        statistics: this.getStatistics(),
        timestamp: Date.now(),
      });

    } catch (error) {
      this.log('Error processing message', error);
    }
  }

  private handleSnapshotComplete(): void {
    if (this.isSnapshotComplete) return;

    this.isSnapshotComplete = true;
    this.stats.mode = 'realtime';
    this.stats.snapshotCompletedAt = Date.now();

    this.log(`Snapshot complete: ${this.cache.size} rows cached`);

    // Mark all current subscribers as having received live snapshot
    this.subscribers.forEach((sub, portId) => {
      sub.receivedLiveSnapshot = true;
    });

    this.broadcast({
      type: 'snapshot-complete',
      providerId: this.providerId,
      statistics: this.getStatistics(),
      timestamp: Date.now(),
    });
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  private updateCache(rows: any[]): void {
    const keyColumn = this.config.keyColumn;
    let added = 0;
    let skipped = 0;

    for (const row of rows) {
      const key = row[keyColumn];

      if (key === undefined || key === null) {
        skipped++;
        continue;
      }

      // Create new object for immutability (required by AG-Grid)
      this.cache.set(String(key), { ...row });
      added++;
    }

    if (skipped > 0) {
      this.log(`Warning: ${skipped}/${rows.length} rows missing key column '${keyColumn}'`);
    }
  }

  // ==========================================================================
  // Broadcasting
  // ==========================================================================

  private broadcast(message: ProviderMessage): void {
    const deadPorts: string[] = [];

    this.subscribers.forEach((subscriber, portId) => {
      try {
        subscriber.port.postMessage(message);
      } catch (error) {
        this.log(`Failed to send to ${portId}, marking as dead`);
        deadPorts.push(portId);
      }
    });

    // Clean up dead ports
    deadPorts.forEach(portId => this.removeSubscriber(portId));
  }

  private sendToSubscriber(portId: string, message: ProviderMessage): void {
    const subscriber = this.subscribers.get(portId);
    if (!subscriber) return;

    try {
      subscriber.port.postMessage(message);
    } catch (error) {
      this.log(`Failed to send to ${portId}`);
      this.removeSubscriber(portId);
    }
  }

  private broadcastStatus(): void {
    this.broadcast({
      type: 'status',
      providerId: this.providerId,
      statistics: this.getStatistics(),
      timestamp: Date.now(),
    });
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  private isSnapshotEndToken(body: string): boolean {
    if (!this.config.snapshotEndToken) return false;

    // Check if body contains the token (case-insensitive)
    const token = this.config.snapshotEndToken.toLowerCase();
    const bodyLower = body.toLowerCase();

    return bodyLower.includes(token) ||
           bodyLower.includes(`"status":"${token}"`) ||
           bodyLower.includes(`"snapshottoken":"${token}"`);
  }

  private extractRows(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data.rows && Array.isArray(data.rows)) return data.rows;
    if (data.data && Array.isArray(data.data)) return data.data;
    if (typeof data === 'object' && data !== null && !data.status) return [data];
    return [];
  }

  private resolveTemplate(template: string): string {
    // Replace {clientId} with a unique ID
    const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return template.replace(/{clientId}/g, clientId);
  }

  private log(message: string, data?: any): void {
    const prefix = `[StompProvider:${this.providerId}]`;
    if (data !== undefined) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  }
}
