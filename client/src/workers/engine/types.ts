// Provider configuration types
export type ProviderType = 'stomp' | 'rest' | 'websocket' | 'socketio' | 'mock';

export interface ProviderConfig {
  providerId: string;
  providerType: ProviderType;
  name: string;
  config: any; // Provider-specific config
}

export interface StompProviderConfig extends ProviderConfig {
  providerType: 'stomp';
  config: {
    websocketUrl: string;
    listenerTopic: string;
    requestMessage?: string;
    requestBody?: string;
    snapshotEndToken?: string;
    keyColumn: string;  // REQUIRED for getRowId
    snapshotTimeoutMs?: number;
    heartbeat?: {
      incoming: number;
      outgoing: number;
    };
  };
}

// Worker message types
export type WorkerRequestType = 'subscribe' | 'unsubscribe' | 'getSnapshot' | 'getStatus';
export type WorkerResponseType = 'snapshot' | 'update' | 'status' | 'error' | 'subscribed' | 'unsubscribed' | 'snapshot-complete';

export interface WorkerRequest {
  type: WorkerRequestType;
  providerId: string;
  requestId: string;
  config?: ProviderConfig;
  portId?: string;
}

export interface WorkerResponse {
  type: WorkerResponseType;
  providerId: string;
  requestId?: string;
  data?: any[];
  statistics?: ProviderStatistics;
  error?: string;
  timestamp?: number;
}

// Provider statistics
export interface ProviderStatistics {
  snapshotRowsReceived: number;
  updateRowsReceived: number;
  connectionCount: number;
  disconnectionCount: number;
  isConnected: boolean;
  bytesReceived: number;
  snapshotBytesReceived: number;
  updateBytesReceived: number;
  mode: 'idle' | 'snapshot' | 'realtime';
}

// Provider engine interface
export interface ProviderEngine {
  start(): Promise<void>;
  stop(): Promise<void>;
  getSnapshotCache(): any[];
  getCacheSize(): number;  // Get number of rows in cache
  getKeyColumn(): string;  // Get key column name used for caching
  getStatistics(): ProviderStatistics;

  // Subscriber tracking methods (prevent double-delivery)
  registerSubscriber(portId: string): void;
  unregisterSubscriber(portId: string): void;
  shouldSubscriberReceiveCachedSnapshot(portId: string): boolean;
}
