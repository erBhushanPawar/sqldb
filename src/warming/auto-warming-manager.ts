import { MariaDBConnectionManager } from '../connection/mariadb';
import { CacheManager } from '../cache/cache-manager';
import { QueryStatsTracker } from './query-stats-tracker';
import { WarmingConfig, WarmingStats, QueryStats } from '../types/warming';
import { MariaDBConfig } from '../types/config';

export class AutoWarmingManager {
  private dbManager: MariaDBConnectionManager;
  private warmingDbManager?: MariaDBConnectionManager;
  private cacheManager: CacheManager;
  private statsTracker: QueryStatsTracker;
  private config: WarmingConfig;
  private warmingInterval?: NodeJS.Timeout;
  private isWarming: boolean = false;
  private warmingStats: WarmingStats | null = null;

  constructor(
    dbManager: MariaDBConnectionManager,
    cacheManager: CacheManager,
    statsTracker: QueryStatsTracker,
    config: WarmingConfig,
    mariadbConfig: MariaDBConfig
  ) {
    this.dbManager = dbManager;
    this.cacheManager = cacheManager;
    this.statsTracker = statsTracker;
    this.config = config;

    // Create separate connection pool for warming if enabled
    if (config.useSeperatePool !== false) {
      this.warmingDbManager = new MariaDBConnectionManager({
        ...mariadbConfig,
        connectionLimit: config.warmingPoolSize || 2,
      });
    }
  }

  /**
   * Start auto-warming
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Connect warming pool if needed
    if (this.warmingDbManager) {
      await this.warmingDbManager.connect();
    }

    // Run initial warming
    await this.warmCache();

    // Schedule periodic warming
    const intervalMs = this.config.intervalMs || 60000; // 1 minute default
    this.warmingInterval = setInterval(async () => {
      await this.warmCache();
    }, intervalMs);
  }

  /**
   * Stop auto-warming
   */
  async stop(): Promise<void> {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = undefined;
    }

