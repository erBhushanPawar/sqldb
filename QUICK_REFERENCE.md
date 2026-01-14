# Quick Reference: SearchFilterModel + SqlDB Search

## Basic Usage

```typescript
import { SearchFilterModel } from './types';
import { getDB } from './db';

const filter = new SearchFilterModel({
  andFilter: { status: 'PUBLISHED' }
});

const db = await getDB();
const results = await db('services').search('plumbing', {
  filters: filter,
  limit: 20
});
```

## Filter Types Cheatsheet

### 1. Exact Match (AND)
```typescript
andFilter: {
  status: 'PUBLISHED',
  isActive: true,
  categoryId: 'cat-123'
}
```

### 2. Partial Match (LIKE)
```typescript
likeFilter: {
  title: 'repair',      // Matches: "repair", "repairs", "repairing"
  location: 'New York'  // Matches: "New York", "New York City"
}
```

### 3. Multiple Options (OR)
```typescript
orFilter: [
  { category: 'plumbing' },
  { category: 'electrical' },
  { category: 'hvac' }
]
```

### 4. Range Queries
```typescript
andFilter: {
  price: {
    minimum: 50,
    maximum: 500
  },
  rating: {
    minimum: 4.0  // >= 4.0 only
  }
}
```

## Common Patterns

### Pattern: Multi-Condition Search
```typescript
const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED',
    isVerified: true,
    price: { minimum: 100, maximum: 1000 }
  },
  likeFilter: {
    providerName: 'Pro'
  },
  orFilter: [
    { urgency: 'emergency' },
    { priority: 'high' }
  ]
});

const results = await db('services').search('installation', {
  filters: filter,
  limit: 25,
  highlightFields: ['title', 'description']
});
```

### Pattern: Dynamic Filters
```typescript
const filter = new SearchFilterModel();

filter.addToAndFilter({ status: 'PUBLISHED' });
filter.addToLikeFilter({ title: 'repair' });

if (priceRange) {
  filter.addToAndFilter({
    price: { minimum: priceRange.min, maximum: priceRange.max }
  });
}

const results = await db('services').search(query, { filters: filter });
```

### Pattern: Geo-Search (3 Ways)

**Method 1: Using setGeoLocation (Automatic)**
```typescript
const filter = new SearchFilterModel({
  andFilter: { status: 'PUBLISHED' }
});

filter.setGeoLocation(40.7128, -74.0060); // Adds to andFilter

// Auto-detects geo coordinates and enables geo-search
const results = await db('services').search('emergency', {
  filters: filter,
  limit: 20
});
// Distance automatically included in results
```

**Method 2: Coordinates in andFilter (Automatic)**
```typescript
const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED',
    latitude: 40.7128,   // Auto-detected
    longitude: -74.0060  // Auto-detected
  }
});

const results = await db('services').search('emergency', {
  filters: filter
});
```

**Method 3: Manual geo options (Full Control)**
```typescript
const filter = new SearchFilterModel({
  andFilter: { status: 'PUBLISHED' }
});

const results = await db('services').search('emergency', {
  filters: filter,
  geo: {
    center: { lat: 40.7128, lng: -74.0060 },
    radius: 10,           // 10km radius
    maxRange: 50,         // Expand up to 50km if needed
    minResults: 10,       // Try to get 10 results
    sortByDistance: true,
    priority: 'geo-first' // Prioritize location
  }
});
```

### Pattern: Pagination
```typescript
const filter = new SearchFilterModel({
  page: 2,
  limit: 20,
  andFilter: { status: 'PUBLISHED' }
});

const results = await db('services').search(query, {
  filters: filter,
  limit: filter.limit,
  offset: filter.skip  // auto-calculated
});
```

## Search Options

```typescript
await db('table').search('query', {
  filters: searchFilterModel,      // Your SearchFilterModel
  limit: 20,                        // Max results
  offset: 0,                        // Skip N results
  minScore: 0.5,                    // Min relevance (0-1)
  highlightFields: ['title'],       // Fields to highlight
  fields: ['title', 'description'], // Fields to search
  geo: {                            // Geo-spatial options
    center: { lat: X, lng: Y },     // Search center
    radius: 10,                     // Radius in km (default)
    maxRange: 50,                   // Max radius to expand
    minResults: 10,                 // Min results to return
    sortByDistance: true,           // Sort by distance
    includeDistance: true,          // Include distance in results
    locationName: 'New York',       // Search by location name
    bucketId: 'bucket-123',         // Search in geo-bucket
    priority: 'geo-first',          // 'geo-first' or 'text-first'
    unit: 'km'                      // 'km' or 'mi'
  }
});
```

## Helper Methods

```typescript
// Add exact match
filter.addToAndFilter({ status: 'PUBLISHED' });

// Add partial match
filter.addToLikeFilter({ title: 'repair' });

// Set geo location
filter.setGeoLocation(lat, lng);

// Transfer LIKE → AND
filter.transferAllToAndFilter();

// Rebuild WHERE clause
filter.buildWhereClause('PUBLISHED');
```

## Complete Example

```typescript
const filter = new SearchFilterModel({
  // Exact matches
  andFilter: {
    status: 'PUBLISHED',
    isActive: true,
    price: { minimum: 50, maximum: 500 },
    rating: { minimum: 4.0 }
  },

  // Partial matches
  likeFilter: {
    title: 'repair',
    tags: 'certified'
  },

  // Multiple options
  orFilter: [
    { category: 'plumbing' },
    { category: 'electrical' }
  ],

  // Pagination
  page: 0,
  limit: 20,
  orderBy: 'createdOn',
  order: 'DESC',

  // Field selection
  selectFields: ['id', 'title', 'price', 'rating']
});

const db = await getDB();
const results = await db('services').search('emergency plumber', {
  filters: filter,
  limit: filter.limit,
  offset: filter.skip,
  minScore: 0.5,
  highlightFields: ['title', 'description'],
  geo: {
    center: { lat: 40.7128, lng: -74.0060 },
    radius: 25,
    sortByDistance: true
  }
});

// Process results
results.forEach(result => {
  console.log('Score:', result.score);
  console.log('Data:', result.data);
  console.log('Highlights:', result.highlights);
  console.log('Distance:', result.distance); // if geo-search
});
```

## API Integration

```typescript
// Express/NestJS endpoint
async function searchEndpoint(req, res) {
  const db = await getDB();

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

## Filter Combination Rules

✅ **All filters work together**
- `andFilter` + `likeFilter` + `orFilter` = Combined with AND
- Text search IDs + Filters = Intersection

✅ **Priority Order**
1. Text search (inverted index) → Returns candidate IDs
2. SQL filters applied → Narrows down results
3. Scoring → Ranks by relevance

✅ **Backwards Compatible**
- Simple key-value filters still work
- `{ status: 'PUBLISHED' }` → Treated as `andFilter`

## Tips

💡 Use `andFilter` for exact values and ranges
💡 Use `likeFilter` for fuzzy text matching
💡 Use `orFilter` for alternative conditions
💡 Combine all three for powerful searches
💡 Set `minScore` to filter low-quality matches
💡 Use `highlightFields` to show context
💡 Enable geo-search for location-based results
💡 Select specific fields for better performance

## Full Documentation

See [SEARCH_FILTER_INTEGRATION.md](./SEARCH_FILTER_INTEGRATION.md) for:
- Detailed explanations
- Advanced patterns
- Performance tips
- Complete examples
