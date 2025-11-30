import * as mariadb from 'mariadb';

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  enabled?: boolean;
  debug?: boolean;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  ttl: number;
  enabled: boolean;
  hits?: number;
  misses?: number;
  evictions?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class MariaDBCache {
  private config: mariadb.PoolConfig;
  private pool: mariadb.Pool | null = null;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheOptions: Required<CacheOptions>;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(config: mariadb.PoolConfig, cacheOptions: CacheOptions = {}) {
    this.config = config;
    this.cacheOptions = {
      ttl: cacheOptions.ttl ?? 60000,
      maxSize: cacheOptions.maxSize ?? 100,
      enabled: cacheOptions.enabled ?? true,
      debug: cacheOptions.debug ?? false,
    };
  }

  private log(message: string, data?: any): void {
    if (this.cacheOptions.debug) {
      const timestamp = new Date().toISOString();
      console.log(`[MariaDBCache ${timestamp}] ${message}`, data || '');
    }
  }

  async createPool(): Promise<mariadb.Pool> {
    if (!this.pool) {
      this.pool = mariadb.createPool(this.config);
    }
    return this.pool;
  }

  async getConnection(): Promise<mariadb.PoolConnection> {
    const pool = await this.createPool();
    const conn = await pool.getConnection();
    return this.wrapConnection(conn);
  }

  private wrapConnection(conn: mariadb.PoolConnection): mariadb.PoolConnection {
    const originalQuery = conn.query.bind(conn);
    const cache = this.cache;
    const cacheOptions = this.cacheOptions;
    const stats = this.stats;
    const log = this.log.bind(this);

    conn.query = async function (sql: string | mariadb.QueryOptions, values?: any): Promise<any> {
      const startTime = performance.now();
      const sqlString = typeof sql === 'string' ? sql : (sql.sql || '');
      const cacheKey = JSON.stringify({ sql: sqlString, values });

      // Check cache
      if (cacheOptions.enabled && cache.has(cacheKey)) {
        const cached = cache.get(cacheKey)!;
        const age = Date.now() - cached.timestamp;

        if (age < cacheOptions.ttl) {
          const duration = performance.now() - startTime;
          stats.hits++;
          log(`CACHE HIT (${duration.toFixed(2)}ms, age: ${age}ms)`, { sql: sqlString.substring(0, 100) });
          return cached.data;
        } else {
          cache.delete(cacheKey);
          log(`CACHE EXPIRED (age: ${age}ms > ttl: ${cacheOptions.ttl}ms)`, { sql: sqlString.substring(0, 100) });
        }
      }

      // Execute query
      const queryStartTime = performance.now();
      const result = await originalQuery(sql, values);
      const queryDuration = performance.now() - queryStartTime;

      stats.misses++;
      log(`CACHE MISS - Query executed (${queryDuration.toFixed(2)}ms)`, { sql: sqlString.substring(0, 100) });

      // Cache SELECT results
      if (cacheOptions.enabled && sqlString && sqlString.trim().toUpperCase().startsWith('SELECT')) {
        if (cache.size >= cacheOptions.maxSize) {
          const firstKey = cache.keys().next().value;
          if (firstKey) {
            cache.delete(firstKey);
            stats.evictions++;
            log(`CACHE EVICTION (size: ${cache.size}/${cacheOptions.maxSize})`);
          }
        }
        cache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
        });
        log(`CACHED result (total cached: ${cache.size})`);
      }

      const totalDuration = performance.now() - startTime;
      log(`TOTAL (${totalDuration.toFixed(2)}ms)`);
      return result;
    };

    return conn;
  }

  async query(sql: string | mariadb.QueryOptions, values?: any): Promise<any> {
    const startTime = performance.now();
    const pool = await this.createPool();
    const sqlString = typeof sql === 'string' ? sql : (sql.sql || '');
    const cacheKey = JSON.stringify({ sql: sqlString, values });

    // Check cache
    if (this.cacheOptions.enabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      const age = Date.now() - cached.timestamp;

      if (age < this.cacheOptions.ttl) {
        const duration = performance.now() - startTime;
        this.stats.hits++;
        this.log(`CACHE HIT (${duration.toFixed(2)}ms, age: ${age}ms)`, { sql: sqlString.substring(0, 100) });
        return cached.data;
      } else {
        this.cache.delete(cacheKey);
        this.log(`CACHE EXPIRED (age: ${age}ms > ttl: ${this.cacheOptions.ttl}ms)`, { sql: sqlString.substring(0, 100) });
      }
    }

    // Execute query
    const queryStartTime = performance.now();
    const result = await pool.query(sql, values);
    const queryDuration = performance.now() - queryStartTime;

    this.stats.misses++;
    this.log(`CACHE MISS - Query executed (${queryDuration.toFixed(2)}ms)`, { sql: sqlString.substring(0, 100) });

    // Cache SELECT results
    if (this.cacheOptions.enabled && sqlString && sqlString.trim().toUpperCase().startsWith('SELECT')) {
      if (this.cache.size >= this.cacheOptions.maxSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
          this.stats.evictions++;
          this.log(`CACHE EVICTION (size: ${this.cache.size}/${this.cacheOptions.maxSize})`);
        }
      }
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });
      this.log(`CACHED result (total cached: ${this.cache.size})`);
    }

    const totalDuration = performance.now() - startTime;
    this.log(`TOTAL (${totalDuration.toFixed(2)}ms)`);
    return result;
  }

  async execute(sql: string | mariadb.QueryOptions, values?: any): Promise<any> {
    return this.query(sql, values);
  }

  async batch(sql: string | mariadb.QueryOptions, values?: any[]): Promise<any> {
    const pool = await this.createPool();
    return pool.batch(sql, values);
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      for (const [key] of this.cache) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  getCacheStats(): CacheStats {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(2)
      : '0.00';

    const stats = {
      size: this.cache.size,
      maxSize: this.cacheOptions.maxSize,
      ttl: this.cacheOptions.ttl,
      enabled: this.cacheOptions.enabled,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
    };

    this.log(`Cache Stats - Hit Rate: ${hitRate}%`, stats);
    return stats;
  }

  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.log('Cache stats reset');
  }

  async end(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.cache.clear();
  }
}

export function createPool(config: mariadb.PoolConfig, cacheOptions?: CacheOptions): MariaDBCache {
  const instance = new MariaDBCache(config, cacheOptions);
  instance.createPool();
  return instance;
}

export function createConnection(config: mariadb.PoolConfig, cacheOptions?: CacheOptions): Promise<mariadb.PoolConnection> {
  const instance = new MariaDBCache(config, cacheOptions);
  return instance.getConnection();
}

export default {
  createPool,
  createConnection,
  MariaDBCache,
};
