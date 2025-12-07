# @bhushanpawar/sqldb

A smart MariaDB ORM layer with intelligent Redis caching, automatic relationship discovery, and cascading cache invalidation.

## Features

- **Simplified CRUD API**: Clean, intuitive interface for database operations
- **Intelligent Redis Caching**: Automatic read-through caching with Redis
- **Relationship Discovery**: Automatically discovers foreign key relationships from your database schema
- **Cascading Invalidation**: Updates automatically invalidate related table caches
- **Hooks System**: Before/after hooks for data transformation and side effects
- **TypeScript Support**: Full type safety and IntelliSense support
- **Performance Monitoring**: Built-in cache statistics and performance tracking

## Installation

```bash
npm install @bhushanpawar/sqldb mariadb ioredis
```

## Quick Start

```typescript
import { createSmartDB } from '@bhushanpawar/sqldb';

const db = await createSmartDB({
  mariadb: {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'mydb',
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
});

// Simple CRUD operations
const user = await db.users.findOne({ email: 'john@example.com' });
const users = await db.users.findMany({ status: 'active' }, { limit: 10 });
const newUser = await db.users.insertOne({ name: 'Jane', email: 'jane@example.com' });
await db.users.updateById(1, { name: 'Updated Name' });
await db.users.deleteOne({ email: 'old@example.com' });

// Close connections when done
await db.close();
```

## Configuration

### Full Configuration Options

```typescript
const db = await createSmartDB({
  // MariaDB connection settings
  mariadb: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'mydb',
    connectionLimit: 10,
  },

  // Redis connection settings
  redis: {
    host: 'localhost',
    port: 6379,
    password: undefined,
    db: 0,
    keyPrefix: 'sdc:', // Cache key prefix
  },

  // Cache configuration
  cache: {
    enabled: true,
    defaultTTL: 60, // seconds
    maxKeys: 10000,
    invalidateOnWrite: true, // Auto-invalidate on INSERT/UPDATE/DELETE
    cascadeInvalidation: true, // Invalidate related tables
  },

  // Schema discovery settings
  discovery: {
    autoDiscover: true, // Discover schema on init
    refreshInterval: 0, // Auto-refresh interval (0 = manual only)
    includeTables: [], // Whitelist specific tables
    excludeTables: [], // Blacklist specific tables
    maxGraphDepth: 3, // Max depth for relationship traversal
  },

  // Logging configuration
  logging: {
    level: 'info', // 'debug' | 'info' | 'warn' | 'error' | 'none'
    logger: (level, message, meta) => {
      console.log(`[${level}] ${message}`, meta);
    },
  },
});
```

## API Reference

### Read Operations (Cache-First)

All read operations check the cache first, falling back to the database on cache miss.

```typescript
// Find one record matching criteria
const user = await db.users.findOne({ email: 'john@example.com' });

// Find multiple records with options
const users = await db.users.findMany(
  { status: 'active' },
  {
    limit: 10,
    offset: 0,
    orderBy: { column: 'created_at', direction: 'DESC' },
    select: ['id', 'name', 'email'],
    skipCache: false, // Force database query
  }
);

// Find by ID (optimized cache key)
const user = await db.users.findById(1);

// Count records
const count = await db.users.count({ status: 'active' });
```

### Write Operations (Auto-Invalidates Cache)

All write operations automatically invalidate relevant cache entries.

```typescript
// Insert one record
const newUser = await db.users.insertOne({
  name: 'Jane Doe',
  email: 'jane@example.com',
  status: 'active',
});

// Insert multiple records
const newUsers = await db.users.insertMany([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
]);

// Update one record
const updated = await db.users.updateOne(
  { email: 'jane@example.com' },
  { status: 'verified' }
);

// Update multiple records
const count = await db.users.updateMany(
  { status: 'inactive' },
  { status: 'archived' }
);

// Update by ID
const user = await db.users.updateById(1, { last_login: new Date() });

// Delete one record
const deleted = await db.users.deleteOne({ email: 'test@example.com' });

// Delete multiple records
const count = await db.users.deleteMany({ status: 'archived' });

// Delete by ID
const deleted = await db.users.deleteById(999);
```

### Raw SQL Queries (Bypass Cache)

