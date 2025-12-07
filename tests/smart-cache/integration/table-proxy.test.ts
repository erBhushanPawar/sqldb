import { TableProxyFactory, createTableProxy } from '../../../src/query/table-proxy';
import { SqlDBClient } from '../../../src/client';
import { TableOperations } from '../../../src/types/query';

// Mock SqlDBClient
jest.mock('../../../src/client');

describe('Table Proxy Integration', () => {
  let mockClient: jest.Mocked<SqlDBClient>;
  let mockOperations: TableOperations;

  beforeEach(() => {
    mockOperations = {
      findOne: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      count: jest.fn(),
      insertOne: jest.fn(),
      insertMany: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      updateById: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      deleteById: jest.fn(),
      raw: jest.fn(),
      invalidateCache: jest.fn(),
      warmCache: jest.fn(),
    };

    mockClient = new SqlDBClient(null as any) as jest.Mocked<SqlDBClient>;
    mockClient.getTableOperations = jest.fn().mockReturnValue(mockOperations);
  });

  describe('createTableProxy', () => {
    it('should create a proxy that delegates to client', () => {
      const proxy = createTableProxy(mockClient, 'users');

      expect(mockClient.getTableOperations).toHaveBeenCalledWith('users');
      expect(proxy).toBe(mockOperations);
    });
  });

  describe('TableProxyFactory', () => {
    it('should cache proxy instances', () => {
      const factory = new TableProxyFactory(mockClient);

      const proxy1 = factory.getProxy('users');
      const proxy2 = factory.getProxy('users');

      expect(proxy1).toBe(proxy2);
      expect(mockClient.getTableOperations).toHaveBeenCalledTimes(1);
    });

    it('should create different proxies for different tables', () => {
      const factory = new TableProxyFactory(mockClient);

      const usersProxy = factory.getProxy('users');
      const ordersProxy = factory.getProxy('orders');

      expect(mockClient.getTableOperations).toHaveBeenCalledWith('users');
      expect(mockClient.getTableOperations).toHaveBeenCalledWith('orders');
      expect(mockClient.getTableOperations).toHaveBeenCalledTimes(2);
    });

    it('should clear cache', () => {
      const factory = new TableProxyFactory(mockClient);

      factory.getProxy('users');
      factory.clearCache();
      factory.getProxy('users');

      // Should be called twice since cache was cleared
      expect(mockClient.getTableOperations).toHaveBeenCalledTimes(2);
    });
  });
});
