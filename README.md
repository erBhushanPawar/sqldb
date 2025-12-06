# @bhushanpawar/sqldb

An intelligent MariaDB client with **Redis-backed caching**, **automatic schema discovery**, **relationship mapping**, and **smart cache invalidation**. Optimized for high-performance applications with read-heavy workloads.

## Features

### Core Features
- **Redis-Backed Distributed Caching** - Fast, distributed caching with configurable TTL
- **Automatic Schema Discovery** - Auto-discovers tables, columns, and relationships
- **Smart Cache Invalidation** - Cascading invalidation based on foreign key relationships
- **Query Builder** - Type-safe CRUD operations with fluent API
- **Raw Query Caching** - Cache custom SQL queries with configurable TTL
- **Query Tracking** - Track queries with correlation IDs for debugging and performance analysis
- **Dependency Graph** - Automatic relationship mapping for cascade invalidation
- **TypeScript Support** - Full TypeScript support with type inference

### Advanced Features
- Configurable TTL per operation type
- LRU cache eviction with max keys limit
- Cache warming and preloading
- Performance statistics and monitoring
- Hooks system for extensibility
- Connection pooling
- Transaction support

## Installation

```bash
npm install @bhushanpawar/sqldb mariadb redis
```

## Quick Start

### Basic Usage with SmartDB

```typescript
import { createSmartDB } from '@bhushanpawar/sqldb';

const db = await createSmartDB({
  mariadb: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'mydb',
    connectionLimit: 10,
  },
  redis: {
    host: 'localhost',
    port: 6379,
    keyPrefix: 'myapp:',
  },
  cache: {
    enabled: true,
    defaultTTL: 60,        // 60 seconds
    maxKeys: 1000,
    invalidateOnWrite: true,
    cascadeInvalidation: true,
  },
  discovery: {
    autoDiscover: true,
    refreshInterval: 3600000, // Refresh schema every hour
  },
});

// Get table operations
const users = db.getTableOperations('users');

// Find operations with automatic caching
const allUsers = await users.findMany();
const activeUsers = await users.findMany({ status: 'active' });
const user = await users.findById(1);

// Create/Update/Delete with automatic cache invalidation
await users.insertOne({ name: 'John', email: 'john@example.com' });
await users.updateById(1, { status: 'inactive' });
await users.deleteById(1);

// Close connection
await db.close();
```

### Raw Query Caching

The `raw` method supports caching custom SQL queries with a configurable TTL (default: 1 minute):

```typescript
const users = db.getTableOperations('users');

// First call - queries database and caches result for 60 seconds
const results = await users.raw(
  'SELECT * FROM users WHERE status = ? ORDER BY created_at DESC LIMIT 10',
  ['active']
);

// Subsequent calls within 60 seconds - served from cache
const cachedResults = await users.raw(
  'SELECT * FROM users WHERE status = ? ORDER BY created_at DESC LIMIT 10',
  ['active']
);

// Cache stats show hits and misses
const stats = db.getCacheManager().getStats();
console.log(stats);
// { hits: 99, misses: 1, evictions: 0, hitRate: '99.00%' }
```

The raw query cache:
- Uses the full SQL query and parameters as the cache key
- Has a fixed 60-second TTL (optimized for dynamic queries)
- Automatically expires when the table is modified
- Supports correlation IDs for query tracking

## Table of Contents

