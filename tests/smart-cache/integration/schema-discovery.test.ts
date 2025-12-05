import { SchemaReader } from '../../../src/smart-cache/discovery/schema-reader';
import { RelationshipParser } from '../../../src/smart-cache/discovery/relationship-parser';
import { MariaDBConnectionManager } from '../../../src/smart-cache/connection/mariadb';
import { DEFAULT_DISCOVERY_CONFIG } from '../../../src/smart-cache/types/config';

// Mock MariaDBConnectionManager
jest.mock('../../../src/smart-cache/connection/mariadb');

describe('Schema Discovery Integration', () => {
  let mockDbManager: jest.Mocked<MariaDBConnectionManager>;

  beforeEach(() => {
    mockDbManager = new MariaDBConnectionManager(null as any) as jest.Mocked<MariaDBConnectionManager>;
  });

  describe('SchemaReader', () => {
    it('should discover all tables in database', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce([{ db: 'test_db' }]) // getCurrentDatabase
        .mockResolvedValueOnce([
          { TABLE_NAME: 'users' },
          { TABLE_NAME: 'orders' },
          { TABLE_NAME: 'products' },
        ]) // getTableNames
        .mockResolvedValueOnce([
          {
            columnName: 'id',
            dataType: 'int',
            isNullable: 'NO',
            columnKey: 'PRI',
            columnDefault: null,
            extra: 'auto_increment',
          },
          {
            columnName: 'name',
            dataType: 'varchar',
            isNullable: 'NO',
            columnKey: '',
            columnDefault: null,
            extra: '',
          },
        ]) // users columns
        .mockResolvedValueOnce([
          {
            columnName: 'id',
            dataType: 'int',
            isNullable: 'NO',
            columnKey: 'PRI',
            columnDefault: null,
            extra: 'auto_increment',
          },
        ]) // orders columns
        .mockResolvedValueOnce([
          {
            columnName: 'id',
            dataType: 'int',
            isNullable: 'NO',
            columnKey: 'PRI',
            columnDefault: null,
            extra: 'auto_increment',
          },
        ]); // products columns

      const reader = new SchemaReader(mockDbManager, DEFAULT_DISCOVERY_CONFIG);
      const tables = await reader.discoverTables();

      expect(tables).toHaveLength(3);
      expect(tables[0].tableName).toBe('users');
      expect(tables[0].columns).toHaveLength(2);
      expect(tables[0].primaryKey).toBe('id');
    });

    it('should filter tables by includeTables', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce([{ db: 'test_db' }])
        .mockResolvedValueOnce([
          { TABLE_NAME: 'users' },
          { TABLE_NAME: 'orders' },
          { TABLE_NAME: 'products' },
        ])
        .mockResolvedValueOnce([
          {
            columnName: 'id',
            dataType: 'int',
            isNullable: 'NO',
            columnKey: 'PRI',
            columnDefault: null,
            extra: 'auto_increment',
          },
        ]);

      const config = {
        ...DEFAULT_DISCOVERY_CONFIG,
        includeTables: ['users'],
      };

      const reader = new SchemaReader(mockDbManager, config);
      const tables = await reader.discoverTables();

      expect(tables).toHaveLength(1);
      expect(tables[0].tableName).toBe('users');
    });

    it('should filter tables by excludeTables', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce([{ db: 'test_db' }])
        .mockResolvedValueOnce([
          { TABLE_NAME: 'users' },
          { TABLE_NAME: 'orders' },
          { TABLE_NAME: 'migrations' },
        ])
        .mockResolvedValueOnce([
          {
            columnName: 'id',
            dataType: 'int',
            isNullable: 'NO',
            columnKey: 'PRI',
            columnDefault: null,
            extra: '',
          },
        ])
        .mockResolvedValueOnce([
          {
            columnName: 'id',
            dataType: 'int',
            isNullable: 'NO',
            columnKey: 'PRI',
            columnDefault: null,
            extra: '',
          },
        ]);

      const config = {
        ...DEFAULT_DISCOVERY_CONFIG,
        excludeTables: ['migrations'],
      };

      const reader = new SchemaReader(mockDbManager, config);
      const tables = await reader.discoverTables();

      expect(tables).toHaveLength(2);
      expect(tables.find((t) => t.tableName === 'migrations')).toBeUndefined();
    });

    it('should handle nullable columns', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce([{ db: 'test_db' }])
        .mockResolvedValueOnce([{ TABLE_NAME: 'users' }])
        .mockResolvedValueOnce([
          {
            columnName: 'id',
            dataType: 'int',
            isNullable: 'NO',
            columnKey: 'PRI',
            columnDefault: null,
            extra: 'auto_increment',
          },
          {
            columnName: 'email',
            dataType: 'varchar',
            isNullable: 'YES',
            columnKey: '',
            columnDefault: null,
            extra: '',
          },
        ]);

      const reader = new SchemaReader(mockDbManager, DEFAULT_DISCOVERY_CONFIG);
      const tables = await reader.discoverTables();

      expect(tables[0].columns[0].isNullable).toBe(false);
      expect(tables[0].columns[1].isNullable).toBe(true);
    });

    it('should handle tables without primary key', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce([{ db: 'test_db' }])
        .mockResolvedValueOnce([{ TABLE_NAME: 'logs' }])
        .mockResolvedValueOnce([
          {
            columnName: 'message',
            dataType: 'text',
            isNullable: 'YES',
            columnKey: '',
            columnDefault: null,
            extra: '',
          },
        ]);

      const reader = new SchemaReader(mockDbManager, DEFAULT_DISCOVERY_CONFIG);
      const tables = await reader.discoverTables();

      expect(tables[0].primaryKey).toBeUndefined();
    });
  });

  describe('RelationshipParser', () => {
    it('should parse foreign key relationships', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce([{ db: 'test_db' }])
        .mockResolvedValueOnce([
          {
            constraintName: 'fk_orders_user',
            fromTable: 'orders',
            fromColumn: 'user_id',
            toTable: 'users',
            toColumn: 'id',
          },
          {
            constraintName: 'fk_order_items_order',
            fromTable: 'order_items',
            fromColumn: 'order_id',
            toTable: 'orders',
            toColumn: 'id',
          },
        ]);

      const parser = new RelationshipParser(mockDbManager);
      const relationships = await parser.parseRelationships();

      expect(relationships).toHaveLength(2);
      expect(relationships[0]).toEqual({
        constraintName: 'fk_orders_user',
        fromTable: 'orders',
        fromColumn: 'user_id',
        toTable: 'users',
        toColumn: 'id',
      });
    });

    it('should handle database with no foreign keys', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce([{ db: 'test_db' }])
        .mockResolvedValueOnce([]);

      const parser = new RelationshipParser(mockDbManager);
      const relationships = await parser.parseRelationships();

      expect(relationships).toEqual([]);
    });

    it('should handle multiple foreign keys from same table', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce([{ db: 'test_db' }])
        .mockResolvedValueOnce([
          {
            constraintName: 'fk_orders_user',
            fromTable: 'orders',
            fromColumn: 'user_id',
            toTable: 'users',
            toColumn: 'id',
          },
          {
            constraintName: 'fk_orders_product',
            fromTable: 'orders',
            fromColumn: 'product_id',
            toTable: 'products',
            toColumn: 'id',
          },
        ]);

      const parser = new RelationshipParser(mockDbManager);
      const relationships = await parser.parseRelationships();

      expect(relationships).toHaveLength(2);
      expect(relationships[0].fromTable).toBe('orders');
      expect(relationships[1].fromTable).toBe('orders');
    });
  });
});
