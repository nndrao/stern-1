/**
 * Core interfaces for dependency injection
 * Allows the library to work with any implementation of these services
 */

/**
 * Logger interface - implement this to provide custom logging
 */
export interface ILogger {
  info(message: string, data?: any, context?: string): void;
  warn(message: string, data?: any, context?: string): void;
  error(message: string, error?: any, context?: string): void;
  debug(message: string, data?: any, context?: string): void;
}

/**
 * Configuration service interface - for loading/saving dock and app configurations
 */
export interface IConfigService {
  loadDockConfig(userId: string): Promise<any>;
  saveDockConfig(userId: string, config: any): Promise<void>;
  loadAppConfig(appId: string): Promise<any>;
  saveAppConfig(appId: string, config: any): Promise<void>;
}

/**
 * View instance interface
 */
export interface ViewInstance {
  id: string;
  type: string;
  title?: string;
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * Create view options
 */
export interface CreateViewOptions {
  type: string;
  basePath?: string;
  title?: string;
  config?: any;
}

/**
 * View manager interface - for tracking view instances
 */
export interface IViewManager {
  initialize(): Promise<void>;
  createView(options: CreateViewOptions): Promise<{ view: any; instance: ViewInstance }>;
  getViewInstances(): Promise<ViewInstance[]>;
  getViewInstance(viewId: string): Promise<ViewInstance | null>;
  deleteViewInstance(viewId: string): Promise<void>;
}

/**
 * Platform initialization options
 */
export interface OpenFinPlatformOptions {
  /**
   * Logger implementation (optional - defaults to console)
   */
  logger?: ILogger;

  /**
   * Configuration service implementation (optional)
   */
  configService?: IConfigService;

  /**
   * View manager implementation (optional)
   */
  viewManager?: IViewManager;

  /**
   * Platform theme configuration
   */
  theme?: {
    default?: 'light' | 'dark';
    palettes?: {
      light?: Record<string, string>;
      dark?: Record<string, string>;
    };
  };

  /**
   * Platform icon URL
   */
  icon?: string;

  /**
   * Platform title
   */
  title?: string;

  /**
   * Disable analytics
   */
  disableAnalytics?: boolean;
}

/**
 * Default console logger implementation
 */
export class ConsoleLogger implements ILogger {
  info(message: string, data?: any, context?: string): void {
    const prefix = context ? `[${context}]` : '';
    console.log(`${prefix} ${message}`, data || '');
  }

  warn(message: string, data?: any, context?: string): void {
    const prefix = context ? `[${context}]` : '';
    console.warn(`${prefix} ${message}`, data || '');
  }

  error(message: string, error?: any, context?: string): void {
    const prefix = context ? `[${context}]` : '';
    console.error(`${prefix} ${message}`, error || '');
  }

  debug(message: string, data?: any, context?: string): void {
    const prefix = context ? `[${context}]` : '';
    console.debug(`${prefix} ${message}`, data || '');
  }
}
