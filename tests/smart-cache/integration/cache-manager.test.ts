import { CacheManager } from '../../../src/cache/cache-manager';
import { RedisConnectionManager } from '../../../src/connection/redis';
import { DEFAULT_CACHE_CONFIG } from '../../../src/types/config';

// Mock Redis
jest.mock('../../../src/connection/redis');

describe('CacheManager Integration', () => {
  let cacheManager: CacheManager;
  let mockRedis: jest.Mocked<RedisConnectionManager>;

  beforeEach(() => {
    mockRedis = new RedisConnectionManager({
      host: 'localhost',
      port: 6379,
    }) as jest.Mocked<RedisConnectionManager>;

    // Mock Redis methods
    mockRedis.isConnected = jest.fn().mockReturnValue(true);
    mockRedis.get = jest.fn().mockResolvedValue(null);
    mockRedis.set = jest.fn().mockResolvedValue(undefined);
    mockRedis.del = jest.fn().mockResolvedValue(1);
    mockRedis.exists = jest.fn().mockResolvedValue(false);
    mockRedis.scan = jest.fn().mockResolvedValue([]);
    mockRedis.deletePattern = jest.fn().mockResolvedValue(0);

    cacheManager = new CacheManager(mockRedis, DEFAULT_CACHE_CONFIG, 'test');
  });

  describe('get', () => {
    it('should return null when cache is disabled', async () => {
      const disabledConfig = { ...DEFAULT_CACHE_CONFIG, enabled: false };
      const disabledManager = new CacheManager(mockRedis, disabledConfig, 'test');

      const result = await disabledManager.get('key');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should return cached value when found', async () => {
      const cachedData = { id: 1, name: 'John' };
      mockRedis.get = jest.fn().mockResolvedValue(JSON.stringify(cachedData));

      const result = await cacheManager.get('test:users:findOne:abc123');

      expect(result).toEqual(cachedData);
      expect(mockRedis.get).toHaveBeenCalledWith('test:users:findOne:abc123');
    });

    it('should return null when not found', async () => {
      mockRedis.get = jest.fn().mockResolvedValue(null);

      const result = await cacheManager.get('test:users:findOne:abc123');

      expect(result).toBeNull();
    });

    it('should track hits and misses', async () => {
      // Miss
      mockRedis.get = jest.fn().mockResolvedValue(null);
      await cacheManager.get('key1');

      // Hit
      mockRedis.get = jest.fn().mockResolvedValue(JSON.stringify({ data: 'value' }));
      await cacheManager.get('key2');

      const stats = cacheManager.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('set', () => {
    it('should not set when cache is disabled', async () => {
      const disabledConfig = { ...DEFAULT_CACHE_CONFIG, enabled: false };
      const disabledManager = new CacheManager(mockRedis, disabledConfig, 'test');

      await disabledManager.set('key', { data: 'value' });

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should serialize and set value with default TTL', async () => {
      const data = { id: 1, name: 'John' };

      await cacheManager.set('test:users:findOne:abc123', data);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:users:findOne:abc123',
        JSON.stringify(data),
        DEFAULT_CACHE_CONFIG.defaultTTL
      );
    });

    it('should use custom TTL when provided', async () => {
      const data = { id: 1, name: 'John' };
      const customTTL = 120;

      await cacheManager.set('test:users:findOne:abc123', data, customTTL);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:users:findOne:abc123',
        JSON.stringify(data),
        customTTL
      );
    });
  });

  describe('delete', () => {
    it('should delete key', async () => {
      await cacheManager.delete('test:users:findOne:abc123');

      expect(mockRedis.del).toHaveBeenCalledWith('test:users:findOne:abc123');
    });
  });

  describe('deletePattern', () => {
    it('should delete matching keys', async () => {
      mockRedis.deletePattern = jest.fn().mockResolvedValue(5);

      const count = await cacheManager.deletePattern('test:users:*');

      expect(count).toBe(5);
      expect(mockRedis.deletePattern).toHaveBeenCalledWith('test:users:*');
    });

    it('should track evictions', async () => {
      mockRedis.deletePattern = jest.fn().mockResolvedValue(3);

      await cacheManager.deletePattern('test:users:*');

      const stats = cacheManager.getStats();

      expect(stats.evictions).toBe(3);
    });
  });

  describe('exists', () => {
    it('should check if key exists', async () => {
      mockRedis.exists = jest.fn().mockResolvedValue(true);

      const exists = await cacheManager.exists('test:users:findOne:abc123');

      expect(exists).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('test:users:findOne:abc123');
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      // Generate some hits and misses
      mockRedis.get = jest.fn().mockResolvedValue(JSON.stringify({ data: 'value' }));
      await cacheManager.get('key1');
      await cacheManager.get('key2');

      mockRedis.get = jest.fn().mockResolvedValue(null);
      await cacheManager.get('key3');

      const stats = cacheManager.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('66.67%');
    });

    it('should calculate 0% hit rate when no operations', () => {
      const stats = cacheManager.getStats();

      expect(stats.hitRate).toBe('0.00%');
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', async () => {
      // Generate some stats
      mockRedis.get = jest.fn().mockResolvedValue(JSON.stringify({ data: 'value' }));
      await cacheManager.get('key1');

      mockRedis.deletePattern = jest.fn().mockResolvedValue(2);
      await cacheManager.deletePattern('test:*');

      // Reset
      cacheManager.resetStats();

      const stats = cacheManager.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all keys', async () => {
      mockRedis.deletePattern = jest.fn().mockResolvedValue(10);

      await cacheManager.clear();

      expect(mockRedis.deletePattern).toHaveBeenCalledWith('*');
    });
  });

  describe('isEnabled', () => {
    it('should return true when enabled and connected', () => {
      mockRedis.isConnected = jest.fn().mockReturnValue(true);

      expect(cacheManager.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      const disabledConfig = { ...DEFAULT_CACHE_CONFIG, enabled: false };
      const disabledManager = new CacheManager(mockRedis, disabledConfig, 'test');

      expect(disabledManager.isEnabled()).toBe(false);
    });

    it('should return false when not connected', () => {
      mockRedis.isConnected = jest.fn().mockReturnValue(false);

      expect(cacheManager.isEnabled()).toBe(false);
    });
  });
});
