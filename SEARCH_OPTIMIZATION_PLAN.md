# Search Optimization Implementation Plan for SqlDB

> **Inspired by Meilisearch & Prisma ORM Architecture**
>
> Date: 2026-01-11
> Status: Planning Phase

---

## Executive Summary

This document outlines a comprehensive plan to implement Meilisearch-inspired search optimizations in SqlDB while learning from Prisma ORM's performance strategies. The goal is to make SqlDB competitive with specialized search engines for text search, faceted filtering, and geo-queries while maintaining all the benefits of a traditional SQL database.

---

## Background Research

### Meilisearch Architecture

**Key Insights:**
- Uses **LMDB (Lightning Memory-Mapped Database)** - OS handles what stays in RAM
- **Inverted Indexing**: Pre-computes word-to-document mappings at write-time
- **Finite State Transducers (FST)**: Prefix search is instant (next states pre-calculated)
- **No Query Result Caching**: Instead caches the "search library" (index states)
- **Pre-computation Philosophy**: Heavy lifting at INSERT/UPDATE, not SELECT

**Performance:**
- Text search: <50ms
- Autocomplete: <10ms
- Faceted search: Instant (pre-computed buckets)

### Prisma ORM Architecture Evolution

**Rust Era (Prisma v2-v5):**
- Query engine written in Rust for performance
- Compiled to native binary
- Issue: Cross-language serialization overhead (Rust ↔ TypeScript)

**TypeScript/WASM Era (Prisma v6+):**
- Moved from Rust to TypeScript + WebAssembly
- **3.4x faster queries** by eliminating serialization
- 90% smaller bundle (14MB → 1.6MB)
- Zero cross-language overhead

**Key Lessons from Prisma:**
1. **Serialization kills performance** - staying in one runtime (Node.js) is faster than crossing language boundaries
2. **Query compilation is key** - compile queries to optimized plans
3. **Bundle size matters** - smaller footprint = faster cold starts
4. **TypeScript is fast enough** when optimized properly

### Current SqlDB Architecture

**Strengths:**
- Redis caching with 99%+ hit rates
- Smart cascade invalidation via foreign keys
- Auto-warming based on query frequency
- Connection pooling

**Limitations:**
- Full query result caching (not index-based)
- Text search relies on slow `LIKE %word%` (50-200ms)
- No pre-computed facets for filtering
- No prefix/autocomplete optimization
- No geo-spatial indexing

---

## Performance Comparison

| Feature | Current SqlDB | Meilisearch | Prisma ORM | **SqlDB v2.0 (Goal)** |
|---------|---------------|-------------|------------|------------------------|
| **Exact Match** | <1ms (cached) | <1ms | <5ms | **<1ms** (no change) |
| **Text Search** | 50-200ms | <50ms | N/A | **<10ms** (inverted index) |
| **Multi-word** | 100-500ms | <50ms | N/A | **<15ms** (index intersection) |
| **Autocomplete** | 50-100ms | <10ms | N/A | **<5ms** (prefix tree) |
| **Faceted Search** | 50-200ms | Instant | N/A | **<2ms** (pre-computed) |
| **Geo-Radius** | 100-300ms | <50ms | N/A | **<10ms** (Redis GEO) |
| **Complex Joins** | <5ms (cached) | ❌ No SQL | <10ms | **<5ms** (no change) |
| **Transactions** | Native | ❌ No SQL | Native | **Native** (no change) |

---

## Implementation Strategy

### Philosophy: Hybrid Approach

**Don't replace SQL - augment it:**
- Keep traditional query caching for complex queries (joins, aggregations)
- Add specialized indexes for search use cases
- Let developers choose: fast search OR complex SQL
- Stay within Node.js/TypeScript ecosystem (learn from Prisma)

---

## Phase 1: Text Search Index (8-12 weeks)

### 1.1 Core Components

#### A. Inverted Index Manager
**File:** `src/search/inverted-index-manager.ts`

