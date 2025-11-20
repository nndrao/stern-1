/**
 * CacheManager
 *
 * Manages snapshot cache with key-based upsert for data provider engines.
 * Uses Map for O(1) lookups and updates.
 * Ensures immutability by creating new objects on upsert.
 */

export class CacheManager {
  private cache: Map<string, any>;
  private keyColumn: string;

  constructor(keyColumn: string) {
    this.keyColumn = keyColumn;
    this.cache = new Map();
  }

  /**
   * Upsert rows into cache
   * Creates new objects for immutability (required for AG-Grid transaction updates)
   */
  upsertRows(rows: any[]): void {
    let added = 0;
    let skipped = 0;

    rows.forEach(row => {
      const key = this.getKey(row);
      if (key !== null) {
        // Create new object for immutability
        this.cache.set(key, { ...row });
        added++;
      } else {
        skipped++;
      }
    });

    if (skipped > 0) {
      console.warn(`[CacheManager] Skipped ${skipped}/${rows.length} rows due to missing key column '${this.keyColumn}'`);
    }
  }

  /**
   * Remove rows from cache
   */
  removeRows(rows: any[]): void {
    rows.forEach(row => {
      const key = this.getKey(row);
      if (key !== null) {
        this.cache.delete(key);
      }
    });
  }

  /**
   * Get all cached rows as array
   */
  getAll(): any[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get row by key
   */
  get(key: string): any | undefined {
    return this.cache.get(key);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (number of rows)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get key column name
   */
  getKeyColumn(): string {
    return this.keyColumn;
  }

  /**
   * Extract key from row data
   * Returns null if key column is missing
   */
  private getKey(row: any): string | null {
    const value = row[this.keyColumn];
    if (value === undefined || value === null) {
      console.warn(`[CacheManager] Missing key column '${this.keyColumn}' in row:`, row);
      return null;
    }
    return String(value);
  }
}
