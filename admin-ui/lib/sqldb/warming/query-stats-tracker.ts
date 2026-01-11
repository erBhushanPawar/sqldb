import { MariaDBConnectionManager } from '../connection/mariadb';
import { QueryStats, QueryAccessLog, WarmingConfig } from '../types/warming';
import { generateQueryId } from '../query/query-tracker';

export class QueryStatsTracker {
  private dbManager: MariaDBConnectionManager;
  private config: WarmingConfig;
  private statsTableName: string;
  private inMemoryStats: Map<string, QueryStats>;
  private initialized: boolean = false;

  constructor(dbManager: MariaDBConnectionManager, config: WarmingConfig) {
    this.dbManager = dbManager;
    this.config = config;
    this.statsTableName = config.statsTableName || '__sqldb_query_stats';
    this.inMemoryStats = new Map();
  }

  async initialize(): Promise<void> {
    if (!this.config.trackInDatabase) {
      this.initialized = true;
      return;
    }

    // Create stats table if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${this.statsTableName} (
        query_id VARCHAR(64) PRIMARY KEY,
        table_name VARCHAR(255) NOT NULL,
        query_type VARCHAR(50) NOT NULL,
        filters TEXT,
        access_count INT DEFAULT 1,
        last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        avg_execution_time DECIMAL(10,2) DEFAULT 0,
        last_warming_time TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_table_access (table_name, access_count DESC),
        INDEX idx_last_accessed (last_accessed_at),
        INDEX idx_warming (last_warming_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;

    try {
      await this.dbManager.query(createTableSQL);
      this.initialized = true;
    } catch (error: any) {
      console.error('[QueryStatsTracker] Failed to create stats table:', error.message);
      // Fallback to in-memory only
      this.config.trackInDatabase = false;
      this.initialized = true;
    }
  }

  /**
   * Record a query access
   */
  async recordAccess(log: QueryAccessLog): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Skip recording if there's no table name (e.g., schema queries, raw SQL)
    if (!log.tableName) {
      return;
    }

    const queryId = log.queryId;

    // Update in-memory stats
    const existing = this.inMemoryStats.get(queryId);
    if (existing) {
      existing.accessCount++;
      existing.lastAccessedAt = log.timestamp;
      // Update running average
      existing.avgExecutionTime =
        (existing.avgExecutionTime * (existing.accessCount - 1) + log.executionTimeMs) /
        existing.accessCount;
    } else {
      this.inMemoryStats.set(queryId, {
        queryId,
        tableName: log.tableName,
        queryType: log.queryType as any,
        filters: log.filters,
        accessCount: 1,
        lastAccessedAt: log.timestamp,
        avgExecutionTime: log.executionTimeMs,
      });
    }

    // Update database stats (async, don't wait)
    if (this.config.trackInDatabase) {
      this.updateDatabaseStats(log).catch((err) => {
        console.error('[QueryStatsTracker] Failed to update database stats:', err.message);
      });
    }
  }

  /**
   * Update database stats (non-blocking)
   */
  private async updateDatabaseStats(log: QueryAccessLog): Promise<void> {
    const sql = `
      INSERT INTO ${this.statsTableName}
        (query_id, table_name, query_type, filters, access_count, avg_execution_time, last_accessed_at)
      VALUES (?, ?, ?, ?, 1, ?, NOW())
      ON DUPLICATE KEY UPDATE
        access_count = access_count + 1,
        avg_execution_time = (avg_execution_time * access_count + ?) / (access_count + 1),
        last_accessed_at = NOW()
    `;

    await this.dbManager.query(sql, [
      log.queryId,
      log.tableName,
      log.queryType,
      log.filters,
      log.executionTimeMs,
      log.executionTimeMs,
    ]);
  }

  /**
   * Get top queries for a specific table
   */
  async getTopQueries(
    tableName: string,
    limit: number = 10,
    minAccessCount: number = 5
  ): Promise<QueryStats[]> {
    if (this.config.trackInDatabase) {
      return this.getTopQueriesFromDatabase(tableName, limit, minAccessCount);
    } else {
      return this.getTopQueriesFromMemory(tableName, limit, minAccessCount);
    }
  }

  /**
   * Get top queries from database
   */
  private async getTopQueriesFromDatabase(
    tableName: string,
    limit: number,
    minAccessCount: number
  ): Promise<QueryStats[]> {
    const maxAge = this.config.maxStatsAge || 3600000; // 1 hour
    const maxAgeDate = new Date(Date.now() - maxAge);

    const sql = `
      SELECT
        query_id as queryId,
        table_name as tableName,
        query_type as queryType,
        filters,
        access_count as accessCount,
        last_accessed_at as lastAccessedAt,
        avg_execution_time as avgExecutionTime,
        last_warming_time as lastWarmingTime
      FROM ${this.statsTableName}
      WHERE table_name = ?
        AND access_count >= ?
        AND last_accessed_at >= ?
      ORDER BY access_count DESC, avg_execution_time ASC
      LIMIT ?
    `;

    const result: any = await this.dbManager.query(sql, [
      tableName,
      minAccessCount,
      maxAgeDate,
      limit,
    ]);

    return result.map((row: any) => ({
      queryId: row.queryId,
      tableName: row.tableName,
      queryType: row.queryType,
      filters: row.filters,
      accessCount: parseInt(row.accessCount),
      lastAccessedAt: new Date(row.lastAccessedAt),
      avgExecutionTime: parseFloat(row.avgExecutionTime),
      lastWarmingTime: row.lastWarmingTime ? new Date(row.lastWarmingTime) : undefined,
    }));
  }

