import { MariaDBConnectionManager } from '../../../src/smart-cache/connection/mariadb';
import { RedisConnectionManager } from '../../../src/smart-cache/connection/redis';
import * as mariadb from 'mariadb';
import Redis from 'ioredis';

// Mock mariadb
jest.mock('mariadb', () => ({
  createPool: jest.fn(),
}));

// Mock ioredis
jest.mock('ioredis');

describe('Connection Managers Integration', () => {
  describe('MariaDBConnectionManager', () => {
    let manager: MariaDBConnectionManager;
    let mockPool: any;

    beforeEach(() => {
      mockPool = {
        query: jest.fn().mockResolvedValue([{ result: 'success' }]),
        getConnection: jest.fn().mockResolvedValue({ connection: 'mock' }),
        end: jest.fn().mockResolvedValue(undefined),
      };

      (mariadb.createPool as jest.Mock).mockReturnValue(mockPool);

      manager = new MariaDBConnectionManager({
        host: 'localhost',
        user: 'root',
        password: 'password',
        database: 'test',
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create pool on connect', async () => {
      await manager.connect();

      expect(mariadb.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          user: 'root',
          password: 'password',
          database: 'test',
          port: 3306,
          connectionLimit: 10,
        })
      );
    });

    it('should reuse existing pool', async () => {
      await manager.connect();
      await manager.connect();

      expect(mariadb.createPool).toHaveBeenCalledTimes(1);
    });

    it('should get connection from pool', async () => {
      await manager.connect();
      const conn = await manager.getConnection();

      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(conn).toEqual({ connection: 'mock' });
    });

    it('should execute query', async () => {
      const result = await manager.query('SELECT * FROM users');

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users', undefined);
      expect(result).toEqual([{ result: 'success' }]);
    });

    it('should execute query with params', async () => {
      await manager.query('SELECT * FROM users WHERE id = ?', [1]);

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
    });

    it('should perform health check', async () => {
      mockPool.query = jest.fn().mockResolvedValue([{ result: 1 }]);

      const healthy = await manager.healthCheck();

      expect(healthy).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1', undefined);
    });

    it('should return false on health check failure', async () => {
      mockPool.query = jest.fn().mockRejectedValue(new Error('Connection failed'));

      const healthy = await manager.healthCheck();

      expect(healthy).toBe(false);
    });

    it('should close connection', async () => {
      await manager.connect();
      await manager.close();

      expect(mockPool.end).toHaveBeenCalled();
      expect(manager.isConnected()).toBe(false);
    });

    it('should report connection status', async () => {
      expect(manager.isConnected()).toBe(false);

      await manager.connect();
      expect(manager.isConnected()).toBe(true);

      await manager.close();
      expect(manager.isConnected()).toBe(false);
    });

    it('should use custom port', async () => {
      const customManager = new MariaDBConnectionManager({
        host: 'localhost',
        port: 3307,
        user: 'root',
        password: 'password',
        database: 'test',
      });

      await customManager.connect();

      expect(mariadb.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 3307,
        })
      );
    });
  });

  describe('RedisConnectionManager', () => {
    let manager: RedisConnectionManager;
    let mockRedis: any;

    beforeEach(() => {
      mockRedis = {
        on: jest.fn(),
        once: jest.fn(),
        get: jest.fn().mockResolvedValue('value'),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        exists: jest.fn().mockResolvedValue(1),
        scan: jest.fn().mockResolvedValue(['0', []]),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue('OK'),
      };

      (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

      manager = new RedisConnectionManager({
        host: 'localhost',
        port: 6379,
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create Redis client on connect', async () => {
      // Simulate successful connection
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') {
          setTimeout(() => callback(), 0);
        }
      });

      await manager.connect();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'localhost',
          port: 6379,
          keyPrefix: 'sdc:',
        })
      );
    });

    it('should get value from Redis', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      const value = await manager.get('test-key');

      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
      expect(value).toBe('value');
    });

    it('should set value in Redis', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      await manager.set('test-key', 'test-value', 60);

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 60);
    });

    it('should set value without TTL', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      await manager.set('test-key', 'test-value');

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should delete key', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      const count = await manager.del('test-key');

      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
      expect(count).toBe(1);
    });

    it('should delete multiple keys', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });
      mockRedis.del = jest.fn().mockResolvedValue(3);

      await manager.connect();
      const count = await manager.del(['key1', 'key2', 'key3']);

      expect(mockRedis.del).toHaveBeenCalledWith('key1', 'key2', 'key3');
      expect(count).toBe(3);
    });

    it('should check if key exists', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      const exists = await manager.exists('test-key');

      expect(mockRedis.exists).toHaveBeenCalledWith('test-key');
      expect(exists).toBe(true);
    });

    it('should scan for keys', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });
      mockRedis.scan = jest
        .fn()
        .mockResolvedValueOnce(['5', ['key1', 'key2']])
        .mockResolvedValueOnce(['0', ['key3']]);

      await manager.connect();
      const keys = await manager.scan('test:*');

      expect(keys).toEqual(['key1', 'key2', 'key3']);
    });

    it('should delete keys by pattern', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });
      mockRedis.scan = jest.fn().mockResolvedValue(['0', ['key1', 'key2', 'key3']]);
      mockRedis.del = jest.fn().mockResolvedValue(3);

      await manager.connect();
      const count = await manager.deletePattern('test:*');

      expect(count).toBe(3);
    });

    it('should perform health check', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      const healthy = await manager.healthCheck();

      expect(mockRedis.ping).toHaveBeenCalled();
      expect(healthy).toBe(true);
    });

    it('should return false on health check failure', async () => {
      mockRedis.ping = jest.fn().mockRejectedValue(new Error('Connection failed'));
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      const healthy = await manager.healthCheck();

      expect(healthy).toBe(false);
    });

    it('should close connection', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      await manager.close();

      expect(mockRedis.quit).toHaveBeenCalled();
      expect(manager.isConnected()).toBe(false);
    });

    it('should handle connection errors gracefully', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();

      // Simulate error
      mockRedis.get = jest.fn().mockRejectedValue(new Error('Redis error'));

      const value = await manager.get('test-key');

      expect(value).toBeNull();
    });

    it('should return null when not connected', async () => {
      const value = await manager.get('test-key');

      expect(value).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('should get client instance', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      const client = manager.getClient();

      expect(client).toBe(mockRedis);
    });
  });
});
