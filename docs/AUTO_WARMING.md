# Auto-Warming Cache System

Intelligent cache warming that tracks query frequency and automatically pre-loads hot data into the cache.

## Overview

The auto-warming system continuously monitors which queries are accessed most frequently and proactively warms the cache with fresh data, ensuring your hottest queries always hit the cache.

### Key Features

✅ **Frequency Tracking** - Tracks access count per query
✅ **Automatic Warming** - Background job keeps cache hot
✅ **Separate Connection Pool** - Zero impact on main queries
✅ **Persistent Statistics** - Stores stats in `__sqldb_query_stats` table
✅ **Configurable** - Full control over warming behavior
✅ **Smart** - Only warms frequently accessed queries
✅ **Observable** - Callbacks for monitoring and alerts

## Quick Start

```typescript
import { createSqlDB } from '@bhushanpawar/sqldb';

const db = await createSqlDB({
  mariadb: { /* ... */ },
  redis: { /* ... */ },
  warming: {
    enabled: true,              // Enable auto-warming
    intervalMs: 60000,          // Warm every 1 minute
    topQueriesPerTable: 10,     // Warm top 10 queries per table
    minAccessCount: 5,          // Must be accessed at least 5 times
  },
});
```

That's it! The system now:
1. Tracks every query execution
2. Identifies hot queries
3. Automatically warms them in the background

## How It Works

### 1. Query Tracking

Every query execution is tracked:

```typescript
// User executes query
const users = await db.users.findMany({ status: 'active' });

// System tracks:
// - Query ID (hash of table + operation + filters)
// - Table name
// - Query type (findMany, findOne, etc.)
// - Filters
// - Execution time
// - Access count
```

### 2. Frequency Analysis

The system analyzes which queries are "hot":

- Ranks queries by access count
- Considers only recent queries (configurable age)
- Filters by minimum access threshold
- Sorts by frequency and performance

### 3. Auto-Warming

Background job runs periodically:

1. Fetches top N queries per table
2. Executes queries using separate connection pool
3. Stores results in cache
4. Updates warming timestamps

## Configuration

### Full Configuration

```typescript
warming: {
  // Enable/disable auto-warming
  enabled: boolean;                    // default: false

  // Warming interval
  intervalMs?: number;                 // default: 60000 (1 minute)

  // Number of top queries to warm per table
  topQueriesPerTable?: number;         // default: 10

  // Minimum access count to consider
  minAccessCount?: number;             // default: 5

  // Maximum age of stats to consider (ms)
  maxStatsAge?: number;                // default: 3600000 (1 hour)

  // Use separate connection pool
  useSeperatePool?: boolean;           // default: true

  // Size of warming pool
  warmingPoolSize?: number;            // default: 2

  // Track stats in database
  trackInDatabase?: boolean;           // default: true

  // Stats table name
  statsTableName?: string;             // default: '__sqldb_query_stats'

  // Callbacks
  onWarmingComplete?: (stats: WarmingStats) => void;
  onWarmingError?: (error: Error) => void;
}
```

### Configuration Examples

#### Minimal Configuration

```typescript
warming: {
  enabled: true,
}
```

#### Aggressive Warming (High Traffic Sites)

```typescript
warming: {
  enabled: true,
  intervalMs: 30000,              // Every 30 seconds
  topQueriesPerTable: 20,         // Top 20 queries
  minAccessCount: 3,              // Lower threshold
  warmingPoolSize: 4,             // More connections
}
```

#### Conservative Warming (Low Traffic Sites)

```typescript
warming: {
  enabled: true,
  intervalMs: 300000,             // Every 5 minutes
  topQueriesPerTable: 5,          // Top 5 queries only
  minAccessCount: 10,             // Higher threshold
  maxStatsAge: 7200000,           // Consider last 2 hours
}
```

#### In-Memory Only (No Database Tracking)

```typescript
warming: {
  enabled: true,
  trackInDatabase: false,         // Don't use database table
  maxStatsAge: 1800000,           // 30 minutes (more aggressive cleanup)
}
```

## Statistics Tracking

### The `__sqldb_query_stats` Table

When `trackInDatabase: true`, the system creates:

