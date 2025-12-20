import * as mariadb from 'mariadb';
import { MariaDBConfig } from '../types/config';
import { QueryTracker, QueryMetadata } from '../types/query';
import { generateQueryId } from '../query/query-tracker';

type QueryType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'ALTER' | 'DROP' | 'OTHER';

/**
 * Recursively converts BigInt values to Numbers in the result set
 * This prevents "Cannot convert a BigInt value to a number" errors
 * when downstream code tries to use isNaN() or other number operations
 */
function convertBigIntToNumber(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'bigint') {
    // Convert BigInt to Number
    // For very large BigInts that exceed Number.MAX_SAFE_INTEGER,
    // precision may be lost, but this is acceptable for most use cases
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map(convertBigIntToNumber);
  }

  if (typeof value === 'object' && value.constructor === Object) {
    const converted: any = {};
    for (const key in value) {
      if (value.hasOwnProperty(key)) {
        converted[key] = convertBigIntToNumber(value[key]);
      }
    }
    return converted;
  }

  return value;
}

export class MariaDBConnectionManager {
  private pool: mariadb.Pool | null = null;
  private config: MariaDBConfig;
  private queryTracker?: QueryTracker;
  private enableQueryLogging: boolean = false;

  constructor(config: MariaDBConfig, queryTracker?: QueryTracker) {
    this.config = config;
    this.queryTracker = queryTracker;
    // Enable query logging if logging is configured
    this.enableQueryLogging = !!(config as any).logging;
  }

  setQueryTracker(tracker: QueryTracker): void {
    this.queryTracker = tracker;
  }

  /**
   * Categorize query type based on SQL statement
   */
  private categorizeQuery(sql: string): QueryType {
    const trimmed = sql.trim().toUpperCase();

    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    if (trimmed.startsWith('CREATE')) return 'CREATE';
    if (trimmed.startsWith('ALTER')) return 'ALTER';
    if (trimmed.startsWith('DROP')) return 'DROP';

    return 'OTHER';
  }

  /**
   * Extract table name from SQL query
   */
  private extractTableName(sql: string, queryType: QueryType): string | null {
    try {
      const trimmed = sql.trim();
      let match: RegExpMatchArray | null = null;

      switch (queryType) {
        case 'SELECT':
          // SELECT ... FROM table_name
          match = trimmed.match(/FROM\s+`?(\w+)`?/i);
          break;
        case 'INSERT':
          // INSERT INTO table_name
          match = trimmed.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
          break;
        case 'UPDATE':
          // UPDATE table_name
          match = trimmed.match(/UPDATE\s+`?(\w+)`?/i);
          break;
        case 'DELETE':
          // DELETE FROM table_name
          match = trimmed.match(/DELETE\s+FROM\s+`?(\w+)`?/i);
          break;
        case 'CREATE':
        case 'ALTER':
        case 'DROP':
          // CREATE/ALTER/DROP TABLE table_name
          match = trimmed.match(/TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?`?(\w+)`?/i);
          break;
      }

      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Format SQL for logging (truncate if too long)
   */
  private formatSqlForLogging(sql: string, maxLength: number = 100): string {
    const cleaned = sql.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    return cleaned.substring(0, maxLength) + '...';
  }

  /**
   * Get performance emoji based on execution time
   */
  private getPerformanceEmoji(ms: number): string {
    if (ms < 10) return '⚡'; // Very fast
    if (ms < 50) return '🚀'; // Fast
    if (ms < 200) return '✅'; // Good
    if (ms < 500) return '⚠️';  // Slow
    return '🐌'; // Very slow
  }

  /**
   * Log query execution with nice formatting
   */
  private logQuery(
    queryType: QueryType,
    tableName: string | null,
    sql: string,
    executionTimeMs: number,
    resultCount: number,
    error?: string
  ): void {
    if (!this.enableQueryLogging) return;

    const emoji = error ? '❌' : this.getPerformanceEmoji(executionTimeMs);
    const table = tableName || 'unknown';
    const formattedSql = this.formatSqlForLogging(sql, 100 * 10);
    const timestamp = new Date().toISOString();

    if (error) {
      console.log(
        `[${timestamp}] ${emoji} ${queryType} on ${table} - FAILED after ${executionTimeMs}ms`
      );
      console.log(`   SQL: ${formattedSql}`);
      console.log(`   Error: ${error}`);
    } else {
      const resultsText = queryType === 'SELECT' ? `${resultCount} rows` : `${resultCount} affected`;
      console.log(
        `[${timestamp}] ${emoji} ${queryType} on ${table} - ${executionTimeMs}ms - ${resultsText}`
      );

      if (executionTimeMs > 200) {
        console.log(`   SQL: ${formattedSql}`);
      }
    }
  }

  async connect(): Promise<mariadb.Pool> {
    if (this.pool) {
      return this.pool;
    }

    this.pool = mariadb.createPool({
      ...this.config,
      port: this.config.port || 3306,
      connectionLimit: this.config.connectionLimit || 10,
    });

    return this.pool;
  }

  async getConnection(): Promise<mariadb.PoolConnection> {
    const pool = await this.connect();
    return pool.getConnection();
  }

  async query<T = any>(
    sql: string,
    params?: any[],
    correlationId?: string
  ): Promise<T> {
    const pool = await this.connect();
    const queryId = generateQueryId();
    const startTime = Date.now();

    // Categorize query
    const queryType = this.categorizeQuery(sql);
    const tableName = this.extractTableName(sql, queryType);

    const metadata: QueryMetadata = {
      queryId,
      correlationId,
      sql,
      params,
      startTime,
      tableName: tableName || undefined,
      operation: queryType,
    };

    try {
      const result = await pool.query(sql, params);
      const endTime = Date.now();
      const executionTimeMs = endTime - startTime;

      metadata.endTime = endTime;
      metadata.executionTimeMs = executionTimeMs;
      metadata.resultCount = Array.isArray(result) ? result.length : 1;

      if (this.queryTracker) {
        this.queryTracker.trackQuery(metadata);
      }

      // Log query execution
      this.logQuery(
        queryType,
        tableName,
        sql,
        executionTimeMs,
        metadata.resultCount
      );

      // Convert BigInt values to Numbers to prevent downstream errors
      return convertBigIntToNumber(result) as T;
    } catch (error) {
      const endTime = Date.now();
      const executionTimeMs = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      metadata.endTime = endTime;
      metadata.executionTimeMs = executionTimeMs;
      metadata.error = errorMessage;

      if (this.queryTracker) {
        this.queryTracker.trackQuery(metadata);
      }

      // Log query error
      this.logQuery(
        queryType,
        tableName,
        sql,
        executionTimeMs,
        0,
        errorMessage
      );

      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get connection pool information
   */
  getConnectionInfo(): {
    host: string;
    database: string;
    activeConnections: number;
    totalConnections: number;
    idleConnections: number;
    maxConnections: number;
  } {
    const pool = this.getPool();

    return {
      host: this.config.host,
      database: this.config.database,
      activeConnections: pool.activeConnections(),
      totalConnections: pool.totalConnections(),
      idleConnections: pool.idleConnections(),
      maxConnections: this.config.connectionLimit || 10,
    };
  }

  /**
   * Get pool instance
   */
  getPool(): mariadb.Pool {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.pool;
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  isConnected(): boolean {
    return this.pool !== null;
  }
}
