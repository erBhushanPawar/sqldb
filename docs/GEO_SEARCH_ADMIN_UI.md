# Geo-Search & Enhanced Admin UI Features

This document describes the new geo-search capabilities and enhanced visualizations added to the SqlDB admin interface.

## Overview

The admin UI now includes:

1. **Geo-Location Search** - Search for records within a geographic radius
2. **Index Statistics Dashboard** - View pre-processed indexed terms and statistics
3. **Results Distribution Chart** - Visual representation of search result quality
4. **Distance-Based Results** - Shows distance from search center for geo-queries

---

## 1. Geo-Location Search

### Features

- **Location Name Search**: Enter city names like "NYC", "San Francisco", "Los Angeles"
  - Automatic normalization handles variations (e.g., "NYC" → "New York City")
  - Pre-defined aliases for major US and international cities
  - Fuzzy matching for misspellings

- **Coordinate-Based Search**: Use latitude/longitude coordinates
  - Manual entry of coordinates
  - "Get Current Location" button uses browser geolocation API
  - Configurable search radius (km, mi, or m)

- **Combined Text + Geo Search**: Find "pizza near me" type queries
  - Full-text search combined with geographic filtering
  - Distance-based relevance boosting
  - Results sorted by distance

### UI Components

#### Toggle Switch
```tsx
// Enable/disable geo-search with a simple toggle
<Switch checked={geoEnabled} onCheckedChange={setGeoEnabled} />
```

#### Location Name Input
```tsx
<Input
  placeholder="Enter city or location name"
  value={locationName}
  onChange={(e) => setLocationName(e.target.value)}
/>
```

#### Coordinate Inputs
```tsx
<Input
  type="number"
  placeholder="40.7128"  // Latitude
  value={latitude}
/>
<Input
  type="number"
  placeholder="-74.0060"  // Longitude
  value={longitude}
/>
```

#### Radius Configuration
```tsx
<Input type="number" value={radius} />
<Select value={radiusUnit}>
  <SelectItem value="km">km</SelectItem>
  <SelectItem value="mi">mi</SelectItem>
  <SelectItem value="m">m</SelectItem>
</Select>
```

### API Integration

**GET /api/search/[table]** - Enhanced with geo parameters:

```typescript
// Query parameters
{
  q: string,              // Search query
  geoEnabled: 'true',     // Enable geo-search

  // Option 1: Location name
  locationName: string,   // e.g., "NYC", "San Francisco"
  radius: number,
  radiusUnit: 'km' | 'mi' | 'm',

  // Option 2: Coordinates
  lat: number,
  lng: number,
  radius: number,
  radiusUnit: 'km' | 'mi' | 'm',

  // Option 3: Bucket ID
  bucketId: string,       // Pre-defined geographic bucket
}
```

**Response includes distance**:
```json
{
  "success": true,
  "results": [
    {
      "id": 1,
      "title": "Pizza Shop",
      "_score": 0.95,
      "distance": {
        "value": 2.34,
        "unit": "km"
      }
    }
  ]
}
```

---

## 2. Index Statistics Dashboard

### Features

Shows pre-processed index information:

- **Total Documents**: Number of indexed records
- **Unique Terms**: Count of distinct search terms extracted
- **Total Tokens**: All tokens including duplicates (shows tokenization depth)
- **Memory Usage**: Estimated memory footprint in MB
- **Indexed Fields**: List of searchable fields with visual badges
- **Build Time**: Index build duration and timestamp
- **Geo-Search Stats** (if enabled):
  - Total geo-indexed documents
  - Normalized location count
  - Bucket distribution

### UI Display

```tsx
<Card className="bg-muted/50">
  <CardHeader>
    <CardTitle>Index Statistics</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <p className="text-xs text-muted-foreground">Documents</p>
        <p className="text-2xl font-bold">{totalDocuments}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Unique Terms</p>
        <p className="text-2xl font-bold">{totalTerms}</p>
      </div>
      {/* ... more stats ... */}
    </div>
  </CardContent>
</Card>
```

