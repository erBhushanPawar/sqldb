export interface QueryStats {
  queryId: string;
  tableName: string;
  queryType: 'findMany' | 'findOne' | 'findById' | 'count';
  filters: string; // JSON stringified filters
  accessCount: number;
  lastAccessedAt: Date;
  avgExecutionTime: number;
  lastWarmingTime?: Date;
}

export interface WarmingConfig {
  // Enable auto-warming
  enabled: boolean;

  // Interval to run warming job (in milliseconds)
  intervalMs?: number; // Default: 60000 (1 minute)

  // Number of top queries to warm per table
  topQueriesPerTable?: number; // Default: 10

  // Minimum access count to consider for warming
  minAccessCount?: number; // Default: 5

  // Maximum age of query stats to consider (in milliseconds)
  maxStatsAge?: number; // Default: 3600000 (1 hour)

  // Use separate connection pool for warming
  useSeperatePool?: boolean; // Default: true

  // Separate pool size for warming
  warmingPoolSize?: number; // Default: 2

  // Track query statistics in database
  trackInDatabase?: boolean; // Default: true

  // Stats table name
  statsTableName?: string; // Default: '__sqldb_query_stats'

  // Callback when warming completes
  onWarmingComplete?: (stats: WarmingStats) => void;

  // Callback when warming fails
  onWarmingError?: (error: Error) => void;
}

export interface WarmingStats {
  timestamp: Date;
  queriesWarmed: number;
  queriesFailed: number;
  totalTimeMs: number;
  cacheHitRateBefore: number;
  cacheHitRateAfter: number;
  tables: {
    [tableName: string]: {
      queriesWarmed: number;
      avgExecutionTime: number;
    };
  };
}

export interface QueryAccessLog {
  queryId: string;
  tableName: string;
  queryType: string;
  filters: string;
  executionTimeMs: number;
  cacheHit: boolean;
  timestamp: Date;
}
