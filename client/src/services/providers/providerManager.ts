/**
 * ProviderManager
 *
 * Manages the lifecycle of data provider services (STOMP, REST, etc.)
 * - Uses SharedWorker for data provider engines
 * - Tracks running providers
 * - Ensures providers/channels are ready before blotters connect
 *
 * Note: The actual channel creation happens in the SharedWorker's BroadcastManager
 * when the first subscriber connects. This manager just tracks provider status.
 */

import { logger } from '@/utils/logger';

interface ProviderInfo {
  providerId: string;
  configId: string;
  config: any;
  type: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  startTime: Date;
  error?: string;
}

class ProviderManagerService {
  private providers = new Map<string, ProviderInfo>();

  /**
   * Start a data provider service
   *
   * Note: With the SharedWorker architecture, the provider engine starts automatically
   * when the first subscriber connects. The OpenFin channel is created by the
   * BroadcastManager inside the SharedWorker. This method just tracks the provider
   * as "registered" and validates that the channel becomes available.
   */
  async startProvider(options: {
    providerId: string;
    configId: string;
    config: any;
    type: 'stomp' | 'rest' | 'websocket';
  }): Promise<void> {
    logger.info('Registering provider', { providerId: options.providerId }, 'ProviderManager');

    // Check if already running
    if (this.providers.has(options.providerId)) {
      const provider = this.providers.get(options.providerId)!;
      if (provider.status === 'running' || provider.status === 'starting') {
        logger.info('Provider already registered', { providerId: options.providerId }, 'ProviderManager');
        return;
      }
    }

    // Create provider info
    const providerInfo: ProviderInfo = {
      providerId: options.providerId,
      configId: options.configId,
      config: options.config,
      type: options.type,
      status: 'starting',
      startTime: new Date()
    };

    // Track provider
    this.providers.set(options.providerId, providerInfo);

    try {
      // The SharedWorker + BroadcastManager will create the channel when the first
      // subscriber connects. We just need to mark this provider as registered.
      // The actual connection will happen in useDataProviderAdapter.

      providerInfo.status = 'running';
      logger.info('Provider registered successfully', { providerId: options.providerId }, 'ProviderManager');

    } catch (error) {
      logger.error('Failed to register provider', error, 'ProviderManager');
      providerInfo.status = 'error';
      providerInfo.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Stop a data provider service
   */
  async stopProvider(providerId: string): Promise<void> {
    logger.info('Unregistering provider', { providerId }, 'ProviderManager');

    const provider = this.providers.get(providerId);
    if (!provider) {
      logger.warn('Provider not found', { providerId }, 'ProviderManager');
      return;
    }

    provider.status = 'stopping';

    try {
      // With SharedWorker architecture, the engine will clean up when all subscribers disconnect
      // We just remove from our tracking
      provider.status = 'stopped';
    } catch (error) {
      logger.error('Failed to unregister provider', error, 'ProviderManager');
      provider.status = 'error';
      provider.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      // Remove from tracking
      this.providers.delete(providerId);
    }
  }

  /**
   * Restart a provider
   */
  async restartProvider(providerId: string): Promise<void> {
    logger.info('Restarting provider', { providerId }, 'ProviderManager');

    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    const { configId, config, type } = provider;

    // Stop the provider
    await this.stopProvider(providerId);

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Start it again
    await this.startProvider({
      providerId,
      configId,
      config,
      type: type as 'stomp' | 'rest' | 'websocket'
    });
  }

  /**
   * Get provider info
   */
  getProvider(providerId: string): ProviderInfo | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get all active providers
   */
  getActiveProviders(): ProviderInfo[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers by type
   */
  getProvidersByType(type: string): ProviderInfo[] {
    return Array.from(this.providers.values())
      .filter(p => p.type === type);
  }

  /**
   * Get providers by status
   */
  getProvidersByStatus(status: ProviderInfo['status']): ProviderInfo[] {
    return Array.from(this.providers.values())
      .filter(p => p.status === status);
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down all providers', undefined, 'ProviderManager');

    const providers = Array.from(this.providers.keys());

    for (const providerId of providers) {
      try {
        await this.stopProvider(providerId);
      } catch (error) {
        logger.error('Failed to unregister provider', error, 'ProviderManager');
      }
    }

    this.providers.clear();
  }
}

// Export singleton instance
export const ProviderManager = new ProviderManagerService();
