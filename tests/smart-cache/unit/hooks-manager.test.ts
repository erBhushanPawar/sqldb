import { HooksManager } from '../../../src/smart-cache/hooks/hooks-manager';

describe('HooksManager', () => {
  let hooksManager: HooksManager;

  beforeEach(() => {
    hooksManager = new HooksManager();
  });

  describe('registerBefore', () => {
    it('should register a before hook', () => {
      const hook = jest.fn();

      hooksManager.registerBefore('users', 'insertOne', hook);

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toEqual({
        table: 'users',
        hookType: 'before',
        operation: 'insertOne',
        count: 1,
      });
    });

    it('should register multiple before hooks for same operation', () => {
      const hook1 = jest.fn();
      const hook2 = jest.fn();

      hooksManager.registerBefore('users', 'insertOne', hook1);
      hooksManager.registerBefore('users', 'insertOne', hook2);

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks[0].count).toBe(2);
    });
  });

  describe('registerAfter', () => {
    it('should register an after hook', () => {
      const hook = jest.fn();

      hooksManager.registerAfter('users', 'insertOne', hook);

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toEqual({
        table: 'users',
        hookType: 'after',
        operation: 'insertOne',
        count: 1,
      });
    });
  });

  describe('executeBefore', () => {
    it('should execute before hooks in order', async () => {
      const executionOrder: number[] = [];

      const hook1 = jest.fn((data) => {
        executionOrder.push(1);
        return data;
      });

      const hook2 = jest.fn((data) => {
        executionOrder.push(2);
        return data;
      });

      hooksManager.registerBefore('users', 'insertOne', hook1);
      hooksManager.registerBefore('users', 'insertOne', hook2);

      await hooksManager.executeBefore('users', 'insertOne', { name: 'John' });

      expect(executionOrder).toEqual([1, 2]);
    });

    it('should transform data through hooks', async () => {
      const hook1 = jest.fn((data) => ({
        ...data,
        transformed1: true,
      }));

      const hook2 = jest.fn((data) => ({
        ...data,
        transformed2: true,
      }));

      hooksManager.registerBefore('users', 'insertOne', hook1);
      hooksManager.registerBefore('users', 'insertOne', hook2);

      const result = await hooksManager.executeBefore('users', 'insertOne', {
        name: 'John',
      });

      expect(result).toEqual({
        name: 'John',
        transformed1: true,
        transformed2: true,
      });
    });

    it('should pass transformed data to next hook', async () => {
      const hook1 = jest.fn((data) => ({
        ...data,
        step1: 'done',
      }));

      const hook2 = jest.fn((data) => {
        expect(data.step1).toBe('done');
        return { ...data, step2: 'done' };
      });

      hooksManager.registerBefore('users', 'insertOne', hook1);
      hooksManager.registerBefore('users', 'insertOne', hook2);

      await hooksManager.executeBefore('users', 'insertOne', { name: 'John' });

      expect(hook2).toHaveBeenCalledWith({
        name: 'John',
        step1: 'done',
      });
    });

    it('should throw error if hook throws', async () => {
      const hook = jest.fn(() => {
        throw new Error('Hook error');
      });

      hooksManager.registerBefore('users', 'insertOne', hook);

      await expect(
        hooksManager.executeBefore('users', 'insertOne', { name: 'John' })
      ).rejects.toThrow('Hook error');
    });

    it('should return original data if no hooks registered', async () => {
      const result = await hooksManager.executeBefore('users', 'insertOne', {
        name: 'John',
      });

      expect(result).toEqual({ name: 'John' });
    });

    it('should handle async hooks', async () => {
      const hook = jest.fn(async (data) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...data, async: true };
      });

      hooksManager.registerBefore('users', 'insertOne', hook);

      const result = await hooksManager.executeBefore('users', 'insertOne', {
        name: 'John',
      });

      expect(result).toEqual({ name: 'John', async: true });
    });
  });

  describe('executeAfter', () => {
    it('should execute after hooks in order', async () => {
      const executionOrder: number[] = [];

      const hook1 = jest.fn(() => {
        executionOrder.push(1);
      });

      const hook2 = jest.fn(() => {
        executionOrder.push(2);
      });

      hooksManager.registerAfter('users', 'insertOne', hook1);
      hooksManager.registerAfter('users', 'insertOne', hook2);

      await hooksManager.executeAfter('users', 'insertOne', { id: 1, name: 'John' });

      expect(executionOrder).toEqual([1, 2]);
    });

    it('should pass result and args to hooks', async () => {
      const hook = jest.fn();

      hooksManager.registerAfter('users', 'insertOne', hook);

      const result = { id: 1, name: 'John' };
      const arg1 = 'extra';
      const arg2 = 'args';

      await hooksManager.executeAfter('users', 'insertOne', result, arg1, arg2);

      expect(hook).toHaveBeenCalledWith(result, arg1, arg2);
    });

    it('should not throw if hook throws (after hooks are fire-and-forget)', async () => {
      const hook = jest.fn(() => {
        throw new Error('Hook error');
      });

      hooksManager.registerAfter('users', 'insertOne', hook);

      // Should not throw
      await expect(
        hooksManager.executeAfter('users', 'insertOne', { id: 1 })
      ).resolves.not.toThrow();
    });

    it('should handle async after hooks', async () => {
      const executed = jest.fn();

      const hook = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executed();
      });

      hooksManager.registerAfter('users', 'insertOne', hook);

      await hooksManager.executeAfter('users', 'insertOne', { id: 1 });

      expect(executed).toHaveBeenCalled();
    });
  });

  describe('removeHook', () => {
    it('should remove specific hook', () => {
      const hook1 = jest.fn();
      const hook2 = jest.fn();

      hooksManager.registerBefore('users', 'insertOne', hook1);
      hooksManager.registerBefore('users', 'insertOne', hook2);

      hooksManager.removeHook('users', 'before', 'insertOne', hook1);

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks[0].count).toBe(1);
    });
  });

  describe('clearHooks', () => {
    it('should clear all hooks when no arguments', () => {
      hooksManager.registerBefore('users', 'insertOne', jest.fn());
      hooksManager.registerAfter('orders', 'updateOne', jest.fn());

      hooksManager.clearHooks();

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks).toHaveLength(0);
    });

    it('should clear all hooks for a table', () => {
      hooksManager.registerBefore('users', 'insertOne', jest.fn());
      hooksManager.registerAfter('users', 'updateOne', jest.fn());
      hooksManager.registerBefore('orders', 'insertOne', jest.fn());

      hooksManager.clearHooks('users');

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks).toHaveLength(1);
      expect(hooks[0].table).toBe('orders');
    });

    it('should clear all hooks for a table and type', () => {
      hooksManager.registerBefore('users', 'insertOne', jest.fn());
      hooksManager.registerAfter('users', 'insertOne', jest.fn());

      hooksManager.clearHooks('users', 'before');

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks).toHaveLength(1);
      expect(hooks[0].hookType).toBe('after');
    });

    it('should clear specific operation hooks', () => {
      hooksManager.registerBefore('users', 'insertOne', jest.fn());
      hooksManager.registerBefore('users', 'updateOne', jest.fn());

      hooksManager.clearHooks('users', 'before', 'insertOne');

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks).toHaveLength(1);
      expect(hooks[0].operation).toBe('updateOne');
    });
  });

  describe('getRegisteredHooks', () => {
    it('should return empty array when no hooks', () => {
      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks).toEqual([]);
    });

    it('should return all registered hooks with counts', () => {
      hooksManager.registerBefore('users', 'insertOne', jest.fn());
      hooksManager.registerBefore('users', 'insertOne', jest.fn());
      hooksManager.registerAfter('users', 'updateOne', jest.fn());
      hooksManager.registerBefore('orders', 'insertOne', jest.fn());

      const hooks = hooksManager.getRegisteredHooks();

      expect(hooks).toHaveLength(3);

      const usersInsertBefore = hooks.find(
        (h) => h.table === 'users' && h.hookType === 'before' && h.operation === 'insertOne'
      );
      expect(usersInsertBefore?.count).toBe(2);

      const usersUpdateAfter = hooks.find(
        (h) => h.table === 'users' && h.hookType === 'after' && h.operation === 'updateOne'
      );
      expect(usersUpdateAfter?.count).toBe(1);

      const ordersInsertBefore = hooks.find(
        (h) => h.table === 'orders' && h.hookType === 'before' && h.operation === 'insertOne'
      );
      expect(ordersInsertBefore?.count).toBe(1);
    });
  });
});
