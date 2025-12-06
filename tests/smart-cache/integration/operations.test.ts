import { TableOperationsImpl } from '../../../src/query/operations';
import { MariaDBConnectionManager } from '../../../src/connection/mariadb';
import { CacheManager } from '../../../src/cache/cache-manager';
import { InvalidationManager } from '../../../src/cache/invalidation';
import { QueryBuilder } from '../../../src/query/query-builder';
import { DEFAULT_CACHE_CONFIG } from '../../../src/types/config';

// Mock dependencies
jest.mock('../../../src/connection/mariadb');
jest.mock('../../../src/cache/cache-manager');
jest.mock('../../../src/cache/invalidation');

describe('TableOperations Integration', () => {
  let operations: TableOperationsImpl;
  let mockDbManager: jest.Mocked<MariaDBConnectionManager>;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let mockInvalidationManager: jest.Mocked<InvalidationManager>;
  let queryBuilder: QueryBuilder;

  beforeEach(() => {
    mockDbManager = new MariaDBConnectionManager(null as any) as jest.Mocked<MariaDBConnectionManager>;
    mockCacheManager = new CacheManager(null as any, null as any) as jest.Mocked<CacheManager>;
    mockInvalidationManager = new InvalidationManager(null as any, null as any) as jest.Mocked<InvalidationManager>;
    queryBuilder = new QueryBuilder();

    // Setup cache manager mocks
    mockCacheManager.isEnabled = jest.fn().mockReturnValue(true);
    mockCacheManager.get = jest.fn().mockResolvedValue(null);
    mockCacheManager.set = jest.fn().mockResolvedValue(undefined);
    mockCacheManager.getKeyBuilder = jest.fn().mockReturnValue({
      buildKey: (table: string, op: string, params: any) => `test:${table}:${op}:hash`,
      buildIdKey: (table: string, id: any) => `test:${table}:id:${id}`,
    });

    // Setup invalidation manager mocks
    mockInvalidationManager.invalidateTable = jest.fn().mockResolvedValue(undefined);

    operations = new TableOperationsImpl(
      'users',
      mockDbManager,
      mockCacheManager,
      mockInvalidationManager,
      queryBuilder,
      DEFAULT_CACHE_CONFIG
    );
  });

  describe('findOne', () => {
    it('should query database on cache miss', async () => {
      const mockUser = { id: 1, name: 'John', email: 'john@example.com' };
      mockDbManager.query = jest.fn().mockResolvedValue([mockUser]);
      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      const result = await operations.findOne({ email: 'john@example.com' });

      expect(result).toEqual(mockUser);
      expect(mockDbManager.query).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should return cached result on cache hit', async () => {
      const cachedUser = { id: 1, name: 'John', email: 'john@example.com' };
      mockCacheManager.get = jest.fn().mockResolvedValue([cachedUser]);

      const result = await operations.findOne({ email: 'john@example.com' });

      expect(result).toEqual(cachedUser);
      expect(mockDbManager.query).not.toHaveBeenCalled();
    });

    it('should return null when no results', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue([]);
      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      const result = await operations.findOne({ email: 'notfound@example.com' });

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should return all results from database', async () => {
      const mockUsers = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ];
      mockDbManager.query = jest.fn().mockResolvedValue(mockUsers);
      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      const result = await operations.findMany({ status: 'active' });

      expect(result).toEqual(mockUsers);
      expect(mockDbManager.query).toHaveBeenCalled();
    });

    it('should use cache when available', async () => {
      const cachedUsers = [{ id: 1, name: 'John' }];
      mockCacheManager.get = jest.fn().mockResolvedValue(cachedUsers);

      const result = await operations.findMany({ status: 'active' });

      expect(result).toEqual(cachedUsers);
      expect(mockDbManager.query).not.toHaveBeenCalled();
    });

    it('should skip cache when skipCache option is true', async () => {
      const mockUsers = [{ id: 1, name: 'John' }];
      mockDbManager.query = jest.fn().mockResolvedValue(mockUsers);
      mockCacheManager.get = jest.fn().mockResolvedValue([{ id: 999, name: 'Cached' }]);

      const result = await operations.findMany({ status: 'active' }, { skipCache: true });

      expect(result).toEqual(mockUsers);
      expect(mockDbManager.query).toHaveBeenCalled();
      expect(mockCacheManager.get).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      const mockUser = { id: 1, name: 'John' };
      mockDbManager.query = jest.fn().mockResolvedValue([mockUser]);
      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      const result = await operations.findById(1);

      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue([]);
      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      const result = await operations.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('count', () => {
    it('should return count from database', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue([{ count: 42 }]);
      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      const result = await operations.count({ status: 'active' });

      expect(result).toBe(42);
    });

    it('should use cached count', async () => {
      mockCacheManager.get = jest.fn().mockResolvedValue(100);

      const result = await operations.count({ status: 'active' });

      expect(result).toBe(100);
      expect(mockDbManager.query).not.toHaveBeenCalled();
    });
  });

  describe('insertOne', () => {
    it('should insert record and return with ID', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ insertId: 123 });

      const result = await operations.insertOne({ name: 'John', email: 'john@example.com' });

      expect(result).toEqual({ name: 'John', email: 'john@example.com', id: 123 });
      expect(mockInvalidationManager.invalidateTable).toHaveBeenCalledWith('users', {
        cascade: true,
      });
    });
  });

  describe('insertMany', () => {
    it('should insert multiple records', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ insertId: 100 });

      const data = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ];

      const result = await operations.insertMany(data);

      expect(result).toEqual([
        { name: 'John', email: 'john@example.com', id: 100 },
        { name: 'Jane', email: 'jane@example.com', id: 101 },
      ]);
    });

    it('should return empty array for empty input', async () => {
      const result = await operations.insertMany([]);

      expect(result).toEqual([]);
      expect(mockDbManager.query).not.toHaveBeenCalled();
    });
  });

  describe('updateOne', () => {
    it('should update record and return updated data', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{ id: 1, name: 'Updated', email: 'john@example.com' }]);

      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      const result = await operations.updateOne({ id: 1 }, { name: 'Updated' });

      expect(result).toEqual({ id: 1, name: 'Updated', email: 'john@example.com' });
      expect(mockInvalidationManager.invalidateTable).toHaveBeenCalled();
    });

    it('should return null when no rows affected', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ affectedRows: 0 });

      const result = await operations.updateOne({ id: 999 }, { name: 'Updated' });

      expect(result).toBeNull();
    });
  });

  describe('updateMany', () => {
    it('should return number of updated rows', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ affectedRows: 5 });

      const result = await operations.updateMany({ status: 'inactive' }, { status: 'archived' });

      expect(result).toBe(5);
      expect(mockInvalidationManager.invalidateTable).toHaveBeenCalled();
    });
  });

  describe('updateById', () => {
    it('should update by ID and return updated record', async () => {
      mockDbManager.query = jest
        .fn()
        .mockResolvedValueOnce({ affectedRows: 1 })
        .mockResolvedValueOnce([{ id: 1, name: 'Updated' }]);

      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      const result = await operations.updateById(1, { name: 'Updated' });

      expect(result).toEqual({ id: 1, name: 'Updated' });
    });
  });

  describe('deleteOne', () => {
    it('should delete record and return true', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ affectedRows: 1 });

      const result = await operations.deleteOne({ id: 1 });

      expect(result).toBe(true);
      expect(mockInvalidationManager.invalidateTable).toHaveBeenCalled();
    });

    it('should return false when no rows affected', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ affectedRows: 0 });

      const result = await operations.deleteOne({ id: 999 });

      expect(result).toBe(false);
    });
  });

  describe('deleteMany', () => {
    it('should return number of deleted rows', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ affectedRows: 3 });

      const result = await operations.deleteMany({ status: 'inactive' });

      expect(result).toBe(3);
      expect(mockInvalidationManager.invalidateTable).toHaveBeenCalled();
    });
  });

  describe('deleteById', () => {
    it('should delete by ID and return true', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ affectedRows: 1 });

      const result = await operations.deleteById(1);

      expect(result).toBe(true);
    });

    it('should return false when not found', async () => {
      mockDbManager.query = jest.fn().mockResolvedValue({ affectedRows: 0 });

      const result = await operations.deleteById(999);

      expect(result).toBe(false);
    });
  });

  describe('raw', () => {
    it('should execute raw SQL', async () => {
      const mockResult = [{ count: 42 }];
      mockDbManager.query = jest.fn().mockResolvedValue(mockResult);

      const result = await operations.raw('SELECT COUNT(*) as count FROM users');

      expect(result).toEqual(mockResult);
      expect(mockDbManager.query).toHaveBeenCalledWith('SELECT COUNT(*) as count FROM users', undefined);
    });

    it('should execute raw SQL with params', async () => {
      const mockResult = [{ id: 1, name: 'John' }];
      mockDbManager.query = jest.fn().mockResolvedValue(mockResult);

      const result = await operations.raw('SELECT * FROM users WHERE id = ?', [1]);

      expect(result).toEqual(mockResult);
      expect(mockDbManager.query).toHaveBeenCalledWith('SELECT * FROM users WHERE id = ?', [1]);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate table cache without cascade', async () => {
      await operations.invalidateCache();

      expect(mockInvalidationManager.invalidateTable).toHaveBeenCalledWith('users', {
        cascade: false,
      });
    });
  });

  describe('warmCache', () => {
    it('should pre-populate cache', async () => {
      const mockUsers = [{ id: 1, name: 'John' }];
      mockDbManager.query = jest.fn().mockResolvedValue(mockUsers);
      mockCacheManager.get = jest.fn().mockResolvedValue(null);

      await operations.warmCache({ status: 'active' });

      expect(mockDbManager.query).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });
});
