import { useState, useEffect, useRef } from 'react';
import { init, getCurrentSync } from '@openfin/workspace-platform';
import {
  createWorkspaceStorageOverride,
  createCustomActions,
  VIEW_CONTEXT_MENU_ACTIONS,
  registerConfigLookupCallback,
  combineOverrides,
  ViewContextMenuActionHandler,
  DockConfiguration
} from '@stern/openfin-platform';
import { TopTabBar } from '@/components/provider/navigation/TopTabBar';
import DockConfigEditor from '@/components/provider/forms/DockConfigEditor';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/ui/use-toast';
import * as dock from './openfinDock';
import { buildUrl, initializeBaseUrlFromManifest } from '@stern/openfin-platform';
import { logger } from '@/utils/logger';
import { dockConfigService } from '@/services/api/dockConfigService';
import { viewManager } from '@/services/viewManager';
import { initializeOpenFinPlatformLibrary } from './openfinPlatformAdapter';
import { handleDuplicateViewAction } from '../actions/viewActions';
import { handleRenameViewAction } from '../actions/renameViewAction';
import { layoutCache } from '@/services/cache/layoutCache';
import { simpleBlotterConfigService } from '@/services/api/simpleBlotterConfigService';

// Placeholder components for future features
const SettingsPanel = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <h2 className="text-2xl font-semibold mb-2">Settings</h2>
      <p className="text-muted-foreground">Settings panel coming soon</p>
    </div>
  </div>
);

const HelpPanel = () => (
  <div className="flex items-center justify-center h-full">
    <div className="text-center">
      <h2 className="text-2xl font-semibold mb-2">Help & Documentation</h2>
      <p className="text-muted-foreground">Help documentation coming soon</p>
    </div>
  </div>
);

// Main dashboard layout - moved outside Provider to prevent recreation on every render
interface DashboardContentProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const DashboardContent: React.FC<DashboardContentProps> = ({ activeTab, onTabChange }) => {
  // Note: useOpenfinTheme is called at App level, no need to call here
  // Calling it here causes performance issues and excessive re-subscriptions

