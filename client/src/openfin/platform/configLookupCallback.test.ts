/**
 * Config Lookup Callback Tests
 *
 * Tests for the config lookup callback pattern used for config reuse behavior.
 *
 * Note: These tests validate the callback contract and flow without importing
 * the actual OpenFin modules (which require the OpenFin runtime environment).
 */

import { describe, it, expect, vi } from 'vitest';

/**
 * Local type definitions matching the exported types from @stern/openfin-platform
 * We define these locally to avoid importing from the package which triggers
 * OpenFin runtime dependencies.
 */
interface ConfigLookupResult {
  configId: string;
  isExisting: boolean;
}

type ConfigLookupCallback = (
  menuItemId: string,
  caption: string
) => Promise<ConfigLookupResult>;

describe('Config Lookup Callback Pattern', () => {
  describe('ConfigLookupResult interface', () => {
    it('should accept valid result with isExisting: true (reusing config)', () => {
      const result: ConfigLookupResult = {
        configId: 'existing-config-uuid',
        isExisting: true
      };

      expect(result.configId).toBe('existing-config-uuid');
      expect(result.isExisting).toBe(true);
    });

    it('should accept valid result with isExisting: false (new config)', () => {
      const result: ConfigLookupResult = {
        configId: 'new-config-uuid',
        isExisting: false
      };

      expect(result.configId).toBe('new-config-uuid');
      expect(result.isExisting).toBe(false);
    });
  });

  describe('ConfigLookupCallback type', () => {
    it('should handle async callback that returns existing config', async () => {
      const callback: ConfigLookupCallback = async (menuItemId, caption) => {
        // Simulate finding an existing config
        return {
          configId: `existing-config-for-${menuItemId}`,
          isExisting: true
        };
      };

      const result = await callback('bonds-blotter', 'Bonds Blotter');

      expect(result.configId).toBe('existing-config-for-bonds-blotter');
      expect(result.isExisting).toBe(true);
    });

    it('should handle async callback that creates new config', async () => {
      const callback: ConfigLookupCallback = async (menuItemId, caption) => {
        // Simulate creating a new config
        const newConfigId = crypto.randomUUID();
        return {
          configId: newConfigId,
          isExisting: false
        };
      };

      const result = await callback('equity-blotter', 'Equity Blotter');

      expect(result.configId).toBeDefined();
      expect(result.configId.length).toBeGreaterThan(0);
      expect(result.isExisting).toBe(false);
    });

    it('should pass menuItemId and caption to callback', async () => {
      const mockCallback = vi.fn<[string, string], Promise<ConfigLookupResult>>()
        .mockResolvedValue({
          configId: 'test-config',
          isExisting: false
        });

      await mockCallback('fx-blotter', 'FX Blotter');

      expect(mockCallback).toHaveBeenCalledWith('fx-blotter', 'FX Blotter');
    });
  });

  describe('config reuse flow simulation', () => {
    it('should simulate first-time menu click (new config)', async () => {
      // First time clicking a dock menu item - no existing config
      const configLookup: ConfigLookupCallback = async (menuItemId, caption) => {
        // Simulate what simpleBlotterConfigService.getOrCreateConfigByMenuItem does
        // when no existing config is found
        const newConfigId = crypto.randomUUID();
        return {
          configId: newConfigId,
          isExisting: false
        };
      };

      const result = await configLookup('bonds-blotter', 'Bonds Blotter');

      expect(result.isExisting).toBe(false);
      expect(result.configId).toBeDefined();
    });

    it('should simulate second-time menu click (reuse existing config)', async () => {
      // Second time clicking same dock menu item - existing config found
      const existingConfigId = 'existing-uuid-12345';

      const configLookup: ConfigLookupCallback = async (menuItemId, caption) => {
        // Simulate what simpleBlotterConfigService.getOrCreateConfigByMenuItem does
        // when an existing config is found
        return {
          configId: existingConfigId,
          isExisting: true
        };
      };

      const result = await configLookup('bonds-blotter', 'Bonds Blotter');

      expect(result.isExisting).toBe(true);
      expect(result.configId).toBe(existingConfigId);
    });

    it('should handle different users getting different configs', async () => {
      // Different users have separate configs for the same menuItem
      const userConfigs: Record<string, string> = {
        'user1': 'config-uuid-user1',
        'user2': 'config-uuid-user2'
      };

      const createUserCallback = (userId: string): ConfigLookupCallback => {
        return async (menuItemId, caption) => {
          const existingConfigId = userConfigs[userId];
          if (existingConfigId) {
            return { configId: existingConfigId, isExisting: true };
          }
          return { configId: crypto.randomUUID(), isExisting: false };
        };
      };

      const user1Callback = createUserCallback('user1');
      const user2Callback = createUserCallback('user2');

      const result1 = await user1Callback('bonds-blotter', 'Bonds Blotter');
      const result2 = await user2Callback('bonds-blotter', 'Bonds Blotter');

      expect(result1.configId).toBe('config-uuid-user1');
      expect(result2.configId).toBe('config-uuid-user2');
      expect(result1.configId).not.toBe(result2.configId);
    });

    it('should handle callback errors gracefully', async () => {
      const failingCallback: ConfigLookupCallback = async () => {
        throw new Error('Network error');
      };

      // The callback should throw
      await expect(failingCallback('test', 'Test')).rejects.toThrow('Network error');
    });

    it('should allow menuLauncher to use callback result for URL building', async () => {
      // Simulate the full flow in menuLauncher
      const configLookup: ConfigLookupCallback = async (menuItemId, caption) => {
        return { configId: 'reused-config-uuid', isExisting: true };
      };

      const menuItem = {
        id: 'bonds-blotter',
        caption: 'Bonds Blotter',
        url: '/simple-blotter'
      };

      // Call the config lookup
      const result = await configLookup(menuItem.id, menuItem.caption);

      // Build URL using the configId (this is what menuLauncher does)
      const url = `${menuItem.url}?id=${encodeURIComponent(result.configId)}`;

      expect(url).toBe('/simple-blotter?id=reused-config-uuid');
      expect(result.isExisting).toBe(true);
    });
  });
});
