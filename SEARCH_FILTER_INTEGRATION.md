# SearchFilterModel Integration with SqlDB Search

## Overview

The `search()` method in SqlDB now fully supports your `SearchFilterModel` class, providing a powerful combination of:

1. **Full-text search** via inverted index
2. **Advanced filtering** with AND/OR/LIKE conditions
3. **Range queries** for numeric and date fields
4. **Geo-spatial search** with location-based filtering
5. **Pagination** and **field selection**

## SearchFilterModel Attributes

Your `SearchFilterModel` supports the following attributes:

### Core Filter Types

| Attribute | Type | Description | Example |
|-----------|------|-------------|---------|
| `andFilter` | `kv` | Exact match conditions (AND logic) | `{ status: 'PUBLISHED', isActive: true }` |
| `likeFilter` | `kv` | Partial match with wildcards (LIKE) | `{ title: 'plumb' }` → matches "plumber", "plumbing" |
| `orFilter` | `any[]` | Multiple conditions with OR logic | `[{ category: 'A' }, { category: 'B' }]` |

### Geo-Location Support

| Attribute | Type | Description | Usage |
|-----------|------|-------------|-------|
| `latitude` | `number` | Latitude coordinate | Add to `andFilter` for geo-search |
| `longitude` | `number` | Longitude coordinate | Add to `andFilter` for geo-search |

**Note**: When you add `latitude` and `longitude` to `andFilter`, the search method automatically:
1. Extracts coordinates and creates geo-search options
2. Removes lat/lng from SQL filters (to avoid errors)
3. Performs geo-spatial search with 25km default radius
4. Sorts results by distance
5. Includes distance in results

### Range Queries

The `andFilter` supports range objects:

```typescript
andFilter: {
  price: {
    minimum: 50,    // >= 50
    maximum: 500    // <= 500
  },
  rating: {
    minimum: 4.0    // >= 4.0 only
  }
}
```

### Wildcard Search

| Attribute | Type | Description |
|-----------|------|-------------|
| `wildcardQueryString` | `string` | Text to search across multiple fields |
| `wildCardMatchWithFields` | `string[]` | Fields to search within |

### Pagination & Sorting

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `number` | 0 | Page number |
| `limit` | `number` | 50 | Results per page |
| `skip` | `number` | 0 | Records to skip |
| `orderBy` | `string` | 'createdOn' | Sort field |
| `order` | `'ASC' \| 'DESC'` | 'DESC' | Sort direction |

### Field Selection

| Attribute | Type | Description |
|-----------|------|-------------|
| `selectFields` | `string[]` | Specific fields to return |
| `groupByField` | `string` | Field to group results by |

### Metadata & Extensions

| Attribute | Type | Description |
|-----------|------|-------------|
| `metadata` | `any` | Custom metadata for tracking |
| `requestedCurrencyCode` | `string` | Currency conversion preference |
| `isMultiCity` | `boolean` | Multi-city search flag |

## How It Works

### 1. Filter Building

When you create a `SearchFilterModel`, it automatically builds SQL WHERE conditions:

```typescript
const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED',
    price: { minimum: 100, maximum: 500 }
  },
  likeFilter: {
    title: 'repair'
  }
});

// Generates SQL: WHERE status = ? AND price BETWEEN ? AND ? AND title LIKE ?
// Params: ['PUBLISHED', 100, 500, '%repair%']
```

### 2. Search Integration

The enhanced `search()` method combines:

1. **Text search** via inverted index → Returns matching document IDs
2. **SQL filtering** → Applies your SearchFilterModel conditions
3. **Scoring** → Ranks results by relevance
4. **Highlighting** → Shows matched terms in context

```typescript
const results = await db('services').search('emergency plumber', {
  filters: filter,
  limit: 20,
  highlightFields: ['title', 'description'],
  minScore: 0.5
});
```

### 3. SQL Query Generation

The `buildSearchQuery()` method translates your filters into optimized SQL:

```sql
SELECT * FROM services
WHERE service_id IN (?, ?, ?, ...) -- IDs from text search
  AND (
    status = ?
    AND price BETWEEN ? AND ?
    AND title LIKE ?
  )
LIMIT ?
```

## Usage Patterns

### Pattern 1: Basic Search with Filters

