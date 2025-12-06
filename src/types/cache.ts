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
