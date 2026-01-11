# SqlDB Admin UI Guide

A comprehensive web-based admin interface for managing and monitoring your SqlDB search implementation, with real-time analytics, performance monitoring, and query insights.

## Features

### 🔍 Search Testing Playground
- **Live Search Testing**: Test search queries in real-time with instant results
- **Configurable Options**: Adjust limit, min score, and highlighting options
- **Result Highlighting**: Visual highlighting of matched terms in results
- **Relevance Scoring**: See relevance scores for each result

### 📊 Performance Analytics
- **Benchmark Testing**: Run automated benchmarks on multiple queries
- **Performance Metrics**: Track average, min, and max search times
- **Query Statistics**: View aggregated stats by query type and table
- **Cache Hit Rate**: Monitor caching effectiveness

### 🐌 Slow Query Monitoring
- **Real-time Tracking**: Monitor slowest queries from `__sqldb_query_stats` table
- **Color-coded Performance**: Visual indicators for query speed (green/orange/red)
- **Detailed Breakdown**: See execution time, cache status, and timestamps
- **Filter Analysis**: View query filters and parameters

### ⚙️ Index Management
- **Build/Rebuild**: Manage search indexes with one click
- **Index Statistics**: View document count, term count, and build duration
- **Build Logs**: Real-time feedback on index operations
- **Status Monitoring**: Track index health and last build time

## Getting Started

### 1. Start the API Server

```bash
npm run search:api
```

The server will start on `http://localhost:3090` by default.

### 2. Access the Admin UI

Open your browser and navigate to:

```
http://localhost:3090/admin
```

### 3. Build Search Index (First Time Only)

1. Navigate to the "Index Management" tab
2. Click "Build Index"
3. Wait for the build to complete
4. You'll see statistics showing indexed documents and terms

### 4. Start Searching!

1. Go to the "Search Testing" tab
2. Enter a search query (e.g., "plumbing repair")
3. Adjust options as needed (limit, min score, highlighting)
4. Click "Search" or press Enter

## Interface Overview

### Dashboard Stats (Top Cards)

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Total Documents │ Indexed Terms   │ Avg Search Time │ Cache Hit Rate  │
│     3,268       │    11,626       │      45ms       │      75%        │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

These cards update automatically based on your index statistics and query performance.

### Tabs

#### 1. Search Testing
**Purpose**: Test and experiment with search queries

**Features**:
- Search input with Enter key support
- Adjustable limit (default: 10)
- Minimum score threshold (default: 0)
- Highlighting toggles for title and description
- Real-time results with scores and highlights

**Example Use Cases**:
- Testing different search queries
- Fine-tuning min score thresholds
- Verifying highlighting works correctly
- Checking relevance ranking

#### 2. Performance
**Purpose**: Benchmark search performance

**Features**:
- Automated benchmark runner
- Tests multiple queries in sequence
- Displays average search time
- Shows individual query performance

**Example Queries Tested**:
- "plumbing"
- "electrical repair"
- "emergency service"
- "installation"

**Expected Results**:
- Average time: <50ms
- Consistent performance across queries
- Faster than traditional SQL LIKE queries (10-20x improvement)

#### 3. Slow Queries
**Purpose**: Monitor and analyze slow database queries

**Features**:
- Top 20 slowest queries
- Execution time in milliseconds
- Cache hit/miss indicators
- Query type and table name
- Timestamp and filters
- Color-coded performance indicators:
  - 🟢 Green: <500ms (Fast)
  - 🟠 Orange: 500-1000ms (Moderate)
  - 🔴 Red: >1000ms (Slow)

**Data Source**: `__sqldb_query_stats` table

**Use Cases**:
- Identify bottlenecks
- Optimize slow queries
- Monitor cache effectiveness
- Track query patterns

#### 4. Index Management
**Purpose**: Manage search indexes