```typescript
// Execute raw SQL with parameter binding
const results = await db.users.raw(
  'SELECT * FROM users WHERE created_at > ? AND status = ?',
  [new Date('2024-01-01'), 'active']
);
```

### Cache Management

```typescript
// Manually invalidate cache for a table
await db.users.invalidateCache();

// Warm cache (pre-populate for common queries)
await db.users.warmCache({ status: 'active' });

// Get cache statistics
const stats = db.getCacheManager().getStats();
console.log(stats);
// {
//   hits: 150,
//   misses: 50,
//   evictions: 2,
//   size: 0,
//   hitRate: "75.00%"
// }

// Reset cache stats
db.getCacheManager().resetStats();

// Clear all cache
await db.getCacheManager().clear();
```

## Relationship Discovery & Cascading Invalidation

The library automatically discovers foreign key relationships and uses them for intelligent cache invalidation.

### How It Works

```typescript
// Given these table relationships:
// users (id, name, email)
// orders (id, user_id, total) -> FK to users.id
// order_items (id, order_id, product) -> FK to orders.id

// When you update a user:
await db.users.updateById(1, { name: 'Updated Name' });

// The library automatically invalidates:
// 1. users:* cache entries
// 2. orders:* cache entries (because orders.user_id -> users.id)
// 3. order_items:* cache entries (because order_items.order_id -> orders.id)
```

### Inspecting the Dependency Graph

```typescript
const graph = db.getDependencyGraph();

// Get tables that reference 'users'
const dependents = graph.getDependents('users');
// ['orders', 'comments', 'user_profiles']

// Get tables that 'orders' references
const dependencies = graph.getDependencies('orders');
// ['users', 'products']

// Get all tables affected by updating 'users'
const targets = graph.getInvalidationTargets('users');
// ['users', 'orders', 'order_items', 'comments', ...]

// Get graph statistics
const info = graph.getGraphInfo();
// { tables: 10, relationships: 15 }
```

### Manual Invalidation Control

```typescript
// Invalidate without cascading
await db.getInvalidationManager().invalidateTable('users', {
  cascade: false,
});

// Invalidate multiple tables
await db.getInvalidationManager().invalidateMultipleTables(
  ['users', 'orders'],
  true // cascade
);

// Invalidate by pattern
await db.getInvalidationManager().invalidatePattern('sdc:users:*');
```

## Hooks System

Hooks allow you to transform data before operations or trigger side effects after operations.

### Before Hooks (Transform Data)

```typescript
// Auto-add timestamps
db.hooks.registerBefore('users', 'insertOne', (data) => {
  return {
    ...data,
    created_at: new Date(),
    updated_at: new Date(),
  };
});

// Hash passwords
db.hooks.registerBefore('users', 'insertOne', (data) => {
  if (data.password) {
    data.password = hashPassword(data.password);
  }
  return data;
});

// Validate data
db.hooks.registerBefore('users', 'insertOne', (data) => {
  if (!data.email || !data.email.includes('@')) {
    throw new Error('Invalid email');
  }
  return data;
});
```

### After Hooks (Side Effects)

```typescript
// Audit logging
db.hooks.registerAfter('users', 'insertOne', (result) => {
  console.log('User created:', result.id);
  // Log to audit table
});

// Send notifications
db.hooks.registerAfter('orders', 'insertOne', async (result) => {
  await sendEmail(result.user_email, 'Order confirmed');
});

// Trigger webhooks
db.hooks.registerAfter('users', 'updateOne', async (result) => {
  await fetch('https://webhook.site/...', {
    method: 'POST',
    body: JSON.stringify(result),
  });
});
```

### Hook Management

```typescript
// View all registered hooks
const hooks = db.hooks.getRegisteredHooks();

// Clear specific hooks
db.hooks.clearHooks('users', 'before', 'insertOne');

// Clear all hooks for a table
db.hooks.clearHooks('users');

// Clear all hooks
db.hooks.clearHooks();
```

## Advanced Query Options

### Complex Where Clauses

