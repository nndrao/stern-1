/**
 * StompEngine
 *
 * STOMP protocol connection handler for data provider engine.
 * Manages WebSocket connection, snapshot fetching, real-time updates, and cache.
 * Broadcasts data to all subscribers via BroadcastManager.
 */

import { Client, IMessage } from '@stomp/stompjs';
import { ProviderEngine, StompProviderConfig, ProviderStatistics } from './types';
import { CacheManager } from './CacheManager';
import { BroadcastManager } from './BroadcastManager';

export class StompEngine implements ProviderEngine {
  private providerId: string;
  private config: StompProviderConfig;
  private client: Client | null = null;
  private cacheManager: CacheManager;
  private broadcastManager: BroadcastManager;
  private statistics: ProviderStatistics;
  private isSnapshotComplete = false;
  private subscription: any = null;
  private clientId: string;

  constructor(
    providerId: string,
    config: StompProviderConfig,
    broadcastManager: BroadcastManager
  ) {
    this.providerId = providerId;
    this.config = config;
    this.broadcastManager = broadcastManager;
    this.cacheManager = new CacheManager(config.config.keyColumn);
    this.statistics = this.initializeStatistics();
    this.clientId = this.generateClientId();
  }

  /**
   * Start STOMP connection
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[StompEngine] Starting connection: ${this.providerId}`);

      this.client = new Client({
        brokerURL: this.config.config.websocketUrl,
        reconnectDelay: 5000,
        heartbeatIncoming: this.config.config.heartbeat?.incoming || 4000,
        heartbeatOutgoing: this.config.config.heartbeat?.outgoing || 4000,
        debug: (msg) => {
          if (msg.includes('ERROR') || msg.includes('WARN')) {
            console.error('[StompEngine]', msg);
          }
        }
      });

      this.client.onConnect = () => {
        console.log(`[StompEngine] Connected: ${this.providerId}`);
        this.statistics.isConnected = true;
        this.statistics.connectionCount++;
        this.statistics.mode = 'snapshot';

        // Subscribe to topic
        this.subscribeToTopic();

        // Send snapshot request if configured
        if (this.config.config.requestMessage) {
          this.requestSnapshot();
        }

        // Broadcast connection status
        this.broadcastStatus();

        resolve();
      };

      this.client.onStompError = (frame) => {
        const errorMsg = frame.headers['message'] || 'STOMP error';
        console.error('[StompEngine] STOMP error:', errorMsg);
        this.statistics.disconnectionCount++;
        this.broadcastError(new Error(errorMsg));
        reject(new Error(errorMsg));
      };

      this.client.onWebSocketError = (event) => {
        console.error('[StompEngine] WebSocket error:', event);
        this.statistics.disconnectionCount++;
        const error = new Error('WebSocket connection failed');
        this.broadcastError(error);
        reject(error);
      };

      this.client.onDisconnect = () => {
        console.log('[StompEngine] Disconnected:', this.providerId);
        this.statistics.isConnected = false;
        this.broadcastStatus();
      };

      // Activate client
      this.client.activate();

      // Set timeout
      setTimeout(() => {
        if (!this.client?.connected) {
          const error = new Error('Connection timeout');
          this.broadcastError(error);
          reject(error);
        }
      }, this.config.config.snapshotTimeoutMs || 30000);
    });
  }

  /**
   * Stop STOMP connection
   */
  async stop(): Promise<void> {
    console.log(`[StompEngine] Stopping: ${this.providerId}`);

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }

