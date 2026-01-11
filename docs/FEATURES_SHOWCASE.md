# SqlDB - Complete Features Showcase

A comprehensive overview of all SqlDB features and capabilities.

## Table of Contents
1. [Core Database Operations](#core-database-operations)
2. [Redis-Backed Caching](#redis-backed-caching)
3. [Schema Discovery & Relationships](#schema-discovery--relationships)
4. [Smart Cache Invalidation](#smart-cache-invalidation)
5. [Auto-Warming](#auto-warming)
6. [Full-Text Search](#full-text-search)
7. [Admin UI & Analytics](#admin-ui--analytics)
8. [Query Tracking & Performance](#query-tracking--performance)

---

## Core Database Operations

### CRUD Operations
```typescript
// Create
const user = await db.users.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// Read
const user = await db.users.findOne({ id: 1 });
const users = await db.users.findMany({ is_active: true });

// Update
await db.users.update({ id: 1 }, { name: 'Jane Doe' });

// Delete
await db.users.delete({ id: 1 });
```

**Benefits**:
- Type-safe operations with TypeScript
- Automatic schema inference
- Simplified API compared to raw SQL

### Query Builder
```typescript
// Complex queries with builder pattern
const users = await db.users.findMany({
  age: { $gte: 18, $lte: 65 },
  is_active: true,
  created_at: { $gte: new Date('2024-01-01') }
}, {
  limit: 10,
  offset: 20,
  orderBy: { created_at: 'DESC' }
});
```

**Supported Operators**:
- `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
- `$in` (with raw SQL fallback)
- `$like`, `$notLike`
- `$isNull`, `$isNotNull`

### Raw SQL Support
```typescript
// Execute custom SQL when needed
const result = await db.raw(`
  SELECT u.*, COUNT(o.id) as order_count
  FROM users u
  LEFT JOIN orders o ON u.id = o.user_id
  GROUP BY u.id
  HAVING order_count > ?
`, [10]);
```

**Use Cases**:
- Complex joins
- Aggregations
- Database-specific features
- Performance optimization

---

## Redis-Backed Caching

### Automatic Caching
```typescript
const db = await createSqlDB({
  // ...
  cache: {
    enabled: true,
    defaultTTL: 60,        // 60 seconds
    maxKeys: 10000,
    invalidateOnWrite: true
  }
});

// First call: hits database
const user = await db.users.findOne({ id: 1 });

// Second call: returns from cache
const user2 = await db.users.findOne({ id: 1 }); // ⚡ Cached!
```

**Performance Improvement**:
- 10-100x faster than database queries
- Reduces database load
- Configurable TTL per query

### Manual Cache Control
```typescript
// Skip cache for specific query
const freshData = await db.users.findMany({}, { skipCache: true });

// Clear cache for specific table
await db.cache.clearTable('users');

// Clear entire cache
await db.cache.clearAll();

// Get cache statistics
const stats = await db.cache.getStats();
console.log(stats.hits, stats.misses, stats.hitRate);
```

**Cache Strategies**:
- Time-based expiration (TTL)
- Write-through invalidation
- Dependency-based invalidation
- LRU eviction when maxKeys reached

---

## Schema Discovery & Relationships

### Automatic Schema Reading
```typescript
const db = await createSqlDB({
  // ...
  discovery: {
    enabled: true,
    autoDiscoverRelations: true
  }
});

await db.initialize(); // Discovers all tables and relationships

// Access discovered tables
const tables = db.getDiscoveredTables();
console.log(tables); // ['users', 'orders', 'products', ...]
```

**Discovered Information**:
- Table names
- Column names and types
- Primary keys
- Foreign key relationships
- Indexes

### Relationship Mapping
```typescript
// Automatically detected from foreign keys:
// orders.user_id → users.id

const order = await db.orders.findOne({ id: 1 });
// Includes: order.user (if relation exists)

// Eager loading with relations
const orders = await db.orders.findMany({}, {
  include: ['user', 'products']
});
```

**Relationship Types**:
- One-to-Many
- Many-to-One
- Many-to-Many (through junction tables)

### Manual Relation Definition
```typescript
const config = {
  discovery: {
    enabled: true,
    customRelations: [
      {
        fromTable: 'posts',
        toTable: 'comments',
        type: 'one-to-many',
        foreignKey: 'post_id'
      }
    ]
  }
};
```

---

## Smart Cache Invalidation

### Automatic Dependency Tracking
```typescript
// When you update users table:
await db.users.update({ id: 1 }, { name: 'Updated' });

// Automatically invalidates:
// - users cache entries
// - All dependent tables (orders, posts, etc.)
// - Relationship caches
```

**Invalidation Strategies**:
1. **Direct Invalidation**: Clear cache for modified table
2. **Dependency Invalidation**: Clear caches for related tables
3. **Pattern Matching**: Clear caches matching specific patterns

### Dependency Graph
```typescript
// Automatically built from foreign keys:
users → orders → order_items → products
     → posts
     → comments

// When users are updated:
// - users cache cleared
// - orders cache cleared (depends on users)
// - order_items cache cleared (depends on orders)
// - etc.
```

**Visualization**:
```
const graph = db.getDependencyGraph();
console.log(graph.getDependents('users'));
// ['orders', 'posts', 'comments']

console.log(graph.getDependencies('orders'));
// ['users', 'products']
```

---

## Auto-Warming

### Intelligent Cache Pre-Loading
```typescript
const db = await createSqlDB({
  // ...
  warming: {
    enabled: true,
    trackQueryStats: true,
    autoWarmThreshold: 10,    // Queries accessed 10+ times
    warmingInterval: 300000,   // Every 5 minutes
    maxConcurrentWarms: 5
  }
});
```

**How It Works**:
1. Tracks most frequently accessed queries in `__sqldb_query_stats` table
2. Identifies "hot" queries (accessed frequently)
3. Pre-loads cache in background before expiration
4. Ensures cache is always warm for popular queries

### Manual Warming
```typescript
// Warm specific query
await db.users.warmCache({ is_active: true });

// Warm with dependencies
await db.users.warmCache({ id: 1 }, {
  warmDependents: true,    // Warm orders, posts, etc.
  warmDependencies: true,  // Warm related user data
  depth: 2                 // How deep to traverse
});
```

### Warming Statistics
```typescript
const stats = await db.getWarmingStats();
console.log({
  totalWarmed: stats.totalWarmed,
  avgWarmTime: stats.avgWarmTime,
  lastWarmingRun: stats.lastWarmingRun
});
```

---

## Full-Text Search

### Search Configuration
```typescript
const db = await createSqlDB({
  // ...
  search: {
    enabled: true,
    invertedIndex: {
      enabled: true,
      tables: {
        services: {
          searchableFields: ['title', 'description', 'category'],
          tokenizer: 'stemming',  // 'simple' | 'stemming' | 'ngram'
          minWordLength: 3,
          stopWords: ['the', 'a', 'an', 'and', 'or'],
          fieldBoosts: {
            title: 3.0,         // Matches in title weighted 3x
            description: 1.0,
            category: 2.0
          }
        }
      }
    }
  }
});
```

### Search Operations
```typescript
// Build search index
await db.services.buildSearchIndex();

// Search with options
const results = await db.services.search('plumbing repair emergency', {
  limit: 10,
  offset: 0,
  minScore: 0.3,
  highlightFields: ['title', 'description'],
  filters: { is_active: true }
});

// Results include:
results.forEach(result => {
  console.log({
    score: result.score,                    // 0.95
    data: result.data,                      // Full record
    highlights: result.highlights?.title,   // "Emergency <mark>Plumbing</mark> <mark>Repair</mark>"
    matchedTerms: result.matchedTerms       // ['emergency', 'plumbing', 'repair']
  });
});
```

### Tokenization Strategies

**1. Simple Tokenizer**
- Best for: English text, performance-critical
- Features: Whitespace splitting, stop word removal
- Example: "Running services" → ["running", "services"]

**2. Stemming Tokenizer (Porter Stemmer)**
- Best for: Natural language, handling plurals/tenses
- Features: Word stemming + simple tokenization
- Example: "Running services" → ["run", "servic"]

**3. N-gram Tokenizer**
- Best for: Autocomplete, typo tolerance, partial matching
- Features: Character sequences
- Example: "plumb" → ["plu", "lum", "umb"]

### Search Performance
```typescript
// Get index statistics
const stats = await db.services.getSearchStats();
console.log({
  totalDocuments: stats.totalDocuments,   // 3,268
  totalTerms: stats.totalTerms,           // 11,626
  buildDurationMs: stats.buildDurationMs, // 800ms
  lastBuildTime: stats.lastBuildTime
});
```

**Performance vs Traditional SQL**:
- Single word: **10-20x faster** (<5ms vs 50-100ms)
- Multi-word: **10-20x faster** (<10ms vs 100-200ms)
- Index build (10k docs): ~1-2 seconds

### Ranking Algorithms
- **TF-IDF**: Term Frequency - Inverse Document Frequency
- **BM25**: Advanced ranking with document length normalization
- **Proximity Scoring**: Terms closer together rank higher
- **Field Boosting**: Prioritize matches in specific fields

---

## Admin UI & Analytics

### Web-Based Dashboard
```
http://localhost:3090/admin
```

**Features**:
1. **Search Testing Playground**
   - Test queries in real-time
   - Adjust limits, scores, highlighting
   - View results with relevance scores
   - See highlighted matches

2. **Performance Analytics**
   - Benchmark multiple queries
   - Track average search times
   - Compare performance metrics
   - Monitor cache hit rates

3. **Slow Query Monitoring**
   - View slowest database queries
   - See execution times, cache status
   - Filter by table and query type
   - Identify bottlenecks

4. **Index Management**
   - Build/rebuild search indexes
   - View index statistics
   - Monitor index health
   - Track build duration

### Dashboard Stats
```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Total Documents │ Indexed Terms   │ Avg Search Time │ Cache Hit Rate  │
│     3,268       │    11,626       │      45ms       │      75%        │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### REST API Endpoints

**Search**:
```bash
GET  /health
GET  /api/search/services?q=plumbing&limit=10
POST /api/search/services
POST /api/search/autocomplete
```

**Index Management**:
```bash
POST /api/search/index/services/build
GET  /api/search/index/services/stats
```

**Analytics**:
```bash
GET  /api/analytics/slow-queries?limit=20
GET  /api/analytics/query-stats
```

---

## Query Tracking & Performance

### Query Statistics Table
```sql
CREATE TABLE __sqldb_query_stats (
  query_id VARCHAR(255) PRIMARY KEY,
  table_name VARCHAR(255),
  query_type VARCHAR(50),
  filters TEXT,
  execution_time_ms INT,
  cache_hit TINYINT(1),
  timestamp BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Tracked Metrics**:
- Query ID (unique identifier)
- Table name
- Query type (findOne, findMany, search, etc.)
- Filters used
- Execution time (ms)
- Cache hit/miss
- Timestamp

### Performance Monitoring
```typescript
// Get query statistics
const stats = await db.getStatsSummary();
console.log({
  totalQueries: stats.totalQueries,
  avgExecutionTime: stats.avgExecutionTime,
  cacheHitRate: stats.cacheHitRate,
  slowestQueries: stats.slowestQueries
});
```

### Query Insights
```typescript
// View slow queries (>1000ms)
const slowQueries = await db.raw(`
  SELECT * FROM __sqldb_query_stats
  WHERE execution_time_ms > 1000
  ORDER BY execution_time_ms DESC
  LIMIT 10
`);

// Queries by type
const byType = await db.raw(`
  SELECT query_type, COUNT(*) as count, AVG(execution_time_ms) as avg_time
  FROM __sqldb_query_stats
  GROUP BY query_type
`);
```

---

## Complete Configuration Example

```typescript
import { createSqlDB } from '@bhushanpawar/sqldb';

const db = await createSqlDB({
  // Database connection
  mariadb: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'myapp',
    connectionLimit: 10
  },

  // Redis caching
  redis: {
    host: 'localhost',
    port: 6379,
    keyPrefix: 'myapp'
  },

  // Cache configuration
  cache: {
    enabled: true,
    defaultTTL: 60,
    maxKeys: 10000,
    invalidateOnWrite: true
  },

  // Schema discovery
  discovery: {
    enabled: true,
    autoDiscoverRelations: true
  },

  // Auto-warming
  warming: {
    enabled: true,
    trackQueryStats: true,
    autoWarmThreshold: 10,
    warmingInterval: 300000,
    maxConcurrentWarms: 5
  },

  // Full-text search
  search: {
    enabled: true,
    invertedIndex: {
      enabled: true,
      tables: {
        services: {
          searchableFields: ['title', 'description', 'category'],
          tokenizer: 'stemming',
          minWordLength: 3,
          stopWords: ['the', 'a', 'an', 'and', 'or'],
          fieldBoosts: {
            title: 3.0,
            description: 1.0,
            category: 2.0
          }
        }
      }
    }
  },

  // Logging
  logging: {
    logger: (level, message, meta) => {
      console.log(`[${level}] ${message}`, meta);
    }
  }
});

await db.initialize();
```

---

## Performance Benchmarks

### CRUD Operations
| Operation | Without Cache | With Cache | Improvement |
|-----------|--------------|------------|-------------|
| findOne | 15-30ms | 1-2ms | **10-15x faster** |
| findMany (10 rows) | 20-40ms | 2-3ms | **10-13x faster** |
| create | 10-20ms | N/A | - |
| update | 15-25ms | N/A | - |
| delete | 10-20ms | N/A | - |

### Search Operations
| Query Type | Traditional (LIKE %) | Inverted Index | Improvement |
|------------|---------------------|----------------|-------------|
| Single word | 50-100ms | <5ms | **10-20x faster** |
| Multi-word | 100-200ms | <10ms | **10-20x faster** |
| Autocomplete | 150-300ms | <15ms | **10-20x faster** |

### Caching Benefits
- **Cache Hit Rate**: 70-90% (typical)
- **Database Load Reduction**: 70-90%
- **Response Time**: 10-100x improvement
- **Throughput**: 5-10x more requests/second

---

## Use Cases

### E-Commerce Platform
```typescript
// Product search with caching
const products = await db.products.search('wireless headphones', {
  filters: { price: { $lt: 100 }, in_stock: true },
  highlightFields: ['name', 'description']
});

// Auto-warmed popular queries
// Cache pre-loaded for bestsellers
const bestsellers = await db.products.findMany({
  is_bestseller: true
}, { limit: 10 }); // ⚡ Cached!
```

### Content Management System
```typescript
// Article search with stemming
const articles = await db.articles.search('javascript async patterns', {
  highlightFields: ['title', 'content'],
  minScore: 0.4
});

// Smart cache invalidation
await db.articles.update({ id: 1 }, { title: 'Updated' });
// Automatically invalidates related caches
```

### SaaS Application
```typescript
// User dashboard with warming
await db.users.warmCache({ id: currentUserId }, {
  warmDependents: true  // Pre-load subscriptions, usage, etc.
});

// Analytics with query tracking
const slowQueries = await db.getSlowQueries();
// Identify and optimize bottlenecks
```

---

## Links & Resources

- [Search Guide](./SEARCH_GUIDE.md)
- [Admin UI Guide](./ADMIN_UI_GUIDE.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Performance Tuning](./SEARCH_OPTIMIZATION_PLAN.md)
- [GitHub Repository](https://github.com/erBhushanPawar/sqldb)

---

## What Makes SqlDB Special?

1. **All-in-One Solution**: CRUD + Caching + Search + Analytics
2. **Production-Ready**: Battle-tested performance optimizations
3. **Developer-Friendly**: Simple API, TypeScript support, auto-discovery
4. **Performance-Focused**: 10-100x faster than traditional approaches
5. **Intelligent**: Auto-warming, smart invalidation, relationship mapping
6. **Observable**: Built-in monitoring, analytics, and admin UI
7. **Flexible**: Use what you need, configure what you want

---

**Built with ❤️ for developers who value both speed and simplicity.**
