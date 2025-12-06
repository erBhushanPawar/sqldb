import * as mariadb from 'mariadb';
import { MariaDBConfig } from '../types/config';
import { QueryTracker, QueryMetadata } from '../types/query';
import { generateQueryId } from '../query/query-tracker';

export class MariaDBConnectionManager {
  private pool: mariadb.Pool | null = null;
  private config: MariaDBConfig;
  private queryTracker?: QueryTracker;

  constructor(config: MariaDBConfig, queryTracker?: QueryTracker) {
    this.config = config;
    this.queryTracker = queryTracker;
  }

  setQueryTracker(tracker: QueryTracker): void {
    this.queryTracker = tracker;
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

    const metadata: QueryMetadata = {
      queryId,
      correlationId,
      sql,
      params,
      startTime,
    };

    try {
      const result = await pool.query(sql, params);
      const endTime = Date.now();

      metadata.endTime = endTime;
      metadata.executionTimeMs = endTime - startTime;
      metadata.resultCount = Array.isArray(result) ? result.length : 1;

      if (this.queryTracker) {
        this.queryTracker.trackQuery(metadata);
      }

      return result;
    } catch (error) {
      const endTime = Date.now();
      metadata.endTime = endTime;
      metadata.executionTimeMs = endTime - startTime;
      metadata.error = error instanceof Error ? error.message : String(error);

      if (this.queryTracker) {
        this.queryTracker.trackQuery(metadata);
      }

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