    this.cacheManager.clear();
    this.statistics.isConnected = false;
    this.isSnapshotComplete = false;
  }

  /**
   * Subscribe to STOMP topic
   */
  private subscribeToTopic(): void {
    if (!this.client) return;

    const topic = this.resolveTopicTemplate(this.config.config.listenerTopic);
    console.log(`[StompEngine] Subscribing to topic: ${topic}`);

    this.subscription = this.client.subscribe(topic, (message: IMessage) => {
      this.handleMessage(message);
    });
  }

  /**
   * Request snapshot from server
   */
  private requestSnapshot(): void {
    if (!this.client || !this.config.config.requestMessage) return;

    const destination = this.resolveTopicTemplate(this.config.config.requestMessage);
    const body = this.config.config.requestBody || '';

    console.log(`[StompEngine] Requesting snapshot: ${destination}`);

    this.client.publish({
      destination,
      body
    });
  }

  /**
   * Handle incoming STOMP message
   */
  private handleMessage(message: IMessage): void {
    try {
      const body = message.body.trim();

      // Check for snapshot end token
      if (this.checkEndToken(body)) {
        this.handleSnapshotComplete();
        return;
      }

      // Parse JSON data
      let data: any;
      try {
        data = JSON.parse(body);
      } catch (parseError) {
        console.warn('[StompEngine] Non-JSON message received, skipping');
        return;
      }

      const rows = this.extractRows(data);

      if (rows.length === 0) return;

      // Update cache
      this.cacheManager.upsertRows(rows);

      // Update statistics
      const bodyLength = body.length;
      if (this.isSnapshotComplete) {
        this.statistics.updateRowsReceived += rows.length;
        this.statistics.updateBytesReceived += bodyLength;
      } else {
        this.statistics.snapshotRowsReceived += rows.length;
        this.statistics.snapshotBytesReceived += bodyLength;
      }
      this.statistics.bytesReceived += bodyLength;

      // Broadcast to subscribers
      this.broadcastData(rows);

    } catch (error) {
      console.error('[StompEngine] Error processing message:', error);
      this.broadcastError(error as Error);
    }
  }

  /**
   * Check if message is snapshot end token
   */
  private checkEndToken(body: string): boolean {
    if (!this.config.config.snapshotEndToken) return false;
    return body.toLowerCase().includes(
      this.config.config.snapshotEndToken.toLowerCase()
    );
  }

  /**
   * Handle snapshot completion
   */
  private handleSnapshotComplete(): void {
    if (this.isSnapshotComplete) return;

    console.log(`[StompEngine] Snapshot complete: ${this.providerId} (${this.cacheManager.size()} rows)`);
    this.isSnapshotComplete = true;
    this.statistics.mode = 'realtime';
    this.broadcastStatus();
  }

  /**
   * Extract rows from message data
   * Handles different data structures (array, object with rows/data property, single object)
   */
  private extractRows(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data.rows && Array.isArray(data.rows)) return data.rows;
    if (data.data && Array.isArray(data.data)) return data.data;
    if (typeof data === 'object' && data !== null) return [data];
    return [];
  }

  /**
   * Resolve topic template variables
   */
  private resolveTopicTemplate(template: string): string {
    return template.replace(/{clientId}/g, this.clientId);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 6);
    return `client-${timestamp}-${random}`;
  }

  /**
   * Broadcast data to all subscribers
   */
  private broadcastData(rows: any[]): void {
    const messageType = this.isSnapshotComplete ? 'update' : 'snapshot';

    this.broadcastManager.broadcast(this.providerId, {
      type: messageType,
      providerId: this.providerId,
      data: rows,
      statistics: this.getStatistics(),
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast status to all subscribers
   */
  private broadcastStatus(): void {
    this.broadcastManager.broadcast(this.providerId, {
      type: 'status',
      providerId: this.providerId,
      statistics: this.getStatistics(),
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast error to all subscribers
   */
  private broadcastError(error: Error): void {
    this.broadcastManager.broadcast(this.providerId, {
      type: 'error',
      providerId: this.providerId,
      error: error.message,
      timestamp: Date.now()
    });
  }

  /**
   * Get snapshot cache as array
   */
  getSnapshotCache(): any[] {
    return this.cacheManager.getAll();
  }

  /**
   * Get cache size (number of cached rows)
   */
  getCacheSize(): number {
    return this.cacheManager.size();
  }

  /**
   * Get key column name used for caching
   */
  getKeyColumn(): string {
    return this.cacheManager.getKeyColumn();
  }

  /**
   * Get current statistics
   */
  getStatistics(): ProviderStatistics {
    return { ...this.statistics };
  }

  /**
   * Initialize statistics
   */
  private initializeStatistics(): ProviderStatistics {
    return {
      snapshotRowsReceived: 0,
      updateRowsReceived: 0,
      connectionCount: 0,
      disconnectionCount: 0,
      isConnected: false,
      bytesReceived: 0,
      snapshotBytesReceived: 0,
      updateBytesReceived: 0,
      mode: 'idle'
    };
  }
}
