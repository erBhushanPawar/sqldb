import { SmartDBClient } from './client';
import { SmartDBConfig } from './types/config';

export async function createSmartDB(
  config: SmartDBConfig
): Promise<SmartDBClient> {
  const client = new SmartDBClient(config);
  await client.initialize();
  return client;
}

// Export main client class
export { SmartDBClient } from './client';

// Export all type definitions
export * from './types/config';
export * from './types/query';
export * from './types/cache';
export * from './types/schema';

// Export managers for advanced usage
export { CacheManager } from './cache/cache-manager';
export { InvalidationManager } from './cache/invalidation';
export { DependencyGraph } from './discovery/dependency-graph';
export { HooksManager } from './hooks/hooks-manager';
export { QueryBuilder } from './query/query-builder';

// Default export
export default {
  createSmartDB,
  SmartDBClient,
};
