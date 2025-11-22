/**
 * SimpleBlotter Configuration Service
 *
 * Manages SimpleBlotter configurations stored as UnifiedConfig.
 * Handles both parent blotter configs and child layout configs.
 *
 * Architecture:
 * - Blotter config: componentType='simple-blotter', configId=viewInstanceId
 * - Layout config: componentType='simple-blotter-layout', parentId=blotter's configId
 */

import { apiClient } from '@/utils/api/apiClient';
import {
  UnifiedConfig,
  COMPONENT_TYPES,
  SimpleBlotterConfig,
  SimpleBlotterLayoutConfig,
  createDefaultBlotterConfig,
  createDefaultLayoutConfig
} from '@stern/shared-types';
import { logger } from '@/utils/logger';

const APP_ID = 'stern-platform';

/**
 * Service for managing SimpleBlotter configurations
 */
export class SimpleBlotterConfigService {
  private readonly baseUrl = '/configurations';

  // ============================================================================
  // Blotter Config Operations (Parent)
  // ============================================================================

  /**
   * Convert SimpleBlotterConfig to UnifiedConfig format
   */
  private blotterToUnifiedConfig(
    configId: string,
    config: SimpleBlotterConfig,
    userId: string,
    name: string
  ): Partial<UnifiedConfig> {
    return {
      configId,
      appId: APP_ID,
      userId,
      parentId: null, // Blotter is the parent, has no parent itself
      componentType: COMPONENT_TYPES.SIMPLE_BLOTTER,
      name,
      description: `SimpleBlotter configuration for ${name}`,
      config: config as unknown as Record<string, unknown>,
      settings: [],
      activeSetting: 'default',
      tags: ['blotter'],
      isDefault: false,
      createdBy: userId,
      lastUpdatedBy: userId
    };
  }

  /**
   * Extract SimpleBlotterConfig from UnifiedConfig
   */
  private blotterFromUnifiedConfig(unified: UnifiedConfig): SimpleBlotterConfig {
    return unified.config as unknown as SimpleBlotterConfig;
  }

