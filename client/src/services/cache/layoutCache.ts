/**
 * Layout Cache Service
 *
 * Implements deferred persistence for blotter layouts.
 * Layouts are stored locally until workspace is saved, preventing orphaned configs.
 *
 * Flow:
 * 1. User saves layout -> stored in memory via savePending()
 * 2. User saves workspace -> persistAll() called to save to DB
 * 3. User closes without saving -> discardAll() clears pending layouts
 */

import { logger } from '@/utils/logger';
import { simpleBlotterConfigService } from '@/services/api/simpleBlotterConfigService';
import type { SimpleBlotterLayoutConfig } from '@stern/shared-types';

/**
 * Represents a layout that hasn't been persisted to the database yet
 */
export interface PendingLayout {
  layoutId: string;
  blotterConfigId: string;
  userId: string;
  name: string;
  config: SimpleBlotterLayoutConfig;
  timestamp: number;
  isNew: boolean; // true = create, false = update
}

/**
 * Represents a pending layout deletion
 */
export interface PendingDeletion {
  layoutId: string;
  blotterConfigId: string;
  timestamp: number;
}

/**
 * Cache for pending layout operations
 * Stores layouts in memory until workspace is saved
 */
class LayoutCache {
  private pendingLayouts: Map<string, PendingLayout> = new Map();
  private pendingDeletions: Map<string, PendingDeletion> = new Map();
  private persistenceCallbacks: Set<() => Promise<void>> = new Set();

  /**
   * Store a layout locally (not persisted to DB yet)
   * @param layout The pending layout to store
   */
  savePending(layout: PendingLayout): void {
    // Remove from deletions if it was marked for deletion
    this.pendingDeletions.delete(layout.layoutId);

    this.pendingLayouts.set(layout.layoutId, {
      ...layout,
      timestamp: Date.now()
    });

    logger.debug('Layout saved to pending cache', {
      layoutId: layout.layoutId,
      blotterConfigId: layout.blotterConfigId,
      isNew: layout.isNew
    }, 'LayoutCache');
  }

  /**
   * Mark a layout for deletion (not deleted from DB yet)
   * @param layoutId The layout ID to delete
   * @param blotterConfigId The blotter config ID
   */
  markForDeletion(layoutId: string, blotterConfigId: string): void {
    // Remove from pending saves if it exists
    this.pendingLayouts.delete(layoutId);

    this.pendingDeletions.set(layoutId, {
      layoutId,
      blotterConfigId,
      timestamp: Date.now()
    });

    logger.debug('Layout marked for deletion', {
      layoutId,
      blotterConfigId
    }, 'LayoutCache');
  }

  /**
   * Get a pending layout by ID
   * @param layoutId The layout ID to get
   * @returns The pending layout or undefined
   */
  getPending(layoutId: string): PendingLayout | undefined {
    return this.pendingLayouts.get(layoutId);
  }

  /**
   * Get all pending layouts for a specific blotter
   * @param blotterConfigId The blotter config ID
   * @returns Array of pending layouts
   */
  getPendingByBlotter(blotterConfigId: string): PendingLayout[] {
    return Array.from(this.pendingLayouts.values())
      .filter(layout => layout.blotterConfigId === blotterConfigId);
  }

  /**
   * Check if a layout is pending (has unsaved changes)
   * @param layoutId The layout ID to check
   * @returns true if the layout has pending changes
   */
  hasPending(layoutId: string): boolean {
    return this.pendingLayouts.has(layoutId);
  }

  /**
   * Check if a layout is marked for deletion
   * @param layoutId The layout ID to check
   * @returns true if the layout is marked for deletion
   */
  isMarkedForDeletion(layoutId: string): boolean {
    return this.pendingDeletions.has(layoutId);
  }

  /**
   * Get the count of pending operations
   */
  getPendingCount(): { saves: number; deletions: number } {
    return {
      saves: this.pendingLayouts.size,
      deletions: this.pendingDeletions.size
    };
  }

  /**
   * Register a callback to be called during persistAll
   * Used for additional persistence operations (e.g., updating view customData)
   */
  onPersist(callback: () => Promise<void>): () => void {
    this.persistenceCallbacks.add(callback);
    return () => {
      this.persistenceCallbacks.delete(callback);
    };
  }

  /**
   * Persist all pending layouts to the database
   * Called when workspace is saved
   * @returns Object with success status and counts
   */
  async persistAll(): Promise<{
    success: boolean;
    savedCount: number;
    deletedCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let savedCount = 0;
    let deletedCount = 0;

    logger.info('Persisting all pending layouts', {
      pendingSaves: this.pendingLayouts.size,
      pendingDeletions: this.pendingDeletions.size
    }, 'LayoutCache');

    // Process deletions first
    for (const [layoutId, deletion] of this.pendingDeletions) {
      try {
        await simpleBlotterConfigService.deleteLayout(layoutId);
        deletedCount++;
        logger.debug('Layout deleted from DB', { layoutId }, 'LayoutCache');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to delete layout ${layoutId}: ${message}`);
        logger.error('Failed to delete layout from DB', { layoutId, error }, 'LayoutCache');
      }
    }

    // Process saves
    for (const [layoutId, pending] of this.pendingLayouts) {
      try {
        if (pending.isNew) {
          // Create new layout
          await simpleBlotterConfigService.createLayout(
            pending.blotterConfigId,
            pending.userId,
            pending.name,
            pending.config
          );
        } else {
          // Update existing layout
          await simpleBlotterConfigService.updateLayout(
            layoutId,
            pending.config,
            pending.userId
          );
        }
        savedCount++;
        logger.debug('Layout persisted to DB', {
          layoutId,
          isNew: pending.isNew
        }, 'LayoutCache');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to save layout ${layoutId}: ${message}`);
        logger.error('Failed to persist layout to DB', { layoutId, error }, 'LayoutCache');
      }
    }

    // Execute registered callbacks
    for (const callback of this.persistenceCallbacks) {
      try {
        await callback();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Persistence callback failed: ${message}`);
        logger.error('Persistence callback failed', { error }, 'LayoutCache');
      }
    }

    // Clear pending operations after persist
    this.pendingLayouts.clear();
    this.pendingDeletions.clear();

    const success = errors.length === 0;
    logger.info('Persist complete', {
      success,
      savedCount,
      deletedCount,
      errorCount: errors.length
    }, 'LayoutCache');

    return { success, savedCount, deletedCount, errors };
  }

  /**
   * Discard all pending layouts without persisting
   * Called when user closes without saving workspace
   */
  discardAll(): void {
    const counts = this.getPendingCount();

    this.pendingLayouts.clear();
    this.pendingDeletions.clear();

    logger.info('Discarded all pending layouts', counts, 'LayoutCache');
  }

  /**
   * Check if there are any pending operations
   * @returns true if there are pending saves or deletions
   */
  hasPendingOperations(): boolean {
    return this.pendingLayouts.size > 0 || this.pendingDeletions.size > 0;
  }
}

// Export class for testing and singleton instance for production use
export { LayoutCache };
export const layoutCache = new LayoutCache();
