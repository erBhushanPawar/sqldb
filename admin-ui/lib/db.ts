import mariadb from 'mariadb';
import Redis from 'ioredis';
import { createSqlDB } from './sqldb';
import type { CallableSqlDBClient, SqlDBConfig } from './sqldb';

// Singleton instances
let dbInstance: CallableSqlDBClient | null = null;
let mariadbPool: mariadb.Pool | null = null;
let redisClient: Redis | null = null;

/**
 * Get MariaDB connection pool (singleton)
 */
export function getMariaDBPool(): mariadb.Pool {
  if (!mariadbPool) {
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    const user = process.env.DB_USER || 'root';
    const database = process.env.DB_NAME || 'test';

    console.log('🔧 MariaDB Config:', {
      host,
      port,
      user,
      database,
      hasPassword: !!process.env.DB_PASSWORD,
    });

    const poolConfig: mariadb.PoolConfig = {
      host,
      port,
      user,
      password: process.env.DB_PASSWORD || '',
      database,
      connectionLimit: 10,
      idleTimeout: 60000,
      acquireTimeout: 10000,
      connectTimeout: 10000,
    };

    mariadbPool = mariadb.createPool(poolConfig);
    console.log('✅ MariaDB connection pool created');
  }

  return mariadbPool;
}

// Alias for compatibility
export const getMySQLPool = getMariaDBPool;

/**
 * Get Redis client (singleton)
 */
export function getRedisClient(): Redis | null {
  const enableCache = process.env.ENABLE_CACHE === 'true';

  if (!enableCache) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
  }

  return redisClient;
}

/**
 * Initialize SqlDB instance (singleton)
 */
export async function getDB(): Promise<CallableSqlDBClient> {
  if (dbInstance) {
    return dbInstance;
  }

  const redis = getRedisClient();

  const config: SqlDBConfig = {
    mariadb: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
      connectionLimit: 10,
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    cache: {
      enabled: process.env.ENABLE_CACHE === 'true',
      defaultTTL: 3600,
    },
    discovery: {
      autoDiscover: true,
    },
  };

  dbInstance = await createSqlDB(config, { singleton: true });

  // Initialize search indexes if enabled
  if (process.env.ENABLE_SEARCH === 'true' && redis) {
    console.log('🔍 Search functionality enabled');
  }

  // Initialize auto-warming if enabled
  if (process.env.ENABLE_AUTO_WARMING === 'true' && redis) {
    console.log('🔥 Auto-warming enabled');
  }

  console.log('✅ SqlDB initialized with features:', {
    cache: config.cache?.enabled,
    search: process.env.ENABLE_SEARCH === 'true',
    autoWarming: process.env.ENABLE_AUTO_WARMING === 'true',
  });

  return dbInstance;
}

/**
 * Close all database connections
 */
export async function closeDB(): Promise<void> {
  if (mariadbPool) {
    await mariadbPool.end();
    mariadbPool = null;
    console.log('✅ MariaDB pool closed');
  }

  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('✅ Redis connection closed');
  }

  dbInstance = null;
}

/**
 * Health check for database connections
 */
export async function healthCheck(): Promise<{
  mysql: boolean;
  redis: boolean;
  error?: string;
}> {
  const result = {
    mysql: false,
    redis: false,
    error: undefined as string | undefined,
  };

  try {
    const pool = getMariaDBPool();
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    result.mysql = true;
  } catch (error) {
    result.error = `MariaDB: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.ping();
      result.redis = true;
    } else {
      result.redis = false; // Redis disabled
    }
  } catch (error) {
    result.error = result.error
      ? `${result.error}; Redis: ${error instanceof Error ? error.message : 'Unknown error'}`
      : `Redis: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  return result;
}
