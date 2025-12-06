import { CacheManager } from '../../../src/cache/cache-manager';
import { RedisConnectionManager } from '../../../src/connection/redis';
import { DEFAULT_CACHE_CONFIG } from '../../../src/types/config';

// Mock Redis
jest.mock('../../../src/connection/redis');

describe('Cache Manager Edge Cases', () => {
  let cacheManager: CacheManager;
  let mockRedis: jest.Mocked<RedisConnectionManager>;

  beforeEach(() => {
    mockRedis = new RedisConnectionManager({
      host: 'localhost',
      port: 6379,
    }) as jest.Mocked<RedisConnectionManager>;

    mockRedis.isConnected = jest.fn().mockReturnValue(true);
    mockRedis.get = jest.fn().mockResolvedValue(null);
    mockRedis.set = jest.fn().mockResolvedValue(undefined);
    mockRedis.del = jest.fn().mockResolvedValue(1);
    mockRedis.exists = jest.fn().mockResolvedValue(false);
    mockRedis.deletePattern = jest.fn().mockResolvedValue(0);

    cacheManager = new CacheManager(mockRedis, DEFAULT_CACHE_CONFIG, 'test');
  });

  describe('Error handling', () => {
    it('should handle JSON parse errors gracefully', async () => {
      mockRedis.get = jest.fn().mockResolvedValue('invalid-json{{{');

      const result = await cacheManager.get('key');

      expect(result).toBeNull();
    });

    it('should handle set errors gracefully', async () => {
      mockRedis.set = jest.fn().mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheManager.set('key', { data: 'value' })).resolves.not.toThrow();
    });

    it('should handle delete errors gracefully', async () => {
      mockRedis.del = jest.fn().mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheManager.delete('key')).resolves.not.toThrow();
    });

    it('should handle deletePattern errors gracefully', async () => {
      mockRedis.deletePattern = jest.fn().mockRejectedValue(new Error('Redis error'));

      const count = await cacheManager.deletePattern('test:*');

      expect(count).toBe(0);
    });

    it('should handle exists errors gracefully', async () => {
      mockRedis.exists = jest.fn().mockRejectedValue(new Error('Redis error'));

      const exists = await cacheManager.exists('key');

      expect(exists).toBe(false);
    });

    it('should handle clear errors gracefully', async () => {
      mockRedis.deletePattern = jest.fn().mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cacheManager.clear()).resolves.not.toThrow();
    });
  });

  describe('Connection state handling', () => {
    it('should return null when Redis not connected', async () => {
      mockRedis.isConnected = jest.fn().mockReturnValue(false);

      const result = await cacheManager.get('key');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should not set when Redis not connected', async () => {
      mockRedis.isConnected = jest.fn().mockReturnValue(false);

      await cacheManager.set('key', { data: 'value' });

      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('should not delete when Redis not connected', async () => {
      mockRedis.isConnected = jest.fn().mockReturnValue(false);

      await cacheManager.delete('key');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should return 0 for deletePattern when not connected', async () => {
      mockRedis.isConnected = jest.fn().mockReturnValue(false);

      const count = await cacheManager.deletePattern('test:*');

      expect(count).toBe(0);
    });

    it('should return false for exists when not connected', async () => {
      mockRedis.isConnected = jest.fn().mockReturnValue(false);

      const exists = await cacheManager.exists('key');

      expect(exists).toBe(false);
    });

    it('should not clear when not connected', async () => {
      mockRedis.isConnected = jest.fn().mockReturnValue(false);

      await cacheManager.clear();

      expect(mockRedis.deletePattern).not.toHaveBeenCalled();
    });
  });
});
