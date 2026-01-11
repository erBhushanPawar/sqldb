export interface CacheKey {
  prefix: string;
  table: string;
  operation: string;
  hash: string;
}

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: string;
  totalKeys?: number;
  memoryUsage?: number;
  keysByTable?: Record<string, number>;
}

export enum InvalidationStrategy {
  IMMEDIATE = 'immediate',
  LAZY = 'lazy',
  TTL_ONLY = 'ttl_only',
}

export interface InvalidationOptions {
  strategy?: InvalidationStrategy;
  cascade?: boolean;
  tables?: string[];
}

export interface CacheAPI {
  // Invalidate cache for specific table
  invalidateTable(tableName: string): Promise<number>;

  // Invalidate by pattern
  invalidateByPattern(pattern: string): Promise<number>;

  // Clear all cache
  clear(): Promise<void>;

  // Get cache statistics
  getStats(): Promise<CacheStats>;

  // Check if key exists in cache
  has(key: string): Promise<boolean>;

  // Get cache TTL for a key
  getTTL(key: string): Promise<number>;

  // Get value from cache
  get<T = any>(key: string): Promise<T | null>;

  // Set value in cache
  set(key: string, value: any, ttl?: number): Promise<void>;

  // Delete specific key
  delete(key: string): Promise<void>;

  // Reset statistics
  resetStats(): void;

  // Check if cache is enabled
  isEnabled(): boolean;
}