### API Endpoint

**GET /api/search/[table]/stats**

```json
{
  "success": true,
  "table": "services",
  "stats": {
    "totalDocuments": 1523,
    "totalTerms": 4567,
    "totalTokens": 12345,
    "lastBuildTime": "2026-01-11T14:35:34.196Z",
    "buildDurationMs": 234,
    "memoryUsageMB": "2.45",
    "fields": ["title", "description", "category"],
    "geo": {
      "totalDocuments": 1523,
      "bucketCounts": {
        "nyc": 345,
        "la": 289,
        "sf": 198
      },
      "normalizedLocations": 42,
      "indexSize": 524288
    }
  }
}
```

### Automatic Updates

- Stats automatically fetch when table is selected
- Stats refresh after building/rebuilding index
- Toggle "Show/Hide Stats" button to control visibility

---

## 3. Results Distribution Chart

### Features

Visual representation of search result quality:

- **Excellent (80-100%)**: Green bar - High relevance matches
- **Good (50-79%)**: Yellow bar - Moderate relevance matches
- **Fair (0-49%)**: Orange bar - Low relevance matches

Shows:
- Count of results in each range
- Percentage of total results
- Animated progress bars

### Implementation

```tsx
const ranges = [
  { label: 'Excellent (80-100%)', min: 0.8, max: 1, color: 'bg-green-500' },
  { label: 'Good (50-79%)', min: 0.5, max: 0.8, color: 'bg-yellow-500' },
  { label: 'Fair (0-49%)', min: 0, max: 0.5, color: 'bg-orange-500' },
];

ranges.map((range) => {
  const count = results.filter(
    (r) => r._score >= range.min && r._score < range.max
  ).length;
  const percentage = (count / results.length) * 100;

  return (
    <div>
      <span>{count} ({percentage.toFixed(0)}%)</span>
      <div className="w-full bg-secondary rounded-full h-2">
        <div
          className={`${range.color} h-full`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
});
```

### Benefits

- **Quick Quality Assessment**: Instantly see if search results are relevant
- **Index Tuning**: Helps identify when to rebuild or adjust search configuration
- **User Feedback**: Shows users the confidence level of results

---

## 4. Distance Display in Results

### Features

When geo-search is enabled, each result shows:

- **Distance Badge**: Shows distance from search center
- **MapPin Icon**: Visual indicator for geographic results
- **Unit Display**: km, mi, or m based on search configuration

### UI Display

```tsx
<Badge variant="outline" className="flex items-center gap-1">
  <MapPin className="h-3 w-3" />
  {distance.value.toFixed(2)} {distance.unit}
</Badge>
```

### Result Card Layout

```
┌─────────────────────────────────────────────┐
│ Title: Pizza Shop                      85% │  <- Relevance Score
│ Description: Best pizza in town    🗺 2.3km│  <- Distance Badge
│ Category: Restaurant                        │
└─────────────────────────────────────────────┘
```

---

## Usage Examples

### Example 1: Find Services Near Current Location

1. Select table: `services`
2. Enable "Geo-Location Search" toggle
3. Click "Get Current Location" button
4. Set radius: `5` km
5. Enter search query: `plumber`
6. Click "Search"

**Result**: Shows plumbers within 5km, sorted by distance

---

### Example 2: Search by City Name

1. Select table: `restaurants`
2. Enable "Geo-Location Search" toggle
3. Enter location name: `NYC` (or "New York City", "Manhattan")
4. Set radius: `10` km
5. Enter search query: `italian`
6. Click "Search"

**Result**: Italian restaurants in NYC area

---

### Example 3: View Index Statistics

1. Select table: `services`
2. Click "Show Stats" button
3. View:
   - Total documents indexed
   - Unique search terms extracted
   - Memory usage
   - Indexed fields
   - Build time and date

---

## Technical Details

### Pre-Processing (Indexing)

When you click "Build Index":

1. **Tokenization**: Text is split into tokens (words)
   - Simple: Split by whitespace
   - Stemming: Reduces words to root form (running → run)
   - N-gram: Creates character sequences for fuzzy matching

