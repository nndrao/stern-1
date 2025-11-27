/**
 * Workspace Storage Provider
 *
 * Custom storage implementation that persists OpenFin workspaces and pages
 * to the Stern Configuration Service instead of the default IndexedDB.
 *
 * This provider extends WorkspacePlatformProvider and overrides storage methods
 * to use the REST API backend, enabling cross-device workspace synchronization.
 */

import type {
  WorkspacePlatformProvider,
  Workspace,
  Page,
  CreateSavedWorkspaceRequest,
  UpdateSavedWorkspaceRequest,
  CreateSavedPageRequest,
  UpdateSavedPageRequest
} from '@openfin/workspace-platform';
import { ConfigurationApiClient } from '../api/configurationApi';

/**
 * Callback invoked before workspace is saved
 * Use this to persist pending layouts or other deferred data
 */
export type WorkspaceSaveCallback = (workspaceId: string) => Promise<void>;

export interface WorkspaceStorageConfig {
  apiBaseUrl?: string;
  userId: string;
  enableFallback?: boolean;  // Fallback to default storage on API errors
  /** Callbacks to invoke before workspace save (for deferred persistence) */
  onBeforeWorkspaceSave?: WorkspaceSaveCallback[];
}

/**
 * Creates a workspace storage override callback
 */
