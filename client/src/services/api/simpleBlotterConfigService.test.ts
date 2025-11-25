/**
 * SimpleBlotter Config Service Tests
 *
 * Tests for the config reuse functionality (findConfigByMenuItemAndUser, getOrCreateConfigByMenuItem)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimpleBlotterConfigService } from './simpleBlotterConfigService';
import { COMPONENT_TYPES } from '@stern/shared-types';

// Mock the apiClient
vi.mock('@/utils/api/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

// Mock the logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Import the mocked apiClient for assertions
import { apiClient } from '@/utils/api/apiClient';

describe('SimpleBlotterConfigService', () => {
  let service: SimpleBlotterConfigService;
  const mockApiClient = apiClient as any;

  const createMockUnifiedConfig = (overrides?: Partial<any>) => ({
    configId: 'config-uuid-123',
    appId: 'stern-platform',
    userId: 'test-user',
    parentId: null,
    componentType: COMPONENT_TYPES.SIMPLE_BLOTTER,
    componentSubType: 'bonds-blotter',
    name: 'Bonds Blotter',
    description: 'SimpleBlotter configuration for Bonds Blotter',
    config: {
      defaultLayoutId: null,
      lastSelectedLayoutId: null,
      favoriteLayoutIds: []
    },
    settings: [],
    activeSetting: 'default',
    tags: ['blotter'],
    isDefault: false,
    createdBy: 'test-user',
    lastUpdatedBy: 'test-user',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 1,
    ...overrides
  });

  beforeEach(() => {
    service = new SimpleBlotterConfigService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('findConfigByMenuItemAndUser', () => {
    it('should return null when no matching config is found', async () => {
      mockApiClient.get.mockResolvedValueOnce({ data: [] });

      const result = await service.findConfigByMenuItemAndUser('bonds-blotter', 'test-user');

      expect(result).toBeNull();
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/configurations/by-user/test-user',
        {
          params: {
            componentType: COMPONENT_TYPES.SIMPLE_BLOTTER,
            componentSubType: 'bonds-blotter'
          }
        }
      );
    });

    it('should return the existing config when found', async () => {
      const mockConfig = createMockUnifiedConfig();
      mockApiClient.get.mockResolvedValueOnce({ data: [mockConfig] });

      const result = await service.findConfigByMenuItemAndUser('bonds-blotter', 'test-user');

      expect(result).not.toBeNull();
      expect(result?.unified.configId).toBe('config-uuid-123');
      expect(result?.unified.componentSubType).toBe('bonds-blotter');
    });

    it('should return null when API returns 404', async () => {
      const error = { response: { status: 404 } };
      mockApiClient.get.mockRejectedValueOnce(error);

      const result = await service.findConfigByMenuItemAndUser('bonds-blotter', 'test-user');

      expect(result).toBeNull();
    });

    it('should throw error for non-404 API errors', async () => {
      const error = { response: { status: 500 }, message: 'Server error' };
      mockApiClient.get.mockRejectedValueOnce(error);

      await expect(service.findConfigByMenuItemAndUser('bonds-blotter', 'test-user'))
        .rejects.toEqual(error);
    });

    it('should return first config when multiple configs exist', async () => {
      const config1 = createMockUnifiedConfig({ configId: 'config-1' });
      const config2 = createMockUnifiedConfig({ configId: 'config-2' });
      mockApiClient.get.mockResolvedValueOnce({ data: [config1, config2] });

      const result = await service.findConfigByMenuItemAndUser('bonds-blotter', 'test-user');

      expect(result?.unified.configId).toBe('config-1');
    });
  });

  describe('getOrCreateConfigByMenuItem', () => {
    it('should return existing config when found (isNew: false)', async () => {
      const existingConfig = createMockUnifiedConfig();
      mockApiClient.get.mockResolvedValueOnce({ data: [existingConfig] });

      const result = await service.getOrCreateConfigByMenuItem(
        'bonds-blotter',
        'test-user',
        'Bonds Blotter'
      );

      expect(result.isNew).toBe(false);
      expect(result.configId).toBe('config-uuid-123');
      expect(result.unified.componentSubType).toBe('bonds-blotter');

      // Should NOT have called create or update
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('should create new config when not found (isNew: true)', async () => {
      // First call - findConfigByMenuItemAndUser returns empty
      mockApiClient.get.mockResolvedValueOnce({ data: [] });

      // Second call - createBlotterConfig POST
      const createdConfig = createMockUnifiedConfig({ configId: 'new-uuid-456' });
      mockApiClient.post.mockResolvedValueOnce({ data: createdConfig });

      // Third call - updateComponentSubType (get existing config)
      mockApiClient.get.mockResolvedValueOnce({ data: createdConfig });

      // Fourth call - updateComponentSubType PUT
      const updatedConfig = { ...createdConfig, componentSubType: 'bonds-blotter' };
      mockApiClient.put.mockResolvedValueOnce({ data: updatedConfig });

      // Fifth call - getBlotterConfig (fetch updated config)
      mockApiClient.get.mockResolvedValueOnce({ data: updatedConfig });

      const result = await service.getOrCreateConfigByMenuItem(
        'bonds-blotter',
        'test-user',
        'Bonds Blotter'
      );

      expect(result.isNew).toBe(true);
      expect(result.configId).toBeDefined();
      expect(mockApiClient.post).toHaveBeenCalled();
      expect(mockApiClient.put).toHaveBeenCalled();
    });

    it('should store menuItemId in componentSubType for new configs', async () => {
      // First call - findConfigByMenuItemAndUser returns empty
      mockApiClient.get.mockResolvedValueOnce({ data: [] });

      // Second call - createBlotterConfig POST
      const createdConfig = createMockUnifiedConfig({ configId: 'new-uuid-789' });
      mockApiClient.post.mockResolvedValueOnce({ data: createdConfig });

      // Third call - updateComponentSubType (get existing config)
      mockApiClient.get.mockResolvedValueOnce({ data: createdConfig });

      // Fourth call - updateComponentSubType PUT - verify menuItemId is passed
      const updatedConfig = { ...createdConfig, componentSubType: 'equity-blotter' };
      mockApiClient.put.mockResolvedValueOnce({ data: updatedConfig });

      // Fifth call - getBlotterConfig (fetch updated config)
      mockApiClient.get.mockResolvedValueOnce({ data: updatedConfig });

      await service.getOrCreateConfigByMenuItem(
        'equity-blotter',
        'test-user',
        'Equity Blotter'
      );

      // Verify the PUT call includes componentSubType
      expect(mockApiClient.put).toHaveBeenCalledWith(
        expect.stringContaining('/configurations/'),
        expect.objectContaining({
          componentSubType: 'equity-blotter'
        })
      );
    });
  });

  describe('updateComponentSubType', () => {
    it('should update componentSubType field on existing config', async () => {
      const existingConfig = createMockUnifiedConfig();
      mockApiClient.get.mockResolvedValueOnce({ data: existingConfig });

      const updatedConfig = { ...existingConfig, componentSubType: 'new-subtype' };
      mockApiClient.put.mockResolvedValueOnce({ data: updatedConfig });

      const result = await service.updateComponentSubType(
        'config-uuid-123',
        'new-subtype',
        'test-user'
      );

      expect(result.unified.componentSubType).toBe('new-subtype');
      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/configurations/config-uuid-123',
        expect.objectContaining({
          componentSubType: 'new-subtype',
          lastUpdatedBy: 'test-user'
        })
      );
    });

    it('should throw error when config not found', async () => {
      // getBlotterConfig returns 404, which means null is returned
      const error = { response: { status: 404 } };
      mockApiClient.get.mockRejectedValueOnce(error);

      await expect(service.updateComponentSubType('non-existent', 'subtype', 'user'))
        .rejects.toThrow('Blotter config not found: non-existent');
    });
  });
});
