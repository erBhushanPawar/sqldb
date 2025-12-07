# Enhanced Query Logging

Beautiful, categorized query logging with performance indicators and automatic slow query detection.

## Features

✅ **Query Categorization** - Automatically categorizes queries (SELECT, INSERT, UPDATE, DELETE, etc.)
✅ **Table Extraction** - Extracts table name from SQL statements
✅ **Performance Emojis** - Visual indicators for query speed
✅ **Execution Time** - Precise millisecond timing
✅ **Result Counts** - Shows rows returned or affected
✅ **Slow Query Detection** - Automatically shows SQL for slow queries (>200ms)
✅ **Error Logging** - Beautiful error formatting with failed queries

## Quick Start

Enable query logging by adding `logging: true` to your MariaDB config:

```typescript
const db = await createSmartDB({
  mariadb: {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'mydb',
    logging: true,  // ← Enable query logging
  },
  redis: { /* ... */ },
});
```

That's it! Queries will now be logged with beautiful formatting.

## Log Output Examples

### Fast Query (⚡ <10ms)

```
[2025-12-07T20:15:23.456Z] ⚡ SELECT on users - 5ms - 10 rows
```

### Good Query (✅ <200ms)

```
[2025-12-07T20:15:24.789Z] ✅ SELECT on orders - 145ms - 25 rows
```

### Slow Query (⚠️ <500ms)

```
[2025-12-07T20:15:25.123Z] ⚠️ SELECT on products - 342ms - 100 rows
   SQL: SELECT * FROM products WHERE category = 'electronics' AND price > 100 ORDER BY created_at DESC
```

Note: SQL is automatically shown for queries >200ms

### Very Slow Query (🐌 ≥500ms)

```
[2025-12-07T20:15:26.456Z] 🐌 SELECT on analytics - 1243ms - 1000 rows
   SQL: SELECT * FROM analytics WHERE date_range BETWEEN '2024-01-01' AND '2024-12-31' GROUP BY mon...
```

### Write Operations

```
[2025-12-07T20:15:27.789Z] 🚀 INSERT on users - 23ms - 1 affected
[2025-12-07T20:15:28.012Z] ✅ UPDATE on orders - 87ms - 5 affected
[2025-12-07T20:15:29.345Z] ⚡ DELETE on temp_data - 8ms - 10 affected
```

### Failed Query (❌)

```
[2025-12-07T20:15:30.678Z] ❌ SELECT on invalid_table - FAILED after 5ms
   SQL: SELECT * FROM invalid_table WHERE id = 1
   Error: Table 'mydb.invalid_table' doesn't exist
```

## Performance Indicators

| Emoji | Range | Description |
|-------|-------|-------------|
| ⚡ | <10ms | Very fast - Excellent performance |
| 🚀 | 10-49ms | Fast - Good performance |
| ✅ | 50-199ms | Good - Acceptable performance |
| ⚠️ | 200-499ms | Slow - Consider optimization |
| 🐌 | ≥500ms | Very slow - Needs optimization |
| ❌ | Any | Failed - Error occurred |

## Query Types

The logging system automatically categorizes queries into:

- **SELECT** - Read operations
- **INSERT** - Create operations
- **UPDATE** - Modify operations
- **DELETE** - Remove operations
- **CREATE** - Schema creation
- **ALTER** - Schema modification
- **DROP** - Schema deletion
- **OTHER** - Miscellaneous operations

## Table Name Extraction

The system extracts table names from various query patterns:

```sql
-- SELECT
SELECT * FROM users WHERE id = 1
→ Table: users

-- INSERT
INSERT INTO orders (user_id, total) VALUES (1, 100.00)
→ Table: orders

-- UPDATE
UPDATE products SET price = 99.99 WHERE id = 5
→ Table: products

-- DELETE
DELETE FROM temp_sessions WHERE expired = 1
→ Table: temp_sessions

-- CREATE
CREATE TABLE IF NOT EXISTS new_table (id INT PRIMARY KEY)
→ Table: new_table
```

## Slow Query Detection

Queries slower than 200ms automatically show their SQL:

```typescript
// Fast query - no SQL shown
[2025-12-07T20:15:31.901Z] ⚡ SELECT on users - 5ms - 10 rows

// Slow query - SQL automatically shown
[2025-12-07T20:15:32.234Z] ⚠️ SELECT on analytics - 342ms - 100 rows
   SQL: SELECT DATE(created_at) as date, COUNT(*) as count FROM analytics GROUP BY DATE(created_at)
```

This helps you quickly identify queries that need optimization.

## SQL Formatting

Long SQL statements are automatically formatted:

- Whitespace collapsed to single spaces
- Truncated to 100 characters with `...`
- Clean, readable output

```sql
-- Original (multiple lines, extra whitespace)
SELECT
  u.id,
  u.name,
  o.order_id
FROM
  users u
LEFT JOIN
  orders o ON u.id = o.user_id
WHERE
  u.status = 'active'

-- Logged (clean, single line)
SELECT u.id, u.name, o.order_id FROM users u LEFT JOIN orders o ON u.id = o.user_id WHERE u.sta...
```

## Configuration Options

### Enable/Disable Logging

```typescript
mariadb: {
  logging: true,   // Enable
  logging: false,  // Disable (default)
}
```