```typescript
export interface InvertedIndexConfig {
  enabled: boolean;
  tables: {
    [tableName: string]: {
      searchableFields: string[];      // ['title', 'description']
      tokenizer: 'simple' | 'stemming' | 'ngram';
      minWordLength: number;           // Minimum 3 chars
      stopWords: string[];             // ['the', 'a', 'an', ...]
      caseSensitive: boolean;
      rebuildOnWrite: boolean;         // Auto-rebuild on INSERT/UPDATE
    };
  };
}

export class InvertedIndexManager {
  // Build inverted index for a table
  async buildIndex(tableName: string): Promise<void>;

  // Search using inverted index
  async search(tableName: string, query: string, options: SearchOptions): Promise<number[]>;

  // Update index for specific row
  async updateRow(tableName: string, rowId: number, data: any): Promise<void>;

  // Delete row from index
  async deleteRow(tableName: string, rowId: number): Promise<void>;
}
```

**Storage Strategy (Redis):**
```typescript
// Word → Document IDs mapping (sorted set for ranking)
Key: "sqldb:index:{table}:word:{word}"
Value: Sorted Set [(docId, score), ...]

// Document → Words mapping (for updates)
Key: "sqldb:index:{table}:doc:{docId}"
Value: Set [word1, word2, ...]

// Metadata
Key: "sqldb:index:{table}:meta"
Value: Hash { lastBuild: timestamp, docCount: number, wordCount: number }
```

**Tokenization:**
```typescript
export class Tokenizer {
  // Simple: split by whitespace, lowercase
  simple(text: string): string[];

  // Stemming: reduce words to root form (running → run)
  stemming(text: string): string[];

  // N-gram: split into character sequences (plumb → pl, plu, lum, umb)
  ngram(text: string, n: number): string[];
}
```

**Ranking Algorithm:**
```typescript
export class SearchRanker {
  // TF-IDF (Term Frequency - Inverse Document Frequency)
  calculateScore(term: string, docId: number, totalDocs: number): number;

  // Field boosting (title matches rank higher than description)
  applyFieldBoost(score: number, field: string, boosts: Record<string, number>): number;

  // Proximity scoring (words closer together rank higher)
  applyProximityBoost(score: number, positions: number[]): number;
}
```

#### B. Search API Integration
**File:** `src/query/operations.ts` (extend existing)

```typescript
export class TableOperationsImpl<T> {
  // New method: Full-text search
  async search(
    query: string,
    options?: {
      fields?: string[];           // Limit to specific fields
      limit?: number;              // Max results
      offset?: number;             // Pagination
      filters?: WhereClause<T>;    // Combine with SQL WHERE
      ranking?: {
        fieldBoosts?: Record<string, number>;
        proximityWeight?: number;
      };
      highlightFields?: string[];  // Return highlighted snippets
    }
  ): Promise<SearchResult<T>[]>;
}

export interface SearchResult<T> {
  score: number;                   // Relevance score (0-1)
  data: T;                         // Full record
  highlights?: Record<string, string>; // Highlighted snippets
}
```

**Usage Example:**
```typescript
const services = db.getTableOperations('services');

// Fast text search (uses inverted index)
const results = await services.search('plumbing repair', {
  fields: ['title', 'description'],
  limit: 10,
  filters: { is_active: true },
  ranking: {
    fieldBoosts: { title: 2.0, description: 1.0 },
    proximityWeight: 1.5
  },
  highlightFields: ['title', 'description']
});

// Results:
// [
//   {
//     score: 0.95,
//     data: { id: 1, title: 'Emergency Plumbing Repair', ... },
//     highlights: {
//       title: 'Emergency <mark>Plumbing Repair</mark>',
//       description: 'Expert <mark>plumbing</mark> and <mark>repair</mark> services'
//     }
//   }
// ]
```

### 1.2 Index Building Strategy

**Rebuild Strategies:**

1. **Full Rebuild** (initial setup or manual trigger)
   ```typescript
   await db.search.rebuildIndex('services');
   ```

