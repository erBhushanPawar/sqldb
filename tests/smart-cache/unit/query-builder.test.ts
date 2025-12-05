import { QueryBuilder } from '../../../src/smart-cache/query/query-builder';

describe('QueryBuilder', () => {
  let builder: QueryBuilder;

  beforeEach(() => {
    builder = new QueryBuilder();
  });

  describe('buildSelect', () => {
    it('should build basic SELECT query', () => {
      const result = builder.buildSelect('users');

      expect(result.sql).toBe('SELECT * FROM users');
      expect(result.params).toEqual([]);
    });

    it('should build SELECT with WHERE clause', () => {
      const result = builder.buildSelect('users', { name: 'John', age: 30 });

      expect(result.sql).toBe('SELECT * FROM users WHERE name = ? AND age = ?');
      expect(result.params).toEqual(['John', 30]);
    });

    it('should build SELECT with specific columns', () => {
      const result = builder.buildSelect(
        'users',
        {},
        { select: ['id', 'name', 'email'] }
      );

      expect(result.sql).toBe('SELECT id, name, email FROM users');
    });

    it('should build SELECT with LIMIT', () => {
      const result = builder.buildSelect('users', {}, { limit: 10 });

      expect(result.sql).toBe('SELECT * FROM users LIMIT ?');
      expect(result.params).toEqual([10]);
    });

    it('should build SELECT with OFFSET', () => {
      const result = builder.buildSelect('users', {}, { limit: 10, offset: 20 });

      expect(result.sql).toBe('SELECT * FROM users LIMIT ? OFFSET ?');
      expect(result.params).toEqual([10, 20]);
    });

    it('should build SELECT with ORDER BY (string)', () => {
      const result = builder.buildSelect('users', {}, { orderBy: 'created_at' });

      expect(result.sql).toBe('SELECT * FROM users ORDER BY created_at');
    });

    it('should build SELECT with ORDER BY (object)', () => {
      const result = builder.buildSelect(
        'users',
        {},
        { orderBy: { column: 'created_at', direction: 'DESC' } }
      );

      expect(result.sql).toBe('SELECT * FROM users ORDER BY created_at DESC');
    });

    it('should build SELECT with multiple ORDER BY', () => {
      const result = builder.buildSelect(
        'users',
        {},
        {
          orderBy: [
            { column: 'status', direction: 'ASC' },
            { column: 'created_at', direction: 'DESC' },
          ],
        }
      );

      expect(result.sql).toBe('SELECT * FROM users ORDER BY status ASC, created_at DESC');
    });

    it('should build complete SELECT with all options', () => {
      const result = builder.buildSelect(
        'users',
        { status: 'active' },
        {
          select: ['id', 'name'],
          orderBy: 'created_at',
          limit: 10,
          offset: 20,
        }
      );

      expect(result.sql).toBe(
        'SELECT id, name FROM users WHERE status = ? ORDER BY created_at LIMIT ? OFFSET ?'
      );
      expect(result.params).toEqual(['active', 10, 20]);
    });

    it('should handle NULL values in WHERE', () => {
      const result = builder.buildSelect('users', { deleted_at: null });

      expect(result.sql).toBe('SELECT * FROM users WHERE deleted_at IS NULL');
      expect(result.params).toEqual([]);
    });

    it('should handle array values (IN clause)', () => {
      const result = builder.buildSelect('users', { status: ['active', 'verified'] });

      expect(result.sql).toBe('SELECT * FROM users WHERE status IN (?, ?)');
      expect(result.params).toEqual(['active', 'verified']);
    });

    it('should handle operator: $gt', () => {
      const result = builder.buildSelect('users', { age: { $gt: 18 } });

      expect(result.sql).toBe('SELECT * FROM users WHERE age > ?');
      expect(result.params).toEqual([18]);
    });

    it('should handle operator: $gte', () => {
      const result = builder.buildSelect('users', { age: { $gte: 18 } });

      expect(result.sql).toBe('SELECT * FROM users WHERE age >= ?');
      expect(result.params).toEqual([18]);
    });

    it('should handle operator: $lt', () => {
      const result = builder.buildSelect('users', { age: { $lt: 65 } });

      expect(result.sql).toBe('SELECT * FROM users WHERE age < ?');
      expect(result.params).toEqual([65]);
    });

    it('should handle operator: $lte', () => {
      const result = builder.buildSelect('users', { age: { $lte: 65 } });

      expect(result.sql).toBe('SELECT * FROM users WHERE age <= ?');
      expect(result.params).toEqual([65]);
    });

    it('should handle operator: $ne', () => {
      const result = builder.buildSelect('users', { status: { $ne: 'banned' } });

      expect(result.sql).toBe('SELECT * FROM users WHERE status != ?');
      expect(result.params).toEqual(['banned']);
    });

    it('should handle operator: $like', () => {
      const result = builder.buildSelect('users', { name: { $like: '%John%' } });

      expect(result.sql).toBe('SELECT * FROM users WHERE name LIKE ?');
      expect(result.params).toEqual(['%John%']);
    });

    it('should skip undefined values in WHERE', () => {
      const result = builder.buildSelect('users', { name: 'John', age: undefined });

      expect(result.sql).toBe('SELECT * FROM users WHERE name = ?');
      expect(result.params).toEqual(['John']);
    });
  });

  describe('buildCount', () => {
    it('should build COUNT query', () => {
      const result = builder.buildCount('users');

      expect(result.sql).toBe('SELECT COUNT(*) as count FROM users');
      expect(result.params).toEqual([]);
    });

    it('should build COUNT with WHERE clause', () => {
      const result = builder.buildCount('users', { status: 'active' });

      expect(result.sql).toBe('SELECT COUNT(*) as count FROM users WHERE status = ?');
      expect(result.params).toEqual(['active']);
    });
  });

  describe('buildInsert', () => {
    it('should build INSERT query', () => {
      const result = builder.buildInsert('users', {
        name: 'John',
        email: 'john@example.com',
        age: 30,
      });

      expect(result.sql).toBe('INSERT INTO users (name, email, age) VALUES (?, ?, ?)');
      expect(result.params).toEqual(['John', 'john@example.com', 30]);
    });

    it('should handle single column insert', () => {
      const result = builder.buildInsert('logs', { message: 'Test log' });

      expect(result.sql).toBe('INSERT INTO logs (message) VALUES (?)');
      expect(result.params).toEqual(['Test log']);
    });
  });

  describe('buildInsertMany', () => {
    it('should build INSERT for multiple rows', () => {
      const result = builder.buildInsertMany('users', [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ]);

      expect(result.sql).toBe('INSERT INTO users (name, age) VALUES (?, ?), (?, ?)');
      expect(result.params).toEqual(['John', 30, 'Jane', 25]);
    });

    it('should throw error for empty array', () => {
      expect(() => {
        builder.buildInsertMany('users', []);
      }).toThrow('Cannot insert empty array');
    });
  });

  describe('buildUpdate', () => {
    it('should build UPDATE query', () => {
      const result = builder.buildUpdate('users', { id: 1 }, { name: 'Updated' });

      expect(result.sql).toBe('UPDATE users SET name = ? WHERE id = ?');
      expect(result.params).toEqual(['Updated', 1]);
    });

    it('should build UPDATE with multiple columns', () => {
      const result = builder.buildUpdate(
        'users',
        { id: 1 },
        { name: 'Updated', age: 31, status: 'verified' }
      );

      expect(result.sql).toBe(
        'UPDATE users SET name = ?, age = ?, status = ? WHERE id = ?'
      );
      expect(result.params).toEqual(['Updated', 31, 'verified', 1]);
    });

    it('should build UPDATE with complex WHERE', () => {
      const result = builder.buildUpdate(
        'users',
        { status: 'active', age: { $gt: 18 } },
        { verified: true }
      );

      expect(result.sql).toBe('UPDATE users SET verified = ? WHERE status = ? AND age > ?');
      expect(result.params).toEqual([true, 'active', 18]);
    });
  });

  describe('buildDelete', () => {
    it('should build DELETE query', () => {
      const result = builder.buildDelete('users', { id: 1 });

      expect(result.sql).toBe('DELETE FROM users WHERE id = ?');
      expect(result.params).toEqual([1]);
    });

    it('should build DELETE with multiple conditions', () => {
      const result = builder.buildDelete('users', { status: 'inactive', age: { $lt: 18 } });

      expect(result.sql).toBe('DELETE FROM users WHERE status = ? AND age < ?');
      expect(result.params).toEqual(['inactive', 18]);
    });
  });

  describe('buildSelectById', () => {
    it('should build SELECT by ID', () => {
      const result = builder.buildSelectById('users', 123);

      expect(result.sql).toBe('SELECT * FROM users WHERE id = ?');
      expect(result.params).toEqual([123]);
    });

    it('should build SELECT by ID with specific columns', () => {
      const result = builder.buildSelectById('users', 123, ['id', 'name']);

      expect(result.sql).toBe('SELECT id, name FROM users WHERE id = ?');
      expect(result.params).toEqual([123]);
    });
  });

  describe('buildUpdateById', () => {
    it('should build UPDATE by ID', () => {
      const result = builder.buildUpdateById('users', 123, { name: 'Updated' });

      expect(result.sql).toBe('UPDATE users SET name = ? WHERE id = ?');
      expect(result.params).toEqual(['Updated', 123]);
    });
  });

  describe('buildDeleteById', () => {
    it('should build DELETE by ID', () => {
      const result = builder.buildDeleteById('users', 123);

      expect(result.sql).toBe('DELETE FROM users WHERE id = ?');
      expect(result.params).toEqual([123]);
    });
  });
});
