import { RedisConnectionManager } from '../connection/redis';
import { CacheConfig } from '../types/config';
import { CacheStats } from '../types/cache';
import { CacheKeyBuilder } from './cache-key-builder';

export class CacheManager {
  private redis: RedisConnectionManager;
  private config: Required<CacheConfig>;
  private keyBuilder: CacheKeyBuilder;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(
    redis: RedisConnectionManager,
    config: Required<CacheConfig>,
    keyPrefix?: string
  ) {
    this.redis = redis;
    this.config = config;
    this.keyBuilder = new CacheKeyBuilder(keyPrefix);
  }

  async get<T = any>(key: string): Promise<T | null> {
    if (!this.config.enabled || !this.redis.isConnected()) {
      return null;
    }

    try {
      const cached = await this.redis.get(key);

      if (cached === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(cached) as T;
    } catch (error) {
      console.error('[CacheManager] Get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.config.enabled || !this.redis.isConnected()) {
      return;
    }

    try {
      // Handle BigInt serialization
      const serialized = JSON.stringify(value, (key, val) =>
        typeof val === 'bigint' ? val.toString() : val
      );
      const ttlSeconds = ttl || this.config.defaultTTL;

      await this.redis.set(key, serialized, ttlSeconds);
    } catch (error) {
      console.error('[CacheManager] Set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.redis.isConnected()) {
      return;
    }

    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('[CacheManager] Delete error:', error);
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    if (!this.redis.isConnected()) {
      return 0;
    }

    try {
      const count = await this.redis.deletePattern(pattern);
      this.stats.evictions += count;
      return count;
    } catch (error) {
      console.error('[CacheManager] DeletePattern error:', error);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.redis.isConnected()) {
      return false;
    }

    try {
      return await this.redis.exists(key);
    } catch (error) {
      console.error('[CacheManager] Exists error:', error);
      return false;
    }
  }

  /**
   * Alias for exists() - more intuitive naming for Cache API
   */
  async has(key: string): Promise<boolean> {
    return this.exists(key);
  }

  /**
   * Get TTL for a key in seconds
   * Returns -1 if key doesn't exist, -2 if key exists but has no TTL
   */
  async getTTL(key: string): Promise<number> {
    if (!this.redis.isConnected()) {
      return -1;
    }

    try {
      const client = this.redis.getClient();
      if (!client) {
        return -1;
      }
      return await client.ttl(key);
    } catch (error) {
      console.error('[CacheManager] GetTTL error:', error);
      return -1;
    }
  }

  /**
   * Invalidate all cache entries for a specific table
   */
  async invalidateTable(tableName: string): Promise<number> {
    const pattern = this.keyBuilder.buildTablePattern(tableName);
    return await this.deletePattern(pattern);
  }

  /**
   * Invalidate cache entries matching a custom pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    return await this.deletePattern(pattern);
  }

  getKeyBuilder(): CacheKeyBuilder {
    return this.keyBuilder;
  }

  async getStats(): Promise<CacheStats> {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0
      ? ((this.stats.hits / total) * 100).toFixed(2)
      : '0.00';

    // Get total keys and memory usage from Redis
    let totalKeys = 0;
    let memoryUsage = 0;
    let keysByTable: Record<string, number> = {};

    try {
      if (this.redis.isConnected()) {
        const client = this.redis.getClient();
        if (client) {
          // Get total keys matching our prefix
          const allKeys = await this.redis.scan('*');
          totalKeys = allKeys.length;

          // Get memory usage (in bytes)
          const info = await client.info('memory');
          const memMatch = info.match(/used_memory:(\d+)/);
          if (memMatch) {
            memoryUsage = parseInt(memMatch[1], 10);
          }

          // Count keys by table
          for (const key of allKeys) {
            // Parse table name from key pattern: prefix:table:operation:hash
            const parts = key.split(':');
            if (parts.length >= 2) {
              const tableName = parts[1];
              keysByTable[tableName] = (keysByTable[tableName] || 0) + 1;
            }
          }
        }
      }
    } catch (error) {
      console.error('[CacheManager] GetStats error:', error);
    }

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: 0, // Deprecated, use totalKeys instead
      hitRate: `${hitRate}%`,
      totalKeys,
      memoryUsage,
      keysByTable,
    };
  }

  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.redis.isConnected();
  }

  async clear(): Promise<void> {
    if (!this.redis.isConnected()) {
      return;
    }

    try {
      // Clear all keys with our prefix
      const count = await this.redis.deletePattern('*');
      this.stats.evictions += count;
    } catch (error) {
      console.error('[CacheManager] Clear error:', error);
    }
  }
}
