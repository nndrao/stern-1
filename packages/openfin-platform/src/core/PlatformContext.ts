/**
 * Platform context - holds dependency instances for the library
 * Singleton pattern ensures consistent access across the library
 */

import { ILogger, IConfigService, IViewManager, ConsoleLogger, OpenFinPlatformOptions } from './interfaces';

class PlatformContext {
  private static instance: PlatformContext;

  private _logger: ILogger = new ConsoleLogger();
  private _configService?: IConfigService;
  private _viewManager?: IViewManager;
  private _options: OpenFinPlatformOptions = {};

  private constructor() {}

  static getInstance(): PlatformContext {
    if (!PlatformContext.instance) {
      PlatformContext.instance = new PlatformContext();
    }
    return PlatformContext.instance;
  }

  /**
   * Initialize the platform context with options
   */
  initialize(options: OpenFinPlatformOptions): void {
    this._options = options;

    if (options.logger) {
      this._logger = options.logger;
    }

    if (options.configService) {
      this._configService = options.configService;
    }

    if (options.viewManager) {
      this._viewManager = options.viewManager;
    }
  }

  /**
   * Get the logger instance
   */
  get logger(): ILogger {
    return this._logger;
  }

  /**
   * Get the config service instance (may be undefined)
   */
  get configService(): IConfigService | undefined {
    return this._configService;
  }

  /**
   * Get the view manager instance (may be undefined)
   */
  get viewManager(): IViewManager | undefined {
    return this._viewManager;
  }

  /**
   * Get platform options
   */
  get options(): OpenFinPlatformOptions {
    return this._options;
  }
}

/**
 * Export singleton instance
 */
export const platformContext = PlatformContext.getInstance();
