/**
 * Configuration API Client
 *
 * Type-safe wrapper around the Configuration Service REST API
 * for workspace and page storage operations.
 */

import type {
  WorkspaceConfiguration,
  PageConfiguration,
  Workspace,
  Page
} from '../types/workspace';

// Component type constants - must match @stern/shared-types COMPONENT_TYPES
const COMPONENT_TYPES = {
  WORKSPACE: 'workspace',
  PAGE: 'page'
} as const;

export interface ConfigurationQueryParams {
  componentType?: string;
  componentSubType?: string;
  userId?: string;
  query?: string;
  includeDeleted?: boolean;
}

export interface CreateConfigurationRequest {
  configId?: string;
  appId: string;
  componentType: string;
  componentSubType?: string;
  userId: string;
  name: string;
  description?: string;
  config: any;
  settings?: any[];
  createdBy?: string;
  lastUpdatedBy?: string;
  tags?: string[];
}

export interface UpdateConfigurationRequest {
  name?: string;
  description?: string;
  config?: any;
  tags?: string[];
}

/**
 * Configuration API Client
 * Communicates with the Configuration Service backend
 */
export class ConfigurationApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * Query configurations with filters
   */
  async queryConfigurations(
    params: ConfigurationQueryParams
  ): Promise<WorkspaceConfiguration[] | PageConfiguration[]> {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined) as [string, string][]
    ).toString();

    const url = `${this.baseUrl}/configurations${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to query configurations: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get a specific configuration by ID
   */
  async getConfiguration(
    configId: string
  ): Promise<WorkspaceConfiguration | PageConfiguration> {
    const response = await fetch(`${this.baseUrl}/configurations/${configId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      throw new Error(`Failed to get configuration: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new configuration
   */
  async createConfiguration(
    request: CreateConfigurationRequest
  ): Promise<WorkspaceConfiguration | PageConfiguration> {
    const response = await fetch(`${this.baseUrl}/configurations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Failed to create configuration: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update an existing configuration
   */
  async updateConfiguration(
    configId: string,
    request: UpdateConfigurationRequest
  ): Promise<WorkspaceConfiguration | PageConfiguration> {
    const response = await fetch(`${this.baseUrl}/configurations/${configId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      throw new Error(`Failed to update configuration: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a configuration (soft delete)
   */
  async deleteConfiguration(configId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/configurations/${configId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Configuration not found: ${configId}`);
      }
      throw new Error(`Failed to delete configuration: ${response.statusText}`);
    }
  }

  /**
   * Get all workspaces for a user
   */
  async getWorkspaces(userId: string, query?: string): Promise<Workspace[]> {
    const configs = await this.queryConfigurations({
      componentType: COMPONENT_TYPES.WORKSPACE,
      userId,
      query
    }) as WorkspaceConfiguration[];

    return configs.map(config => config.config);
  }

  /**
   * Get a specific workspace
   */
  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const config = await this.getConfiguration(workspaceId) as WorkspaceConfiguration;
    return config.config;
  }

  /**
   * Save a workspace
   */
  async saveWorkspace(workspace: Workspace, userId: string): Promise<Workspace> {
    const existing = await this.getConfiguration(workspace.workspaceId)
      .catch(() => null);

    if (existing) {
      // Update existing
      const updated = await this.updateConfiguration(workspace.workspaceId, {
        name: workspace.title,
        config: workspace
      }) as WorkspaceConfiguration;
      return updated.config;
    } else {
      // Create new
      const created = await this.createConfiguration({
        configId: workspace.workspaceId,
        appId: 'stern-platform',
        componentType: COMPONENT_TYPES.WORKSPACE,
        componentSubType: 'openfin',
        userId,
        name: workspace.title || 'Untitled Workspace',
        config: workspace,
        settings: [],
        createdBy: userId,
        lastUpdatedBy: userId,
        tags: ['workspace']
      }) as WorkspaceConfiguration;
      return created.config;
    }
  }

  /**
   * Delete a workspace
   */
  async deleteWorkspace(workspaceId: string): Promise<void> {
    await this.deleteConfiguration(workspaceId);
  }

  /**
   * Get all pages for a user
   */
  async getPages(userId: string, query?: string): Promise<Page[]> {
    const configs = await this.queryConfigurations({
      componentType: COMPONENT_TYPES.PAGE,
      userId,
      query
    }) as PageConfiguration[];

    return configs.map(config => config.config);
  }

  /**
   * Get a specific page
   */
  async getPage(pageId: string): Promise<Page> {
    const config = await this.getConfiguration(pageId) as PageConfiguration;
    return config.config;
  }

  /**
   * Save a page
   */
  async savePage(page: Page, userId: string): Promise<Page> {
    const existing = await this.getConfiguration(page.pageId)
      .catch(() => null);

    if (existing) {
      // Update existing
      const updated = await this.updateConfiguration(page.pageId, {
        name: page.title,
        config: page
      }) as PageConfiguration;
      return updated.config;
    } else {
      // Create new
      const created = await this.createConfiguration({
        configId: page.pageId,
        appId: 'stern-platform',
        componentType: COMPONENT_TYPES.PAGE,
        componentSubType: 'openfin',
        userId,
        name: page.title || 'Untitled Page',
        config: page,
        settings: [],
        createdBy: userId,
        lastUpdatedBy: userId,
        tags: ['page']
      }) as PageConfiguration;
      return created.config;
    }
  }

  /**
   * Delete a page
   */
  async deletePage(pageId: string): Promise<void> {
    await this.deleteConfiguration(pageId);
  }
}
