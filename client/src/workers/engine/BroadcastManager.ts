/**
 * BroadcastManager
 *
 * Handles broadcasting updates to all subscribers of a provider.
 * Supports both OpenFin Channel API (preferred) and MessagePort (fallback).
 * Automatically manages channel lifecycle.
 */

import { WorkerResponse } from './types';

export class BroadcastManager {
  private subscribers = new Map<string, Map<string, MessagePort>>();

  constructor() {
    // Always use MessagePort for communication (not OpenFin channels)
    console.log('[BroadcastManager] Using MessagePort for all communication');
  }

  /**
   * Add subscriber to provider
   */
  addSubscriber(providerId: string, portId: string, port: MessagePort): void {
    if (!this.subscribers.has(providerId)) {
      this.subscribers.set(providerId, new Map());
    }

    this.subscribers.get(providerId)!.set(portId, port);
    console.log(`[BroadcastManager] Subscriber added for provider ${providerId} (total: ${this.subscribers.get(providerId)!.size})`);
  }

  /**
   * Remove subscriber from provider
   */
  removeSubscriber(providerId: string, portId: string): void {
    const providerSubs = this.subscribers.get(providerId);
    if (!providerSubs) return;

    providerSubs.delete(portId);
    console.log(`[BroadcastManager] Subscriber removed for provider ${providerId} (remaining: ${providerSubs.size})`);

    // Clean up if no more subscribers
    if (providerSubs.size === 0) {
      this.subscribers.delete(providerId);
      console.log(`[BroadcastManager] No more subscribers for provider ${providerId}, cleaning up`);
    }
  }

  /**
   * Remove port from all providers
   */
  removePortFromAll(portId: string): void {
    this.subscribers.forEach((subs, providerId) => {
      if (subs.has(portId)) {
        this.removeSubscriber(providerId, portId);
      }
    });
  }

  /**
   * Get subscriber count for provider
   */
  getSubscriberCount(providerId: string): number {
    return this.subscribers.get(providerId)?.size || 0;
  }

  /**
   * Broadcast message to all subscribers of a provider
   */
  broadcast(providerId: string, message: WorkerResponse): void {
    this.broadcastViaMessagePort(providerId, message);
  }

  /**
   * Broadcast via MessagePort
   */
  private broadcastViaMessagePort(providerId: string, message: WorkerResponse): void {
    const subs = this.subscribers.get(providerId);
    if (!subs) return;

    const deadPorts: string[] = [];

    subs.forEach((port, portId) => {
      try {
        port.postMessage(message);
      } catch (error) {
        console.error(`[BroadcastManager] MessagePort send error (${portId}):`, error);
        deadPorts.push(portId);
      }
    });

    // Clean up dead ports
    deadPorts.forEach(portId => this.removeSubscriber(providerId, portId));
  }

  /**
   * Get all active provider IDs
   */
  getActiveProviders(): string[] {
    return Array.from(this.subscribers.keys());
  }
}
