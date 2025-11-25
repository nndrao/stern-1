/**
 * View Utilities Tests
 *
 * Tests for OpenFin view instance ID management and customData utilities.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateViewId,
  buildViewUrl,
  buildViewName,
  extractViewType,
} from './viewUtils';

describe('View Utilities', () => {
  describe('generateViewId', () => {
    it('should generate a UUID format string', () => {
      const id = generateViewId();
      // UUID format: 8-4-4-4-12 characters
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateViewId();
      const id2 = generateViewId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('buildViewUrl', () => {
    it('should use provided base URL', () => {
      const url = buildViewUrl('/mycomponent', 'view-456', 'https://example.com');
      expect(url).toBe('https://example.com/mycomponent?id=view-456');
    });

    it('should handle paths without leading slash', () => {
      const url = buildViewUrl('mycomponent', 'view-789', 'https://example.com');
      expect(url).toBe('https://example.com/mycomponent?id=view-789');
    });
  });

  describe('buildViewName', () => {
    it('should create view name from component type and ID', () => {
      const name = buildViewName('simple-blotter', 'abc-123');
      expect(name).toBe('simple-blotter-abc-123');
    });

    it('should handle component types with hyphens', () => {
      const name = buildViewName('my-custom-component', 'xyz-789');
      expect(name).toBe('my-custom-component-xyz-789');
    });
  });

  describe('extractViewType', () => {
    it('should extract component type from view name', () => {
      // View name format: componentType-uuid (uuid has 5 segments)
      const type = extractViewType('demo-component-abc12345-def1-4567-89ab-cdef01234567');
      expect(type).toBe('demo-component');
    });

    it('should return null for invalid format', () => {
      const type = extractViewType('invalid');
      expect(type).toBeNull();
    });

    it('should handle component types without hyphens', () => {
      const type = extractViewType('blotter-abc12345-def1-4567-89ab-cdef01234567');
      expect(type).toBe('blotter');
    });
  });
});

describe('View customData utilities', () => {
  describe('when not in OpenFin environment', () => {
    beforeEach(() => {
      // Ensure fin is not defined
      delete (window as any).fin;
    });

    it('getViewCustomData should return undefined', async () => {
      const { getViewCustomData } = await import('./viewUtils');
      const result = await getViewCustomData();
      expect(result).toBeUndefined();
    });

    it('updateViewCustomData should not throw', async () => {
      const { updateViewCustomData } = await import('./viewUtils');
      await expect(updateViewCustomData({ activeLayoutId: 'test' })).resolves.not.toThrow();
    });

    it('getActiveLayoutId should return undefined', async () => {
      const { getActiveLayoutId } = await import('./viewUtils');
      const result = await getActiveLayoutId();
      expect(result).toBeUndefined();
    });

    it('setActiveLayoutId should not throw', async () => {
      const { setActiveLayoutId } = await import('./viewUtils');
      await expect(setActiveLayoutId('test-layout')).resolves.not.toThrow();
    });
  });
});
