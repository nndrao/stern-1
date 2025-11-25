/**
 * Layout Cache Service Tests
 *
 * Tests for deferred persistence of blotter layouts.
 * These tests verify the caching behavior without actual database calls.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LayoutCache, PendingLayout } from './layoutCache';

describe('LayoutCache', () => {
  let cache: LayoutCache;

  const createMockLayout = (overrides?: Partial<PendingLayout>): PendingLayout => ({
    layoutId: 'layout-1',
    blotterConfigId: 'blotter-1',
    userId: 'user-1',
    name: 'Test Layout',
    config: {
      columnDefs: [],
      columnState: [],
      filterState: {},
      sortState: [],
      selectedProviderId: null,
      toolbarState: { isCollapsed: false, isPinned: false },
      // Required properties from SimpleBlotterLayoutConfig
      activeFormattingRuleIds: [],
      activeEditingRuleIds: [],
      activeColumnGroupIds: [],
      activeFormatterIds: [],
      activeCalculatedColumnIds: [],
    },
    timestamp: Date.now(),
    isNew: true,
    ...overrides
  });

  beforeEach(() => {
    cache = new LayoutCache();
  });

  describe('savePending', () => {
    it('should save a layout to pending cache', () => {
      const layout = createMockLayout();
      cache.savePending(layout);

      expect(cache.hasPending('layout-1')).toBe(true);
      expect(cache.getPending('layout-1')).toMatchObject({
        layoutId: 'layout-1',
        blotterConfigId: 'blotter-1'
      });
    });

    it('should update timestamp when saving', () => {
      const layout = createMockLayout({ timestamp: 1000 });
      cache.savePending(layout);

      const saved = cache.getPending('layout-1');
      expect(saved?.timestamp).toBeGreaterThan(1000);
    });

    it('should remove layout from deletions if it was marked for deletion', () => {
      cache.markForDeletion('layout-1', 'blotter-1');
      expect(cache.isMarkedForDeletion('layout-1')).toBe(true);

      const layout = createMockLayout();
      cache.savePending(layout);

      expect(cache.isMarkedForDeletion('layout-1')).toBe(false);
      expect(cache.hasPending('layout-1')).toBe(true);
    });

    it('should overwrite existing pending layout', () => {
      const layout1 = createMockLayout({ name: 'Original' });
      cache.savePending(layout1);

      const layout2 = createMockLayout({ name: 'Updated' });
      cache.savePending(layout2);

      expect(cache.getPending('layout-1')?.name).toBe('Updated');
    });
  });

  describe('markForDeletion', () => {
    it('should mark a layout for deletion', () => {
      cache.markForDeletion('layout-1', 'blotter-1');

      expect(cache.isMarkedForDeletion('layout-1')).toBe(true);
    });

    it('should remove layout from pending saves when marked for deletion', () => {
      const layout = createMockLayout();
      cache.savePending(layout);
      expect(cache.hasPending('layout-1')).toBe(true);

      cache.markForDeletion('layout-1', 'blotter-1');

      expect(cache.hasPending('layout-1')).toBe(false);
      expect(cache.isMarkedForDeletion('layout-1')).toBe(true);
    });
  });

  describe('getPending', () => {
    it('should return undefined for non-existent layout', () => {
      expect(cache.getPending('non-existent')).toBeUndefined();
    });

    it('should return the pending layout', () => {
      const layout = createMockLayout();
      cache.savePending(layout);

      const result = cache.getPending('layout-1');
      expect(result?.layoutId).toBe('layout-1');
    });
  });

  describe('getPendingByBlotter', () => {
    it('should return empty array when no pending layouts', () => {
      expect(cache.getPendingByBlotter('blotter-1')).toEqual([]);
    });

    it('should return all layouts for a blotter', () => {
      cache.savePending(createMockLayout({ layoutId: 'layout-1', blotterConfigId: 'blotter-1' }));
      cache.savePending(createMockLayout({ layoutId: 'layout-2', blotterConfigId: 'blotter-1' }));
      cache.savePending(createMockLayout({ layoutId: 'layout-3', blotterConfigId: 'blotter-2' }));

      const result = cache.getPendingByBlotter('blotter-1');
      expect(result).toHaveLength(2);
      expect(result.map(l => l.layoutId)).toContain('layout-1');
      expect(result.map(l => l.layoutId)).toContain('layout-2');
    });

    it('should not include layouts from other blotters', () => {
      cache.savePending(createMockLayout({ layoutId: 'layout-1', blotterConfigId: 'blotter-2' }));

      const result = cache.getPendingByBlotter('blotter-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('hasPending', () => {
    it('should return false for non-existent layout', () => {
      expect(cache.hasPending('non-existent')).toBe(false);
    });

    it('should return true for pending layout', () => {
      cache.savePending(createMockLayout());
      expect(cache.hasPending('layout-1')).toBe(true);
    });
  });

  describe('isMarkedForDeletion', () => {
    it('should return false for non-marked layout', () => {
      expect(cache.isMarkedForDeletion('layout-1')).toBe(false);
    });

    it('should return true for marked layout', () => {
      cache.markForDeletion('layout-1', 'blotter-1');
      expect(cache.isMarkedForDeletion('layout-1')).toBe(true);
    });
  });

  describe('getPendingCount', () => {
    it('should return zeros when empty', () => {
      expect(cache.getPendingCount()).toEqual({ saves: 0, deletions: 0 });
    });

    it('should count pending saves', () => {
      cache.savePending(createMockLayout({ layoutId: 'layout-1' }));
      cache.savePending(createMockLayout({ layoutId: 'layout-2' }));

      expect(cache.getPendingCount()).toEqual({ saves: 2, deletions: 0 });
    });

    it('should count pending deletions', () => {
      cache.markForDeletion('layout-1', 'blotter-1');
      cache.markForDeletion('layout-2', 'blotter-1');

      expect(cache.getPendingCount()).toEqual({ saves: 0, deletions: 2 });
    });

    it('should count both saves and deletions', () => {
      cache.savePending(createMockLayout({ layoutId: 'layout-1' }));
      cache.markForDeletion('layout-2', 'blotter-1');

      expect(cache.getPendingCount()).toEqual({ saves: 1, deletions: 1 });
    });
  });

  describe('discardAll', () => {
    it('should clear all pending layouts', () => {
      cache.savePending(createMockLayout({ layoutId: 'layout-1' }));
      cache.savePending(createMockLayout({ layoutId: 'layout-2' }));
      cache.markForDeletion('layout-3', 'blotter-1');

      cache.discardAll();

      expect(cache.getPendingCount()).toEqual({ saves: 0, deletions: 0 });
      expect(cache.hasPending('layout-1')).toBe(false);
      expect(cache.isMarkedForDeletion('layout-3')).toBe(false);
    });
  });

  describe('hasPendingOperations', () => {
    it('should return false when empty', () => {
      expect(cache.hasPendingOperations()).toBe(false);
    });

    it('should return true with pending saves', () => {
      cache.savePending(createMockLayout());
      expect(cache.hasPendingOperations()).toBe(true);
    });

    it('should return true with pending deletions', () => {
      cache.markForDeletion('layout-1', 'blotter-1');
      expect(cache.hasPendingOperations()).toBe(true);
    });

    it('should return false after discardAll', () => {
      cache.savePending(createMockLayout());
      cache.discardAll();
      expect(cache.hasPendingOperations()).toBe(false);
    });
  });

  describe('onPersist', () => {
    it('should register a callback', () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      const unsubscribe = cache.onPersist(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should return an unsubscribe function', () => {
      const callback = vi.fn().mockResolvedValue(undefined);
      const unsubscribe = cache.onPersist(callback);

      // Calling unsubscribe should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});
