import { RedisConnectionManager } from '../../../src/smart-cache/connection/redis';
import Redis from 'ioredis';

// Mock ioredis
jest.mock('ioredis');

describe('Redis Connection Edge Cases', () => {
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
      password: 'secret',
      db: 2,
      keyPrefix: 'custom:',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection errors', () => {
    it('should handle connection timeout', async () => {
      jest.useFakeTimers();

      mockRedis.once.mockImplementation((event: string) => {
        // Never call ready or error - simulate timeout
      });

      const connectPromise = manager.connect();

      // Fast-forward time
      jest.advanceTimersByTime(11000);

      await expect(connectPromise).rejects.toThrow('Redis connection timeout');

      jest.useRealTimers();
    });

    it('should handle connection error', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Connection refused')), 0);
        }
      });

      await expect(manager.connect()).rejects.toThrow('Connection refused');
    });

    it('should use custom Redis options', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      const customManager = new RedisConnectionManager({
        host: 'custom-host',
        port: 6380,
        password: 'secret-password',
        db: 5,
        keyPrefix: 'app:',
        options: {
          connectTimeout: 20000,
        },
      });

      await customManager.connect();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'custom-host',
          port: 6380,
          password: 'secret-password',
          db: 5,
          keyPrefix: 'app:',
          connectTimeout: 20000,
        })
      );
    });
  });

  describe('Operation errors when not healthy', () => {
    beforeEach(async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });
      await manager.connect();

      // Simulate connection lost
      const onHandlers = (mockRedis.on as jest.Mock).mock.calls;
      const errorHandler = onHandlers.find((call: any) => call[0] === 'error')?.[1];
      const closeHandler = onHandlers.find((call: any) => call[0] === 'close')?.[1];

      if (errorHandler) errorHandler(new Error('Connection lost'));
      if (closeHandler) closeHandler();
    });

    it('should return null for get when not healthy', async () => {
      const value = await manager.get('test-key');

      expect(value).toBeNull();
    });

    it('should return 0 for del when not healthy', async () => {
      const count = await manager.del('test-key');

      expect(count).toBe(0);
    });

    it('should return false for exists when not healthy', async () => {
      const exists = await manager.exists('test-key');

      expect(exists).toBe(false);
    });

    it('should return empty array for scan when not healthy', async () => {
      const keys = await manager.scan('test:*');

      expect(keys).toEqual([]);
    });
  });

  describe('Scan edge cases', () => {
    beforeEach(async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });
      await manager.connect();
    });

    it('should handle scan errors', async () => {
      mockRedis.scan = jest.fn().mockRejectedValue(new Error('Scan error'));

      const keys = await manager.scan('test:*');

      expect(keys).toEqual([]);
    });

    it('should return 0 for deletePattern when no keys found', async () => {
      mockRedis.scan = jest.fn().mockResolvedValue(['0', []]);

      const count = await manager.deletePattern('nonexistent:*');

      expect(count).toBe(0);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  describe('Set operations', () => {
    beforeEach(async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });
      await manager.connect();
    });

    it('should handle set errors', async () => {
      mockRedis.set = jest.fn().mockRejectedValue(new Error('Set error'));

      // Should not throw
      await expect(manager.set('key', 'value')).resolves.not.toThrow();
    });

    it('should not set when not healthy', async () => {
      // Simulate connection lost
      const closeHandler = (mockRedis.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'close'
      )?.[1];
      if (closeHandler) closeHandler();

      await manager.set('key', 'value');

      // set should not be called after close
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('Event handlers', () => {
    it('should set up event handlers', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();

      const onCalls = (mockRedis.on as jest.Mock).mock.calls;

      expect(onCalls.find((call: any) => call[0] === 'connect')).toBeDefined();
      expect(onCalls.find((call: any) => call[0] === 'error')).toBeDefined();
      expect(onCalls.find((call: any) => call[0] === 'close')).toBeDefined();
    });

    it('should handle connect event', async () => {
      let connectCallback: Function | undefined;
      mockRedis.on.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          connectCallback = callback;
        }
      });

      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();

      // Trigger connect event
      if (connectCallback) connectCallback();

      expect(manager.isConnected()).toBe(true);
    });
  });

  describe('Reuse connection', () => {
    it('should reuse existing healthy connection', async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });

      await manager.connect();
      await manager.connect();

      expect(Redis).toHaveBeenCalledTimes(1);
    });
  });

  describe('Del operations', () => {
    beforeEach(async () => {
      mockRedis.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'ready') callback();
      });
      await manager.connect();
    });

    it('should handle del errors', async () => {
      mockRedis.del = jest.fn().mockRejectedValue(new Error('Del error'));

      const count = await manager.del('key');

      expect(count).toBe(0);
    });

    it('should handle exists errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockRedis.exists = jest.fn().mockRejectedValue(new Error('Exists error'));

      const exists = await manager.exists('key');

      expect(exists).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  describe('Connection close', () => {
    it('should not quit if never connected', async () => {
      await manager.close();

      expect(mockRedis.quit).not.toHaveBeenCalled();
    });
  });
});