**Operations**:
- **Build Index**: Create index from scratch (use when index doesn't exist)
- **Rebuild Index**: Clear and rebuild entire index (use after bulk data updates)

**Statistics Shown**:
- Total documents indexed
- Total unique terms
- Total tokens processed
- Last build timestamp
- Build duration (ms)

**When to Rebuild**:
- After bulk data imports
- When search results seem outdated
- After schema changes
- Periodically (weekly/monthly for large datasets)

## API Endpoints Used by the UI

The admin UI communicates with these backend endpoints:

### Search Endpoints
```bash
GET  /api/search/services?q=query&limit=10
POST /api/search/services
POST /api/search/autocomplete
```

### Index Management
```bash
POST /api/search/index/services/build
GET  /api/search/index/services/stats
```

### Analytics
```bash
GET  /api/analytics/slow-queries?limit=20
GET  /api/analytics/query-stats
```

## Performance Best Practices

### 1. Search Optimization

**Min Score Threshold**:
- Set to 0.1-0.3 for lenient matching
- Set to 0.5-0.7 for strict matching
- Higher scores = fewer but more relevant results

**Limit**:
- Keep limit ≤ 50 for best UX
- Use pagination for larger result sets
- Consider offset for "Load More" functionality

**Highlighting**:
- Only highlight fields users will see
- Highlighting adds minimal overhead (<1ms)

### 2. Index Management

**When to Build**:
- First-time setup
- After database is restored
- When index is corrupted

**When to Rebuild**:
- After bulk updates (>1000 records)
- Weekly for frequently updated data
- Monthly for slowly changing data

**Build Time Expectations**:
- 1,000 docs: ~100ms
- 10,000 docs: ~1-2s
- 100,000 docs: ~10-20s

### 3. Monitoring

**Watch For**:
- Search times >100ms consistently
- Cache hit rate <60%
- Queries with execution_time_ms >1000ms
- Sudden spikes in slow queries

**Actions**:
- Rebuild index if search times are slow
- Optimize filters if cache hit rate is low
- Add indexes to frequently queried fields
- Consider Redis memory limits

## Troubleshooting

### Admin UI Not Loading

1. **Check Server is Running**:
   ```bash
   curl http://localhost:3090/health
   ```

2. **Verify Port is Correct**:
   - Default: 3090
   - Set via environment: `PORT=3090 npm run search:api`

3. **Check Browser Console**:
   - Look for CORS errors
   - Verify API_BASE URL matches server

### Search Not Working

1. **Check Index is Built**:
   - Go to "Index Management" tab
   - Look for "Index not found" error
   - Click "Build Index"

2. **Verify Table Configuration**:
   ```typescript
   search: {
     enabled: true,
     invertedIndex: {
       enabled: true,
       tables: {
         services: { /* config */ }
       }
     }
   }
   ```

3. **Check Console Logs**:
   - Look for errors in terminal
   - Verify Redis connection

### Slow Queries Tab Empty

1. **Run Some Queries**:
   - Search in the "Search Testing" tab
   - Use the API endpoints
   - Wait for queries to be logged

2. **Check Table Exists**:
   ```sql
   SHOW TABLES LIKE '__sqldb_query_stats';
   ```

3. **Verify Auto-warming is Enabled**:
   ```typescript
   warming: {
     enabled: true,
     trackQueryStats: true
   }
   ```

### Performance Issues

1. **High Search Times (>500ms)**:
   - Rebuild search index
   - Check Redis memory
   - Verify tokenizer configuration

2. **Low Cache Hit Rate (<50%)**:
   - Increase cache TTL
   - Check filter diversity
   - Review query patterns

3. **Build Takes Too Long**:
   - Normal for large datasets
   - Consider batch processing
   - Increase Redis max memory

## Advanced Features (Future)

### AI-Driven Suggestions (Planned)
- Gemini-powered query suggestions
- Auto-complete based on popular searches
- Smart typo correction
- Related query recommendations

### Enhanced Analytics (Planned)
- Query heatmaps
- User search patterns
- A/B testing for ranking algorithms
- Performance trends over time

### Multi-Table Support
- Currently supports single table (services)
- Future: Dynamic table selection
- Cross-table search
- Federated search results

## Security Considerations

⚠️ **Important**: The admin UI is currently designed for development and internal use.

**For Production**:
1. Add authentication (e.g., passport.js, JWT)
2. Implement role-based access control
3. Use HTTPS only
4. Add rate limiting
5. Sanitize user inputs
6. Add CORS restrictions

**Example Auth Middleware**:
```typescript
app.get('/admin', requireAuth, (_req, res) => {
  res.sendFile(__dirname + '/admin-ui.html');
});
```

## Customization

### Change Port

```bash
PORT=3000 npm run search:api
```

Or in code:
```typescript
const port = parseInt(process.env.PORT || '3000', 10);
startSearchAPI(port);
```

### Update Styling

The UI uses Tailwind CSS via CDN. To customize:

1. Edit `examples/admin-ui.html`
2. Modify Tailwind classes
3. Add custom CSS in `<style>` tag

### Add Custom Metrics

In `admin-ui.html`:
```javascript
async function loadCustomMetrics() {
  const response = await fetch(`${API_BASE}/api/analytics/custom`);
  const data = await response.json();
  // Display custom metrics
}
```

## Links

- [Search Guide](./SEARCH_GUIDE.md)
- [Search Example Code](../examples/search-example.ts)
- [Performance Optimization](./SEARCH_OPTIMIZATION_PLAN.md)

## Support

For issues or questions:
- GitHub Issues: https://github.com/erBhushanPawar/sqldb/issues
- Documentation: https://github.com/erBhushanPawar/sqldb

---

**Pro Tip**: Keep the admin UI open while developing to monitor search performance in real-time! 🚀