  /**
   * Get top queries from memory
   */
  private getTopQueriesFromMemory(
    tableName: string,
    limit: number,
    minAccessCount: number
  ): QueryStats[] {
    const maxAge = this.config.maxStatsAge || 3600000; // 1 hour
    const maxAgeDate = new Date(Date.now() - maxAge);

    const filtered = Array.from(this.inMemoryStats.values())
      .filter(
        (stat) =>
          stat.tableName === tableName &&
          stat.accessCount >= minAccessCount &&
          stat.lastAccessedAt >= maxAgeDate
      )
      .sort((a, b) => {
        // Sort by access count (desc), then by avg execution time (asc)
        if (b.accessCount !== a.accessCount) {
          return b.accessCount - a.accessCount;
        }
        return a.avgExecutionTime - b.avgExecutionTime;
      })
      .slice(0, limit);

    return filtered;
  }

  /**
   * Get all tables with tracked queries
   */
  async getTrackedTables(): Promise<string[]> {
    if (this.config.trackInDatabase) {
      const sql = `
        SELECT DISTINCT table_name
        FROM ${this.statsTableName}
        ORDER BY table_name
      `;
      const result: any = await this.dbManager.query(sql);
      return result.map((row: any) => row.table_name);
    } else {
      const tables = new Set<string>();
      for (const stat of this.inMemoryStats.values()) {
        tables.add(stat.tableName);
      }
      return Array.from(tables).sort();
    }
  }

  /**
   * Update last warming time for a query
   */
  async updateWarmingTime(queryId: string): Promise<void> {
    const stat = this.inMemoryStats.get(queryId);
    if (stat) {
      stat.lastWarmingTime = new Date();
    }

    if (this.config.trackInDatabase) {
      const sql = `
        UPDATE ${this.statsTableName}
        SET last_warming_time = NOW()
        WHERE query_id = ?
      `;
      await this.dbManager.query(sql, [queryId]).catch(() => {
        // Ignore errors
      });
    }
  }

  /**
   * Clean old stats
   */
  async cleanOldStats(olderThanMs: number = 86400000): Promise<number> {
    const cutoffDate = new Date(Date.now() - olderThanMs);

    // Clean in-memory stats
    let cleaned = 0;
    for (const [queryId, stat] of this.inMemoryStats.entries()) {
      if (stat.lastAccessedAt < cutoffDate) {
        this.inMemoryStats.delete(queryId);
        cleaned++;
      }
    }

    // Clean database stats
    if (this.config.trackInDatabase) {
      const sql = `
        DELETE FROM ${this.statsTableName}
        WHERE last_accessed_at < ?
      `;
      const result: any = await this.dbManager.query(sql, [cutoffDate]);
      cleaned += result.affectedRows || 0;
    }

    return cleaned;
  }

  /**
   * Get statistics summary
   */
  async getStatsSummary(): Promise<{
    totalQueries: number;
    totalAccesses: number;
    tableCount: number;
    avgAccessCount: number;
  }> {
    if (this.config.trackInDatabase) {
      const sql = `
        SELECT
          COUNT(*) as totalQueries,
          SUM(access_count) as totalAccesses,
          COUNT(DISTINCT table_name) as tableCount,
          AVG(access_count) as avgAccessCount
        FROM ${this.statsTableName}
      `;
      const result: any = await this.dbManager.query(sql);
      return {
        totalQueries: parseInt(result[0].totalQueries) || 0,
        totalAccesses: parseInt(result[0].totalAccesses) || 0,
        tableCount: parseInt(result[0].tableCount) || 0,
        avgAccessCount: parseFloat(result[0].avgAccessCount) || 0,
      };
    } else {
      const totalQueries = this.inMemoryStats.size;
      const totalAccesses = Array.from(this.inMemoryStats.values()).reduce(
        (sum, stat) => sum + stat.accessCount,
        0
      );
      const tables = new Set(
        Array.from(this.inMemoryStats.values()).map((s) => s.tableName)
      );
      return {
        totalQueries,
        totalAccesses,
        tableCount: tables.size,
        avgAccessCount: totalQueries > 0 ? totalAccesses / totalQueries : 0,
      };
    }
  }
}
