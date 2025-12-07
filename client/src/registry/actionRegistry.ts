/**
 * ActionRegistry
 *
 * Singleton registry that holds all available actions for toolbar buttons.
 * Actions are registered at app startup and resolved at runtime by string ID.
 *
 * This pattern allows:
 * - Serializing action references (string IDs) to database
 * - Dynamically discovering available actions in wizard UI
 * - Type-safe action execution with context
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Parameter definition for configurable actions
 */
export interface ActionParameter {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  required?: boolean;
  default?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  description?: string;
}

/**
 * Registered action metadata (serializable part)
 */
export interface ActionMetadata {
  id: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  parameters?: ActionParameter[];
}

/**
 * Context passed to action handlers
 */
export interface ActionContext {
  /** AG-Grid API */
  gridApi: any | null;

  /** Selected rows in the grid */
  selectedRows: any[];

  /** All row data in the grid */
  rowData: any[];

  /** Currently selected provider ID */
  providerId: string | null;

  /** Currently selected layout ID */
  layoutId: string | null;

  /** Open a dialog by ID */
  openDialog: (dialogId: string, props?: Record<string, unknown>) => Promise<unknown>;

  /** Close a dialog by ID */
  closeDialog: (dialogId: string) => void;

  /** Refresh data from provider */
  refreshData: () => void;

  /** Emit a custom event */
  emit: (event: string, data?: unknown) => void;

  /** Check if running in OpenFin */
  isOpenFin: boolean;

  /** Platform services */
  platform: any;
}

/**
 * Action handler function type
 */
export type ActionHandler = (
  context: ActionContext,
  actionData?: Record<string, unknown>
) => void | Promise<void>;

/**
 * Availability check function type
 */
export type ActionAvailabilityCheck = (context: ActionContext) => boolean;

/**
 * Full registered action definition
 */
export interface RegisteredAction extends ActionMetadata {
  /** The handler function to execute */
  handler: ActionHandler;

  /** Optional check for when this action is available */
  isAvailable?: ActionAvailabilityCheck;
}

/**
 * Options for registering an action
 */
export interface RegisterActionOptions {
  id: string;
  name: string;
  description?: string;
  category: string;
  icon?: string;
  parameters?: ActionParameter[];
  handler: ActionHandler;
  isAvailable?: ActionAvailabilityCheck;
}

// ============================================================================
// ActionRegistry Class
// ============================================================================

class ActionRegistryImpl {
  private actions = new Map<string, RegisteredAction>();
  private listeners = new Set<() => void>();

  /**
   * Register a single action
   */
  register(options: RegisterActionOptions): () => void {
    const action: RegisteredAction = {
      id: options.id,
      name: options.name,
      description: options.description,
      category: options.category,
      icon: options.icon,
      parameters: options.parameters,
      handler: options.handler,
      isAvailable: options.isAvailable,
    };

    this.actions.set(action.id, action);
    this.notifyListeners();

    // Return unregister function
    return () => {
      this.actions.delete(action.id);
      this.notifyListeners();
    };
  }

  /**
   * Register multiple actions at once
   */
  registerMany(actions: RegisterActionOptions[]): () => void {
    actions.forEach((options) => {
      const action: RegisteredAction = {
        id: options.id,
        name: options.name,
        description: options.description,
        category: options.category,
        icon: options.icon,
        parameters: options.parameters,
        handler: options.handler,
        isAvailable: options.isAvailable,
      };
      this.actions.set(action.id, action);
    });

    this.notifyListeners();

    // Return unregister function for all
    return () => {
      actions.forEach((a) => this.actions.delete(a.id));
      this.notifyListeners();
    };
  }

  /**
   * Unregister an action by ID
   */
  unregister(actionId: string): boolean {
    const deleted = this.actions.delete(actionId);
    if (deleted) {
      this.notifyListeners();
    }
    return deleted;
  }

  /**
   * Get an action by ID
   */
  get(actionId: string): RegisteredAction | undefined {
    return this.actions.get(actionId);
  }

  /**
   * Get action metadata only (without handler)
   */
  getMetadata(actionId: string): ActionMetadata | undefined {
    const action = this.actions.get(actionId);
    if (!action) return undefined;

    return {
      id: action.id,
      name: action.name,
      description: action.description,
      category: action.category,
      icon: action.icon,
      parameters: action.parameters,
    };
  }

  /**
   * Get all registered actions
   */
  getAll(): RegisteredAction[] {
    return Array.from(this.actions.values());
  }

  /**
   * Get all action metadata (without handlers)
   */
  getAllMetadata(): ActionMetadata[] {
    return this.getAll().map((action) => ({
      id: action.id,
      name: action.name,
      description: action.description,
      category: action.category,
      icon: action.icon,
      parameters: action.parameters,
    }));
  }

  /**
   * Get actions filtered by category
   */
  getByCategory(category: string): RegisteredAction[] {
    return this.getAll().filter((a) => a.category === category);
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    const categories = new Set(this.getAll().map((a) => a.category));
    return Array.from(categories).sort();
  }

  /**
   * Get actions that are available given the current context
   */
  getAvailable(context: ActionContext): RegisteredAction[] {
    return this.getAll().filter((action) => {
      if (!action.isAvailable) return true;
      return action.isAvailable(context);
    });
  }

  /**
   * Check if an action exists
   */
  has(actionId: string): boolean {
    return this.actions.has(actionId);
  }

  /**
   * Execute an action by ID
   */
  async execute(
    actionId: string,
    context: ActionContext,
    actionData?: Record<string, unknown>
  ): Promise<void> {
    const action = this.actions.get(actionId);

    if (!action) {
      console.warn(`[ActionRegistry] Action not found: ${actionId}`);
      return;
    }

    // Check availability
    if (action.isAvailable && !action.isAvailable(context)) {
      console.warn(`[ActionRegistry] Action not available: ${actionId}`);
      return;
    }

    try {
      await action.handler(context, actionData);
    } catch (error) {
      console.error(`[ActionRegistry] Error executing action ${actionId}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to registry changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get the count of registered actions
   */
  get size(): number {
    return this.actions.size;
  }

  /**
   * Clear all registered actions
   */
  clear(): void {
    this.actions.clear();
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[ActionRegistry] Error in listener:', error);
      }
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global action registry instance
 */
export const actionRegistry = new ActionRegistryImpl();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an action context from blotter state
 */
export function createActionContext(params: {
  gridApi: any | null;
  selectedRows?: any[];
  rowData?: any[];
  providerId?: string | null;
  layoutId?: string | null;
  openDialog?: (dialogId: string, props?: Record<string, unknown>) => Promise<unknown>;
  closeDialog?: (dialogId: string) => void;
  refreshData?: () => void;
  emit?: (event: string, data?: unknown) => void;
  isOpenFin?: boolean;
  platform?: any;
}): ActionContext {
  return {
    gridApi: params.gridApi,
    selectedRows: params.selectedRows ?? [],
    rowData: params.rowData ?? [],
    providerId: params.providerId ?? null,
    layoutId: params.layoutId ?? null,
    openDialog: params.openDialog ?? (async () => undefined),
    closeDialog: params.closeDialog ?? (() => {}),
    refreshData: params.refreshData ?? (() => {}),
    emit: params.emit ?? (() => {}),
    isOpenFin: params.isOpenFin ?? false,
    platform: params.platform ?? null,
  };
}
