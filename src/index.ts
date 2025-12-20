import { SqlDBClient } from './client';
import { SqlDBConfig } from './types/config';

// Singleton instance storage
let singletonInstance: SqlDBClient | null = null;

export async function createSqlDB(
  config: SqlDBConfig,
  options?: { singleton?: boolean }
): Promise<SqlDBClient> {
  // If singleton mode is enabled and instance exists, return it
  if (options?.singleton) {
    if (singletonInstance) {
      return singletonInstance;
    }

    // Create and store singleton instance
    const client = new SqlDBClient(config);
    await client.initialize();

    // Wrap in Proxy for dynamic table access
    const proxiedClient = createProxiedClient(client);
    singletonInstance = proxiedClient;
    return singletonInstance;
  }

  // Non-singleton mode: create new instance
  const client = new SqlDBClient(config);
  await client.initialize();

  // Wrap in Proxy for dynamic table access
  return createProxiedClient(client);
}

// Create a proxied client that allows dynamic table access (db.users, db.orders, etc.)
function createProxiedClient(client: SqlDBClient): SqlDBClient {
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
  }) as SqlDBClient;
}

// Get the singleton instance (throws if not initialized)
export function getSqlDB(): SqlDBClient {
  if (!singletonInstance) {
    throw new Error(
      'Singleton SqlDB instance not initialized. Call createSqlDB({ ... }, { singleton: true }) first.'
    );
  }
  return singletonInstance;
}

// Clear singleton instance (useful for testing or reconnecting)
export function clearSqlDBSingleton(): void {
  singletonInstance = null;
}

// Export main client class
export { SqlDBClient } from './client';

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
export { InMemoryQueryTracker, generateQueryId, QueryMetrics } from './query/query-tracker';
export { SchemaGenerator } from './cli/schema-generator';

// Export utilities
export { CaseConverter } from './utils/case-converter';

// Default export
export default {
  createSqlDB,
  getSqlDB,
  clearSqlDBSingleton,
  SqlDBClient,
};