  /**
   * Get blotter configuration by configId (viewInstanceId)
   * Returns null if not found
   */
  async getBlotterConfig(configId: string): Promise<{ config: SimpleBlotterConfig; unified: UnifiedConfig } | null> {
    try {
      logger.debug('Fetching blotter config', { configId }, 'SimpleBlotterConfigService');

      const response = await apiClient.get<UnifiedConfig>(`${this.baseUrl}/${configId}`);
      const unified = response.data;

      // Verify it's a blotter config
      if (unified.componentType !== COMPONENT_TYPES.SIMPLE_BLOTTER) {
        logger.warn('Config found but not a blotter type', { configId, type: unified.componentType }, 'SimpleBlotterConfigService');
        return null;
      }

      return {
        config: this.blotterFromUnifiedConfig(unified),
        unified
      };
    } catch (error: any) {
      if (error?.response?.status === 404) {
        logger.debug('Blotter config not found', { configId }, 'SimpleBlotterConfigService');
        return null;
      }
      logger.error('Failed to fetch blotter config', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Create a new blotter configuration
   * Uses configId = viewInstanceId (from OpenFin)
   */
  async createBlotterConfig(
    configId: string,
    userId: string,
    name: string,
    config?: Partial<SimpleBlotterConfig>
  ): Promise<{ config: SimpleBlotterConfig; unified: UnifiedConfig }> {
    try {
      logger.info('Creating blotter config', { configId, name }, 'SimpleBlotterConfigService');

      const blotterConfig = createDefaultBlotterConfig(config);
      const unifiedConfig = this.blotterToUnifiedConfig(configId, blotterConfig, userId, name);

      const response = await apiClient.post<UnifiedConfig>(this.baseUrl, unifiedConfig);

      logger.info('Blotter config created', { configId: response.data.configId }, 'SimpleBlotterConfigService');

      return {
        config: this.blotterFromUnifiedConfig(response.data),
        unified: response.data
      };
    } catch (error) {
      logger.error('Failed to create blotter config', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Update blotter configuration
   */
  async updateBlotterConfig(
    configId: string,
    updates: Partial<SimpleBlotterConfig>,
    userId: string
  ): Promise<{ config: SimpleBlotterConfig; unified: UnifiedConfig }> {
    try {
      logger.info('Updating blotter config', { configId }, 'SimpleBlotterConfigService');

      // Get existing config
      const existing = await this.getBlotterConfig(configId);
      if (!existing) {
        throw new Error(`Blotter config not found: ${configId}`);
      }

      // Merge updates
      const updatedConfig: SimpleBlotterConfig = {
        ...existing.config,
        ...updates
      };

      const response = await apiClient.put<UnifiedConfig>(`${this.baseUrl}/${configId}`, {
        config: updatedConfig,
        lastUpdatedBy: userId
      });

      logger.info('Blotter config updated', { configId }, 'SimpleBlotterConfigService');

      return {
        config: this.blotterFromUnifiedConfig(response.data),
        unified: response.data
      };
    } catch (error) {
      logger.error('Failed to update blotter config', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Get or create blotter configuration
   * If config exists, returns it. Otherwise creates a new one with defaults.
   */
  async getOrCreateBlotterConfig(
    configId: string,
    userId: string,
    name: string
  ): Promise<{ config: SimpleBlotterConfig; unified: UnifiedConfig; isNew: boolean }> {
    const existing = await this.getBlotterConfig(configId);

    if (existing) {
      return { ...existing, isNew: false };
    }

    const created = await this.createBlotterConfig(configId, userId, name);
    return { ...created, isNew: true };
  }

  /**
   * Delete blotter configuration and all its layouts
   */
  async deleteBlotterConfig(configId: string): Promise<void> {
    try {
      logger.info('Deleting blotter config and layouts', { configId }, 'SimpleBlotterConfigService');

      // First, delete all child layouts
      const layouts = await this.getLayoutsByBlotter(configId);
      for (const layout of layouts) {
        await apiClient.delete(`${this.baseUrl}/${layout.unified.configId}`);
      }

      // Then delete the blotter config itself
      await apiClient.delete(`${this.baseUrl}/${configId}`);

      logger.info('Blotter config and layouts deleted', { configId, layoutCount: layouts.length }, 'SimpleBlotterConfigService');
    } catch (error) {
      logger.error('Failed to delete blotter config', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  // ============================================================================
  // Layout Config Operations (Child)
  // ============================================================================

  /**
   * Convert SimpleBlotterLayoutConfig to UnifiedConfig format
   */
  private layoutToUnifiedConfig(
    blotterConfigId: string,
    config: SimpleBlotterLayoutConfig,
    userId: string,
    name: string,
    layoutId?: string
  ): Partial<UnifiedConfig> {
    return {
      configId: layoutId, // Let server generate if not provided
      appId: APP_ID,
      userId,
      parentId: blotterConfigId, // Link to parent blotter
      componentType: COMPONENT_TYPES.SIMPLE_BLOTTER_LAYOUT,
      name,
      description: `Layout: ${name}`,
      config: config as unknown as Record<string, unknown>,
      settings: [],
      activeSetting: 'default',
      tags: ['layout'],
      isDefault: false,
      createdBy: userId,
      lastUpdatedBy: userId
    };
  }

  /**
   * Extract SimpleBlotterLayoutConfig from UnifiedConfig
   */
  private layoutFromUnifiedConfig(unified: UnifiedConfig): SimpleBlotterLayoutConfig {
    return unified.config as unknown as SimpleBlotterLayoutConfig;
  }

  /**
   * Get all layouts for a blotter
   */
  async getLayoutsByBlotter(blotterConfigId: string): Promise<Array<{ config: SimpleBlotterLayoutConfig; unified: UnifiedConfig }>> {
    try {
      logger.debug('Fetching layouts for blotter', { blotterConfigId }, 'SimpleBlotterConfigService');

      const response = await apiClient.get<UnifiedConfig[]>(`${this.baseUrl}/by-parent/${blotterConfigId}`, {
        params: {
          componentType: COMPONENT_TYPES.SIMPLE_BLOTTER_LAYOUT
        }
      });

      const layouts = response.data.map(unified => ({
        config: this.layoutFromUnifiedConfig(unified),
        unified
      }));

      logger.debug('Layouts fetched', { blotterConfigId, count: layouts.length }, 'SimpleBlotterConfigService');

      return layouts;
    } catch (error) {
      logger.error('Failed to fetch layouts', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Get a specific layout by ID
   */
  async getLayoutConfig(layoutId: string): Promise<{ config: SimpleBlotterLayoutConfig; unified: UnifiedConfig } | null> {
    try {
      logger.debug('Fetching layout config', { layoutId }, 'SimpleBlotterConfigService');

      const response = await apiClient.get<UnifiedConfig>(`${this.baseUrl}/${layoutId}`);
      const unified = response.data;

      // Verify it's a layout config
      if (unified.componentType !== COMPONENT_TYPES.SIMPLE_BLOTTER_LAYOUT) {
        logger.warn('Config found but not a layout type', { layoutId, type: unified.componentType }, 'SimpleBlotterConfigService');
        return null;
      }

      return {
        config: this.layoutFromUnifiedConfig(unified),
        unified
      };
    } catch (error: any) {
      if (error?.response?.status === 404) {
        logger.debug('Layout config not found', { layoutId }, 'SimpleBlotterConfigService');
        return null;
      }
      logger.error('Failed to fetch layout config', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Create a new layout for a blotter
   */
  async createLayout(
    blotterConfigId: string,
    userId: string,
    name: string,
    config?: Partial<SimpleBlotterLayoutConfig>
  ): Promise<{ config: SimpleBlotterLayoutConfig; unified: UnifiedConfig }> {
    try {
      logger.info('Creating layout', { blotterConfigId, name }, 'SimpleBlotterConfigService');

      const layoutConfig = createDefaultLayoutConfig(config);
      const unifiedConfig = this.layoutToUnifiedConfig(blotterConfigId, layoutConfig, userId, name);

      const response = await apiClient.post<UnifiedConfig>(this.baseUrl, unifiedConfig);

      logger.info('Layout created', { layoutId: response.data.configId, blotterConfigId }, 'SimpleBlotterConfigService');

      return {
        config: this.layoutFromUnifiedConfig(response.data),
        unified: response.data
      };
    } catch (error) {
      logger.error('Failed to create layout', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Update a layout configuration
   */
  async updateLayout(
    layoutId: string,
    updates: Partial<SimpleBlotterLayoutConfig>,
    userId: string
  ): Promise<{ config: SimpleBlotterLayoutConfig; unified: UnifiedConfig }> {
    try {
      logger.info('Updating layout', { layoutId }, 'SimpleBlotterConfigService');

      // Get existing config
      const existing = await this.getLayoutConfig(layoutId);
      if (!existing) {
        throw new Error(`Layout config not found: ${layoutId}`);
      }

      // Merge updates
      const updatedConfig: SimpleBlotterLayoutConfig = {
        ...existing.config,
        ...updates
      };

      const response = await apiClient.put<UnifiedConfig>(`${this.baseUrl}/${layoutId}`, {
        config: updatedConfig,
        lastUpdatedBy: userId
      });

      logger.info('Layout updated', { layoutId }, 'SimpleBlotterConfigService');

      return {
        config: this.layoutFromUnifiedConfig(response.data),
        unified: response.data
      };
    } catch (error) {
      logger.error('Failed to update layout', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Delete a layout
   */
  async deleteLayout(layoutId: string): Promise<void> {
    try {
      logger.info('Deleting layout', { layoutId }, 'SimpleBlotterConfigService');

      await apiClient.delete(`${this.baseUrl}/${layoutId}`);

      logger.info('Layout deleted', { layoutId }, 'SimpleBlotterConfigService');
    } catch (error) {
      logger.error('Failed to delete layout', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Duplicate a layout
   */
  async duplicateLayout(
    layoutId: string,
    newName: string,
    userId: string
  ): Promise<{ config: SimpleBlotterLayoutConfig; unified: UnifiedConfig }> {
    try {
      logger.info('Duplicating layout', { layoutId, newName }, 'SimpleBlotterConfigService');

      const existing = await this.getLayoutConfig(layoutId);
      if (!existing) {
        throw new Error(`Layout config not found: ${layoutId}`);
      }

      // Create new layout with same config but new name
      const newLayout = await this.createLayout(
        existing.unified.parentId!,
        userId,
        newName,
        existing.config
      );

      logger.info('Layout duplicated', { originalId: layoutId, newId: newLayout.unified.configId }, 'SimpleBlotterConfigService');

      return newLayout;
    } catch (error) {
      logger.error('Failed to duplicate layout', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Set default layout for a blotter
   */
  async setDefaultLayout(blotterConfigId: string, layoutId: string, userId: string): Promise<void> {
    try {
      logger.info('Setting default layout', { blotterConfigId, layoutId }, 'SimpleBlotterConfigService');

      await this.updateBlotterConfig(blotterConfigId, { defaultLayoutId: layoutId }, userId);

      logger.info('Default layout set', { blotterConfigId, layoutId }, 'SimpleBlotterConfigService');
    } catch (error) {
      logger.error('Failed to set default layout', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }

  /**
   * Get the default layout for a blotter, or the first layout if no default is set
   */
  async getDefaultLayout(blotterConfigId: string): Promise<{ config: SimpleBlotterLayoutConfig; unified: UnifiedConfig } | null> {
    try {
      const blotter = await this.getBlotterConfig(blotterConfigId);
      if (!blotter) {
        return null;
      }

      const layouts = await this.getLayoutsByBlotter(blotterConfigId);
      if (layouts.length === 0) {
        return null;
      }

      // Find the default layout
      const defaultLayoutId = blotter.config.defaultLayoutId;
      if (defaultLayoutId) {
        const defaultLayout = layouts.find(l => l.unified.configId === defaultLayoutId);
        if (defaultLayout) {
          return defaultLayout;
        }
      }

      // Fall back to first layout
      return layouts[0];
    } catch (error) {
      logger.error('Failed to get default layout', error, 'SimpleBlotterConfigService');
      throw error;
    }
  }
}

// Export singleton instance
export const simpleBlotterConfigService = new SimpleBlotterConfigService();