- [Core Concepts](#core-concepts)
- [Configuration](#configuration)
- [CRUD Operations](#crud-operations)
- [Cache Management](#cache-management)
- [Query Tracking](#query-tracking)
- [Smart Cache Invalidation](#smart-cache-invalidation)
- [Performance Optimization](#performance-optimization)
- [API Reference](#api-reference)

## Core Concepts

### Schema Discovery

SmartDB automatically discovers your database schema on initialization:

```typescript
const db = await createSmartDB({
  discovery: {
    autoDiscover: true,
    includedTables: ['users', 'posts', 'comments'], // Optional: specific tables
    excludedTables: ['temp_*'], // Optional: exclude patterns
    refreshInterval: 3600000, // Refresh every hour
  },
});

// Get discovered tables
const tables = db.getDiscoveredTables();
console.log(tables); // ['users', 'posts', 'comments', ...]

// Get dependency graph
const graph = db.getDependencyGraph();
const deps = graph.getDependencies('users'); // Tables that depend on users
```

### Relationship Mapping

SmartDB automatically maps foreign key relationships:

```typescript
// Schema example:
// posts (id, user_id, title)
// comments (id, post_id, user_id, content)

// Updating a user invalidates related posts and comments
await users.updateById(1, { name: 'Jane' });
// Cache invalidated: users:*, posts:*, comments:*

// With cascadeInvalidation: false, only users cache is invalidated
```

### Cache Invalidation Strategies

```typescript
// 1. Automatic invalidation on write (recommended)
await createSmartDB({
  cache: {
    invalidateOnWrite: true,
    cascadeInvalidation: true, // Invalidate related tables
  },
});

// 2. Manual invalidation
const users = db.getTableOperations('users');
await users.invalidateCache();

// 3. Invalidation via manager
const invalidationManager = db.getInvalidationManager();
await invalidationManager.invalidateTable('users', { cascade: true });

// 4. Clear entire cache
const cacheManager = db.getCacheManager();
await cacheManager.clear();
```

## Configuration

### Complete Configuration Example

```typescript
import { createSmartDB, SmartDBConfig } from '@bhushanpawar/sqldb';

const config: SmartDBConfig = {
  // MariaDB connection
  mariadb: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'mydb',
    connectionLimit: 10,
    acquireTimeout: 10000,
    connectTimeout: 10000,
  },

  // Redis connection
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'redis-password', // Optional
    db: 0,
    keyPrefix: 'myapp:',
  },

  // Cache configuration
  cache: {
    enabled: true,
    defaultTTL: 60,              // Default: 60 seconds
    maxKeys: 1000,               // Max cached queries
    invalidateOnWrite: true,     // Auto-invalidate on INSERT/UPDATE/DELETE
    cascadeInvalidation: true,   // Invalidate related tables
  },

  // Schema discovery
  discovery: {
    autoDiscover: true,
    includedTables: [],          // Empty = all tables
    excludedTables: [],
    maxGraphDepth: 3,            // Cascade depth
    refreshInterval: 3600000,    // 1 hour
  },

  // Logging
  logging: {
    level: 'info',               // 'debug' | 'info' | 'warn' | 'error'
    logger: (level, message, meta) => {
      console.log(`[${level}] ${message}`, meta);
    },
  },
};

const db = await createSmartDB(config);
```

### Configuration Options

#### Cache Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable/disable caching |
| `defaultTTL` | number | 60 | Default cache TTL in seconds |
| `maxKeys` | number | 1000 | Maximum cached keys (LRU eviction) |
| `invalidateOnWrite` | boolean | true | Auto-invalidate on writes |
| `cascadeInvalidation` | boolean | true | Cascade invalidation to related tables |

#### Discovery Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoDiscover` | boolean | true | Auto-discover schema on init |
| `includedTables` | string[] | [] | Tables to include (empty = all) |
| `excludedTables` | string[] | [] | Tables to exclude (supports patterns) |
| `maxGraphDepth` | number | 3 | Max cascade depth for relationships |
| `refreshInterval` | number | 0 | Schema refresh interval (0 = disabled) |

## CRUD Operations

### Find Operations

```typescript
const users = db.getTableOperations<User>('users');

// Find all
const all = await users.findMany();

// Find with conditions
const active = await users.findMany({
  status: 'active'
});

// Find with options
const paginated = await users.findMany(
  { status: 'active' },
  {
    limit: 10,
    offset: 20,
    orderBy: 'created_at',
    order: 'DESC',
    skipCache: false, // Force cache bypass
  }
);

// Find one
const user = await users.findOne({ email: 'john@example.com' });

// Find by ID
const userById = await users.findById(1);

// Count
const count = await users.count({ status: 'active' });
```

### Insert Operations

```typescript
// Insert one
const newUser = await users.insertOne({
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active',
});
console.log(newUser.id); // Auto-generated ID

// Insert many
const newUsers = await users.insertMany([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);
console.log(newUsers.map(u => u.id)); // [1, 2]
```

### Update Operations

```typescript
// Update one
const updated = await users.updateOne(
  { id: 1 },
  { status: 'inactive' }
);

// Update many
const count = await users.updateMany(
  { status: 'pending' },
  { status: 'active' }
);
console.log(`Updated ${count} users`);

// Update by ID
const user = await users.updateById(1, { name: 'Jane Doe' });
```

### Delete Operations

```typescript
// Delete one
const deleted = await users.deleteOne({ id: 1 });
console.log(deleted); // true/false

// Delete many
const count = await users.deleteMany({ status: 'inactive' });
console.log(`Deleted ${count} users`);

// Delete by ID
const deleted = await users.deleteById(1);
```

### Raw SQL Queries

```typescript
// Raw query with caching (60s TTL)
const results = await users.raw<User[]>(
  'SELECT * FROM users WHERE created_at > ? ORDER BY id DESC',
  ['2024-01-01']
);

// With correlation ID for tracking
const correlationId = 'request-123';
const results = await users.raw(
  'SELECT COUNT(*) as total FROM users',
  [],
  correlationId
);
```

## Cache Management

### Cache Statistics

```typescript
const cacheManager = db.getCacheManager();
const stats = cacheManager.getStats();

console.log(stats);
// {
//   hits: 1500,
//   misses: 100,
//   evictions: 50,
//   size: 0,
//   hitRate: '93.75%'
// }

// Reset stats
cacheManager.resetStats();
```

### Manual Cache Control

```typescript
// Check if cache is enabled
if (cacheManager.isEnabled()) {
  // Get cached value
  const value = await cacheManager.get('cache:key');

  // Set cached value
  await cacheManager.set('cache:key', data, 120); // 120s TTL

  // Delete specific key
  await cacheManager.delete('cache:key');

  // Delete by pattern
  const count = await cacheManager.deletePattern('users:*');

  // Clear all cache
  await cacheManager.clear();
}
```

### Cache Warming

```typescript
const users = db.getTableOperations('users');

// Pre-warm cache with common queries
await users.warmCache({ status: 'active' });

// This will now be served from cache
const active = await users.findMany({ status: 'active' });
```

### Cache Warming with Relations

Pre-warm cache for a table and all its related tables based on the dependency graph:

```typescript
const provider = db.getTableOperations('provider');

// Warm cache for provider and all related tables
await provider.warmCacheWithRelations({}, {
  correlationId: 'startup-warming',
  depth: 1,                    // How deep to traverse relationships
  warmDependents: true,        // Warm tables that reference this table
  warmDependencies: true,      // Warm tables this table references
});

// Now provider and all related tables are cached:
// - provider (main table)
// - user (table that provider depends on)
// - orders, services, bank_details, etc. (tables that depend on provider)
```

**Use Cases:**
- **Application startup**: Pre-warm frequently accessed tables and their relations
- **API endpoints**: Warm cache before handling requests for better response times
- **Batch operations**: Pre-load related data before processing

**Example - Warm on Startup:**
```typescript
async function warmCacheOnStartup(db: SmartDBClient) {
  // Warm most frequently accessed tables with their relations
  const provider = db.getTableOperations('provider');
  const orders = db.getTableOperations('orders');

  await Promise.all([
    provider.warmCacheWithRelations({}, { depth: 1, warmDependents: true }),
    orders.warmCacheWithRelations({}, { depth: 1, warmDependencies: true }),
  ]);

  console.log('Cache warmed successfully!');
}
```

## Query Tracking

Track queries with correlation IDs for debugging and performance monitoring:

```typescript
import { generateQueryId } from '@bhushanpawar/sqldb';

// Generate correlation ID for a request
const correlationId = generateQueryId();

// Use across multiple operations
const users = db.getTableOperations('users');
await users.findMany({ status: 'active' }, { correlationId });
await users.count({ status: 'active' }, correlationId);
await users.findById(1, correlationId);

// Get all queries for this correlation
const queries = db.getQueries(correlationId);

queries.forEach(q => {
  console.log({
    queryId: q.queryId,
    sql: q.sql,
    executionTime: q.executionTimeMs,
    cached: q.resultCount,
  });
});

// Performance analysis
const totalTime = queries.reduce((sum, q) => sum + (q.executionTimeMs || 0), 0);
const avgTime = totalTime / queries.length;
console.log(`Total: ${totalTime}ms, Average: ${avgTime}ms`);

// Clean up
db.clearQueries(correlationId);
```

### Query Metadata

Each tracked query includes:

```typescript
interface QueryMetadata {
  queryId: string;           // Unique UUID
  correlationId?: string;    // Optional correlation ID
  sql: string;              // SQL query
  params?: any[];           // Query parameters
  startTime: number;        // Unix timestamp
  endTime?: number;         // Unix timestamp
  executionTimeMs?: number; // Execution time
  resultCount?: number;     // Rows returned/affected
  error?: string;           // Error message if failed
}
```

## Smart Cache Invalidation

### How It Works

```typescript
// Database schema:
// users (id, name)
// posts (id, user_id, title)  -- FK to users
// comments (id, post_id, content) -- FK to posts

// When you update a user:
await users.updateById(1, { name: 'Updated Name' });

// SmartDB invalidates:
// 1. users:* (direct table)
// 2. posts:* (depends on users via user_id)
// 3. comments:* (depends on posts via post_id)
```

### Dependency Graph

```typescript
const graph = db.getDependencyGraph();

// Get tables that depend on 'users'
const deps = graph.getDependencies('users');
console.log(deps); // ['posts', 'comments']

// Get all tables 'comments' depends on
const parents = graph.getParents('comments');
console.log(parents); // ['posts', 'users']

// Check if there's a path
const hasPath = graph.hasPath('users', 'comments');
console.log(hasPath); // true

// Get graph info
const info = graph.getGraphInfo();
console.log(info); // { tables: 3, relationships: 2 }
```

### Manual Invalidation

```typescript
const invalidationManager = db.getInvalidationManager();

// Invalidate single table
await invalidationManager.invalidateTable('users');

// Invalidate with cascade
await invalidationManager.invalidateTable('users', {
  cascade: true
});

// Invalidate multiple tables
await invalidationManager.invalidateTables(['users', 'posts']);

// Invalidate by operation
const cacheManager = db.getCacheManager();
await cacheManager.deletePattern('users:findMany:*');
```

## Performance Optimization

### Best Practices

1. **Configure Appropriate TTL**
   ```typescript
   // High-churn data: short TTL
   cache: { defaultTTL: 30 }

   // Stable data: longer TTL
   cache: { defaultTTL: 300 }
   ```

2. **Use Selective Caching**
   ```typescript
   // Skip cache for real-time data
   const users = await users.findMany(
     { status: 'online' },
     { skipCache: true }
   );
   ```

3. **Warm Cache for Common Queries**
   ```typescript
   // Pre-warm after deployment
   await users.warmCache({ status: 'active' });
   await posts.warmCache({ published: true });
   ```

4. **Monitor Cache Performance**
   ```typescript
   const stats = db.getCacheManager().getStats();

   if (parseFloat(stats.hitRate) < 80) {
     console.warn('Low cache hit rate:', stats);
   }
   ```

5. **Use Correlation IDs**
   ```typescript
   // Track request performance
   app.use((req, res, next) => {
     req.correlationId = generateQueryId();
     next();
   });

   // Log slow requests
   app.use((req, res, next) => {
     const queries = db.getQueries(req.correlationId);
     const totalTime = queries.reduce((sum, q) =>
       sum + (q.executionTimeMs || 0), 0);

     if (totalTime > 1000) {
       console.warn('Slow request:', {
         path: req.path,
         time: totalTime,
         queries: queries.length
       });
     }
     next();
   });
   ```

### Performance Testing

```typescript
// Example performance test
const iterations = 100;
const correlationId = generateQueryId();

console.time('100 queries');
for (let i = 0; i < iterations; i++) {
  await users.findMany({ status: 'active' }, { correlationId });
}
console.timeEnd('100 queries');

// Check cache effectiveness
const stats = db.getCacheManager().getStats();
console.log(`Hit rate: ${stats.hitRate}`);
console.log(`Hits: ${stats.hits}, Misses: ${stats.misses}`);

// Analyze query performance
const queries = db.getQueries(correlationId);
console.log(`Total queries executed: ${queries.length}`); // Should be 1 if cache works
```

## API Reference

### SmartDBClient

```typescript
class SmartDBClient {
  // Initialize client
  async initialize(): Promise<void>;

  // Get table operations
  getTableOperations<T>(tableName: string): TableOperations<T>;

  // Get managers
  getCacheManager(): CacheManager;
  getInvalidationManager(): InvalidationManager;
  getDependencyGraph(): DependencyGraph;

  // Schema discovery
  getDiscoveredTables(): string[];
  async refreshSchema(): Promise<void>;

  // Query tracking
  getQueries(correlationId?: string): QueryMetadata[];
  clearQueries(correlationId?: string): void;

  // Health and lifecycle
  async healthCheck(): Promise<HealthStatus>;
  async close(): Promise<void>;
}
```

### TableOperations

```typescript
interface TableOperations<T> {
  // Find operations
  findOne(where: WhereClause<T>, options?: FindOptions): Promise<T | null>;
  findMany(where?: WhereClause<T>, options?: FindOptions): Promise<T[]>;
  findById(id: string | number, correlationId?: string): Promise<T | null>;
  count(where?: WhereClause<T>, correlationId?: string): Promise<number>;

  // Insert operations
  insertOne(data: Omit<T, 'id'>, correlationId?: string): Promise<T>;
  insertMany(data: Omit<T, 'id'>[], correlationId?: string): Promise<T[]>;

  // Update operations
  updateOne(where: WhereClause<T>, data: Partial<T>, correlationId?: string): Promise<T | null>;
  updateMany(where: WhereClause<T>, data: Partial<T>, correlationId?: string): Promise<number>;
  updateById(id: string | number, data: Partial<T>, correlationId?: string): Promise<T | null>;

  // Delete operations
  deleteOne(where: WhereClause<T>, correlationId?: string): Promise<boolean>;
  deleteMany(where: WhereClause<T>, correlationId?: string): Promise<number>;
  deleteById(id: string | number, correlationId?: string): Promise<boolean>;

  // Raw queries
  raw<R = any>(sql: string, params?: any[], correlationId?: string): Promise<R>;

  // Cache management
  invalidateCache(): Promise<void>;
  warmCache(where?: WhereClause<T>, correlationId?: string): Promise<void>;
}
```

### CacheManager

```typescript
class CacheManager {
  async get<T>(key: string): Promise<T | null>;
  async set(key: string, value: any, ttl?: number): Promise<void>;
  async delete(key: string): Promise<void>;
  async deletePattern(pattern: string): Promise<number>;
  async exists(key: string): Promise<boolean>;
  async clear(): Promise<void>;

  getStats(): CacheStats;
  resetStats(): void;
  isEnabled(): boolean;
  getKeyBuilder(): CacheKeyBuilder;
}
```

## Migration from mariadb

### Before (mariadb)

```typescript
import mariadb from 'mariadb';

const pool = mariadb.createPool(config);

const conn = await pool.getConnection();
const users = await conn.query('SELECT * FROM users WHERE status = ?', ['active']);
conn.release();

await pool.end();
```

### After (@bhushanpawar/sqldb)

```typescript
import { createSmartDB } from '@bhushanpawar/sqldb';

const db = await createSmartDB({ mariadb: config, redis: redisConfig });

const users = db.getTableOperations('users');
const activeUsers = await users.findMany({ status: 'active' });
// Automatically cached, invalidated on writes, type-safe

await db.close();
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run performance tests
npm run usage perf
```

## Performance Results

Based on real-world testing:

- **Cache Hit Rate**: 99%+ for read-heavy workloads
- **Query Time**: <1ms for cached queries vs 50-300ms for database queries
- **Throughput**: 10,000+ queries/second with Redis cache
- **Memory**: ~1KB per cached query

See [PERFORMANCE_RESULTS.md](./PERFORMANCE_RESULTS.md) for detailed benchmarks.

## Examples

See the [examples](./examples) directory for complete examples:

- [usage.ts](./examples/usage.ts) - Basic CRUD operations
- [query-tracking.ts](./examples/query-tracking.ts) - Query tracking with correlation IDs
- [simple-query-tracking.ts](./examples/simple-query-tracking.ts) - Simple tracking example

## Documentation

- [Query Tracking Guide](./QUERY_TRACKING.md)
- [Performance Testing](./PERFORMANCE_TESTING.md)
- [Changelog](./CHANGELOG_QUERY_TRACKING.md)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

For issues and questions:
- GitHub Issues: [sqldb/issues](https://github.com/erBhushanPawar/sqldb/issues)
- Documentation: See docs above

## Roadmap

- [ ] Support for more complex WHERE clauses (IN, LIKE, etc.)
- [ ] Query result transformation and mapping
- [ ] Built-in pagination helpers
- [ ] Redis Cluster support
- [ ] GraphQL integration
- [ ] Prisma-like schema definition
- [ ] Migration tools
- [ ] Admin UI for cache monitoring
