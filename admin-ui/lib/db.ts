import mariadb from 'mariadb';
import Redis from 'ioredis';
import { createSqlDB } from './sqldb';
import type { CallableSqlDBClient, SqlDBConfig } from './sqldb';
import {
  loadConfig,
  saveConfig,
  updateTableConfig,
  getTableConfig,
  validateConfig,
  type SqlDBConfigFile,
  type TableSearchConfig,
} from './sqldb/config-loader';

// Global configuration (loaded from file)
let globalConfig: SqlDBConfigFile = { tables: {} };

// Search configs storage (backwards compatibility - populated from globalConfig)
export const searchConfigs = new Map<string, TableSearchConfig>();

// Load configs from file on module initialization
try {
  globalConfig = loadConfig();

  // Populate searchConfigs Map for backwards compatibility
  Object.entries(globalConfig.tables).forEach(([tableName, config]) => {
    searchConfigs.set(tableName, config);
  });

  console.log(`📂 Loaded ${searchConfigs.size} table configuration(s)`);
} catch (error) {
  console.error('Failed to load configuration:', error);
}

/**
 * Get the global configuration
 */
export function getGlobalConfig(): SqlDBConfigFile {
  return globalConfig;
}

/**
 * Persist search configs to disk
 */
export function saveConfigsToDisk(): void {
  try {
    // Convert Map to config object
    const tables: { [key: string]: TableSearchConfig } = {};
    for (const [table, config] of searchConfigs.entries()) {
      tables[table] = config;
    }

    // Preserve defaults from global config
    const configToSave: SqlDBConfigFile = {
      defaults: globalConfig.defaults,
      tables,
    };

    saveConfig(configToSave);

    // Update global config
    globalConfig = configToSave;

    console.log(`💾 Saved ${searchConfigs.size} table configuration(s) to disk`);
  } catch (error) {
    console.error('Failed to save configuration:', error);
    throw error;
  }
}

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
      connectionLimit: parseInt(process.env.POOL_SIZE || '2', 10), // Increased from 10 to handle concurrent requests
      idleTimeout: 60000,
      acquireTimeout: 30000, // Increased from 10s to 30s for AWS RDS latency
      connectTimeout: 30000, // Increased from 10s to 30s for AWS RDS latency
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
export async function getDB(forceReinit: boolean = false): Promise<CallableSqlDBClient> {
  // Force reinitialization if requested (e.g., after config changes)
  if (forceReinit && dbInstance) {
    console.log('🔄 Forcing SqlDB reinitialization with updated search configs');
    dbInstance = null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  const redis = getRedisClient();

  // Build search table configurations from saved configs
  const searchTables: any = {};
  const geoTables: any = {};

  for (const [tableName, config] of searchConfigs.entries()) {
    const tableConfig: any = {
      searchableFields: config.searchableFields.map((f: any) => f.field),
      tokenizer: config.tokenizer || 'stemming',
      minWordLength: config.minWordLength || 3,
      fieldBoosts: config.searchableFields.reduce((acc: any, f: any) => {
        acc[f.field] = f.boost;
        return acc;
      }, {}),
    };

    // Add geo configuration if enabled (for inverted index)
    if (config.geo?.enabled) {
      tableConfig.geo = {
        latitudeField: config.geo.latitudeField,
        longitudeField: config.geo.longitudeField,
        locationNameField: config.geo.locationNameField,
      };

      // Also add to geoTables for GeoSearchManager
      geoTables[tableName] = {
        latField: config.geo.latitudeField,
        lngField: config.geo.longitudeField,
        locationField: config.geo.locationNameField,
        radiusUnit: 'km',
      };
    }

    searchTables[tableName] = tableConfig;

    console.log(`📋 Registering search config for table '${tableName}':`, {
      searchableFields: tableConfig.searchableFields,
      tokenizer: tableConfig.tokenizer,
      fieldBoosts: tableConfig.fieldBoosts,
      geo: tableConfig.geo ? '✓ enabled' : '✗ disabled',
    });
  }

  const config: SqlDBConfig = {
    mariadb: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
      connectionLimit: 20, // Increased from 10 to handle concurrent requests
      acquireTimeout: 30000, // Added: 30s timeout for AWS RDS
      connectTimeout: 30000, // Added: 30s timeout for AWS RDS
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
    search: redis ? {
      enabled: true,
      invertedIndex: {
        enabled: true,
        tables: searchTables,
      },
      geo: Object.keys(geoTables).length > 0 ? {
        enabled: true,
        tables: geoTables,
      } : undefined,
    } : undefined,
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
