# Performance Testing Guide

This guide explains how to run performance tests using real production queries extracted from CloudWatch logs.

## Prerequisites

1. **Extract queries from CloudWatch logs:**
   ```bash
   ./extract-queries.sh "logs-insights-results (3).json"
   ```
   This creates `extracted-queries.sql` with all your SQL queries.

2. **Configure database connection:**
   Ensure your `.env` file has the correct database configuration:
   ```env
   DB_CONFIG={"host":"localhost","port":3306,"username":"root","password":"yourpassword","database":"yourdatabase"}
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

## Running Performance Tests

### Basic Usage

```bash
npm run perf
```

### What It Does

The performance test:

1. **Loads queries** from `extracted-queries.sql`
2. **Executes queries** in 2 rounds:
   - Round 1: Cold cache (direct database queries)
   - Round 2: Warm cache (cached queries)
3. **Tracks metrics** for each query using correlation IDs
4. **Analyzes performance**:
   - Total execution time per round
   - Average time per query
   - Cache performance improvement
   - Slowest queries identification
5. **Saves results** to `performance-results.json`

### Test Configuration

You can modify these parameters in `examples/usage.ts`:

```typescript
const testRounds = 2;        // Number of times to run each query
const batchSize = 50;        // Parallel query execution batch size
const queries = uniqueQueries.slice(0, 100);  // Number of queries to test
```

## Output

### Console Output

```
=== MariaDB Cache Performance Test ===

📊 Loaded 9978 queries from file
🔹 Unique queries: 708

🎯 Testing 100 queries with 2 rounds

--- Round 1/2 ---
Progress: 100/100 queries
✓ Round 1 completed in 3245ms
  Executed: 100 queries
  Average: 32.45ms per query

--- Round 2/2 ---
Progress: 100/100 queries
✓ Round 2 completed in 156ms
  Executed: 100 queries
  Average: 1.56ms per query

=== Performance Summary ===

Round 1:
  Total Time: 3245ms
  Avg Time/Query: 32.45ms

Round 2:
  Total Time: 156ms
  Avg Time/Query: 1.56ms

📈 Cache Performance:
  First run: 3245ms
  Second run (cached): 156ms
  Improvement: 95.19%
  Speedup: 20.80x faster

📊 Query Execution Stats:
  Total queries tracked: 200
  Avg execution time: 16.78ms
  Min execution time: 0.12ms
  Max execution time: 145.23ms

🐌 Top 10 Slowest Queries:
  1. 145.23ms - SELECT * FROM services WHERE category IN (...)...
  2. 132.45ms - SELECT * FROM orders WHERE user_id IN (...)...
  ...
```

### JSON Output

Results are saved to `performance-results.json`:

```json
{
  "testDate": "2025-12-06T11:00:00.000Z",
  "configuration": {
    "totalQueries": 100,
    "rounds": 2,
    "batchSize": 50,
    "cacheTTL": 300
  },
  "roundMetrics": [
    {
      "round": 1,
      "totalTime": 3245,
      "avgTime": 32.45,
      "cacheHits": 0,
      "cacheMisses": 100
    },
    {
      "round": 2,
      "totalTime": 156,
      "avgTime": 1.56,
      "cacheHits": 100,
      "cacheMisses": 0
    }
  ],
  "queryDetails": [
    {
      "queryId": "uuid-here",
      "sql": "SELECT * FROM ...",
      "executionTimeMs": 32.45,
      "resultCount": 10
    }
  ],
  "summary": {
    "avgExecutionTime": 16.78,
    "minExecutionTime": 0.12,
    "maxExecutionTime": 145.23
  }
}
```

## Use Cases

### 1. Measure Cache Effectiveness

Compare performance between cached and uncached queries:

```bash
npm run perf
```

Look for the "Cache Performance" section to see improvement percentage and speedup factor.

### 2. Identify Slow Queries

Find queries that need optimization:

```bash
npm run perf
```

Check the "Top 10 Slowest Queries" section.

### 3. Benchmark Different Configurations

Test different cache configurations:

1. Modify cache settings in `examples/usage.ts`
2. Run performance test
3. Compare results in `performance-results.json`

### 4. Production Query Analysis

Test real production workload:

1. Extract recent queries from CloudWatch
2. Run performance test with production-like data
3. Analyze which queries benefit most from caching

## Advanced Usage

### Custom Query Set

To test specific queries:

```typescript
// In examples/usage.ts, modify:
const queries = uniqueQueries
  .filter(q => q.includes('users'))  // Only test user queries
  .slice(0, 50);  // Test 50 queries
```

### Longer Test Runs

For more accurate results:

```typescript
const testRounds = 5;  // Run 5 times
const queries = uniqueQueries;  // Test all queries
```

### Different Batch Sizes

Test parallel vs sequential execution:

```typescript
const batchSize = 1;    // Sequential
// vs
const batchSize = 100;  // Highly parallel
```

## Performance Tips

1. **Warm up Redis**: Run the test once to warm up Redis before actual testing
2. **Consistent environment**: Use same database state for consistent results
3. **Network conditions**: Run on same network as production for realistic results
4. **Query diversity**: Test mix of simple and complex queries
5. **Cache TTL**: Set appropriate TTL based on data freshness requirements

## Troubleshooting

### No improvement in Round 2

- Check if cache is enabled
- Verify Redis connection
- Ensure TTL is long enough

### Queries failing

- Verify database connection
- Check if tables exist
- Review query syntax

### Memory issues

- Reduce number of queries tested
- Decrease batch size
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096 npm run perf`

## Example Workflow

```bash
# 1. Extract queries from CloudWatch
./extract-queries.sh "logs-insights-results.json"

# 2. Analyze extracted queries
./analyze-queries.sh "logs-insights-results.json"

# 3. Run performance test
npm run perf

# 4. Review results
cat performance-results.json | jq '.summary'

# 5. Identify improvements
cat performance-results.json | jq '.roundMetrics'
```

## Interpreting Results

### Good Cache Performance

- Speedup: 10x-50x faster
- Improvement: >90%
- Round 2 avg time: <5ms

### Moderate Cache Performance

- Speedup: 3x-10x faster
- Improvement: 60-90%
- Round 2 avg time: 5-20ms

### Poor Cache Performance

- Speedup: <3x faster
- Improvement: <60%
- Possible causes:
  - Queries with always-changing parameters
  - Very fast queries (<1ms)
  - High cache eviction rate

## Next Steps

After performance testing:

1. **Optimize slow queries**: Use query details to identify candidates for indexing
2. **Adjust cache TTL**: Set per-table TTL based on data change frequency
3. **Monitor in production**: Use query tracking with correlation IDs
4. **Scale cache**: Increase `maxKeys` if seeing high eviction rates