  // Log on mount (for debugging only)
  useEffect(() => {
    logger.info('[PROVIDER WINDOW] DashboardContent mounted', {
      isOpenFin: typeof window !== 'undefined' && !!window.fin,
      htmlClassName: document.documentElement.className,
      htmlHasDark: document.documentElement.classList.contains('dark'),
    }, 'DashboardContent');
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground p-2.5">
      <TopTabBar
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
      <main className="flex-1 overflow-hidden">
        {activeTab === 'dock' && <DockConfigEditor />}
        {activeTab === 'settings' && <SettingsPanel />}
        {activeTab === 'help' && <HelpPanel />}
      </main>
    </div>
  );
};

export default function Provider() {
  const isInitialized = useRef(false);
  const [isPlatformReady, setIsPlatformReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dock');
  const { toast } = useToast();

  useEffect(() => {
    let analyticsErrorHandler: ((event: PromiseRejectionEvent) => void) | null = null;

    // Check if we're in OpenFin environment and prevent double initialization
    if (typeof window !== 'undefined' && window.fin && !isInitialized.current) {
      isInitialized.current = true;

      // Capture the handler reference for cleanup
      const initializeWithCleanup = async () => {
        analyticsErrorHandler = await initializePlatform();
      };
      initializeWithCleanup();
    } else if (!window.fin) {
      logger.info('Not in OpenFin environment - Provider will not initialize', undefined, 'Provider');
      // Still show the UI in non-OpenFin environment for development
      setIsPlatformReady(true);
    }

    // Cleanup function
    return () => {
      if (analyticsErrorHandler) {
        window.removeEventListener('unhandledrejection', analyticsErrorHandler);
        logger.debug('Cleaned up analytics error handler', undefined, 'Provider');
      }
    };
  }, []);

  async function getManifestCustomSettings() {
    try {
      // Get the current OpenFin application
      const app = await fin.Application.getCurrent();

      // Get the manifest - using the correct API
      const manifest = await app.getManifest() as any;

      // Initialize base URL from manifest if available
      await initializeBaseUrlFromManifest();

      // Platform icon: Use SVG for windows (provider, apps) - works fine with SVG
      // Note: Dock provider taskbar icon requires PNG/ICO - handled in openfinDock.ts
      // star.svg (2.5KB) works for regular windows, dock will auto-convert to star.png
      const iconUrl = manifest.platform?.icon || buildUrl("/star.svg");
      logger.info(`[DOCK_ICON] Platform icon URL: "${iconUrl}"`, undefined, 'Provider');

      // Log platform context if available
      if (manifest.platform?.context) {
        logger.info('[PLATFORM CONTEXT] Found platform context in manifest', manifest.platform.context, 'Provider');
        if (manifest.platform.context.apiUrl) {
          logger.info(`[API CONFIG] API URL from manifest: ${manifest.platform.context.apiUrl}`, undefined, 'Provider');
        }
        if (manifest.platform.context.environment) {
          logger.info(`[API CONFIG] Environment: ${manifest.platform.context.environment}`, undefined, 'Provider');
        }
      } else {
        logger.warn('[PLATFORM CONTEXT] No platform context found in manifest, will use defaults', undefined, 'Provider');
      }

      return {
        platformSettings: {
          id: manifest.platform?.uuid || "stern-platform",
          title: manifest.shortcut?.name || "STAR Trading Platform",
          icon: iconUrl
        },
        customSettings: manifest.customSettings || { apps: [] },
        platformContext: manifest.platform?.context || {}
      };
    } catch (error) {
      logger.error('Failed to get manifest settings', error, 'Provider');
      // Return defaults if manifest loading fails
      return {
        platformSettings: {
          id: "stern-platform",
          title: "STAR Trading Platform",
          icon: buildUrl("/star.svg")  // SVG for windows (dock converts to PNG automatically)
        },
        customSettings: { apps: [] },
        platformContext: {}
      };
    }
  }


  async function initializePlatform(): Promise<(event: PromiseRejectionEvent) => void> {
    try {
      logger.info('Starting OpenFin platform initialization...', undefined, 'Provider');

      // Initialize OpenFin platform library with Stern's services
      initializeOpenFinPlatformLibrary();

      // Suppress OpenFin analytics errors globally
      // These are non-fatal and occur when analytics payload format is incorrect
      const analyticsErrorHandler = (event: PromiseRejectionEvent) => {
        if (event.reason?.message?.includes('system topic payload') ||
            event.reason?.message?.includes('registerUsage')) {
          logger.warn('Suppressed analytics error (non-fatal)', event.reason, 'Provider');
          event.preventDefault(); // Prevent error from showing in console
        }
      };
      window.addEventListener('unhandledrejection', analyticsErrorHandler);

      // Get settings from manifest
      const settings = await getManifestCustomSettings();
      const apps = settings.customSettings.apps || [];

      logger.info('Platform settings:', settings.platformSettings, 'Provider');
      logger.debug('Apps to register:', apps, 'Provider');

      // FIRST: Initialize the workspace platform
      logger.info('Initializing workspace platform...', undefined, 'Provider');

      // Wrap in try-catch to handle initialization errors
      try {
        // Initialize following OpenFin workspace-starter patterns
        // IMPORTANT: Do NOT include analytics config - omitting it disables analytics entirely
        // Including analytics: { sendToOpenFin: false } still triggers analytics initialization

        // Get API base URL from platform context
        const apiBaseUrl = settings.platformContext?.apiUrl || 'http://localhost:3001/api/v1';
        const userId = settings.platformContext?.userId || 'default-user';

        logger.info('[WorkspaceStorage] Configuring custom workspace storage with dual storage strategy', { apiBaseUrl, userId }, 'Provider');

        // Create workspace storage override (returns instance directly)
        // onBeforeWorkspaceSave callbacks are invoked before workspace is saved to persist pending layouts
        const workspaceStorageOverride = createWorkspaceStorageOverride({
          apiBaseUrl,
          userId,
          enableFallback: true,
          onBeforeWorkspaceSave: [
            async (workspaceId: string) => {
              logger.info('[WorkspaceStorage] Before-save callback: persisting pending layouts', { workspaceId }, 'Provider');
              const result = await layoutCache.persistAll();
              if (result.success) {
                logger.info('[WorkspaceStorage] Layouts persisted successfully', {
                  workspaceId,
                  savedCount: result.savedCount,
                  deletedCount: result.deletedCount
                }, 'Provider');
              } else {
                logger.error('[WorkspaceStorage] Some layouts failed to persist', {
                  workspaceId,
                  errors: result.errors
                }, 'Provider');
              }
            }
          ]
        });

        // Create custom actions handler for context menu items
        const customViewActionsHandler: ViewContextMenuActionHandler = async (action, payload) => {
          logger.info('View context menu action triggered', { action }, 'Provider');

          if (action === VIEW_CONTEXT_MENU_ACTIONS.DUPLICATE_VIEW_WITH_LAYOUTS) {
            // Handle each selected view
            for (const viewIdentity of payload.selectedViews) {
              const result = await handleDuplicateViewAction(viewIdentity);
              if (!result.success) {
                logger.error('Failed to duplicate view', { error: result.error, viewIdentity }, 'Provider');
              } else {
                logger.info('View duplicated successfully', { newViewId: result.newViewId }, 'Provider');
              }
            }
          } else if (action === VIEW_CONTEXT_MENU_ACTIONS.RENAME_VIEW) {
            // Handle rename view action using extracted action handler
            if (payload.selectedViews.length === 0) {
              logger.warn('No view selected for rename', {}, 'Provider');
              return;
            }

            // Get the first selected view
            const viewIdentity = payload.selectedViews[0];
            const result = await handleRenameViewAction(viewIdentity);

            if (!result.success) {
              logger.error('Failed to rename view', { error: result.error, viewIdentity }, 'Provider');

              // Show error toast if there was an actual error (not just cancelled)
              if (result.error) {
                toast({
                  title: "Failed to rename view",
                  description: result.error.message || "An unknown error occurred",
                  variant: "destructive",
                });
              }
            } else if (result.newName) {
              logger.info('View renamed successfully', {
                oldName: viewIdentity.name,
                newName: result.newName
              }, 'Provider');

              // Show success toast
              toast({
                title: "View renamed",
                description: `Successfully renamed to "${result.newName}"`,
              });
            }
          }
        };

        const customActions = {
          ...dock.dockGetCustomActions(),
          ...createCustomActions(customViewActionsHandler)
        };

        // Combine workspace storage + browser overrides
        const combinedOverride = combineOverrides(
          workspaceStorageOverride,
          {
            onAction: customViewActionsHandler,
            enableDuplicateWithLayouts: true,
            enableRenameView: true,
            enableWindowTitleUpdates: true,
            defaultWindowTitle: 'Dock Configurator'
          }
        );

        await init({
          browser: {
            defaultWindowOptions: {
              icon: settings.platformSettings.icon,
              workspacePlatform: {
                pages: [],
                favicon: settings.platformSettings.icon
              }
            }
          },
          overrideCallback: combinedOverride,
          theme: [{
            label: "STAR Theme",
            default: "dark",
            palettes: {
              light: {
                brandPrimary: "#0A76D3",
                brandSecondary: "#1E1F23",
                backgroundPrimary: "#FFFFFF",
                background1: "#FAFBFE",
                background2: "#F5F6FA",
                background3: "#ECEEF5",
                background4: "#E0E3EB",
                background5: "#D4D8E1",
                background6: "#A8ADB9",
                statusSuccess: "#35C759",
                statusWarning: "#FF9500",
                statusCritical: "#FF3B30",
                statusActive: "#0A76D3",
                inputBackground: "#FFFFFF",
                inputColor: "#1E1F23",
                inputPlaceholder: "#A8ADB9",
                inputDisabled: "#D4D8E1",
                inputFocused: "#0A76D3",
                textDefault: "#1E1F23",
                textHelp: "#6C757D",
                textInactive: "#A8ADB9"
              },
              dark: {
                brandPrimary: "#0A76D3",
                brandSecondary: "#383A40",
                backgroundPrimary: "#000000",
                background1: "#111214",
                background2: "#1E1F23",
                background3: "#24262B",
                background4: "#2F3136",
                background5: "#383A40",
                background6: "#53565F",
                statusSuccess: "#35C759",
                statusWarning: "#FF9500",
                statusCritical: "#FF3B30",
                statusActive: "#0879C4",
                inputBackground: "#53565F",
                inputColor: "#FFFFFF",
                inputPlaceholder: "#C9CBD2",
                inputDisabled: "#7D808A",
                inputFocused: "#C9CBD2",
                textDefault: "#FFFFFF",
                textHelp: "#C9CBD2",
                textInactive: "#7D808A"
              }
            }
          }],
          customActions
        });

        logger.info('Platform initialized, waiting for platform-api-ready...', undefined, 'Provider');
      } catch (initError: unknown) {
        const error = initError as Error;
        logger.error('Failed to initialize workspace platform', error, 'Provider');
        // Continue anyway - the UI should still work
        if (error?.message?.includes('system topic payload')) {
          logger.warn('OpenFin workspace initialization failed with usage tracking error - this is expected in some environments', undefined, 'Provider');
          logger.info('Continuing with platform initialization despite error', undefined, 'Provider');
        } else {
          // Re-throw if it's a different error
          throw error;
        }
      }

      // Get the current platform
      try {
        const platform = fin.Platform.getCurrentSync();

        // THEN: Register components when platform API is ready
        platform.once("platform-api-ready", async () => {
        logger.info('Platform API ready - registering workspace components', undefined, 'Provider');

        try {
          // Add a small delay to ensure workspace APIs are fully initialized
          await new Promise(resolve => setTimeout(resolve, 500));

          // Initialize View Manager for persistent view instance tracking
          try {
            logger.info('Initializing View Manager...', undefined, 'Provider');
            await viewManager.initialize();
            logger.info('View Manager initialized successfully', undefined, 'Provider');
          } catch (viewManagerError) {
            logger.error('Failed to initialize View Manager', viewManagerError, 'Provider');
            // Continue anyway - view manager is not critical for platform operation
          }

          // Register config lookup callback for "reuse existing config" behavior
          // When a dock menu item is clicked, this callback checks if a config already exists
          // for that menu item + user combination, and reuses it instead of creating a new one
          const configUserId = settings.platformContext?.userId || 'default-user';
          registerConfigLookupCallback(async (menuItemId: string, caption: string) => {
            try {
              logger.info('Config lookup callback invoked', { menuItemId, caption, userId: configUserId }, 'Provider');

              const result = await simpleBlotterConfigService.getOrCreateConfigByMenuItem(
                menuItemId,
                configUserId,
                caption
              );

              logger.info('Config lookup result', {
                menuItemId,
                configId: result.configId,
                isNew: result.isNew
              }, 'Provider');

              return {
                configId: result.configId,
                isExisting: !result.isNew
              };
            } catch (error) {
              logger.error('Config lookup failed', { menuItemId, error }, 'Provider');
              // Return a new UUID as fallback
              return {
                configId: crypto.randomUUID(),
                isExisting: false
              };
            }
          });
          logger.info('Config lookup callback registered for reuse behavior', undefined, 'Provider');

          // Check if Dock is available
          if (dock.isDockAvailable()) {
            // Try to load saved dock configuration from API
            try {
              logger.info('Loading DockApplicationsMenuItems configuration from API...', undefined, 'Provider');
              const userId = 'System'; // System userId for admin configs (matches DockConfigEditor)
              const menuItemsConfig = await dockConfigService.loadApplicationsMenuItems(userId);

              if (menuItemsConfig && menuItemsConfig.config?.menuItems && menuItemsConfig.config.menuItems.length > 0) {
                // User has saved menu items in the database - use those
                logger.info('✅ Loaded DockApplicationsMenuItems config from database', {
                  configId: menuItemsConfig.configId,
                  name: menuItemsConfig.name,
                  menuItemsCount: menuItemsConfig.config.menuItems.length
                }, 'Provider');
                logger.info('📋 MENU ITEMS LOADED FROM DATABASE:', JSON.stringify(menuItemsConfig.config.menuItems, null, 2), 'Provider');
                logger.info('📋 Using menu items configured via Dock Configuration screen', undefined, 'Provider');

                // Convert DockApplicationsMenuItemsConfig to DockConfiguration for backwards compatibility
                const dockConfig: DockConfiguration = {
                  ...menuItemsConfig,
                  componentType: 'dock',
                  componentSubType: 'default'
                };

                // Register dock with saved configuration (suppress analytics errors)
                try {
                  await dock.registerFromConfig(dockConfig, settings.platformSettings.icon);
                  logger.info('Dock registered with user-configured menu items', undefined, 'Provider');
                } catch (dockError: any) {
                  if (dockError?.message?.includes('system topic payload')) {
                    logger.warn('Dock registered successfully (analytics error suppressed)', undefined, 'Provider');
                  } else {
                    throw dockError;
                  }
                }
              } else {
                logger.info('No DockApplicationsMenuItems configuration found in database', undefined, 'Provider');
                logger.info('Fallback: Using apps from manifest.customSettings.apps', undefined, 'Provider');

                // Convert manifest apps to dock menu items
                const appsFromManifest = apps.map((app: any, index: number) => ({
                  id: app.appId || `app-${index}`,
                  caption: app.title || app.name,
                  url: app.url || app.manifest,
                  icon: app.icons?.[0]?.src || buildUrl('/icons/app.svg'),
                  openMode: (app.manifestType === 'view' ? 'view' : 'window') as 'window' | 'view',
                  order: index,
                  windowOptions: {
                    autoShow: true,
                    defaultWidth: 1200,
                    defaultHeight: 800
                  }
                }));

                logger.info('Converted manifest apps to menu items', {
                  appsCount: apps.length,
                  menuItems: appsFromManifest
                }, 'Provider');

                // Register dock with manifest apps as menu items
                try {
                  await dock.register({
                    id: settings.platformSettings.id,
                    title: settings.platformSettings.title,
                    icon: settings.platformSettings.icon,
                    menuItems: appsFromManifest
                  });
                  logger.info('Dock registered with manifest apps', {
                    menuItemsCount: appsFromManifest.length
                  }, 'Provider');
                } catch (dockError: any) {
                  if (dockError?.message?.includes('system topic payload')) {
                    logger.warn('Dock registered successfully (analytics error suppressed)', undefined, 'Provider');
                  } else {
                    throw dockError;
                  }
                }
              }
            } catch (apiError) {
              logger.warn('Failed to load dock config from API, using manifest apps as fallback', apiError, 'Provider');

              // Fallback to manifest apps
              const appsFromManifest = apps.map((app: any, index: number) => ({
                id: app.appId || `app-${index}`,
                caption: app.title || app.name,
                url: app.url || app.manifest,
                icon: app.icons?.[0]?.src || buildUrl('/icons/app.svg'),
                openMode: (app.manifestType === 'view' ? 'view' : 'window') as 'window' | 'view',
                order: index,
                windowOptions: {
                  autoShow: true,
                  defaultWidth: 1200,
                  defaultHeight: 800
                }
              }));

              try {
                await dock.register({
                  id: settings.platformSettings.id,
                  title: settings.platformSettings.title,
                  icon: settings.platformSettings.icon,
                  menuItems: appsFromManifest
                });
                logger.info('Dock registered with manifest apps (API error fallback)', {
                  menuItemsCount: appsFromManifest.length
                }, 'Provider');
              } catch (dockError: any) {
                if (dockError?.message?.includes('system topic payload')) {
                  logger.warn('Dock registered successfully (analytics error suppressed)', undefined, 'Provider');
                } else {
                  throw dockError;
                }
              }
            }

            // Show dock after registration
            await dock.show();
          } else {
            logger.warn('Dock API not available - skipping dock registration', undefined, 'Provider');
            logger.info('Make sure @openfin/workspace package is properly installed', undefined, 'Provider');
          }

          // Hide provider window after initialization
          const providerWindow = fin.Window.getCurrentSync();
          await providerWindow.hide();

          // Handle close button - hide window instead of quitting
          // User can re-open via "Toggle Provider Window" from dock Tools menu
          providerWindow.on('close-requested', async () => {
            logger.info('Provider window close requested - hiding window', undefined, 'Provider');
            try {
              await providerWindow.hide();
              logger.info('Provider window hidden (use dock Tools menu to re-open)', undefined, 'Provider');
            } catch (error) {
              logger.error('Error hiding provider window', error, 'Provider');
            }
          });

        } catch (error: any) {
          logger.error('Failed to register workspace components', error, 'Provider');
          // Continue execution even if dock registration fails
          if (error?.message && !error.message.includes('system topic payload')) {
           // Detailed error already logged above
          }
        }
      });
    } catch (platformError: any) {
      logger.error('Failed to get platform or register listeners', platformError, 'Provider');
    }

      logger.info('Platform initialization complete', undefined, 'Provider');
      setIsPlatformReady(true);

      // Return the handler reference so it can be cleaned up
      return analyticsErrorHandler;
    } catch (error) {
      logger.error('Failed to initialize platform', error, 'Provider');
      // Still show UI on error
      setIsPlatformReady(true);

      // Return a no-op handler if initialization failed
      return () => {};
    }
  }

  // Render the dashboard UI
  if (!isPlatformReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <h1 className="text-2xl font-bold mb-4 mt-4">STAR Trading Platform</h1>
          <p>Initializing workspace...</p>
        </div>
      </div>
    );
  }

  // Note: ThemeProvider is NOT needed here because the provider window route
  // is already wrapped by ThemeProvider in main.tsx (lines 25-30)
  // Having nested ThemeProviders prevents theme synchronization from working
  return (
    <>
      <DashboardContent activeTab={activeTab} onTabChange={setActiveTab} />
      <Toaster />
    </>
  );
}