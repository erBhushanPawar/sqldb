# mariadb-cache

A caching wrapper for the [mariadb](https://www.npmjs.com/package/mariadb) npm package to improve query performance by caching SELECT query results.

## Features

- In-memory caching of SELECT queries
- Configurable TTL (Time To Live) for cached entries
- Configurable cache size limit
- Drop-in replacement for mariadb connection/pool API
- Cache statistics and management
- TypeScript support

## Installation

```bash
npm install mariadb-cache mariadb
```

## Usage

### TypeScript

```typescript
import { createPool, MariaDBCache, CacheOptions } from 'mariadb-cache';

const pool = createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb'
}, {
  ttl: 60000,      // Cache entries expire after 60 seconds
  maxSize: 100,    // Maximum 100 cached queries
  enabled: true    // Cache is enabled
});

async function queryData() {
  try {
    // First call - queries the database
    const rows = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
    console.log(rows);

    // Second call within TTL - returns cached result
    const cachedRows = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
    console.log(cachedRows);
  } finally {
    await pool.end();
  }
}

queryData();
```

### JavaScript (CommonJS)

```javascript
const { createPool } = require('mariadb-cache');

const pool = createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb'
}, {
  ttl: 60000,
  maxSize: 100
});

async function queryData() {
  try {
    const rows = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
    console.log(rows);
  } finally {
    await pool.end();
  }
}

queryData();
```

### Using Connections

```typescript
import { createPool } from 'mariadb-cache';

const pool = createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb'
}, {
  ttl: 30000,
  maxSize: 50
});

async function queryWithConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT * FROM products WHERE category = ?', ['electronics']);
    console.log(rows);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

queryWithConnection();
```

### Cache Management

```javascript
// Clear entire cache
pool.clearCache();

// Clear cache entries matching a pattern
pool.clearCache('SELECT * FROM users');

// Get cache statistics with hit/miss metrics
const stats = pool.getCacheStats();
console.log(stats);
// Output: {
//   size: 5,
//   maxSize: 100,
//   ttl: 60000,
//   enabled: true,
//   hits: 150,
//   misses: 50,
//   evictions: 2
// }

// Reset statistics counters
pool.resetStats();
```

### Performance Debugging

Enable debug mode to get detailed performance logs for every query:

```typescript
import { createPool } from 'mariadb-cache';

const pool = createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb'
}, {
  ttl: 60000,
  maxSize: 100,
  debug: true  // Enable performance logging
});

// Example output:
// [MariaDBCache 2025-11-30T12:00:00.123Z] CACHE MISS - Query executed (45.32ms) { sql: 'SELECT * FROM users WHERE id = ?' }
// [MariaDBCache 2025-11-30T12:00:00.125Z] CACHED result (total cached: 1)
// [MariaDBCache 2025-11-30T12:00:00.125Z] TOTAL (45.78ms)
// [MariaDBCache 2025-11-30T12:00:01.234Z] CACHE HIT (0.12ms, age: 1111ms) { sql: 'SELECT * FROM users WHERE id = ?' }

const stats = pool.getCacheStats();
const hitRate = ((stats.hits! / (stats.hits! + stats.misses!)) * 100).toFixed(2);
console.log(`Cache Hit Rate: ${hitRate}%`);
```

## Configuration Options

### Cache Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ttl` | number | 60000 | Time to live for cached entries in milliseconds |
| `maxSize` | number | 100 | Maximum number of queries to cache |
| `enabled` | boolean | true | Enable or disable caching |
| `debug` | boolean | false | Enable detailed performance logging with millisecond precision |

### Database Configuration

All [mariadb pool configuration options](https://github.com/mariadb-corporation/mariadb-connector-nodejs/blob/master/documentation/promise-api.md#pool-options) are supported.

## API

### `createPool(config, cacheOptions)`

Creates a new cached pool instance.

- **config**: MariaDB pool configuration
- **cacheOptions**: Cache configuration options
- **Returns**: MariaDBCache instance

### `createConnection(config, cacheOptions)`

Creates a single cached connection.

- **config**: MariaDB connection configuration
- **cacheOptions**: Cache configuration options
- **Returns**: Promise<PoolConnection>

### `MariaDBCache` Class

#### Methods

- `query(sql, values)`: Execute a query (cached if SELECT)
- `execute(sql, values)`: Alias for query()
- `batch(sql, values)`: Execute batch queries (not cached)
- `getConnection()`: Get a connection from the pool
- `clearCache(pattern?)`: Clear all or specific cache entries
- `getCacheStats()`: Get cache statistics including hits, misses, and evictions
- `resetStats()`: Reset performance statistics counters
- `end()`: Close the pool and clear cache

## How It Works

1. Only SELECT queries are cached
2. Cache keys are generated from SQL query + parameters
3. Cached entries expire after the configured TTL
4. When cache is full, oldest entries are removed (FIFO)
5. Non-SELECT queries (INSERT, UPDATE, DELETE) are not cached

## Performance Considerations

- Best suited for read-heavy workloads with repetitive queries
- Configure appropriate TTL based on data freshness requirements
- Monitor cache hit rate using `getCacheStats()`
- Consider cache size vs memory usage trade-offs

## Testing

The package includes comprehensive test coverage using Jest.

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Test Coverage

The test suite includes **24 comprehensive test cases** covering:
- Pool and connection creation
- Query caching for SELECT statements
- Non-SELECT queries (INSERT, UPDATE, DELETE) bypass cache
- Cache TTL expiration in both pool and connection modes
- Cache size limits (FIFO eviction) in both pool and connection modes
- Cache enable/disable functionality
- Different query parameters
- Cache clearing (full and pattern-based)
- Cache statistics
- Connection wrapping with caching
- Batch queries
- QueryOptions object handling (with and without sql property)
- Performance statistics tracking (hits, misses, evictions)
- Debug logging functionality

**Current coverage: 100% statements, 100% branches, 100% functions, 100% lines**

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Disclaimer

This is a simple in-memory caching solution. For production environments with multiple server instances, consider using a distributed cache like Redis.