```sql
CREATE TABLE __sqldb_query_stats (
  query_id VARCHAR(64) PRIMARY KEY,
  table_name VARCHAR(255) NOT NULL,
  query_type VARCHAR(50) NOT NULL,
  filters TEXT,
  access_count INT DEFAULT 1,
  last_accessed_at TIMESTAMP,
  avg_execution_time DECIMAL(10,2),
  last_warming_time TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_access (table_name, access_count DESC),
  INDEX idx_last_accessed (last_accessed_at),
  INDEX idx_warming (last_warming_time)
);
```

### Query the Stats

```sql
-- Top 10 most accessed queries
SELECT table_name, query_type, access_count, avg_execution_time
FROM __sqldb_query_stats
ORDER BY access_count DESC
LIMIT 10;

-- Queries never warmed
SELECT table_name, access_count, last_accessed_at
FROM __sqldb_query_stats
WHERE last_warming_time IS NULL
AND access_count >= 5
ORDER BY access_count DESC;

-- Per-table statistics
SELECT
  table_name,
  COUNT(*) as query_count,
  SUM(access_count) as total_accesses,
  AVG(avg_execution_time) as avg_time
FROM __sqldb_query_stats
GROUP BY table_name
ORDER BY total_accesses DESC;
```

## API Methods

### Get Warming Statistics

```typescript
const stats = db.getWarmingStats();

if (stats) {
  console.log('Queries warmed:', stats.queriesWarmed);
  console.log('Cache hit rate before:', stats.cacheHitRateBefore);
  console.log('Cache hit rate after:', stats.cacheHitRateAfter);
  console.log('Total time:', stats.totalTimeMs + 'ms');

  // Per-table breakdown
  for (const [table, tableStats] of Object.entries(stats.tables)) {
    console.log(`${table}:`, tableStats.queriesWarmed, 'queries');
  }
}
```

### Manually Trigger Warming

```typescript
// Trigger immediate warming
const stats = await db.warmCache();
console.log('Manual warming complete:', stats);
```

### Get Query Statistics Summary

```typescript
const summary = await db.getQueryStatsSummary();

if (summary) {
  console.log('Total queries tracked:', summary.totalQueries);
  console.log('Total accesses:', summary.totalAccesses);
  console.log('Tables with queries:', summary.tableCount);
  console.log('Average access count:', summary.avgAccessCount);
}
```

## Monitoring & Observability

### Warming Completion Callback

```typescript
warming: {
  enabled: true,
  onWarmingComplete: (stats) => {
    // Log to monitoring system
    metrics.gauge('cache.warming.queries', stats.queriesWarmed);
    metrics.gauge('cache.warming.duration_ms', stats.totalTimeMs);
    metrics.gauge('cache.hit_rate.before', stats.cacheHitRateBefore);
    metrics.gauge('cache.hit_rate.after', stats.cacheHitRateAfter);

    // Alert if performance degraded
    if (stats.cacheHitRateAfter < stats.cacheHitRateBefore) {
      logger.warn('Cache hit rate decreased after warming');
    }
  },
}
```

### Error Handling

```typescript
warming: {
  enabled: true,
  onWarmingError: (error) => {
    logger.error('Cache warming failed', { error: error.message });

    // Alert ops team
    if (error.message.includes('connection')) {
      alerting.sendAlert('Database connection issue in cache warming');
    }
  },
}
```

## Performance Considerations

### Separate Connection Pool

By default (`useSeperatePool: true`), warming uses its own connection pool:

```
Main App Queries         Warming Queries
      ↓                        ↓
 Main Pool (10)          Warming Pool (2)
      ↓                        ↓
    Database
```

Benefits:
- Zero impact on main application queries
- Warming can't starve app connections
- Better isolation and debugging

### Memory Usage

The system stores query stats in memory and/or database:

- **In-Memory Only**: ~1KB per unique query
- **Database Tracking**: Minimal memory, data in DB
- Old stats automatically cleaned up based on `maxStatsAge`

### Network & CPU

Warming executes real queries:

- Uses database CPU (minimal with proper indexes)
- Network traffic proportional to data size
- Adjust `topQueriesPerTable` and `intervalMs` based on load

## Best Practices

### 1. Start Conservative

```typescript
warming: {
  enabled: true,
  intervalMs: 300000,        // 5 minutes
  topQueriesPerTable: 5,     // Top 5 only
  minAccessCount: 10,        // High threshold
}
```