### Global Logging Level

You can also control logging via the global logging config:

```typescript
logging: {
  level: 'debug',  // Show all queries
  level: 'info',   // Show queries (default)
  level: 'warn',   // Only slow queries
  level: 'error',  // Only failed queries
  level: 'none',   // No logging
}
```

## Use Cases

### Development

Enable logging to understand query patterns:

```typescript
const db = await createSmartDB({
  mariadb: {
    logging: true,  // Always on in dev
  },
  // ...
});
```

### Production Monitoring

Log only slow queries:

```typescript
const db = await createSmartDB({
  mariadb: {
    logging: true,
  },
  logging: {
    level: 'warn',  // Only log slow/failed queries
  },
});
```

### Performance Testing

Enable logging to track query performance:

```typescript
const db = await createSmartDB({
  mariadb: {
    logging: true,
  },
});

// Run test queries
const start = Date.now();
await db.users.findMany({});
await db.orders.findMany({});
const end = Date.now();

console.log(`Total time: ${end - start}ms`);
// Query logs show individual timings
```

## Integration with Monitoring

### Custom Logger

Send logs to your monitoring system:

```typescript
import { createSmartDB } from '@bhushanpawar/sqldb';

// Override console.log to send to monitoring
const originalLog = console.log;
console.log = (...args) => {
  originalLog(...args);

  // Send to monitoring
  const message = args.join(' ');
  if (message.includes('⚠️') || message.includes('🐌')) {
    monitoring.sendAlert('Slow query detected', { message });
  }
};

const db = await createSmartDB({
  mariadb: { logging: true },
});
```

### Parse Logs for Metrics

Extract metrics from log output:

```typescript
const logPattern = /\[(.*?)\] (.) (\w+) on (\w+) - (\d+)ms - (.*)/;

console.log = (message: string) => {
  const match = message.match(logPattern);
  if (match) {
    const [, timestamp, emoji, queryType, table, ms, result] = match;

    // Send to metrics
    metrics.timing(`query.${queryType}.${table}`, parseInt(ms));
    metrics.increment(`query.${queryType}.count`);

    if (parseInt(ms) > 200) {
      metrics.increment('query.slow.count');
    }
  }
};
```

## Best Practices

### 1. Enable in Development

Always enable in development:

```typescript
const isDev = process.env.NODE_ENV === 'development';

mariadb: {
  logging: isDev,
}
```

### 2. Monitor Slow Queries

Pay attention to slow query warnings:

```
⚠️ SELECT on users - 342ms
🐌 SELECT on analytics - 1243ms
```

These need optimization (indexes, query rewrite, etc.)

### 3. Track Query Patterns

Look for frequently logged tables:

```
✅ SELECT on users - 45ms
✅ SELECT on users - 52ms
✅ SELECT on users - 38ms
```

→ Consider caching or optimization

### 4. Investigate Errors

Failed queries show the problem:

```
❌ SELECT on orders - FAILED after 5ms
   SQL: SELECT * FROM orders WHERE user_id = 'invalid'
   Error: Incorrect integer value: 'invalid' for column 'user_id'
```

→ Fix data type issues

### 5. Use in Tests

Enable logging in tests to verify queries:

```typescript
describe('User queries', () => {
  beforeAll(async () => {
    db = await createSmartDB({
      mariadb: { logging: true },
    });
  });

  it('should fetch users efficiently', async () => {
    await db.users.findMany({});
    // Check logs for performance
  });
});
```

## Comparison

### Before (No Categorization)

```
Query executed in 145ms
```

No context, hard to optimize.

### After (Enhanced Logging)

```
[2025-12-07T20:15:33.567Z] ✅ SELECT on orders - 145ms - 25 rows
```

Clear context:
- Query type: SELECT
- Table: orders
- Performance: Good (✅)
- Time: 145ms
- Results: 25 rows

## Troubleshooting

### Q: Logging not showing?

**Check:**
1. `logging: true` in mariadb config
2. Console output not suppressed
3. Queries actually executing

### Q: Too much output?

**Solutions:**
1. Set `level: 'warn'` to only log slow queries
2. Disable in production: `logging: false`
3. Filter output: `grep "⚠️\|🐌" logs.txt`

### Q: Want structured JSON logs?

**Solution:** Override console.log:

```typescript
console.log = (message: string) => {
  const match = message.match(/\[(.*?)\] (.) (\w+) on (\w+) - (\d+)ms - (.*)/);
  if (match) {
    const [, timestamp, emoji, queryType, table, ms, result] = match;
    console.json({
      timestamp,
      queryType,
      table,
      duration_ms: parseInt(ms),
      result,
      performance: emoji === '⚡' ? 'fast' : emoji === '✅' ? 'good' : 'slow',
    });
  }
};
```

## Summary

Enhanced query logging provides:

✅ **Visual Performance Indicators** - Instant understanding via emojis
✅ **Automatic Categorization** - Know what type of query
✅ **Table Extraction** - See which tables are accessed
✅ **Slow Query Detection** - Automatic SQL display for slow queries
✅ **Error Logging** - Clear error messages with context
✅ **Zero Configuration** - Just enable and go

Perfect for development, debugging, and performance monitoring! 🚀