```typescript
import { SearchFilterModel } from './types';
import { getDB } from './db';

const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED',
    categoryId: 'cat-123'
  }
});

const db = await getDB();
const results = await db('services').search('plumbing', {
  filters: filter,
  limit: 20
});
```

### Pattern 2: Complex Multi-Condition Search

```typescript
const filter = new SearchFilterModel({
  // Exact matches
  andFilter: {
    status: 'PUBLISHED',
    isVerified: true,
    price: { minimum: 100, maximum: 1000 }
  },
  // Partial matches
  likeFilter: {
    providerName: 'Pro Services'
  },
  // Multiple options
  orFilter: [
    { urgency: 'emergency' },
    { priority: 'high' }
  ]
});

const results = await db('services').search('installation', {
  filters: filter,
  limit: 25,
  minScore: 0.5,
  highlightFields: ['title', 'description']
});
```

### Pattern 3: Dynamic Filter Building

```typescript
const filter = new SearchFilterModel();

// Build filters dynamically
filter.addToAndFilter({ status: 'PUBLISHED' });

if (userPreferences.verified) {
  filter.addToAndFilter({ isVerified: true });
}

if (priceRange) {
  filter.addToAndFilter({
    price: {
      minimum: priceRange.min,
      maximum: priceRange.max
    }
  });
}

filter.addToLikeFilter({ title: searchTerm });

const results = await db('services').search(query, {
  filters: filter,
  limit: 20
});
```

### Pattern 4: Geo-Spatial Search

```typescript
const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED',
    rating: { minimum: 4.0 }
  }
});

filter.setGeoLocation(40.7128, -74.0060); // NYC coordinates

const results = await db('services').search('emergency plumber', {
  filters: filter,
  geo: {
    center: { lat: 40.7128, lng: -74.0060 },
    radius: 10, // 10km radius
    sortByDistance: true
  },
  limit: 15
});
```

### Pattern 5: API Request Integration

```typescript
// Express/NestJS endpoint
async function searchServices(req, res) {
  const db = await getDB();

  // Parse SearchFilterModel from request
  const filter = SearchFilterModel.fromJson(req.body.filters || {});
  const query = req.body.query || '';

  const results = await db('services').search(query, {
    filters: filter,
    limit: filter.limit || 20,
    offset: filter.skip || 0,
    highlightFields: ['title', 'description']
  });

  res.json({
    results: results.map(r => ({
      ...r.data,
      _score: r.score,
      _highlights: r.highlights
    })),
    metadata: {
      total: results.length,
      page: filter.page,
      limit: filter.limit
    }
  });
}
```

## Advanced Features

### Range Queries

Support for numeric and date ranges:

```typescript
const filter = new SearchFilterModel({
  andFilter: {
    // Numeric range
    price: { minimum: 50, maximum: 500 },

    // Date range
    createdOn: {
      minimum: new Date('2024-01-01'),
      maximum: new Date('2024-12-31')
    },

    // Minimum only
    rating: { minimum: 4.0 }
  }
});
```

### TypeORM Like Operator Support

The system detects and handles TypeORM `Like` and `Between` operators:

```typescript
import { Like, Between } from 'typeorm';

const filter = new SearchFilterModel({
  andFilter: {
    title: Like('%repair%'),
    price: Between(100, 500)
  }
});
```

### Field Selection

Return only specific fields to optimize performance:

```typescript
const filter = new SearchFilterModel({
  selectFields: ['id', 'title', 'price', 'rating'],
  andFilter: {
    status: 'PUBLISHED'
  }
});

const results = await db('services').search('plumbing', {
  filters: filter,
  fields: filter.selectFields
});
```

### Pagination

Built-in pagination support:

```typescript
const filter = new SearchFilterModel({
  page: 2,       // 0-indexed
  limit: 20,
  andFilter: {
    status: 'PUBLISHED'
  }
});

// skip is auto-calculated: page * limit
const results = await db('services').search('repair', {
  filters: filter,
  limit: filter.limit,
  offset: filter.skip  // 40 (page 2 * limit 20)
});
```

## Helper Methods

### `addToAndFilter(filterJson, override?)`

Add exact match conditions:

```typescript
const filter = new SearchFilterModel();
filter.addToAndFilter({ status: 'PUBLISHED' });
filter.addToAndFilter({ isActive: true }, false); // Don't override existing
```

### `addToLikeFilter(filterJson, override?)`

Add partial match conditions:

```typescript
filter.addToLikeFilter({ title: 'repair' });
filter.addToLikeFilter({ description: 'emergency' });
```

