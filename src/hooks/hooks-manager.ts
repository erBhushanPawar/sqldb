type HookFunction = (...args: any[]) => Promise<any> | any;

export type HookType = 'before' | 'after';
export type Operation =
  | 'findOne'
  | 'findMany'
  | 'findById'
  | 'count'
  | 'insertOne'
  | 'insertMany'
  | 'updateOne'
  | 'updateMany'
  | 'updateById'
  | 'deleteOne'
  | 'deleteMany'
  | 'deleteById';

export class HooksManager {
  // Map: table -> hookType -> operation -> hooks[]
  private hooks: Map<string, Map<HookType, Map<Operation, HookFunction[]>>> =
    new Map();

  registerBefore(
    table: string,
    operation: Operation,
    hook: HookFunction
  ): void {
    this.registerHook(table, 'before', operation, hook);
  }

  registerAfter(
    table: string,
    operation: Operation,
    hook: HookFunction
  ): void {
    this.registerHook(table, 'after', operation, hook);
  }

  private registerHook(
    table: string,
    hookType: HookType,
    operation: Operation,
    hook: HookFunction
  ): void {
    if (!this.hooks.has(table)) {
      this.hooks.set(table, new Map());
    }

    const tableHooks = this.hooks.get(table)!;

    if (!tableHooks.has(hookType)) {
      tableHooks.set(hookType, new Map());
    }

    const typeHooks = tableHooks.get(hookType)!;

    if (!typeHooks.has(operation)) {
      typeHooks.set(operation, []);
    }

    typeHooks.get(operation)!.push(hook);
  }

  async executeBefore(
    table: string,
    operation: Operation,
    data: any
  ): Promise<any> {
    const hooks = this.getHooks(table, 'before', operation);

    let transformedData = data;

    for (const hook of hooks) {
      try {
        const result = await hook(transformedData);
        // If hook returns something, use it as transformed data
        if (result !== undefined) {
          transformedData = result;
        }
      } catch (error) {
        console.error(
          `[HooksManager] Error in before hook for ${table}.${operation}:`,
          error
        );
        throw error;
      }
    }

    return transformedData;
  }

  async executeAfter(
    table: string,
    operation: Operation,
    result: any,
    ...args: any[]
  ): Promise<void> {
    const hooks = this.getHooks(table, 'after', operation);

    for (const hook of hooks) {
      try {
        await hook(result, ...args);
      } catch (error) {
        console.error(
          `[HooksManager] Error in after hook for ${table}.${operation}:`,
          error
        );
        // Don't throw - after hooks shouldn't break the main operation
      }
    }
  }

  private getHooks(
    table: string,
    hookType: HookType,
    operation: Operation
  ): HookFunction[] {
    const tableHooks = this.hooks.get(table);
    if (!tableHooks) {
      return [];
    }

    const typeHooks = tableHooks.get(hookType);
    if (!typeHooks) {
      return [];
    }

    return typeHooks.get(operation) || [];
  }

  removeHook(
    table: string,
    hookType: HookType,
    operation: Operation,
    hook: HookFunction
  ): void {
    const hooks = this.getHooks(table, hookType, operation);
    const index = hooks.indexOf(hook);

    if (index !== -1) {
      hooks.splice(index, 1);
    }
  }

  clearHooks(table?: string, hookType?: HookType, operation?: Operation): void {
    if (!table) {
      this.hooks.clear();
      return;
    }

    if (!hookType) {
      this.hooks.delete(table);
      return;
    }

    const tableHooks = this.hooks.get(table);
    if (!tableHooks) {
      return;
    }

    if (!operation) {
      tableHooks.delete(hookType);
      return;
    }

    const typeHooks = tableHooks.get(hookType);
    if (typeHooks) {
      typeHooks.delete(operation);
    }
  }

  getRegisteredHooks(): {
    table: string;
    hookType: HookType;
    operation: Operation;
    count: number;
  }[] {
    const result: {
      table: string;
      hookType: HookType;
      operation: Operation;
      count: number;
    }[] = [];

    for (const [table, tableHooks] of this.hooks.entries()) {
      for (const [hookType, typeHooks] of tableHooks.entries()) {
        for (const [operation, hooks] of typeHooks.entries()) {
          result.push({
            table,
            hookType,
            operation,
            count: hooks.length,
          });
        }
      }
    }

    return result;
  }
}
