import { createPool, createConnection, MariaDBCache } from '../src/index';
import * as mariadb from 'mariadb';

// Mock mariadb module
jest.mock('mariadb');

describe('MariaDBCache', () => {
  let mockPool: any;
  let mockConnection: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock connection
    mockConnection = {
      query: jest.fn(),
      release: jest.fn(),
      end: jest.fn(),
    };

    // Mock pool
    mockPool = {
      query: jest.fn(),
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      end: jest.fn().mockResolvedValue(undefined),
    };

    // Mock mariadb.createPool
    (mariadb.createPool as jest.Mock).mockReturnValue(mockPool);
  });

  describe('createPool', () => {
    it('should create a MariaDBCache instance', () => {
      const pool = createPool({
        host: 'localhost',
        user: 'root',
        password: 'password',
        database: 'testdb',
      });

      expect(pool).toBeInstanceOf(MariaDBCache);
    });

    it('should create pool with custom cache options', () => {
      const pool = createPool(
        {
          host: 'localhost',
          user: 'root',
        },
        {
          ttl: 30000,
          maxSize: 50,
          enabled: true,
        }
      );

      const stats = pool.getCacheStats();
      expect(stats.ttl).toBe(30000);
      expect(stats.maxSize).toBe(50);
      expect(stats.enabled).toBe(true);
    });
  });

  describe('query method', () => {
    it('should execute query and cache SELECT results', async () => {
      const pool = createPool({ host: 'localhost' });
      const mockResult = [{ id: 1, name: 'Test' }];
      mockPool.query.mockResolvedValue(mockResult);

      // First query - should hit database
      const result1 = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result1).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      // Second query - should hit cache
      const result2 = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result2).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledTimes(1); // Still only called once

      await pool.end();
    });

    it('should not cache non-SELECT queries', async () => {
      const pool = createPool({ host: 'localhost' });
      const mockResult = { affectedRows: 1 };
      mockPool.query.mockResolvedValue(mockResult);

      // First INSERT
      await pool.query('INSERT INTO users (name) VALUES (?)', ['Test']);
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      // Second INSERT - should not use cache
      await pool.query('INSERT INTO users (name) VALUES (?)', ['Test']);
      expect(mockPool.query).toHaveBeenCalledTimes(2);

      await pool.end();
    });

    it('should respect cache TTL', async () => {
      jest.useFakeTimers();
      const pool = createPool({ host: 'localhost' }, { ttl: 1000 });
      const mockResult = [{ id: 1, name: 'Test' }];
      mockPool.query.mockResolvedValue(mockResult);

      // First query
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      // Second query within TTL - should hit cache
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      jest.advanceTimersByTime(1001);

      // Third query after TTL - should hit database again
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(mockPool.query).toHaveBeenCalledTimes(2);

      await pool.end();
      jest.useRealTimers();
    });

    it('should respect maxSize limit', async () => {
      const pool = createPool({ host: 'localhost' }, { maxSize: 2 });
      mockPool.query.mockResolvedValue([]);

      // Fill cache with 2 queries
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      await pool.query('SELECT * FROM users WHERE id = ?', [2]);

      let stats = pool.getCacheStats();
      expect(stats.size).toBe(2);

      // Add third query - should evict first one
      await pool.query('SELECT * FROM users WHERE id = ?', [3]);

      stats = pool.getCacheStats();
      expect(stats.size).toBe(2);

      await pool.end();
    });

    it('should handle cache disabled', async () => {
      const pool = createPool({ host: 'localhost' }, { enabled: false });
      const mockResult = [{ id: 1, name: 'Test' }];
      mockPool.query.mockResolvedValue(mockResult);

      // First query
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      // Second query - should NOT use cache
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(mockPool.query).toHaveBeenCalledTimes(2);

      await pool.end();
    });
  });

  describe('execute method', () => {
    it('should work as alias for query', async () => {
      const pool = createPool({ host: 'localhost' });
      const mockResult = [{ id: 1, name: 'Test' }];
      mockPool.query.mockResolvedValue(mockResult);

      const result = await pool.execute('SELECT * FROM users WHERE id = ?', [1]);
      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      await pool.end();
    });
  });

  describe('batch method', () => {
    it('should execute batch queries without caching', async () => {
      const pool = createPool({ host: 'localhost' });
      const mockResult = [{ affectedRows: 3 }];
      mockPool.batch = jest.fn().mockResolvedValue(mockResult);

      const values = [[1, 'User1'], [2, 'User2'], [3, 'User3']];
      const result = await pool.batch('INSERT INTO users (id, name) VALUES (?, ?)', values);

      expect(result).toEqual(mockResult);
      expect(mockPool.batch).toHaveBeenCalledTimes(1);

      await pool.end();
    });
  });

  describe('getConnection', () => {
    it('should return a wrapped connection with caching', async () => {
      const pool = createPool({ host: 'localhost' });
      const mockResult = [{ id: 1, name: 'Test' }];

      // Track original query function calls
      const originalQuerySpy = jest.fn().mockResolvedValue(mockResult);
      mockConnection.query = originalQuerySpy;

      const conn = await pool.getConnection();

      // First query - should hit database
      const result1 = await conn.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result1).toEqual(mockResult);
      expect(originalQuerySpy).toHaveBeenCalledTimes(1);

      // Second query - should hit cache
      const result2 = await conn.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result2).toEqual(mockResult);
      expect(originalQuerySpy).toHaveBeenCalledTimes(1); // Still 1 because cached

      await pool.end();
    });

    it('should respect cache TTL in wrapped connection', async () => {
      jest.useFakeTimers();
      const pool = createPool({ host: 'localhost' }, { ttl: 1000 });
      const mockResult = [{ id: 1, name: 'Test' }];

      const originalQuerySpy = jest.fn().mockResolvedValue(mockResult);
      mockConnection.query = originalQuerySpy;

      const conn = await pool.getConnection();

      // First query
      await conn.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(originalQuerySpy).toHaveBeenCalledTimes(1);

      // Second query within TTL - should hit cache
      await conn.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(originalQuerySpy).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      jest.advanceTimersByTime(1001);

      // Third query after TTL - should hit database again (line 63)
      await conn.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(originalQuerySpy).toHaveBeenCalledTimes(2);

      await pool.end();
      jest.useRealTimers();
    });

    it('should respect maxSize limit in wrapped connection', async () => {
      const pool = createPool({ host: 'localhost' }, { maxSize: 2 });

      const originalQuerySpy = jest.fn().mockResolvedValue([]);
      mockConnection.query = originalQuerySpy;

      const conn = await pool.getConnection();

      // Fill cache with 2 queries
      await conn.query('SELECT * FROM users WHERE id = ?', [1]);
      await conn.query('SELECT * FROM users WHERE id = ?', [2]);

      // Add third query - should evict first one (lines 71-72)
      await conn.query('SELECT * FROM users WHERE id = ?', [3]);

      expect(originalQuerySpy).toHaveBeenCalledTimes(3);

      // Query id=1 again - should hit database because it was evicted
      await conn.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(originalQuerySpy).toHaveBeenCalledTimes(4);

      await pool.end();
    });
  });

  describe('clearCache', () => {
    it('should clear entire cache when no pattern provided', async () => {
      const pool = createPool({ host: 'localhost' });
      mockPool.query.mockResolvedValue([]);

      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      await pool.query('SELECT * FROM users WHERE id = ?', [2]);

      expect(pool.getCacheStats().size).toBe(2);

      pool.clearCache();
      expect(pool.getCacheStats().size).toBe(0);

      await pool.end();
    });

    it('should clear cache entries matching pattern', async () => {
      const pool = createPool({ host: 'localhost' });
      mockPool.query.mockResolvedValue([]);

      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      await pool.query('SELECT * FROM products WHERE id = ?', [1]);

      expect(pool.getCacheStats().size).toBe(2);

      pool.clearCache('users');
      expect(pool.getCacheStats().size).toBe(1);

      await pool.end();
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', () => {
      const pool = createPool(
        { host: 'localhost' },
        {
          ttl: 30000,
          maxSize: 50,
          enabled: true,
        }
      );

      const stats = pool.getCacheStats();
      expect(stats).toEqual({
        size: 0,
        maxSize: 50,
        ttl: 30000,
        enabled: true,
        hits: 0,
        misses: 0,
        evictions: 0,
      });
    });
  });

  describe('end', () => {
    it('should close pool and clear cache', async () => {
      const pool = createPool({ host: 'localhost' });
      mockPool.query.mockResolvedValue([]);

      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(pool.getCacheStats().size).toBe(1);

      await pool.end();
      expect(mockPool.end).toHaveBeenCalledTimes(1);
      expect(pool.getCacheStats().size).toBe(0);
    });
  });

  describe('createConnection', () => {
    it('should create a single cached connection', async () => {
      const conn = await createConnection({ host: 'localhost' });
      expect(conn).toBeDefined();
      expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('different query parameters', () => {
    it('should cache queries with different parameters separately', async () => {
      const pool = createPool({ host: 'localhost' });
      mockPool.query
        .mockResolvedValueOnce([{ id: 1, name: 'User1' }])
        .mockResolvedValueOnce([{ id: 2, name: 'User2' }]);

      // First query with id=1
      const result1 = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result1).toEqual([{ id: 1, name: 'User1' }]);

      // Second query with id=2 (different parameter)
      const result2 = await pool.query('SELECT * FROM users WHERE id = ?', [2]);
      expect(result2).toEqual([{ id: 2, name: 'User2' }]);

      expect(mockPool.query).toHaveBeenCalledTimes(2);
      expect(pool.getCacheStats().size).toBe(2);

      // Query with id=1 again - should use cache
      const result3 = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      expect(result3).toEqual([{ id: 1, name: 'User1' }]);
      expect(mockPool.query).toHaveBeenCalledTimes(2); // Still 2 calls

      await pool.end();
    });
  });

  describe('Performance stats and debugging', () => {
    it('should track hits, misses, and evictions', async () => {
      const pool = createPool({ host: 'localhost' }, { maxSize: 2 });
      mockPool.query.mockResolvedValue([]);

      // First query - miss
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      let stats = pool.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.evictions).toBe(0);

      // Second query - hit
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      stats = pool.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      // Third query - miss
      await pool.query('SELECT * FROM users WHERE id = ?', [2]);
      stats = pool.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);

      // Fourth query causes eviction
      await pool.query('SELECT * FROM users WHERE id = ?', [3]);
      stats = pool.getCacheStats();
      expect(stats.evictions).toBe(1);

      await pool.end();
    });

    it('should reset stats', async () => {
      const pool = createPool({ host: 'localhost' });
      mockPool.query.mockResolvedValue([]);

      await pool.query('SELECT * FROM users WHERE id = ?', [1]);
      await pool.query('SELECT * FROM users WHERE id = ?', [1]);

      let stats = pool.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      pool.resetStats();

      stats = pool.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.evictions).toBe(0);

      await pool.end();
    });

    it('should support debug mode without errors', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const pool = createPool({ host: 'localhost' }, { debug: true });
      mockPool.query.mockResolvedValue([{ id: 1 }]);

      await pool.query('SELECT * FROM users WHERE id = ?', [1]);

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls;
      const hasDebugLog = calls.some(call =>
        call[0].includes('[MariaDBCache')
      );
      expect(hasDebugLog).toBe(true);

      consoleSpy.mockRestore();
      await pool.end();
    });
  });

  describe('QueryOptions object', () => {
    it('should handle QueryOptions object with sql property', async () => {
      const pool = createPool({ host: 'localhost' });
      const mockResult = [{ id: 1, name: 'Test' }];
      mockPool.query.mockResolvedValue(mockResult);

      const queryOptions = {
        sql: 'SELECT * FROM users WHERE id = ?',
      };

      const result = await pool.query(queryOptions, [1]);
      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      await pool.end();
    });

    it('should handle QueryOptions object without sql property', async () => {
      const pool = createPool({ host: 'localhost' });
      const mockResult = [{ id: 1, name: 'Test' }];
      mockPool.query.mockResolvedValue(mockResult);

      // Edge case: QueryOptions without sql property (covers line 88 branch)
      const queryOptions = {} as any;

      const result = await pool.query(queryOptions, [1]);
      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledTimes(1);

      await pool.end();
    });

    it('should handle QueryOptions object without sql property in wrapped connection', async () => {
      const pool = createPool({ host: 'localhost' });
      const mockResult = [{ id: 1, name: 'Test' }];

      const originalQuerySpy = jest.fn().mockResolvedValue(mockResult);
      mockConnection.query = originalQuerySpy;

      const conn = await pool.getConnection();

      // Edge case: QueryOptions without sql property (covers line 55 branch)
      const queryOptions = {} as any;

      const result = await conn.query(queryOptions, [1]);
      expect(result).toEqual(mockResult);
      expect(originalQuerySpy).toHaveBeenCalledTimes(1);

      await pool.end();
    });
  });
});