2. **Incremental Updates** (on INSERT/UPDATE/DELETE)
   ```typescript
   // Hooks into existing invalidation system
   hooks.on('afterInsert', async (table, data) => {
     if (searchConfig.tables[table]) {
       await invertedIndex.updateRow(table, data.id, data);
     }
   });
   ```

3. **Background Rebuilds** (scheduled)
   ```typescript
   // Similar to auto-warming
   warming: {
     rebuildIndexes: true,
     rebuildIntervalMs: 3600000  // Every hour
   }
   ```

### 1.3 Performance Targets

| Metric | Target | Current (LIKE %) | Improvement |
|--------|--------|------------------|-------------|
| Single word search | <5ms | 50-100ms | **20x faster** |
| Multi-word search | <10ms | 100-200ms | **20x faster** |
| Search + filters | <15ms | 150-300ms | **20x faster** |
| Index build (10k rows) | <2s | N/A | N/A |
| Memory overhead | ~2MB/10k docs | 0 | Minimal |

---

## Phase 2: Faceted Search (4-6 weeks)

### 2.1 Core Components

#### A. Facet Manager
**File:** `src/search/facet-manager.ts`

```typescript
export interface FacetConfig {
  tables: {
    [tableName: string]: {
      filterableAttributes: string[];    // ['category_id', 'status', 'price']
      numericRanges?: {
        [field: string]: number[];       // price: [0, 50, 100, 200]
      };
      dateRanges?: {
        [field: string]: string[];       // created_at: ['1d', '7d', '30d', '1y']
      };
    };
  };
}

export class FacetManager {
  // Pre-compute facet counts
  async computeFacets(tableName: string): Promise<void>;

  // Get facet counts (instant)
  async getFacets(
    tableName: string,
    filters?: WhereClause<any>
  ): Promise<FacetCounts>;
}

export interface FacetCounts {
  [attributeName: string]: {
    [value: string]: number;
  };
}
```

**Storage Strategy (Redis):**
```typescript
// Categorical facets
Key: "sqldb:facets:{table}:{attribute}"
Value: Hash { "value1": count1, "value2": count2, ... }

// Numeric ranges
Key: "sqldb:facets:{table}:{attribute}:ranges"
Value: Hash { "0-50": count1, "50-100": count2, ... }

// With filters (conditional facets)
Key: "sqldb:facets:{table}:{attribute}:filter:{hash}"
Value: Hash { "value1": count1, "value2": count2, ... }
```

#### B. API Integration

```typescript
const results = await db.services.findMany(
  { is_active: true },
  {
    facets: ['category_id', 'price_range', 'location'],
    getFacetCounts: true
  }
);

// Returns:
// {
//   data: [...services...],
//   facets: {
//     category_id: { "1": 45, "2": 67, "3": 23 },
//     price_range: { "0-50": 12, "50-100": 34, "100-200": 21 },
//     location: { "NYC": 23, "LA": 45, "SF": 12 }
//   }
// }
```

### 2.2 Performance Targets

| Metric | Target | Current | Improvement |
|--------|--------|---------|-------------|
| Facet counts (cached) | <1ms | 50-200ms | **200x faster** |
| Facet counts (rebuild) | <500ms | N/A | N/A |
| Conditional facets | <5ms | 100-300ms | **60x faster** |

---

## Phase 3: Autocomplete/Prefix Search (4-6 weeks)

### 3.1 Core Components

#### A. Prefix Tree Manager
**File:** `src/search/prefix-tree-manager.ts`

```typescript
export interface PrefixTreeConfig {
  tables: {
    [tableName: string]: {
      autocompleteFields: string[];    // ['title', 'name']
      minPrefixLength: number;         // Minimum 2 chars
      maxSuggestions: number;          // Top 10 results
      rankBy?: 'frequency' | 'alphabetical' | 'custom';
    };
  };
}

export class PrefixTreeManager {
  // Build prefix tree
  async buildTree(tableName: string, field: string): Promise<void>;

  // Get autocomplete suggestions
  async getSuggestions(
    tableName: string,
    prefix: string,
    options?: {
      field?: string;
      limit?: number;
      filters?: WhereClause<any>;
    }
  ): Promise<Suggestion[]>;
}

export interface Suggestion {
  text: string;
  score: number;
  count: number;  // Frequency
}
```

