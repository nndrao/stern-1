/**
 * OpenFin Platform Library Adapter
 * Bridges Stern-specific services to @stern/openfin-platform library
 */

import { platformContext, type ILogger, type IConfigService, type IViewManager } from '@stern/openfin-platform';
import { logger as sternLogger } from '@/utils/logger';
import { dockConfigService } from '@/services/api/dockConfigService';
import { viewManager as sternViewManager } from '@/services/viewManager';

/**
 * Logger adapter - wraps Stern's logger to match ILogger interface
 */
class LoggerAdapter implements ILogger {
  info(message: string, data?: any, context?: string): void {
    sternLogger.info(message, data, context);
  }

  warn(message: string, data?: any, context?: string): void {
    sternLogger.warn(message, data, context);
  }

  error(message: string, error?: any, context?: string): void {
    sternLogger.error(message, error, context);
  }

  debug(message: string, data?: any, context?: string): void {
    sternLogger.debug(message, data, context);
  }
}

/**
 * Config service adapter - wraps Stern's dock config service
 */
class ConfigServiceAdapter implements IConfigService {
  async loadDockConfig(userId: string): Promise<any> {
    try {
      const configs = await dockConfigService.loadByUser(userId);
      return configs.length > 0 ? configs[0] : null;
    } catch (error) {
      sternLogger.error('Failed to load dock config', error, 'ConfigServiceAdapter');
      return null;
    }
  }

  async saveDockConfig(userId: string, config: any): Promise<void> {
    try {
      if (config.configId) {
        await dockConfigService.update(config.configId, config);
      } else {
        await dockConfigService.save(config);
      }
    } catch (error) {
      sternLogger.error('Failed to save dock config', error, 'ConfigServiceAdapter');
      throw error;
    }
  }

  async loadAppConfig(appId: string): Promise<any> {
    // For now, app configs can be loaded by configId
    try {
      if (appId) {
        return await dockConfigService.loadById(appId);
      }
      return null;
    } catch (error) {
      sternLogger.error('Failed to load app config', error, 'ConfigServiceAdapter');
      return null;
    }
  }

  async saveAppConfig(appId: string, config: any): Promise<void> {
    try {
      if (config.configId) {
        await dockConfigService.update(config.configId, config);
      } else {
        await dockConfigService.save(config);
      }
    } catch (error) {
      sternLogger.error('Failed to save app config', error, 'ConfigServiceAdapter');
      throw error;
    }
  }
}

/**
 * View manager adapter - wraps Stern's view manager
 */
class ViewManagerAdapter implements IViewManager {
  async initialize(): Promise<void> {
    await sternViewManager.initialize();
  }

  async createView(options: any): Promise<{ view: any; instance: any }> {
    return await sternViewManager.createView(options);
  }

  async getViewInstances(): Promise<any[]> {
    return await sternViewManager.getViewInstances();
  }

  async getViewInstance(viewId: string): Promise<any | null> {
    return await sternViewManager.getViewInstance(viewId);
  }

  async deleteViewInstance(viewId: string): Promise<void> {
    await sternViewManager.deleteViewInstance(viewId);
  }
}

/**
 * Initialize the OpenFin platform library with Stern's services
 */
export function initializeOpenFinPlatformLibrary(): void {
  platformContext.initialize({
    logger: new LoggerAdapter(),
    configService: new ConfigServiceAdapter(),
    viewManager: new ViewManagerAdapter(),
  });

  sternLogger.info('OpenFin platform library initialized with Stern adapters', undefined, 'openfinPlatformAdapter');
}