Monitor and adjust based on results.

### 2. Monitor Cache Hit Rates

```typescript
warming: {
  enabled: true,
  onWarmingComplete: (stats) => {
    const improvement = stats.cacheHitRateAfter - stats.cacheHitRateBefore;
    console.log('Cache improvement:', (improvement * 100).toFixed(2) + '%');
  },
}
```

### 3. Use Database Tracking in Production

```typescript
warming: {
  enabled: true,
  trackInDatabase: true,     // Persists across restarts
  statsTableName: '__sqldb_query_stats',
}
```

### 4. Tune for Your Traffic Pattern

**High Traffic (many users, same queries)**
```typescript
warming: {
  intervalMs: 30000,         // More frequent
  topQueriesPerTable: 20,    // More queries
  minAccessCount: 5,         // Lower threshold
}
```

**Low Traffic (few users, diverse queries)**
```typescript
warming: {
  intervalMs: 300000,        // Less frequent
  topQueriesPerTable: 3,     // Fewer queries
  minAccessCount: 10,        // Higher threshold
}
```

### 5. Monitor Warming Performance

```typescript
warming: {
  enabled: true,
  onWarmingComplete: (stats) => {
    // Alert if warming takes too long
    if (stats.totalTimeMs > 5000) {
      logger.warn('Warming took > 5 seconds', { duration: stats.totalTimeMs });
    }

    // Alert if many failures
    if (stats.queriesFailed > 0) {
      logger.error('Some queries failed to warm', { failed: stats.queriesFailed });
    }
  },
}
```

## Use Cases

### 1. E-Commerce Product Catalog

```typescript
warming: {
  enabled: true,
  intervalMs: 60000,           // Every minute
  topQueriesPerTable: 15,      // Top 15 products/categories
  minAccessCount: 3,           // Warm after 3 views
  onWarmingComplete: (stats) => {
    console.log('Product catalog warmed:', stats.queriesWarmed, 'queries');
  },
}

// Popular product queries stay hot
await db.products.findMany({ category: 'electronics' });
await db.products.findMany({ featured: true });
```

### 2. SaaS Dashboard

```typescript
warming: {
  enabled: true,
  intervalMs: 30000,           // Every 30 seconds
  topQueriesPerTable: 10,
  minAccessCount: 2,           // Warm frequently viewed dashboards
}

// User dashboard queries stay cached
await db.metrics.findMany({ user_id: 123, timeframe: 'day' });
await db.notifications.findMany({ user_id: 123, unread: true });
```

### 3. News/Blog Site

```typescript
warming: {
  enabled: true,
  intervalMs: 120000,          // Every 2 minutes
  topQueriesPerTable: 20,      // Many popular articles
  minAccessCount: 5,
  maxStatsAge: 3600000,        // Last hour (trending content)
}

// Trending articles stay hot
await db.articles.findMany({ published: true, limit: 10 });
await db.articles.findOne({ slug: 'popular-article' });
```

## Troubleshooting

### Q: Warming not running?

**Check:**
1. `warming.enabled` is `true`
2. Check logs for initialization message
3. Verify stats are being tracked: `await db.getQueryStatsSummary()`

### Q: No queries being warmed?

**Check:**
1. `minAccessCount` threshold - lower it temporarily
2. `maxStatsAge` - may be too restrictive
3. Query the stats table to see tracked queries

```sql
SELECT * FROM __sqldb_query_stats
WHERE access_count >= 5
ORDER BY access_count DESC;
```

### Q: Warming too slow?

**Solutions:**
1. Increase `warmingPoolSize`
2. Reduce `topQueriesPerTable`
3. Optimize slow queries (check `avg_execution_time`)

### Q: Too much database load?

**Solutions:**
1. Increase `intervalMs` (less frequent warming)
2. Reduce `topQueriesPerTable`
3. Increase `minAccessCount`

## Summary

The auto-warming system provides:

✅ **Automatic** - No manual cache management
✅ **Intelligent** - Only warms frequently used queries
✅ **Safe** - Separate connection pool
✅ **Observable** - Full monitoring capabilities
✅ **Persistent** - Stats survive restarts
✅ **Flexible** - Highly configurable

Enable it and watch your cache hit rates soar! 🚀
