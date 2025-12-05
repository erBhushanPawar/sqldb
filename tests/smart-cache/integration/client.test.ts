import { SmartDBClient } from '../../../src/smart-cache/client';
import { SmartDBConfig } from '../../../src/smart-cache/types/config';

// Mock all dependencies
jest.mock('../../../src/smart-cache/connection/mariadb');
jest.mock('../../../src/smart-cache/connection/redis');
jest.mock('../../../src/smart-cache/discovery/schema-reader');
jest.mock('../../../src/smart-cache/discovery/relationship-parser');

import { MariaDBConnectionManager } from '../../../src/smart-cache/connection/mariadb';
import { RedisConnectionManager } from '../../../src/smart-cache/connection/redis';
import { SchemaReader } from '../../../src/smart-cache/discovery/schema-reader';
import { RelationshipParser } from '../../../src/smart-cache/discovery/relationship-parser';

describe('SmartDBClient Integration', () => {
  let config: SmartDBConfig;

  beforeEach(() => {
    config = {
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
      cache: {
        enabled: true,
        defaultTTL: 60,
      },
      discovery: {
        autoDiscover: true,
      },
    };

    // Setup mocks
    (MariaDBConnectionManager.prototype.connect as jest.Mock) = jest.fn().mockResolvedValue({});
    (MariaDBConnectionManager.prototype.healthCheck as jest.Mock) = jest.fn().mockResolvedValue(true);
    (MariaDBConnectionManager.prototype.close as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    (RedisConnectionManager.prototype.connect as jest.Mock) = jest.fn().mockResolvedValue({});
    (RedisConnectionManager.prototype.healthCheck as jest.Mock) = jest.fn().mockResolvedValue(true);
    (RedisConnectionManager.prototype.close as jest.Mock) = jest.fn().mockResolvedValue(undefined);

    (SchemaReader.prototype.discoverTables as jest.Mock) = jest.fn().mockResolvedValue([
      {
        tableName: 'users',
        columns: [
          { columnName: 'id', dataType: 'int', isNullable: false, columnKey: 'PRI', columnDefault: null, extra: 'auto_increment' },
          { columnName: 'name', dataType: 'varchar', isNullable: false, columnKey: '', columnDefault: null, extra: '' },
        ],
        primaryKey: 'id',
      },
      {
        tableName: 'orders',
        columns: [
          { columnName: 'id', dataType: 'int', isNullable: false, columnKey: 'PRI', columnDefault: null, extra: 'auto_increment' },
          { columnName: 'user_id', dataType: 'int', isNullable: false, columnKey: 'MUL', columnDefault: null, extra: '' },
        ],
        primaryKey: 'id',
      },
    ]);

    (RelationshipParser.prototype.parseRelationships as jest.Mock) = jest.fn().mockResolvedValue([
      {
        constraintName: 'fk_orders_user',
        fromTable: 'orders',
        fromColumn: 'user_id',
        toTable: 'users',
        toColumn: 'id',
      },
    ]);
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      expect(MariaDBConnectionManager.prototype.connect).toHaveBeenCalled();
      expect(RedisConnectionManager.prototype.connect).toHaveBeenCalled();
    });

    it('should discover schema when autoDiscover is true', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      expect(SchemaReader.prototype.discoverTables).toHaveBeenCalled();
      expect(RelationshipParser.prototype.parseRelationships).toHaveBeenCalled();
    });

    it('should not discover schema when autoDiscover is false', async () => {
      const noDiscoveryConfig = {
        ...config,
        discovery: { autoDiscover: false },
      };

      const client = new SmartDBClient(noDiscoveryConfig);
      await client.initialize();

      expect(SchemaReader.prototype.discoverTables).not.toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();
      await client.initialize();

      // Should only connect once
      expect(MariaDBConnectionManager.prototype.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTableOperations', () => {
    it('should return table operations', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      const operations = client.getTableOperations('users');

      expect(operations).toBeDefined();
      expect(operations.findOne).toBeDefined();
      expect(operations.findMany).toBeDefined();
      expect(operations.insertOne).toBeDefined();
    });

    it('should throw error if not initialized', () => {
      const client = new SmartDBClient(config);

      expect(() => {
        client.getTableOperations('users');
      }).toThrow('SmartDBClient not initialized');
    });
  });

  describe('getDiscoveredTables', () => {
    it('should return discovered tables', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      const tables = client.getDiscoveredTables();

      expect(tables).toContain('users');
      expect(tables).toContain('orders');
    });
  });

  describe('getDependencyGraph', () => {
    it('should return dependency graph', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      const graph = client.getDependencyGraph();
      const info = graph.getGraphInfo();

      expect(info.tables).toBe(2);
      expect(info.relationships).toBe(1);
    });
  });

  describe('getCacheManager', () => {
    it('should return cache manager', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      const cacheManager = client.getCacheManager();

      expect(cacheManager).toBeDefined();
      expect(cacheManager.get).toBeDefined();
      expect(cacheManager.set).toBeDefined();
    });
  });

  describe('getInvalidationManager', () => {
    it('should return invalidation manager', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      const invalidationManager = client.getInvalidationManager();

      expect(invalidationManager).toBeDefined();
      expect(invalidationManager.invalidateTable).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      const health = await client.healthCheck();

      expect(health.mariadb).toBe(true);
      expect(health.redis).toBe(true);
      expect(health.overall).toBe(true);
    });

    it('should return false overall if MariaDB is down', async () => {
      (MariaDBConnectionManager.prototype.healthCheck as jest.Mock) = jest.fn().mockResolvedValue(false);

      const client = new SmartDBClient(config);
      await client.initialize();

      const health = await client.healthCheck();

      expect(health.mariadb).toBe(false);
      expect(health.overall).toBe(false);
    });

    it('should return false overall if Redis is down', async () => {
      (RedisConnectionManager.prototype.healthCheck as jest.Mock) = jest.fn().mockResolvedValue(false);

      const client = new SmartDBClient(config);
      await client.initialize();

      const health = await client.healthCheck();

      expect(health.redis).toBe(false);
      expect(health.overall).toBe(false);
    });
  });

  describe('refreshSchema', () => {
    it('should refresh schema', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      // Clear mock calls from initialization
      jest.clearAllMocks();

      await client.refreshSchema();

      expect(SchemaReader.prototype.discoverTables).toHaveBeenCalled();
      expect(RelationshipParser.prototype.parseRelationships).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should close all connections', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      await client.close();

      expect(MariaDBConnectionManager.prototype.close).toHaveBeenCalled();
      expect(RedisConnectionManager.prototype.close).toHaveBeenCalled();
    });
  });

  describe('hooks', () => {
    it('should have hooks manager', async () => {
      const client = new SmartDBClient(config);
      await client.initialize();

      expect(client.hooks).toBeDefined();
      expect(client.hooks.registerBefore).toBeDefined();
      expect(client.hooks.registerAfter).toBeDefined();
    });
  });
});
