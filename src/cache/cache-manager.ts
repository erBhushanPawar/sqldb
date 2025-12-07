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

  getKeyBuilder(): CacheKeyBuilder {
    return this.keyBuilder;
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0
      ? ((this.stats.hits / total) * 100).toFixed(2)
      : '0.00';

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: 0, // Redis doesn't provide easy size lookup
      hitRate: `${hitRate}%`,
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
