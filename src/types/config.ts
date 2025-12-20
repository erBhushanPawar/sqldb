import * as mariadb from 'mariadb';
import { RedisOptions } from 'ioredis';
import { WarmingConfig } from './warming';

export interface MariaDBConfig {
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
  [key: string]: any; // Allow other mariadb options
}

export interface RedisConfig {
  host: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  options?: RedisOptions;
}

export interface CacheConfig {
  enabled?: boolean;
  defaultTTL?: number; // seconds
  maxKeys?: number;
  invalidateOnWrite?: boolean;
  cascadeInvalidation?: boolean;
}

export interface DiscoveryConfig {
  autoDiscover?: boolean;
  refreshInterval?: number; // milliseconds, 0 = manual only
  includeTables?: string[];
  excludeTables?: string[];
  maxGraphDepth?: number; // for dependency traversal
}

export interface LoggingConfig {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  logger?: (level: string, message: string, meta?: any) => void;
}

export interface CaseConversionConfig {
  enabled?: boolean;
  database?: 'snake_case' | 'camelCase'; // Database column naming
  application?: 'snake_case' | 'camelCase'; // Application property naming
}

export interface SqlDBConfig {
  mariadb: MariaDBConfig;
  redis: RedisConfig;
  cache?: CacheConfig;
  discovery?: DiscoveryConfig;
  logging?: LoggingConfig;
  warming?: WarmingConfig;
  caseConversion?: CaseConversionConfig;
}

// Default configurations
export const DEFAULT_CACHE_CONFIG: Required<CacheConfig> = {
  enabled: true,
  defaultTTL: 60, // 60 seconds
  maxKeys: 10000,
  invalidateOnWrite: true,
  cascadeInvalidation: true,
};

export const DEFAULT_DISCOVERY_CONFIG: Required<DiscoveryConfig> = {
  autoDiscover: true,
  refreshInterval: 0, // manual only by default
  includeTables: [],
  excludeTables: [],
  maxGraphDepth: 3,
};

export const DEFAULT_LOGGING_CONFIG: Required<LoggingConfig> = {
  level: 'info',
  logger: (level: string, message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
  },
};

export const DEFAULT_WARMING_CONFIG: Required<WarmingConfig> = {
  enabled: false,
  intervalMs: 60000, // 1 minute
  topQueriesPerTable: 10,
  minAccessCount: 5,
  maxStatsAge: 3600000, // 1 hour
  useSeperatePool: true,
  warmingPoolSize: 2,
  trackInDatabase: true,
  statsTableName: '__sqldb_query_stats',
  onWarmingComplete: undefined as any,
  onWarmingError: undefined as any,
};

export const DEFAULT_CASE_CONVERSION_CONFIG: Required<CaseConversionConfig> = {
  enabled: false,
  database: 'snake_case',
  application: 'camelCase',
};