**Storage Strategy (Redis):**
```typescript
// Prefix → Completions mapping (sorted set for ranking)
Key: "sqldb:prefix:{table}:{field}:{prefix}"
Value: Sorted Set [(completion, score), ...]

// Example:
// Key: "sqldb:prefix:services:title:plu"
// Value: [("plumbing", 95), ("plumbing repair", 78), ("plumber", 45)]
```

#### B. API Integration

```typescript
const suggestions = await db.services.autocomplete('plu', {
  field: 'title',
  limit: 10,
  filters: { is_active: true }
});

// Returns:
// [
//   { text: 'plumbing', score: 95, count: 150 },
//   { text: 'plumbing repair', score: 78, count: 89 },
//   { text: 'plumber emergency', score: 45, count: 34 }
// ]
```

### 3.2 Performance Targets

| Metric | Target | Current | Improvement |
|--------|--------|---------|-------------|
| Autocomplete | <2ms | 50-100ms | **50x faster** |
| With filters | <5ms | 100-200ms | **40x faster** |

---

## Phase 4: Geo-Spatial Search (3-4 weeks)

### 4.1 Core Components

#### A. Geo Index Manager
**File:** `src/search/geo-index-manager.ts`

```typescript
export interface GeoConfig {
  tables: {
    [tableName: string]: {
      latField: string;      // 'latitude'
      lngField: string;      // 'longitude'
      radiusUnit: 'km' | 'mi';
    };
  };
}

export class GeoIndexManager {
  // Build geo index
  async buildIndex(tableName: string): Promise<void>;

  // Find nearby
  async findNearby(
    tableName: string,
    lat: number,
    lng: number,
    radius: number,
    options?: {
      filters?: WhereClause<any>;
      limit?: number;
      orderBy?: 'distance' | 'rating';
    }
  ): Promise<GeoResult[]>;
}

export interface GeoResult<T> {
  data: T;
  distance: number;  // In km or miles
  bearing: number;   // Direction (0-360)
}
```

**Storage Strategy (Redis):**
```typescript
// Use Redis GeoSpatial commands
Key: "sqldb:geo:{table}"
Value: GeoSet [(lng, lat, docId), ...]

// Redis commands:
// GEOADD sqldb:geo:services lng lat docId
// GEORADIUS sqldb:geo:services lng lat radius UNIT
```

#### B. API Integration

```typescript
const nearby = await db.services.findNearby({
  lat: 40.7128,
  lng: -74.0060,
  radius: 5,        // 5 km
  filters: { is_active: true },
  limit: 20,
  orderBy: 'distance'
});

// Returns:
// [
//   { data: {...}, distance: 0.5, bearing: 45 },
//   { data: {...}, distance: 1.2, bearing: 120 }
// ]
```

### 4.2 Performance Targets

| Metric | Target | Current | Improvement |
|--------|--------|---------|-------------|
| Geo-radius query | <10ms | 100-300ms | **30x faster** |
| With filters | <15ms | 200-400ms | **25x faster** |

---

## Phase 5: Query Optimization (4-6 weeks)

### 5.1 Query Compiler (Inspired by Prisma)

**File:** `src/query/query-compiler.ts`

```typescript
export class QueryCompiler {
  // Analyze query and create execution plan
  compile(query: Query): ExecutionPlan;

  // Optimize query based on available indexes
  optimize(plan: ExecutionPlan): ExecutionPlan;

  // Execute optimized plan
  async execute(plan: ExecutionPlan): Promise<any>;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  estimatedCost: number;
  indexesUsed: string[];
  cacheStrategy: 'full' | 'partial' | 'none';
}

export interface ExecutionStep {
  type: 'index_lookup' | 'cache_check' | 'db_query' | 'merge';
  operation: string;
  cost: number;
}
```

