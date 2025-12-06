/**
 * OpenFinBridge
 *
 * Abstraction layer for OpenFin InterApplicationBus (IAB) communication.
 * Provides a clean, testable interface for OpenFin features that gracefully
 * falls back to no-op implementations in browser mode.
 *
 * Benefits:
 * - Single source of truth for OpenFin detection
 * - Centralized error handling
 * - Easy to mock for testing
 * - Type-safe event handling
 * - Automatic cleanup management
 */

import { logger } from '@/utils/logger';
import { OpenFinCustomEvents, OpenFinEventMap } from '@stern/openfin-platform';

export type EventUnsubscribe = () => void;

export interface IOpenFinBridge {
  /** Whether running in OpenFin environment */
  readonly isAvailable: boolean;

  /** Subscribe to an IAB event */
  subscribe<K extends keyof OpenFinEventMap>(
    topic: K,
    handler: (data: OpenFinEventMap[K]) => void
  ): Promise<EventUnsubscribe>;

  /** Publish an IAB event */
  publish<K extends keyof OpenFinEventMap>(
    topic: K,
    data: OpenFinEventMap[K]
  ): Promise<void>;

  /** Send a targeted message to a specific window */
  send<K extends keyof OpenFinEventMap>(
    target: { uuid: string; name?: string },
    topic: K,
    data: OpenFinEventMap[K]
  ): Promise<void>;
}

/**
 * OpenFin Bridge Implementation
 * Provides access to OpenFin IAB with graceful fallback
 */
class OpenFinBridge implements IOpenFinBridge {
  private readonly _isAvailable: boolean;

  constructor() {
    this._isAvailable = typeof window !== 'undefined' && !!window.fin;

    if (this._isAvailable) {
      logger.info('OpenFin environment detected', undefined, 'OpenFinBridge');
    } else {
      logger.info('Browser mode - OpenFin not available', undefined, 'OpenFinBridge');
    }
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  /**
   * Subscribe to an IAB event
   * Returns a cleanup function to unsubscribe
   */
  async subscribe<K extends keyof OpenFinEventMap>(
    topic: K,
    handler: (data: OpenFinEventMap[K]) => void
  ): Promise<EventUnsubscribe> {
    if (!this._isAvailable) {
      logger.warn('subscribe called in browser mode - no-op', { topic }, 'OpenFinBridge');
      return () => {}; // No-op cleanup
    }

    try {
      logger.debug('Subscribing to IAB event', { topic }, 'OpenFinBridge');

      const listener = (data: any) => {
        handler(data as OpenFinEventMap[K]);
      };

      await fin.InterApplicationBus.subscribe(
        { uuid: '*' },
        topic as string,
        listener
      );

      logger.debug('Subscribed to IAB event', { topic }, 'OpenFinBridge');

      // Return cleanup function
      return async () => {
        try {
          await fin.InterApplicationBus.unsubscribe(
            { uuid: '*' },
            topic as string,
            listener
          );
          logger.debug('Unsubscribed from IAB event', { topic }, 'OpenFinBridge');
        } catch (error) {
          logger.warn('Failed to unsubscribe from IAB event', error, 'OpenFinBridge');
        }
      };
    } catch (error) {
      logger.error('Failed to subscribe to IAB event', error, 'OpenFinBridge');
      throw error;
    }
  }

  /**
   * Publish an IAB event to all subscribers
   */
  async publish<K extends keyof OpenFinEventMap>(
    topic: K,
    data: OpenFinEventMap[K]
  ): Promise<void> {
    if (!this._isAvailable) {
      logger.warn('publish called in browser mode - no-op', { topic }, 'OpenFinBridge');
      return;
    }

    try {
      logger.debug('Publishing IAB event', { topic, data }, 'OpenFinBridge');

      await fin.InterApplicationBus.publish(topic as string, data);

      logger.debug('Published IAB event successfully', { topic }, 'OpenFinBridge');
    } catch (error) {
      logger.error('Failed to publish IAB event', error, 'OpenFinBridge');
      throw error;
    }
  }

  /**
   * Send a targeted message to a specific window
   */
  async send<K extends keyof OpenFinEventMap>(
    target: { uuid: string; name?: string },
    topic: K,
    data: OpenFinEventMap[K]
  ): Promise<void> {
    if (!this._isAvailable) {
      logger.warn('send called in browser mode - no-op', { topic, target }, 'OpenFinBridge');
      return;
    }

    try {
      logger.debug('Sending targeted IAB message', { topic, target, data }, 'OpenFinBridge');

      await fin.InterApplicationBus.send(target, topic as string, data);

      logger.debug('Sent targeted IAB message successfully', { topic, target }, 'OpenFinBridge');
    } catch (error) {
      logger.error('Failed to send targeted IAB message', error, 'OpenFinBridge');
      throw error;
    }
  }
}

// Export singleton instance
export const openFinBridge = new OpenFinBridge();
