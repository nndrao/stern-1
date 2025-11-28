/// <reference path="./types/openfin.d.ts" />

/**
 * @stern/openfin-platform
 * Reusable OpenFin platform library with dock, theming, IAB events, and workspace services
 */

// Core interfaces and context
export * from './core/interfaces';
export { platformContext } from './core/PlatformContext';

// Types
export type {
  DockMenuItem,
  DockConfiguration,
  DockApplicationsMenuItemsConfig,
  DockConfigFilter,
  DockButton,
  DockButtonOption
} from './types/dockConfig';
export {
  COMPONENT_TYPES,
  COMPONENT_SUBTYPES,
  DEFAULT_WINDOW_OPTIONS,
  DEFAULT_VIEW_OPTIONS,
  createMenuItem,
  validateDockConfiguration,
  createDockConfiguration
} from './types/dockConfig';
export * from './types/openfin';
export * from './types/openfinEvents';
export * from './types/workspace';

// Services
export * from './services/OpenfinIABService';
export * from './services/cache';

// Storage
export { createWorkspaceStorageOverride } from './storage/WorkspaceStorageProvider';
export type { WorkspaceSaveCallback, WorkspaceStorageConfig } from './storage/WorkspaceStorageProvider';
export { ConfigurationApiClient } from './api/configurationApi';

// Browser Override
export { createBrowserOverride, combineOverrides, createCustomActions, VIEW_CONTEXT_MENU_ACTIONS } from './browser/BrowserOverride';
export type { BrowserOverrideConfig, ViewContextMenuActionHandler } from './browser/BrowserOverride';

// Utils
export * from './utils/openfinUtils';
export * from './utils/urlHelper';
export * from './utils/windowTitleManager';

// Platform
export * from './platform/openfinShapes';
export * from './platform/openfinThemePalettes';
export * from './platform/dock';
export * from './platform/menuLauncher';

// Hooks
export * from './hooks/useOpenfinWorkspace';
export * from './hooks/useOpenFinEvents';
export * from './hooks/useOpenfinTheme';
export * from './hooks/useViewManager';

// Components
export * from './components/OpenfinComponent';
