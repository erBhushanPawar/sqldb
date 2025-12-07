import { createSqlDB, SqlDBClient } from '../../../src/index';
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

    // Mock SqlDBClient initialization
    (SqlDBClient.prototype.initialize as jest.Mock) = jest.fn().mockResolvedValue(undefined);
  });

  describe('createSqlDB', () => {
    it('should create and initialize SqlDBClient', async () => {
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

      const client = await createSqlDB(config);

      expect(client).toBeInstanceOf(SqlDBClient);
      expect(SqlDBClient.prototype.initialize).toHaveBeenCalled();
    });
  });

  describe('Exports', () => {
    it('should export SqlDBClient', () => {
      expect(smartCacheExports.SqlDBClient).toBeDefined();
    });

    it('should export createSqlDB function', () => {
      expect(typeof smartCacheExports.createSqlDB).toBe('function');
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
      expect(smartCacheExports.default.createSqlDB).toBe(smartCacheExports.createSqlDB);
      expect(smartCacheExports.default.SqlDBClient).toBe(smartCacheExports.SqlDBClient);
    });
  });
});
