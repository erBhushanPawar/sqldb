import * as mariadb from 'mariadb';
import { MariaDBConfig } from '../types/config';

export class MariaDBConnectionManager {
  private pool: mariadb.Pool | null = null;
  private config: MariaDBConfig;

  constructor(config: MariaDBConfig) {
    this.config = config;
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

  async query<T = any>(sql: string, params?: any[]): Promise<T> {
    const pool = await this.connect();
    return pool.query(sql, params);
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