export function createWorkspaceStorageOverride(config: WorkspaceStorageConfig) {
  return async (WorkspacePlatformProvider: {
    new (): WorkspacePlatformProvider;
  }): Promise<WorkspacePlatformProvider> => {
    class CustomWorkspaceStorage extends WorkspacePlatformProvider {
      private apiClient: ConfigurationApiClient;
      private userId: string;
      private enableFallback: boolean;
      private onBeforeWorkspaceSave: WorkspaceSaveCallback[];

      constructor() {
        super();
        this.apiClient = new ConfigurationApiClient(config.apiBaseUrl);
        this.userId = config.userId;
        this.enableFallback = config.enableFallback ?? true;
        this.onBeforeWorkspaceSave = config.onBeforeWorkspaceSave ?? [];

        console.log('[WorkspaceStorage] Initialized with Configuration Service backend', {
          apiBaseUrl: config.apiBaseUrl,
          userId: config.userId,
          fallbackEnabled: this.enableFallback,
          beforeSaveCallbacks: this.onBeforeWorkspaceSave.length
        });
      }

      /**
       * Execute all registered before-save callbacks
       * Used for deferred persistence of layouts
       */
      private async executeBeforeSaveCallbacks(workspaceId: string): Promise<void> {
        if (this.onBeforeWorkspaceSave.length === 0) return;

        console.log('[WorkspaceStorage] Executing before-save callbacks', {
          workspaceId,
          callbackCount: this.onBeforeWorkspaceSave.length
        });

        for (const callback of this.onBeforeWorkspaceSave) {
          try {
            await callback(workspaceId);
          } catch (error) {
            console.error('[WorkspaceStorage] Before-save callback failed:', error);
            // Continue with other callbacks even if one fails
          }
        }
      }

      /**
       * Get all saved workspaces for the current user
       */
      async getSavedWorkspaces(query?: string): Promise<Workspace[]> {
        console.log('[WorkspaceStorage] getSavedWorkspaces', { query });

        try {
          const workspaces = await this.apiClient.getWorkspaces(this.userId, query);
          console.log(`[WorkspaceStorage] Retrieved ${workspaces.length} workspaces`);
          return workspaces;
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to get workspaces:', error);

          if (this.enableFallback) {
            console.log('[WorkspaceStorage] Falling back to default storage');
            return super.getSavedWorkspaces(query);
          }

          throw error;
        }
      }

      /**
       * Get workspace metadata (for faster loading)
       */
      async getSavedWorkspacesMetadata(
        query?: string
      ): Promise<Pick<Workspace, 'title' | 'workspaceId'>[]> {
        console.log('[WorkspaceStorage] getSavedWorkspacesMetadata', { query });

        try {
          const workspaces = await this.apiClient.getWorkspaces(this.userId, query);
          return workspaces.map(w => ({
            workspaceId: w.workspaceId,
            title: w.title
          }));
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to get workspace metadata:', error);

          if (this.enableFallback) {
            return super.getSavedWorkspacesMetadata(query);
          }

          throw error;
        }
      }

      /**
       * Get a specific workspace by ID
       */
      async getSavedWorkspace(workspaceId: string): Promise<Workspace | undefined> {
        console.log('[WorkspaceStorage] getSavedWorkspace called for:', workspaceId);

        // Try fallback storage FIRST (IndexedDB has the active workspace state)
        if (this.enableFallback) {
          try {
            const fallbackWorkspace = await super.getSavedWorkspace(workspaceId);
            if (fallbackWorkspace) {
              console.log('[WorkspaceStorage] Found workspace in IndexedDB:', workspaceId);
              return fallbackWorkspace;
            }
          } catch (fallbackError) {
            console.log('[WorkspaceStorage] Workspace not in IndexedDB, trying API:', workspaceId);
          }
        }

        // Try API storage as secondary option
        try {
          const workspace = await this.apiClient.getWorkspace(workspaceId);
          if (workspace) {
            console.log('[WorkspaceStorage] Retrieved workspace from API:', workspaceId);
            return workspace;
          }
        } catch (apiError) {
          console.log('[WorkspaceStorage] Workspace not in API either:', workspaceId);
        }

        // If we get here, workspace doesn't exist anywhere
        // Return undefined (not throw error) per OpenFin API contract
        console.log('[WorkspaceStorage] Workspace not found, returning undefined:', workspaceId);
        return undefined;
      }

      /**
       * Create a new workspace
       */
      async createSavedWorkspace(req: CreateSavedWorkspaceRequest): Promise<void> {
        console.log('[WorkspaceStorage] createSavedWorkspace', {
          workspaceId: req.workspace.workspaceId,
          title: req.workspace.title
        });

        // Execute before-save callbacks (persist pending layouts)
        await this.executeBeforeSaveCallbacks(req.workspace.workspaceId);

        // Save to IndexedDB FIRST (required for OpenFin to work)
        if (this.enableFallback) {
          await super.createSavedWorkspace(req);
        }

        // Then save to API (for persistence across devices)
        try {
          await this.apiClient.saveWorkspace(req.workspace, this.userId);
          console.log('[WorkspaceStorage] Workspace saved to API');
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to save workspace to API (saved to IndexedDB only):', error);
          // Don't throw - IndexedDB save succeeded, which is enough for OpenFin to work
        }
      }

      /**
       * Update an existing workspace
       */
      async updateSavedWorkspace(req: UpdateSavedWorkspaceRequest): Promise<void> {
        console.log('[WorkspaceStorage] updateSavedWorkspace', {
          workspaceId: req.workspace.workspaceId,
          title: req.workspace.title
        });

        // Execute before-save callbacks (persist pending layouts)
        await this.executeBeforeSaveCallbacks(req.workspace.workspaceId);

        // Save to IndexedDB FIRST (required for OpenFin to work)
        if (this.enableFallback) {
          // Check if workspace exists in IndexedDB first
          const existingWorkspace = await super.getSavedWorkspace(req.workspace.workspaceId);

          if (existingWorkspace) {
            // Update existing workspace
            console.log('[WorkspaceStorage] Updating existing workspace in IndexedDB');
            await super.updateSavedWorkspace(req);
          } else {
            // Workspace doesn't exist yet, create it instead
            console.log('[WorkspaceStorage] Workspace not found in IndexedDB, creating new workspace');
            await super.createSavedWorkspace({
              workspace: req.workspace
            });
          }
        }

        // Then save to API (for persistence across devices)
        try {
          await this.apiClient.saveWorkspace(req.workspace, this.userId);
          console.log('[WorkspaceStorage] Workspace updated in API');
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to update workspace in API (saved to IndexedDB only):', error);
          // Don't throw - IndexedDB save succeeded, which is enough for OpenFin to work
        }
      }

      /**
       * Delete a workspace
       */
      async deleteSavedWorkspace(workspaceId: string): Promise<void> {
        console.log('[WorkspaceStorage] deleteSavedWorkspace', { workspaceId });

        try {
          await this.apiClient.deleteWorkspace(workspaceId);
          console.log('[WorkspaceStorage] Workspace deleted successfully');
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to delete workspace:', error);

          if (this.enableFallback) {
            return super.deleteSavedWorkspace(workspaceId);
          }

          throw error;
        }
      }

      /**
       * Get all saved pages for the current user
       */
      async getSavedPages(query?: string): Promise<Page[]> {
        console.log('[WorkspaceStorage] getSavedPages', { query });

        try {
          const pages = await this.apiClient.getPages(this.userId, query);
          console.log(`[WorkspaceStorage] Retrieved ${pages.length} pages`);
          return pages;
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to get pages:', error);

          if (this.enableFallback) {
            return super.getSavedPages(query);
          }

          throw error;
        }
      }

      /**
       * Get a specific page by ID
       */
      async getSavedPage(pageId: string): Promise<Page | undefined> {
        console.log('[WorkspaceStorage] getSavedPage called for:', pageId);

        // Try fallback storage FIRST (IndexedDB has the active workspace state)
        if (this.enableFallback) {
          try {
            const fallbackPage = await super.getSavedPage(pageId);
            if (fallbackPage) {
              console.log('[WorkspaceStorage] Found page in IndexedDB:', pageId);
              return fallbackPage;
            }
          } catch (fallbackError) {
            console.log('[WorkspaceStorage] Page not in IndexedDB, trying API:', pageId);
          }
        }

        // Try API storage as secondary option
        try {
          const page = await this.apiClient.getPage(pageId);
          if (page) {
            console.log('[WorkspaceStorage] Retrieved page from API:', pageId);
            return page;
          }
        } catch (apiError) {
          console.log('[WorkspaceStorage] Page not in API either:', pageId);
        }

        // If we get here, page doesn't exist anywhere
        // Return undefined (not throw error) per OpenFin API contract
        // This is expected for runtime pages that haven't been explicitly saved yet
        console.log('[WorkspaceStorage] Page not found, returning undefined (expected for unsaved runtime pages):', pageId);
        return undefined;
      }

      /**
       * Create a new page
       */
      async createSavedPage(req: CreateSavedPageRequest): Promise<void> {
        console.log('[WorkspaceStorage] createSavedPage', {
          pageId: req.page.pageId,
          title: req.page.title
        });

        // Save to IndexedDB FIRST (required for OpenFin to work)
        if (this.enableFallback) {
          await super.createSavedPage(req);
        }

        // Then save to API (for persistence across devices)
        try {
          await this.apiClient.savePage(req.page, this.userId);
          console.log('[WorkspaceStorage] Page saved to API');
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to save page to API (saved to IndexedDB only):', error);
          // Don't throw - IndexedDB save succeeded, which is enough for OpenFin to work
        }
      }

      /**
       * Update an existing page
       */
      async updateSavedPage(req: UpdateSavedPageRequest): Promise<void> {
        console.log('[WorkspaceStorage] updateSavedPage', {
          pageId: req.page.pageId,
          title: req.page.title
        });

        // Save to IndexedDB FIRST (required for OpenFin to work)
        if (this.enableFallback) {
          // Check if page exists in IndexedDB first
          const existingPage = await super.getSavedPage(req.page.pageId);

          if (existingPage) {
            // Update existing page
            console.log('[WorkspaceStorage] Updating existing page in IndexedDB');
            await super.updateSavedPage(req);
          } else {
            // Page doesn't exist yet, create it instead
            console.log('[WorkspaceStorage] Page not found in IndexedDB, creating new page');
            await super.createSavedPage({
              page: req.page
            });
          }
        }

        // Then save to API (for persistence across devices)
        try {
          await this.apiClient.savePage(req.page, this.userId);
          console.log('[WorkspaceStorage] Page updated in API');
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to update page in API (saved to IndexedDB only):', error);
          // Don't throw - IndexedDB save succeeded, which is enough for OpenFin to work
        }
      }

      /**
       * Delete a page
       */
      async deleteSavedPage(pageId: string): Promise<void> {
        console.log('[WorkspaceStorage] deleteSavedPage', { pageId });

        try {
          await this.apiClient.deletePage(pageId);
          console.log('[WorkspaceStorage] Page deleted successfully');
        } catch (error) {
          console.error('[WorkspaceStorage] Failed to delete page:', error);

          if (this.enableFallback) {
            return super.deleteSavedPage(pageId);
          }

          throw error;
        }
      }
    }

    return new CustomWorkspaceStorage();
  };
}
