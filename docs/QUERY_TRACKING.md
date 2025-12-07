# Query Tracking

The @bhushanpawar/sqldb library includes comprehensive query tracking capabilities that allow you to monitor SQL query execution, measure performance, and trace queries across complex operations using correlation IDs.

## Features

- **Unique Query IDs**: Every query gets a unique UUID identifier
- **Correlation IDs**: Group related queries together for complex operations
- **Execution Metrics**: Track query execution time and result counts
- **Error Tracking**: Capture and log failed queries with error details
- **In-Memory Storage**: Fast query metadata storage with filtering capabilities

## Query Metadata

Each tracked query includes the following information:

```typescript
interface QueryMetadata {
  queryId: string;           // Unique UUID for this query
  correlationId?: string;    // Optional correlation ID to group queries
  sql: string;               // The SQL query executed
  params?: any[];            // Query parameters
  startTime: number;         // Query start timestamp (ms)
  endTime?: number;          // Query end timestamp (ms)
  executionTimeMs?: number;  // Total execution time in milliseconds
  resultCount?: number;      // Number of rows returned/affected
  tableName?: string;        // Table name (future use)
  operation?: string;        // Operation type (future use)
  error?: string;            // Error message if query failed
}
```

## Basic Usage

### Accessing Query Tracker

```typescript
const db = await createSmartDB(config);

// The query tracker is available on the client
const allQueries = db.getQueries();
```

### Using Correlation IDs

Correlation IDs allow you to group multiple queries that are part of a single logical operation or request.

```typescript
import { generateQueryId } from '@bhushanpawar/sqldb';

// Generate a unique correlation ID
const correlationId = generateQueryId();

// Use it across multiple operations
await db.users.findMany({ status: 'active' }, { correlationId });
await db.users.count({ status: 'active' }, correlationId);
await db.users.findById(1, correlationId);

// Retrieve all queries for this correlation ID
const queries = db.getQueries(correlationId);
console.log(`Executed ${queries.length} queries for this operation`);
```

## API Reference

### SmartDBClient Methods

#### `getQueries(correlationId?: string): QueryMetadata[]`

Retrieve tracked queries.

- **Without correlationId**: Returns all tracked queries
- **With correlationId**: Returns only queries matching the correlation ID

```typescript
// Get all queries
const allQueries = db.getQueries();

// Get queries for specific correlation ID
const specificQueries = db.getQueries('my-correlation-id');
```

#### `clearQueries(correlationId?: string): void`

Clear tracked queries from memory.

- **Without correlationId**: Clears all tracked queries
- **With correlationId**: Clears only queries matching the correlation ID

```typescript
// Clear all queries
db.clearQueries();

// Clear specific correlation ID
db.clearQueries('my-correlation-id');
```

### Table Operations with Correlation IDs

All table operations support correlation IDs:

#### Read Operations

```typescript
// findOne - via FindOptions
await db.users.findOne({ id: 1 }, { correlationId });

// findMany - via FindOptions
await db.users.findMany({ status: 'active' }, { correlationId });

// findById - direct parameter
await db.users.findById(1, correlationId);

// count - direct parameter
await db.users.count({ status: 'active' }, correlationId);
```

#### Write Operations

```typescript
// insertOne
await db.users.insertOne({ name: 'John' }, correlationId);

// insertMany
await db.users.insertMany([{ name: 'John' }, { name: 'Jane' }], correlationId);

// updateOne
await db.users.updateOne({ id: 1 }, { name: 'Updated' }, correlationId);

// updateMany
await db.users.updateMany({ status: 'pending' }, { status: 'active' }, correlationId);

// updateById
await db.users.updateById(1, { name: 'Updated' }, correlationId);

// deleteOne
await db.users.deleteOne({ id: 1 }, correlationId);

// deleteMany
await db.users.deleteMany({ status: 'inactive' }, correlationId);

// deleteById
await db.users.deleteById(1, correlationId);
```

#### Raw Queries

```typescript
await db.users.raw('SELECT * FROM users WHERE id = ?', [1], correlationId);
```

## Use Cases

### 1. Request Tracing in Web Applications

Use correlation IDs to trace all database queries made during a single HTTP request:

```typescript
app.get('/api/user/:id', async (req, res) => {
  const correlationId = generateQueryId();

  try {
    const user = await db.users.findById(req.params.id, correlationId);
    const posts = await db.posts.findMany({ userId: user.id }, { correlationId });
    const comments = await db.comments.findMany({ userId: user.id }, { correlationId });

    // Log query performance
    const queries = db.getQueries(correlationId);
    const totalTime = queries.reduce((sum, q) => sum + (q.executionTimeMs || 0), 0);
    console.log(`Request completed with ${queries.length} queries in ${totalTime}ms`);

    // Clean up
    db.clearQueries(correlationId);

    res.json({ user, posts, comments });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 2. Performance Monitoring

Track and analyze query performance:

```typescript
const queries = db.getQueries();

