# Quick Start - Performance Testing

Test your database cache performance with real production queries in 3 steps:

## Step 1: Extract Queries from CloudWatch

```bash
./extract-queries.sh "logs-insights-results.json"
```

**Output:**
```
Extracting SQL queries from: logs-insights-results.json
✓ Extracted 9978 queries
✓ Saved to: extracted-queries.sql
✓ Unique queries: 708
```

## Step 2: Run Performance Test

```bash
npm run perf
```

## Step 3: Review Results

The test will show:
- ✅ Cache improvement percentage
- ⚡ Speedup factor
- 📊 Query execution statistics
- 🐌 Slowest queries

Results saved to `performance-results.json`

## What You'll See

```
📈 Cache Performance:
  First run: 3245ms
  Second run (cached): 156ms
  Improvement: 95.19%
  Speedup: 20.80x faster
```

## Available Commands

```bash
# Extract queries from CloudWatch logs
./extract-queries.sh "your-file.json"

# Analyze queries (stats, frequency, tables)
./analyze-queries.sh "your-file.json"

# Run performance test
npm run perf

# Run normal usage example
npm run usage
```

## Troubleshooting

**Error: extracted-queries.sql not found**
→ Run `./extract-queries.sh` first

**Error: DB_CONFIG not found**
→ Create `.env` file with database config

**No cache improvement**
→ Check Redis connection and cache settings

## Learn More

- [PERFORMANCE_TESTING.md](./PERFORMANCE_TESTING.md) - Complete testing guide
- [QUERY_TRACKING.md](./QUERY_TRACKING.md) - Query tracking documentation
- [README.md](./README.md) - Main documentation
