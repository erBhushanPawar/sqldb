import { CacheKeyBuilder } from '../../../src/cache/cache-key-builder';

describe('CacheKeyBuilder', () => {
  let builder: CacheKeyBuilder;

  beforeEach(() => {
    builder = new CacheKeyBuilder('test');
  });

  describe('buildKey', () => {
    it('should generate consistent keys for same params', () => {
      const params1 = { name: 'John', age: 30 };
      const params2 = { name: 'John', age: 30 };

      const key1 = builder.buildKey('users', 'findOne', params1);
      const key2 = builder.buildKey('users', 'findOne', params2);

      expect(key1).toBe(key2);
    });

    it('should generate consistent keys regardless of property order', () => {
      const params1 = { name: 'John', age: 30 };
      const params2 = { age: 30, name: 'John' };

      const key1 = builder.buildKey('users', 'findOne', params1);
      const key2 = builder.buildKey('users', 'findOne', params2);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const params1 = { name: 'John', age: 30 };
      const params2 = { name: 'Jane', age: 25 };

      const key1 = builder.buildKey('users', 'findOne', params1);
      const key2 = builder.buildKey('users', 'findOne', params2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different tables', () => {
      const params = { id: 1 };

      const key1 = builder.buildKey('users', 'findOne', params);
      const key2 = builder.buildKey('orders', 'findOne', params);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different operations', () => {
      const params = { id: 1 };

      const key1 = builder.buildKey('users', 'findOne', params);
      const key2 = builder.buildKey('users', 'findMany', params);

      expect(key1).not.toBe(key2);
    });

    it('should handle null and undefined params', () => {
      const key1 = builder.buildKey('users', 'findOne', null);
      const key2 = builder.buildKey('users', 'findOne', undefined);

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });

    it('should handle nested objects', () => {
      const params = {
        where: { name: 'John' },
        options: { limit: 10 },
      };

      const key = builder.buildKey('users', 'findMany', params);

      expect(key).toMatch(/^test:users:findMany:/);
    });

    it('should handle arrays', () => {
      const params = { ids: [1, 2, 3] };

      const key = builder.buildKey('users', 'findMany', params);

      expect(key).toMatch(/^test:users:findMany:/);
    });
  });

  describe('buildIdKey', () => {
    it('should build ID-based key with number', () => {
      const key = builder.buildIdKey('users', 123);

      expect(key).toBe('test:users:id:123');
    });

    it('should build ID-based key with string', () => {
      const key = builder.buildIdKey('users', 'abc-123');

      expect(key).toBe('test:users:id:abc-123');
    });
  });

  describe('buildTablePattern', () => {
    it('should build pattern for table', () => {
      const pattern = builder.buildTablePattern('users');

      expect(pattern).toBe('test:users:*');
    });
  });

  describe('buildOperationPattern', () => {
    it('should build pattern for operation', () => {
      const pattern = builder.buildOperationPattern('users', 'findOne');

      expect(pattern).toBe('test:users:findOne:*');
    });
  });

  describe('parseKey', () => {
    it('should parse valid key', () => {
      const key = 'test:users:findOne:abc123';
      const parsed = builder.parseKey(key);

      expect(parsed).toEqual({
        table: 'users',
        operation: 'findOne',
        hash: 'abc123',
      });
    });

    it('should return null for invalid key', () => {
      const key = 'invalid:key';
      const parsed = builder.parseKey(key);

      expect(parsed).toBeNull();
    });

    it('should return null for wrong prefix', () => {
      const key = 'wrong:users:findOne:abc123';
      const parsed = builder.parseKey(key);

      expect(parsed).toBeNull();
    });
  });

  describe('matchesPattern', () => {
    it('should match exact pattern', () => {
      const key = 'test:users:findOne:abc123';
      const pattern = 'test:users:findOne:abc123';

      expect(builder.matchesPattern(key, pattern)).toBe(true);
    });

    it('should match wildcard pattern', () => {
      const key = 'test:users:findOne:abc123';
      const pattern = 'test:users:*';

      expect(builder.matchesPattern(key, pattern)).toBe(true);
    });

    it('should not match different pattern', () => {
      const key = 'test:users:findOne:abc123';
      const pattern = 'test:orders:*';

      expect(builder.matchesPattern(key, pattern)).toBe(false);
    });

    it('should match multiple wildcards', () => {
      const key = 'test:users:findOne:abc123';
      const pattern = 'test:*:*:abc123';

      expect(builder.matchesPattern(key, pattern)).toBe(true);
    });
  });
});