**Example Optimization:**
```typescript
// Query: Find active plumbing services in NYC within 5km
const results = await db.services.findMany({
  title: { contains: 'plumbing' },
  city: 'NYC',
  is_active: true,
  location: { near: { lat: 40.7128, lng: -74.0060, radius: 5 } }
});

// Execution Plan:
// 1. Use inverted index for "plumbing" → [id1, id2, ..., id100]
// 2. Use geo index for location → [id5, id23, ..., id89]
// 3. Use facet index for is_active=true → [id1, id5, ..., id200]
// 4. Intersection: [id5, id23] (only 2 matches)
// 5. Fetch full records from cache/DB
// Total time: <15ms (vs 200ms with full DB scan)
```

### 5.2 Smart Query Router

```typescript
export class QueryRouter {
  // Decide: use indexes, cache, or raw SQL?
  route(query: Query): 'index' | 'cache' | 'database';

  // Estimate costs
  estimateCost(query: Query): {
    indexCost: number;
    cacheCost: number;
    databaseCost: number;
  };
}
```

---

## Configuration API Design

### Unified Configuration

```typescript
const db = await createSqlDB({
  mariadb: { /* ... */ },
  redis: { /* ... */ },

  // NEW: Search configuration
  search: {
    enabled: true,

    // Text search
    invertedIndex: {
      enabled: true,
      tables: {
        services: {
          searchableFields: ['title', 'description'],
          tokenizer: 'stemming',
          minWordLength: 3,
          stopWords: ['the', 'a', 'an', 'and', 'or'],
          caseSensitive: false,
          rebuildOnWrite: true,
          fieldBoosts: {
            title: 2.0,
            description: 1.0
          }
        },
        products: {
          searchableFields: ['name', 'description', 'tags'],
          tokenizer: 'ngram',
          minWordLength: 2
        }
      }
    },

    // Faceted search
    facets: {
      enabled: true,
      tables: {
        services: {
          filterableAttributes: ['category_id', 'status', 'location'],
          numericRanges: {
            price: [0, 50, 100, 200, 500]
          },
          dateRanges: {
            created_at: ['1d', '7d', '30d', '90d', '1y']
          }
        }
      }
    },

    // Autocomplete
    autocomplete: {
      enabled: true,
      tables: {
        services: {
          autocompleteFields: ['title', 'name'],
          minPrefixLength: 2,
          maxSuggestions: 10,
          rankBy: 'frequency'
        }
      }
    },

    // Geo-spatial
    geo: {
      enabled: true,
      tables: {
        services: {
          latField: 'latitude',
          lngField: 'longitude',
          radiusUnit: 'km'
        }
      }
    },

    // Index management
    indexManagement: {
      autoRebuild: true,
      rebuildIntervalMs: 3600000,  // 1 hour
      rebuildOnStartup: false,
      backgroundRebuilds: true
    }
  }
});
```

---

## Implementation Timeline

### Phase 1: Text Search Index (Weeks 1-12)
- **Week 1-2**: Design inverted index architecture
- **Week 3-5**: Implement tokenizers and index builder
- **Week 6-8**: Build search API and ranking algorithm
- **Week 9-10**: Integration with existing operations
- **Week 11-12**: Testing, optimization, documentation

### Phase 2: Faceted Search (Weeks 13-18)
- **Week 13-14**: Design facet architecture
- **Week 15-16**: Implement facet computation and storage
- **Week 17-18**: API integration, testing, docs

### Phase 3: Autocomplete (Weeks 19-24)
- **Week 19-20**: Design prefix tree architecture
- **Week 21-22**: Implementation and storage
- **Week 23-24**: API integration, testing, docs

### Phase 4: Geo-Spatial (Weeks 25-28)
- **Week 25-26**: Design and implement geo indexing
- **Week 27-28**: API integration, testing, docs

### Phase 5: Query Optimization (Weeks 29-34)
- **Week 29-30**: Design query compiler
- **Week 31-32**: Implement smart routing
- **Week 33-34**: End-to-end optimization, testing, docs

