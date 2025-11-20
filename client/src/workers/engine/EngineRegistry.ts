/**
 * EngineRegistry
 *
 * Manages lifecycle of provider engines.
 * Ensures single instance per provider (singleton pattern).
 * Creates appropriate engine type based on provider configuration.
 */

import { StompEngine } from './StompEngine';
import { ProviderConfig, ProviderEngine } from './types';
import { BroadcastManager } from './BroadcastManager';

export class EngineRegistry {
  private engines = new Map<string, ProviderEngine>();
  private broadcastManager: BroadcastManager;

  constructor(broadcastManager: BroadcastManager) {
    this.broadcastManager = broadcastManager;
  }

  /**
   * Get existing engine or create new one
   * Ensures single instance per provider
   */
  async getOrCreate(providerId: string, config: ProviderConfig): Promise<ProviderEngine> {
    // Return existing engine
    if (this.engines.has(providerId)) {
      console.log(`[EngineRegistry] Reusing existing engine: ${providerId}`);
      return this.engines.get(providerId)!;
    }

    // Create new engine
    console.log(`[EngineRegistry] Creating new engine: ${providerId} (type: ${config.providerType})`);
    const engine = this.createEngine(providerId, config);
    this.engines.set(providerId, engine);

    // Start engine
    try {
      await engine.start();
      console.log(`[EngineRegistry] Engine started successfully: ${providerId}`);
    } catch (error) {
      console.error(`[EngineRegistry] Failed to start engine: ${providerId}`, error);
      this.engines.delete(providerId);
      throw error;
    }

    return engine;
  }

  /**
   * Get existing engine (no create)
   * Returns undefined if engine doesn't exist
   */
  get(providerId: string): ProviderEngine | undefined {
    return this.engines.get(providerId);
  }

  /**
   * Check if engine exists
   */
  has(providerId: string): boolean {
    return this.engines.has(providerId);
  }

  /**
   * Stop and remove engine
   */
  async stop(providerId: string): Promise<void> {
    const engine = this.engines.get(providerId);
    if (!engine) {
      console.warn(`[EngineRegistry] Engine not found for stop: ${providerId}`);
      return;
    }

    console.log(`[EngineRegistry] Stopping engine: ${providerId}`);
    try {
      await engine.stop();
    } catch (error) {
      console.error(`[EngineRegistry] Error stopping engine: ${providerId}`, error);
    } finally {
      this.engines.delete(providerId);
      console.log(`[EngineRegistry] Engine removed: ${providerId}`);
    }
  }

  /**
   * Stop all engines
   */
  async stopAll(): Promise<void> {
    console.log(`[EngineRegistry] Stopping all engines (${this.engines.size} active)`);
    const stopPromises = Array.from(this.engines.keys()).map(id => this.stop(id));
    await Promise.all(stopPromises);
    console.log('[EngineRegistry] All engines stopped');
  }

  /**
   * Create engine based on provider type
   */
  private createEngine(providerId: string, config: ProviderConfig): ProviderEngine {
    switch (config.providerType) {
      case 'stomp':
        return new StompEngine(providerId, config as any, this.broadcastManager);

      case 'rest':
        throw new Error('REST provider not yet implemented');

      case 'websocket':
        throw new Error('WebSocket provider not yet implemented');

      case 'socketio':
        throw new Error('Socket.IO provider not yet implemented');

      case 'mock':
        throw new Error('Mock provider not yet implemented');

      default:
        throw new Error(`Unknown provider type: ${config.providerType}`);
    }
  }

  /**
   * Get all active provider IDs
   */
  getActiveProviders(): string[] {
    return Array.from(this.engines.keys());
  }

  /**
   * Get engine count
   */
  getEngineCount(): number {
    return this.engines.size;
  }

  /**
   * Get statistics for all engines
   */
  getAllStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};
    this.engines.forEach((engine, providerId) => {
      stats[providerId] = engine.getStatistics();
    });
    return stats;
  }
}