```typescript
// Operators
const users = await db.users.findMany({
  age: { $gt: 18 }, // Greater than
  status: { $ne: 'banned' }, // Not equal
  name: { $like: '%John%' }, // SQL LIKE
});

// IN clause (array)
const users = await db.users.findMany({
  status: ['active', 'verified', 'premium'],
});

// NULL checks
const users = await db.users.findMany({
  deleted_at: null,
});
```

### Ordering and Pagination

```typescript
// Single column order
const users = await db.users.findMany({}, { orderBy: 'created_at' });

// Multiple column order
const users = await db.users.findMany(
  {},
  {
    orderBy: [
      { column: 'status', direction: 'ASC' },
      { column: 'created_at', direction: 'DESC' },
    ],
    limit: 20,
    offset: 40,
  }
);
```

### Select Specific Columns

```typescript
const users = await db.users.findMany(
  { status: 'active' },
  {
    select: ['id', 'name', 'email'],
  }
);
```

## Health Checks

```typescript
const health = await db.healthCheck();
console.log(health);
// {
//   mariadb: true,
//   redis: true,
//   overall: true
// }
```

## Schema Inspection

```typescript
// Get all discovered tables
const tables = db.getDiscoveredTables();
console.log(tables);
// ['users', 'orders', 'order_items', 'products', ...]

// Manually refresh schema (if database structure changed)
await db.refreshSchema();
```

## Performance Best Practices

### 1. Configure Appropriate TTL

```typescript
cache: {
  defaultTTL: 60, // 60 seconds for most tables
}

// For frequently changing data: shorter TTL
// For static data (e.g., categories): longer TTL
```

### 2. Use `findById` for Single Record Lookups

```typescript
// Better: uses optimized cache key
const user = await db.users.findById(1);

// Less optimal: more complex cache key
const user = await db.users.findOne({ id: 1 });
```

### 3. Warm Cache for Hot Queries

```typescript
// On application startup
await db.users.warmCache({ status: 'active' });
await db.products.warmCache({ featured: true });
```

### 4. Monitor Cache Performance

```typescript
const stats = db.getCacheManager().getStats();

if (parseFloat(stats.hitRate) < 50) {
  console.warn('Low cache hit rate - consider adjusting TTL or queries');
}
```

### 5. Use Selective Caching

```typescript
// Skip cache for real-time data
const liveData = await db.orders.findMany(
  { status: 'processing' },
  { skipCache: true }
);
```

### 6. Limit Cascade Depth

```typescript
discovery: {
  maxGraphDepth: 2, // Limit invalidation cascade to prevent over-invalidation
}
```

## Error Handling

The library handles Redis connection failures gracefully:

```typescript
// If Redis is down, queries bypass cache and go directly to database
// No application errors, just cache misses logged

try {
  const user = await db.users.findOne({ id: 1 });
} catch (error) {
  // Only database errors will throw here
  console.error('Database error:', error);
}
```

## Migration from Simple mariadb-cache

The smart-cache library offers a completely different API focused on ORM-style operations:

```typescript
// Old (mariadb-cache)
const result = await pool.query('SELECT * FROM users WHERE id = ?', [1]);

// New (mariadb-smart-cache)
const user = await db.users.findById(1);
```

Key differences:
- **ORM-style API** instead of raw SQL
- **Redis** instead of in-memory cache
- **Relationship-aware** invalidation
- **Hooks system** for extensibility

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your Application                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SmartDBClient (Main API)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ QueryBuilder│  │ CacheManager│  │ RelationshipDiscovery   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│   MariaDB       │  │     Redis       │  │  Dependency Graph   │
│   Connection    │  │     Cache       │  │  (In-Memory)        │
└─────────────────┘  └─────────────────┘  └─────────────────────┘
```

## Examples

See the [`examples/`](./examples/) directory for complete working examples:

- [`basic-usage.ts`](./examples/basic-usage.ts) - CRUD operations and cache management
- [`relationships-example.ts`](./examples/relationships-example.ts) - Cascading invalidation
- [`hooks-example.ts`](./examples/hooks-example.ts) - Before/after hooks

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Disclaimer

This library is designed for applications with:
- Read-heavy workloads
- Acceptable eventual consistency (TTL-based)
- Foreign key relationships in the database schema

For strong consistency requirements or real-time data, consider bypassing cache with `skipCache: true` or using shorter TTLs.