2. **Stop Words Removal**: Common words removed (the, a, an, etc.)

3. **Inverted Index Creation**: Maps terms to documents
   ```
   term -> [doc1, doc2, doc3]
   "pizza" -> [15, 42, 89, 123]
   ```

4. **TF-IDF Calculation**: Term frequency × inverse document frequency
   - Ranks how important a term is to a document

5. **Geo-Indexing** (if enabled):
   - Stores lat/lng coordinates in Redis
   - Creates geographic buckets for regional queries
   - Normalizes location names to canonical forms

### Search Process

1. **Query Tokenization**: User query split into tokens
2. **Index Lookup**: Find documents containing tokens
3. **Score Calculation**: TF-IDF + field boosts + proximity
4. **Geo-Filtering** (if enabled): Filter by distance
5. **Distance Boosting**: Closer results ranked higher
6. **Result Sorting**: By relevance score or distance
7. **Highlighting**: Match terms highlighted in results

---

## Configuration

### Search Configuration in Code

```typescript
// In your SqlDB initialization
search: {
  enabled: true,
  invertedIndex: {
    enabled: true,
    tables: {
      services: {
        searchableFields: ['title', 'description', 'category'],
        tokenizer: 'stemming',
        minWordLength: 3,
        fieldBoosts: {
          title: 3.0,         // Title matches are most important
          category: 2.0,
          description: 1.0,
        },

        // Geo-search configuration
        geo: {
          enabled: true,
          latitudeField: 'latitude',
          longitudeField: 'longitude',
          locationNameField: 'city',
          autoNormalize: true,
          defaultRadius: { value: 25, unit: 'km' },
          maxRadius: { value: 500, unit: 'km' },
          combineWithTextSearch: true,
        },
      },
    },
  },
}
```

---

## Performance Considerations

### Index Building
- Initial index build can take time for large tables (e.g., 10k records ~1-2 seconds)
- Index is stored in Redis for fast retrieval
- Memory usage grows with document count and unique terms
- Rebuild periodically when data changes significantly

### Search Performance
- Index searches are fast (typically <50ms)
- Geo-searches use Redis GEORADIUS (very efficient)
- Combining text + geo search adds minimal overhead
- Result count affects scoring time (limit results for faster queries)

### Best Practices
1. **Index Management**:
   - Build index after bulk data imports
   - Clear and rebuild if index becomes stale
   - Use `rebuildOnWrite: false` for manual control

2. **Geo-Search**:
   - Use appropriate radius (smaller = faster)
   - Use buckets for regional queries
   - Combine with text search for best results

3. **Query Optimization**:
   - Use field filtering to search specific fields
   - Adjust minScore to filter low-relevance results
   - Limit results to needed amount (default: 10)

---

## Browser Compatibility

- **Geolocation API**: Requires HTTPS in production
- **All other features**: Work in all modern browsers
- **Mobile Support**: Responsive design, works on mobile devices

---

## Future Enhancements

Potential additions:

- [ ] Interactive map view of results
- [ ] Heatmap of result distribution
- [ ] Advanced geo-filters (polygons, bounding boxes)
- [ ] Real-time search suggestions with geo-awareness
- [ ] Multi-location search (find across multiple cities)
- [ ] Geo-faceting (group results by region)
- [ ] Distance-based pagination

---

## Files Modified/Created

### Created Files:
1. `/admin-ui/app/api/search/[table]/stats/route.ts` - Index stats API
2. `/admin-ui/components/ui/switch.tsx` - Toggle component
3. `/docs/GEO_SEARCH_ADMIN_UI.md` - This documentation

### Modified Files:
1. `/admin-ui/app/api/search/[table]/route.ts` - Added GET endpoint with geo params
2. `/admin-ui/components/features/search.tsx` - Enhanced UI with all new features

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/anthropics/sqldb/issues
- Documentation: /docs/ADMIN_UI_GUIDE.md
- Examples: /examples/geo-search-example.ts
