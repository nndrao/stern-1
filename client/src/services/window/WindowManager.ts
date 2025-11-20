/**
 * WindowManager - Service for managing view instances
 *
 * Tracks all active view instances across the application.
 * Pure utility class with in-memory registry.
 *
 * Design:
 * - Singleton pattern
 * - In-memory storage
 * - Type-safe
 * - No side effects
 */

export interface ViewInstance {
  id: string;
  name: string;
  type: string;
  componentType?: string;
  componentSubType?: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

class WindowManagerClass {
  private instances = new Map<string, ViewInstance>();

  /**
   * Register a new view instance
   */
  registerViewInstance(
    id: string,
    name: string,
    type: string,
    componentType?: string,
    componentSubType?: string,
    metadata?: Record<string, any>
  ): ViewInstance {
    const instance: ViewInstance = {
      id,
      name,
      type,
      componentType,
      componentSubType,
      createdAt: Date.now(),
      metadata,
    };

    this.instances.set(id, instance);
    return instance;
  }

  /**
   * Unregister a view instance
   */
  unregisterViewInstance(id: string): boolean {
    return this.instances.delete(id);
  }

  /**
   * Get a specific view instance
   */
  getViewInstance(id: string): ViewInstance | null {
    return this.instances.get(id) || null;
  }

  /**
   * Get all view instances
   */
  getAllViewInstances(): ViewInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get view instances by type
   */
  getViewInstancesByType(type: string): ViewInstance[] {
    return Array.from(this.instances.values()).filter(instance => instance.type === type);
  }

  /**
   * Get view instances by component type
   */
  getViewInstancesByComponentType(componentType: string, componentSubType?: string): ViewInstance[] {
    return Array.from(this.instances.values()).filter(
      instance =>
        instance.componentType === componentType &&
        (!componentSubType || instance.componentSubType === componentSubType)
    );
  }

  /**
   * Check if a view instance exists
   */
  hasViewInstance(id: string): boolean {
    return this.instances.has(id);
  }

  /**
   * Get instance count
   */
  getInstanceCount(): number {
    return this.instances.size;
  }

  /**
   * Update view instance metadata
   */
  updateViewInstanceMetadata(id: string, metadata: Record<string, any>): boolean {
    const instance = this.instances.get(id);
    if (!instance) return false;

    instance.metadata = { ...instance.metadata, ...metadata };
    this.instances.set(id, instance);
    return true;
  }

  /**
   * Update view instance name
   */
  updateViewInstanceName(id: string, name: string): boolean {
    const instance = this.instances.get(id);
    if (!instance) return false;

    instance.name = name;
    this.instances.set(id, instance);
    return true;
  }

  /**
   * Clear all instances
   */
  clearAll(): void {
    this.instances.clear();
  }

  /**
   * Find instances by metadata query
   */
  findInstancesByMetadata(query: Record<string, any>): ViewInstance[] {
    return Array.from(this.instances.values()).filter(instance => {
      if (!instance.metadata) return false;

      return Object.entries(query).every(
        ([key, value]) => instance.metadata![key] === value
      );
    });
  }

  /**
   * Get instance statistics
   */
  getStatistics(): {
    total: number;
    byType: Record<string, number>;
    byComponentType: Record<string, number>;
  } {
    const instances = Array.from(this.instances.values());

    const byType: Record<string, number> = {};
    const byComponentType: Record<string, number> = {};

    instances.forEach(instance => {
      // Count by type
      byType[instance.type] = (byType[instance.type] || 0) + 1;

      // Count by component type
      if (instance.componentType) {
        const key = instance.componentSubType
          ? `${instance.componentType}:${instance.componentSubType}`
          : instance.componentType;
        byComponentType[key] = (byComponentType[key] || 0) + 1;
      }
    });

    return {
      total: instances.length,
      byType,
      byComponentType,
    };
  }
}

// Export singleton instance
export const WindowManager = new WindowManagerClass();
