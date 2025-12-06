import { createSmartDB, SmartDBClient } from '../../../src/index';
import * as smartCacheExports from '../../../src/index';

// Mock all dependencies
jest.mock('../../../src/client');
jest.mock('../../../src/connection/mariadb');
jest.mock('../../../src/connection/redis');
jest.mock('../../../src/discovery/schema-reader');
jest.mock('../../../src/discovery/relationship-parser');

describe('Smart Cache Index Exports', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock SmartDBClient initialization
    (SmartDBClient.prototype.initialize as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  describe('createSmartDB', () => {
    it('should create and initialize SmartDBClient', async () => {
      const config = {
        mariadb: {
          host: 'localhost',
          user: 'root',
          password: 'password',
          database: 'test',
        },
        redis: {
          host: 'localhost',
          port: 6379,
        },
      };

      const client = await createSmartDB(config);

      expect(client).toBeInstanceOf(SmartDBClient);
      expect(SmartDBClient.prototype.initialize).toHaveBeenCalled();
    });
  });

  describe('Exports', () => {
    it('should export SmartDBClient', () => {
      expect(smartCacheExports.SmartDBClient).toBeDefined();
    });

    it('should export createSmartDB function', () => {
      expect(typeof smartCacheExports.createSmartDB).toBe('function');
    });

    it('should export type definitions', () => {
      // These are TypeScript types, but we can check if the module exports them
      expect(smartCacheExports).toHaveProperty('CacheManager');
      expect(smartCacheExports).toHaveProperty('InvalidationManager');
      expect(smartCacheExports).toHaveProperty('DependencyGraph');
      expect(smartCacheExports).toHaveProperty('HooksManager');
      expect(smartCacheExports).toHaveProperty('QueryBuilder');
    });

    it('should export default object', () => {
      expect(smartCacheExports.default).toBeDefined();
      expect(smartCacheExports.default.createSmartDB).toBe(smartCacheExports.createSmartDB);
      expect(smartCacheExports.default.SmartDBClient).toBe(smartCacheExports.SmartDBClient);
    });
  });
});