**Total Timeline**: 34 weeks (~8 months)

---

## Migration Path for Existing Users

### Version 2.0 (Backward Compatible)

```typescript
// v1.x (existing) - still works
const users = await db.users.findMany({ status: 'active' });

// v2.0 (opt-in search features)
const users = await db.users.search('john', {
  fields: ['name', 'email']
});
```

### Opt-In Strategy
1. Search features disabled by default
2. Explicit configuration required
3. No breaking changes to existing API
4. Gradual adoption path

---

## Performance Benchmarks

### Test Dataset
- **Services table**: 100,000 rows
- **Products table**: 50,000 rows
- **Geographic data**: 25,000 locations

### Expected Results

| Operation | v1.x (Current) | v2.0 (Target) | Improvement |
|-----------|----------------|---------------|-------------|
| Text search (single word) | 120ms | 5ms | **24x** |
| Text search (multi-word) | 250ms | 10ms | **25x** |
| Autocomplete | 80ms | 2ms | **40x** |
| Faceted filters | 150ms | 1ms | **150x** |
| Geo-radius | 200ms | 8ms | **25x** |
| Combined (text + geo + facets) | 450ms | 18ms | **25x** |

---

## Risk Assessment

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis memory usage | High | Configurable index size limits, LRU eviction |
| Index rebuild time | Medium | Background rebuilds, incremental updates |
| Complex query compatibility | Medium | Fallback to traditional queries |
| Learning curve | Low | Backward compatible, opt-in features |

### Performance Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Serialization overhead | Low | Stay in Node.js (learned from Prisma) |
| Index staleness | Medium | Real-time incremental updates |
| Large dataset indexing | Medium | Batch processing, rate limiting |

---

## Success Metrics

### Performance KPIs
- **Text search**: <10ms for 95% of queries
- **Faceted search**: <2ms for 99% of queries
- **Autocomplete**: <5ms for 99% of queries
- **Geo-radius**: <10ms for 95% of queries
- **Memory overhead**: <10MB per 100k documents

### Adoption KPIs
- 30% of users enable search features within 6 months
- 50% improvement in average query time
- <5 bug reports per month after stable release

---

## Next Steps

1. **Review & Approval** (Week 0)
   - Team review of this plan
   - Architecture approval
   - Resource allocation

2. **Prototype** (Weeks 1-4)
   - Build minimal text search index
   - Prove performance targets are achievable
   - Get early feedback

3. **Phase 1 Execution** (Weeks 5-12)
   - Full text search implementation
   - Alpha release for testing

4. **Iterate** (Weeks 13-34)
   - Continue with phases 2-5
   - Gather user feedback
   - Adjust based on real-world usage

---

## References

### Meilisearch
- **Architecture**: LMDB, inverted indexes, FST
- **Key Insight**: Pre-compute at write-time, not read-time

### Prisma ORM
- [Prisma ORM Architecture Shift: Why We Moved from Rust to TypeScript](https://www.prisma.io/blog/from-rust-to-typescript-a-new-chapter-for-prisma-orm)
- [Prisma ORM without Rust: Latest Performance Benchmarks](https://www.prisma.io/blog/prisma-orm-without-rust-latest-performance-benchmarks)
- [Rust to TypeScript Update: Boosting Prisma ORM Performance](https://www.prisma.io/blog/rust-to-typescript-update-boosting-prisma-orm-performance)
- **Key Lesson**: Staying in one runtime (TypeScript) beats cross-language serialization

### Redis
- **GeoSpatial commands**: GEOADD, GEORADIUS
- **Sorted Sets**: For inverted indexes and ranking
- **Hash structures**: For facet counts

---

## Conclusion

By combining Meilisearch's indexing philosophy with Prisma's runtime optimization lessons, SqlDB v2.0 can become a hybrid ORM that excels at both **complex SQL queries** AND **fast search operations**.

**The key insight**: Don't choose between SQL and search engines—have both in one library.

**Next Action**: Build Phase 1 prototype to validate performance assumptions.