// Find slow queries
const slowQueries = queries.filter(q => (q.executionTimeMs || 0) > 100);
console.log(`Found ${slowQueries.length} slow queries (>100ms)`);

// Calculate statistics
const times = queries.map(q => q.executionTimeMs || 0);
const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
const maxTime = Math.max(...times);
console.log(`Average: ${avgTime.toFixed(2)}ms, Max: ${maxTime}ms`);
```

### 3. Debugging Complex Operations

Use correlation IDs to debug multi-step operations:

```typescript
async function createUserWithProfile(userData: any, profileData: any) {
  const correlationId = generateQueryId();
  console.log(`Operation correlation ID: ${correlationId}`);

  try {
    const user = await db.users.insertOne(userData, correlationId);
    const profile = await db.profiles.insertOne(
      { ...profileData, userId: user.id },
      correlationId
    );

    // Check what queries were executed
    const queries = db.getQueries(correlationId);
    queries.forEach(q => {
      console.log(`${q.sql} - ${q.executionTimeMs}ms`);
    });

    return { user, profile };
  } catch (error) {
    // Check for failed queries
    const queries = db.getQueries(correlationId);
    const failedQuery = queries.find(q => q.error);
    if (failedQuery) {
      console.error(`Failed query: ${failedQuery.sql}`);
      console.error(`Error: ${failedQuery.error}`);
    }
    throw error;
  }
}
```

### 4. Audit Logging

Create audit logs with full query details:

```typescript
async function auditedUpdate(userId: number, changes: any, auditInfo: any) {
  const correlationId = generateQueryId();

  const result = await db.users.updateById(userId, changes, correlationId);

  // Log audit trail
  const queries = db.getQueries(correlationId);
  await db.audit_log.insertOne({
    userId,
    action: 'update',
    correlationId,
    queriesExecuted: queries.length,
    totalExecutionTime: queries.reduce((sum, q) => sum + (q.executionTimeMs || 0), 0),
    details: JSON.stringify(queries),
    ...auditInfo
  });

  return result;
}
```

### 5. Testing and Quality Assurance

Verify query counts and performance in tests:

```typescript
describe('User API', () => {
  it('should execute minimal queries for user fetch', async () => {
    const correlationId = generateQueryId();

    await fetchUserWithDetails(userId, correlationId);

    const queries = db.getQueries(correlationId);

    // Assert query count
    expect(queries.length).toBeLessThanOrEqual(3);

    // Assert performance
    const totalTime = queries.reduce((sum, q) => sum + (q.executionTimeMs || 0), 0);
    expect(totalTime).toBeLessThan(50);

    // Clean up
    db.clearQueries(correlationId);
  });
});
```

## Best Practices

1. **Generate Correlation IDs Early**: Create correlation IDs at the start of operations or requests
2. **Clear Regularly**: Clear queries periodically to prevent memory growth
3. **Use in Production Carefully**: Query tracking adds minimal overhead but stores data in memory
4. **Implement Rotation**: For long-running applications, implement a cleanup strategy
5. **Don't Store Sensitive Data**: Query params may contain sensitive information

## Memory Management

The query tracker stores data in memory. For production use:

```typescript
// Clear old queries periodically
setInterval(() => {
  db.clearQueries();
  console.log('Query history cleared');
}, 60000); // Every minute

// Or implement custom cleanup logic
const queries = db.getQueries();
const oneHourAgo = Date.now() - (60 * 60 * 1000);
queries.forEach(query => {
  if (query.startTime < oneHourAgo) {
    // Custom cleanup logic
  }
});
```

## Integration with Logging Systems

```typescript
import { QueryMetadata } from '@bhushanpawar/sqldb';

function logQueryMetrics(correlationId: string) {
  const queries = db.getQueries(correlationId);

  const metrics = {
    correlationId,
    totalQueries: queries.length,
    totalTime: queries.reduce((sum, q) => sum + (q.executionTimeMs || 0), 0),
    queries: queries.map(q => ({
      sql: q.sql,
      executionTime: q.executionTimeMs,
      resultCount: q.resultCount,
      error: q.error
    }))
  };

  // Send to your logging system
  logger.info('Query metrics', metrics);

  // Clean up
  db.clearQueries(correlationId);
}
```

## Custom Query Tracker

You can implement your own query tracker:

```typescript
import { QueryTracker, QueryMetadata } from '@bhushanpawar/sqldb';

class CustomQueryTracker implements QueryTracker {
  trackQuery(metadata: QueryMetadata): void {
    // Send to external service, database, etc.
    analytics.track('database_query', metadata);
  }

  getQueries(correlationId?: string): QueryMetadata[] {
    // Implement your retrieval logic
    return [];
  }

  clearQueries(correlationId?: string): void {
    // Implement your cleanup logic
  }
}

// Use custom tracker
const db = await createSmartDB(config);
db.queryTracker = new CustomQueryTracker();
```

## Complete Example

See [examples/query-tracking.ts](./examples/query-tracking.ts) for a complete working example.