    // Close warming pool if needed
    if (this.warmingDbManager) {
      await this.warmingDbManager.close();
    }
  }

  /**
   * Warm cache with most frequently accessed queries
   */
  async warmCache(): Promise<WarmingStats> {
    if (this.isWarming) {
      return this.warmingStats!;
    }

    this.isWarming = true;
    const startTime = Date.now();
    const stats: WarmingStats = {
      timestamp: new Date(),
      queriesWarmed: 0,
      queriesFailed: 0,
      totalTimeMs: 0,
      cacheHitRateBefore: await this.getCacheHitRate(),
      cacheHitRateAfter: 0,
      tables: {},
    };

    try {
      // Get all tracked tables
      const tables = await this.statsTracker.getTrackedTables();

      // Warm queries for each table
      for (const tableName of tables) {
        const tableStats = await this.warmTableQueries(tableName);
        stats.queriesWarmed += tableStats.queriesWarmed;
        stats.queriesFailed += tableStats.queriesFailed;
        stats.tables[tableName] = {
          queriesWarmed: tableStats.queriesWarmed,
          avgExecutionTime: tableStats.avgExecutionTime,
        };
      }

      stats.cacheHitRateAfter = await this.getCacheHitRate();
      stats.totalTimeMs = Date.now() - startTime;

      this.warmingStats = stats;

      // Call success callback
      if (this.config.onWarmingComplete) {
        this.config.onWarmingComplete(stats);
      }
    } catch (error: any) {
      console.error('[AutoWarmingManager] Cache warming failed:', error.message);

      // Call error callback
      if (this.config.onWarmingError) {
        this.config.onWarmingError(error);
      }

      throw error;
    } finally {
      this.isWarming = false;
    }

    return stats;
  }

  /**
   * Warm queries for a specific table
   */
  private async warmTableQueries(tableName: string): Promise<{
    queriesWarmed: number;
    queriesFailed: number;
    avgExecutionTime: number;
  }> {
    const limit = this.config.topQueriesPerTable || 10;
    const minAccessCount = this.config.minAccessCount || 5;

    // Get top queries for this table
    const topQueries = await this.statsTracker.getTopQueries(
      tableName,
      limit,
      minAccessCount
    );

    let queriesWarmed = 0;
    let queriesFailed = 0;
    let totalExecutionTime = 0;

    // Warm each query
    for (const queryStats of topQueries) {
      try {
        const executionTime = await this.warmQuery(queryStats);
        totalExecutionTime += executionTime;
        queriesWarmed++;

        // Update warming time
        await this.statsTracker.updateWarmingTime(queryStats.queryId);
      } catch (error: any) {
        console.error(
          `[AutoWarmingManager] Failed to warm query ${queryStats.queryId}:`,
          error.message
        );
        queriesFailed++;
      }
    }

    return {
      queriesWarmed,
      queriesFailed,
      avgExecutionTime:
        queriesWarmed > 0 ? totalExecutionTime / queriesWarmed : 0,
    };
  }

  /**
   * Warm a single query
   */
  private async warmQuery(queryStats: QueryStats): Promise<number> {
    const startTime = Date.now();
    const dbManager = this.warmingDbManager || this.dbManager;

    // Parse filters
    const filters = queryStats.filters ? JSON.parse(queryStats.filters) : {};

    // Build SQL based on query type
    let sql: string;
    const params: any[] = [];

    switch (queryStats.queryType) {
      case 'findMany':
        sql = this.buildFindManySQL(queryStats.tableName, filters, params);
        break;

      case 'findOne':
        sql = this.buildFindOneSQL(queryStats.tableName, filters, params);
        break;

      case 'findById':
        sql = this.buildFindByIdSQL(queryStats.tableName, filters, params);
        break;

      case 'count':
        sql = this.buildCountSQL(queryStats.tableName, filters, params);
        break;

      case 'raw':
        // For raw queries, use the stored SQL directly
        sql = filters.sql || '';
        params.push(...(filters.params || []));
        break;

      default:
        throw new Error(`Unknown query type: ${queryStats.queryType}`);
    }

    // Execute query
    const result = await dbManager.query(sql, params);

    // Store in cache
    const cacheKey = `query:${queryStats.queryId}`;
    await this.cacheManager.set(cacheKey, result, 300); // 5 minute TTL

    return Date.now() - startTime;
  }

  /**
   * Build SQL for findMany
   */
  private buildFindManySQL(
    tableName: string,
    filters: Record<string, any>,
    params: any[]
  ): string {
    let sql = `SELECT * FROM ${tableName}`;
    const whereClauses: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        whereClauses.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    return sql;
  }

  /**
   * Build SQL for findOne
   */
  private buildFindOneSQL(
    tableName: string,
    filters: Record<string, any>,
    params: any[]
  ): string {
    const sql = this.buildFindManySQL(tableName, filters, params);
    return `${sql} LIMIT 1`;
  }

  /**
   * Build SQL for findById
   */
  private buildFindByIdSQL(
    tableName: string,
    filters: Record<string, any>,
    params: any[]
  ): string {
    // Assume filters contains the ID
    const id = Object.values(filters)[0];
    params.push(id);

    // We'd need to know the primary key column name
    // For now, assume it's in the filters keys
    const idColumn = Object.keys(filters)[0] || 'id';
    return `SELECT * FROM ${tableName} WHERE ${idColumn} = ? LIMIT 1`;
  }

  /**
   * Build SQL for count
   */
  private buildCountSQL(
    tableName: string,
    filters: Record<string, any>,
    params: any[]
  ): string {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
    const whereClauses: string[] = [];

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        whereClauses.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    return sql;
  }

  /**
   * Get current cache hit rate
   */
  private async getCacheHitRate(): Promise<number> {
    try {
      const stats = await this.cacheManager.getStats();
      if (!stats) {
        return 0;
      }
      const totalRequests = stats.hits + stats.misses;
      if (totalRequests === 0) {
        return 0;
      }
      return stats.hits / totalRequests;
    } catch {
      return 0;
    }
  }

  /**
   * Get last warming stats
   */
  getLastWarmingStats(): WarmingStats | null {
    return this.warmingStats;
  }

  /**
   * Check if currently warming
   */
  isCurrentlyWarming(): boolean {
    return this.isWarming;
  }
}
