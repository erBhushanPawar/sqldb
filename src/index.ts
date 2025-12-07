import { SmartDBClient } from './client';
import { SmartDBConfig } from './types/config';

// Singleton instance storage
let singletonInstance: SmartDBClient | null = null;

export async function createSmartDB(
  config: SmartDBConfig,
  options?: { singleton?: boolean }
): Promise<SmartDBClient> {
  // If singleton mode is enabled and instance exists, return it
  if (options?.singleton) {
    if (singletonInstance) {
      return singletonInstance;
    }

    // Create and store singleton instance
    const client = new SmartDBClient(config);
    await client.initialize();

    // Wrap in Proxy for dynamic table access
    const proxiedClient = createProxiedClient(client);
    singletonInstance = proxiedClient;
    return singletonInstance;
  }

  // Non-singleton mode: create new instance
  const client = new SmartDBClient(config);
  await client.initialize();

  // Wrap in Proxy for dynamic table access
  return createProxiedClient(client);
}

// Create a proxied client that allows dynamic table access (db.users, db.orders, etc.)
function createProxiedClient(client: SmartDBClient): SmartDBClient {
  return new Proxy(client, {
    get(target, prop: string | symbol) {
      // If prop is a symbol or starts with underscore, return from target
      if (typeof prop === 'symbol' || prop.startsWith('_')) {
        return (target as any)[prop];
      }

      // If property exists on the target, return it
      if (prop in target) {
        const value = (target as any)[prop];
        // Bind methods to maintain correct 'this' context
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      }

      // Otherwise, treat it as a table name and return TableOperations
      if (typeof prop === 'string') {
        return target.getTableOperations(prop);
      }

      return undefined;
    },
  }) as SmartDBClient;
}

// Get the singleton instance (throws if not initialized)
export function getSmartDB(): SmartDBClient {
  if (!singletonInstance) {
    throw new Error(
      'Singleton SmartDB instance not initialized. Call createSmartDB({ ... }, { singleton: true }) first.'
    );
  }
  return singletonInstance;
}

// Clear singleton instance (useful for testing or reconnecting)
export function clearSmartDBSingleton(): void {
  singletonInstance = null;
}

// Export main client class
export { SmartDBClient } from './client';

// Export all type definitions
export * from './types/config';
export * from './types/query';
export * from './types/cache';
export * from './types/schema';
export * from './types/client';

// Export managers for advanced usage
export { CacheManager } from './cache/cache-manager';
export { InvalidationManager } from './cache/invalidation';
export { DependencyGraph } from './discovery/dependency-graph';
export { HooksManager } from './hooks/hooks-manager';
export { QueryBuilder } from './query/query-builder';
export { InMemoryQueryTracker, generateQueryId } from './query/query-tracker';
export { SchemaGenerator } from './cli/schema-generator';

// Default export
export default {
  createSmartDB,
  getSmartDB,
  clearSmartDBSingleton,
  SmartDBClient,
};
