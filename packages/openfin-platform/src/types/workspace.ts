/**
 * OpenFin Workspace Type Definitions
 *
 * These types align with OpenFin's Workspace Platform API
 * and are stored as configurations using the Configuration Service.
 */

import type { Page, Workspace } from '@openfin/workspace-platform';

// Re-export OpenFin types
export type { Page, Workspace };

/**
 * Workspace metadata for storage
 */
export interface WorkspaceMetadata {
  workspaceId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  tags?: string[];
}

/**
 * Configuration document structure for workspaces
 * Maps OpenFin Workspace to Configuration Service format
 */
export interface WorkspaceConfiguration {
  configId: string;           // Maps to workspace.workspaceId
  componentType: 'workspace';  // Fixed value for workspace configs (lowercase)
  componentSubType?: 'openfin';
  userId: string;
  name: string;                // Maps to workspace.title
  description?: string;
  config: Workspace;           // Full OpenFin workspace data
  tags?: string[];
  createdBy: string;
  lastUpdatedBy: string;
  creationTime: string;
  lastUpdated: string;
  deletedAt?: string | null;
}

/**
 * Page configuration structure
 * Maps OpenFin Page to Configuration Service format
 */
export interface PageConfiguration {
  configId: string;            // Maps to page.pageId
  componentType: 'page';       // Fixed value for page configs (lowercase)
  componentSubType?: 'openfin';
  userId: string;
  name: string;                // Maps to page.title
  config: Page;                // Full OpenFin page data
  tags?: string[];
  createdBy: string;
  lastUpdatedBy: string;
  creationTime: string;
  lastUpdated: string;
  deletedAt?: string | null;
}

/**
 * Query parameters for workspace retrieval
 */
export interface WorkspaceQuery {
  userId?: string;
  query?: string;              // Search term
  includeDeleted?: boolean;
  tags?: string[];
}

/**
 * Helper function to convert OpenFin Workspace to Configuration
 */
export function workspaceToConfiguration(
  workspace: Workspace,
  userId: string
): Partial<WorkspaceConfiguration> {
  return {
    configId: workspace.workspaceId,
    componentType: 'workspace',
    componentSubType: 'openfin',
    userId,
    name: workspace.title || 'Untitled Workspace',
    config: workspace,
    tags: ['workspace'],
    createdBy: userId,
    lastUpdatedBy: userId
  };
}

/**
 * Helper function to convert Configuration to OpenFin Workspace
 */
export function configurationToWorkspace(config: WorkspaceConfiguration): Workspace {
  return config.config;
}

/**
 * Helper function to convert OpenFin Page to Configuration
 */
export function pageToConfiguration(
  page: Page,
  userId: string
): Partial<PageConfiguration> {
  return {
    configId: page.pageId,
    componentType: 'page',
    componentSubType: 'openfin',
    userId,
    name: page.title || 'Untitled Page',
    config: page,
    createdBy: userId,
    lastUpdatedBy: userId
  };
}

/**
 * Helper function to convert Configuration to OpenFin Page
 */
export function configurationToPage(config: PageConfiguration): Page {
  return config.config;
}
