import { InvalidationManager } from '../../../src/smart-cache/cache/invalidation';
import { CacheManager } from '../../../src/smart-cache/cache/cache-manager';
import { DependencyGraph } from '../../../src/smart-cache/discovery/dependency-graph';
import { InvalidationStrategy } from '../../../src/smart-cache/types/cache';
import { TableRelationship } from '../../../src/smart-cache/types/schema';

// Mock CacheManager
jest.mock('../../../src/smart-cache/cache/cache-manager');

describe('InvalidationManager Integration', () => {
  let invalidationManager: InvalidationManager;
  let mockCacheManager: jest.Mocked<CacheManager>;
  let dependencyGraph: DependencyGraph;

  beforeEach(() => {
    mockCacheManager = new CacheManager(null as any, null as any) as jest.Mocked<CacheManager>;
    mockCacheManager.deletePattern = jest.fn().mockResolvedValue(0);
    mockCacheManager.delete = jest.fn().mockResolvedValue(undefined);
    mockCacheManager.getKeyBuilder = jest.fn().mockReturnValue({
      buildTablePattern: (table: string) => `test:${table}:*`,
    });

    dependencyGraph = new DependencyGraph(3);
    invalidationManager = new InvalidationManager(mockCacheManager, dependencyGraph);
  });

  describe('invalidateTable', () => {
    it('should invalidate single table when cascade is false', async () => {
      await invalidationManager.invalidateTable('users', { cascade: false });

      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:users:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledTimes(1);
    });

    it('should invalidate table and dependents when cascade is true', async () => {
      const relationships: TableRelationship[] = [
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
      ];

      dependencyGraph.buildFromRelationships(relationships);

      await invalidationManager.invalidateTable('users', { cascade: true });

      // Should invalidate users, orders, and order_items
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:users:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:orders:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:order_items:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledTimes(3);
    });

    it('should use default cascade value when not specified', async () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
      ];

      dependencyGraph.buildFromRelationships(relationships);

      await invalidationManager.invalidateTable('users');

      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:users:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:orders:*');
    });

    it('should not invalidate when strategy is TTL_ONLY', async () => {
      await invalidationManager.invalidateTable('users', {
        strategy: InvalidationStrategy.TTL_ONLY,
      });

      expect(mockCacheManager.deletePattern).not.toHaveBeenCalled();
    });
  });

  describe('invalidatePattern', () => {
    it('should invalidate keys matching pattern', async () => {
      mockCacheManager.deletePattern = jest.fn().mockResolvedValue(5);

      const count = await invalidationManager.invalidatePattern('test:users:findOne:*');

      expect(count).toBe(5);
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:users:findOne:*');
    });
  });

  describe('invalidateKey', () => {
    it('should invalidate specific key', async () => {
      await invalidationManager.invalidateKey('test:users:findOne:abc123');

      expect(mockCacheManager.delete).toHaveBeenCalledWith('test:users:findOne:abc123');
    });
  });

  describe('invalidateMultipleTables', () => {
    it('should invalidate multiple tables without cascade', async () => {
      await invalidationManager.invalidateMultipleTables(['users', 'orders'], false);

      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:users:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:orders:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledTimes(2);
    });

    it('should invalidate multiple tables with cascade', async () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
        {
          constraintName: 'fk_comments_user',
          fromTable: 'comments',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
      ];

      dependencyGraph.buildFromRelationships(relationships);

      await invalidationManager.invalidateMultipleTables(['users'], true);

      // Should invalidate users, orders, and comments
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:users:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:orders:*');
      expect(mockCacheManager.deletePattern).toHaveBeenCalledWith('test:comments:*');
    });

    it('should deduplicate tables when cascading', async () => {
      const relationships: TableRelationship[] = [
        {
          constraintName: 'fk_orders_user',
          fromTable: 'orders',
          fromColumn: 'user_id',
          toTable: 'users',
          toColumn: 'id',
        },
      ];

      dependencyGraph.buildFromRelationships(relationships);

      // Both users and orders should result in same invalidation set
      await invalidationManager.invalidateMultipleTables(['users', 'orders'], true);

      // Should not invalidate tables multiple times
      const calls = (mockCacheManager.deletePattern as jest.Mock).mock.calls;
      const usersCalls = calls.filter((call) => call[0] === 'test:users:*');
      const ordersCalls = calls.filter((call) => call[0] === 'test:orders:*');

      expect(usersCalls.length).toBe(1);
      expect(ordersCalls.length).toBe(1);
    });
  });

  describe('invalidateAll', () => {
    it('should clear entire cache', async () => {
      mockCacheManager.clear = jest.fn().mockResolvedValue(undefined);

      await invalidationManager.invalidateAll();

      expect(mockCacheManager.clear).toHaveBeenCalled();
    });
  });
});
