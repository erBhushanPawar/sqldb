import { CacheManager } from './cache-manager';
import { DependencyGraph } from '../discovery/dependency-graph';
import { InvalidationOptions, InvalidationStrategy } from '../types/cache';

export class InvalidationManager {
  private cacheManager: CacheManager;
  private dependencyGraph: DependencyGraph;

  constructor(cacheManager: CacheManager, dependencyGraph: DependencyGraph) {
    this.cacheManager = cacheManager;
    this.dependencyGraph = dependencyGraph;
  }

  async invalidateTable(
    table: string,
    options: InvalidationOptions = {}
  ): Promise<void> {
    const {
      cascade = true,
      strategy = InvalidationStrategy.IMMEDIATE,
    } = options;

    if (strategy === InvalidationStrategy.TTL_ONLY) {
      // Don't actively invalidate, rely on TTL
      return;
    }

    const tablesToInvalidate = cascade
      ? this.dependencyGraph.getInvalidationTargets(table)
      : [table];

    if (strategy === InvalidationStrategy.LAZY) {
      // Mark for invalidation but don't delete immediately
      // This could be implemented with a flag or separate tracking
      // For now, we'll do immediate invalidation
    }

    // Invalidate cache for all affected tables
    for (const targetTable of tablesToInvalidate) {
      await this.invalidateTableCache(targetTable);
    }
  }

  private async invalidateTableCache(table: string): Promise<void> {
    const pattern = this.cacheManager.getKeyBuilder().buildTablePattern(table);
    await this.cacheManager.deletePattern(pattern);
  }

  async invalidatePattern(pattern: string): Promise<number> {
    return await this.cacheManager.deletePattern(pattern);
  }

  async invalidateKey(key: string): Promise<void> {
    await this.cacheManager.delete(key);
  }

  async invalidateMultipleTables(
    tables: string[],
    cascade: boolean = true
  ): Promise<void> {
    const allTables = new Set<string>();

    for (const table of tables) {
      if (cascade) {
        const targets = this.dependencyGraph.getInvalidationTargets(table);
        targets.forEach((t) => allTables.add(t));
      } else {
        allTables.add(table);
      }
    }

    for (const table of allTables) {
      await this.invalidateTableCache(table);
    }
  }

  async invalidateAll(): Promise<void> {
    await this.cacheManager.clear();
  }
}