### `setGeoLocation(lat, long)`

Set geo-coordinates for location-based search:

```typescript
filter.setGeoLocation(40.7128, -74.0060);
// Adds to andFilter: { latitude: 40.7128, longitude: -74.0060 }
```

### `transferAllToAndFilter()`

Convert all LIKE filters to AND filters (with Like operators):

```typescript
const filter = new SearchFilterModel({
  likeFilter: { title: 'repair', description: 'emergency' }
});

filter.transferAllToAndFilter();
// Moves to andFilter with Like() operators
```

### `buildWhereClause(defaultStatus?)`

Manually rebuild the WHERE clause:

```typescript
filter.buildWhereClause('PUBLISHED');
// Rebuilds builtWhereClause with default status if not in wildcard mode
```

## Search Options

In addition to filters, the `search()` method accepts:

| Option | Type | Description |
|--------|------|-------------|
| `fields` | `string[]` | Fields to search within |
| `limit` | `number` | Max results (default: 10) |
| `offset` | `number` | Skip N results |
| `minScore` | `number` | Minimum relevance score |
| `highlightFields` | `string[]` | Fields to highlight matches |
| `ranking` | `object` | Custom ranking configuration |
| `geo` | `GeoOptions` | Geo-spatial search options |

## Best Practices

### 1. Use Appropriate Filter Types

- **andFilter**: For exact matches and ranges
- **likeFilter**: For partial text matching
- **orFilter**: For multiple alternative conditions

### 2. Combine Text Search with Filters

```typescript
// Good: Let text search find candidates, filters narrow them down
const results = await db('services').search('emergency repair', {
  filters: {
    andFilter: { status: 'PUBLISHED', rating: { minimum: 4.0 } }
  }
});

// Avoid: Over-filtering before text search
```

### 3. Use Field Selection for Performance

```typescript
// Return only needed fields
const filter = new SearchFilterModel({
  selectFields: ['id', 'title', 'price']
});
```

### 4. Set Minimum Score for Quality

```typescript
const results = await db('services').search(query, {
  filters: filter,
  minScore: 0.5  // Only return good matches
});
```

### 5. Use Highlighting for UX

```typescript
const results = await db('services').search(query, {
  filters: filter,
  highlightFields: ['title', 'description']
});

// Access highlights: results[0].highlights.title
```

## Examples

See [search-with-filters-example.ts](./admin-ui/lib/examples/search-with-filters-example.ts) for comprehensive examples including:

- Basic text search with exact filters
- LIKE filters for partial matching
- Range queries for prices and dates
- OR conditions for multiple categories
- Complex multi-condition searches
- Wildcard searches across fields
- Geo-spatial search with filters
- Pagination patterns
- Dynamic filter building
- API request integration

## Migration Guide

If you're upgrading from simple filters:

### Before
```typescript
const results = await db('services').search('plumbing', {
  filters: {
    status: 'PUBLISHED',
    categoryId: 'cat-123'
  }
});
```

### After (Enhanced)
```typescript
const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED',
    categoryId: 'cat-123',
    price: { minimum: 100, maximum: 500 }
  },
  likeFilter: {
    tags: 'emergency'
  }
});

const results = await db('services').search('plumbing', {
  filters: filter,
  highlightFields: ['title', 'description']
});
```

## TypeScript Support

Full TypeScript support with proper typing:

```typescript
interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  status: string;
}

const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED' as const
  }
});

const results = await db('services').search<Service>('repair', {
  filters: filter
});

// results is typed as SearchResult<Service>[]
```

## Performance Considerations

1. **Inverted Index First**: Text search uses Redis inverted index for fast ID retrieval
2. **SQL Filtering Second**: Database filters applied on pre-filtered IDs
3. **Caching**: Results are cached when enabled
4. **Limit Results**: Use appropriate `limit` values to avoid large result sets

## Summary

The integration provides:

✅ **Full SearchFilterModel support** - All attributes work seamlessly
✅ **Backward compatible** - Simple key-value filters still work
✅ **Type-safe** - Proper TypeScript typing throughout
✅ **Flexible** - Mix and match any filter types
✅ **Performant** - Optimized SQL generation
✅ **Feature-rich** - Geo-search, highlighting, pagination built-in

You can now use your existing `SearchFilterModel` class with all its features directly in the search method!
