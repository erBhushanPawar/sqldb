# Geo-Clustering Implementation Guide

## Overview

The current issue: **"Total Locations: 1"** on the map indicates that geo-clustering is not properly implemented in the core SqlDB library. The admin UI has been updated to support geo-clustering, but the underlying database methods need to be added.

## What Needs to Be Implemented

### 1. Core SqlDB Methods

Add these methods to your `TableOperations` class in the core SqlDB library:

#### `buildGeoBuckets(options)`

```typescript
interface GeoBucketOptions {
  targetBucketSize: number;     // Target number of items per bucket (e.g., 5)
  gridSizeKm: number;            // Grid size in kilometers (e.g., 10)
  minBucketSize: number;         // Minimum items to form a bucket (e.g., 3)
}

interface GeoBucket {
  id: string;                    // Unique bucket identifier
  center: { lat: number; lng: number }; // Geographic center
  count: number;                 // Number of items in bucket
  locationName?: string;         // Primary location name (e.g., "Mumbai")
  bounds: {                      // Bounding box
    north: number;
    south: number;
    east: number;
    west: number;
  };
  memberIds: string[];           // IDs of documents in this bucket
}

async buildGeoBuckets(options: GeoBucketOptions): Promise<{
  totalBuckets: number;
  buckets: GeoBucket[];
  avgBucketSize: number;
}>;
```

**Implementation Strategy:**

1. **Fetch all geo-located documents** from the table
2. **Grid-based clustering:**
   - Divide geographic space into a grid (e.g., 10km x 10km cells)
   - Group nearby points into the same cell
   - Merge adjacent cells if they're below `minBucketSize`
   - Split cells if they're much larger than `targetBucketSize`

3. **Store buckets in Redis:**
   ```
   Key pattern: search:geo:buckets:{tableName}:{bucketId}
   Value: JSON with bucket metadata + member IDs

   Index key: search:geo:buckets:{tableName}:index
   Value: Sorted set of bucket IDs by size
   ```

4. **Use Redis GEOADD for spatial indexing:**
   ```
   Key: search:geo:buckets:{tableName}:spatial
   Members: bucket IDs with their center coordinates
   ```

#### `getGeoBuckets()`

```typescript
async getGeoBuckets(): Promise<GeoBucket[]>;
```

Retrieves all pre-computed geo-buckets for the table from Redis.

#### Update `search()` method

Modify the existing `search()` method to handle bucket-based queries:

```typescript
interface GeoSearchOptions {
  // Existing options
  center?: { lat: number; lng: number };
  radius?: { value: number; unit: 'km' | 'mi' | 'm' };
  locationName?: string;

  // NEW: Bucket-based search
  bucketId?: string;

  // NEW: Priority mode
  priority?: 'geo-first' | 'text-first' | 'balanced';

  includeDistance?: boolean;
  sortByDistance?: boolean;
}
```

**Search flow with buckets:**

1. **If `bucketId` provided:**
   - Fetch bucket metadata from Redis
   - Get all member IDs from the bucket
   - Perform text search ONLY on those documents
   - Much faster than radius search!

2. **Priority modes:**
   - `geo-first`: Filter by location first, then rank by text relevance
   - `text-first`: Rank by text relevance first, then filter by location
   - `balanced`: Combine scores (e.g., 0.6 * textScore + 0.4 * proximityScore)

### 2. Clustering Algorithm

Here's a recommended algorithm for creating clusters with target size ~5:

```typescript
async function buildGeoBuckets(
  tableName: string,
  config: GeoConfig,
  options: GeoBucketOptions
): Promise<GeoBucket[]> {
  // 1. Fetch all documents with valid coordinates
  const records = await fetchAllGeoRecords(tableName, config);

  // 2. Create grid-based initial clusters
  const gridSize = options.gridSizeKm / 111; // Convert km to degrees (approx)
  const grid: Map<string, GeoRecord[]> = new Map();

  for (const record of records) {
    const lat = record[config.latitudeField];
    const lng = record[config.longitudeField];

    // Assign to grid cell
    const cellLat = Math.floor(lat / gridSize) * gridSize;
    const cellLng = Math.floor(lng / gridSize) * gridSize;
    const cellKey = `${cellLat},${cellLng}`;

    if (!grid.has(cellKey)) {
      grid.set(cellKey, []);
    }
    grid.get(cellKey)!.push(record);
  }

  // 3. Process grid cells into buckets
  const buckets: GeoBucket[] = [];

  for (const [cellKey, cellRecords] of grid.entries()) {
    if (cellRecords.length < options.minBucketSize) {
      // Try to merge with adjacent cells
      // ... merging logic ...
      continue;
    }

    if (cellRecords.length > options.targetBucketSize * 3) {
      // Cell too large, subdivide using k-means clustering
      const subClusters = kMeansClustering(
        cellRecords,
        Math.ceil(cellRecords.length / options.targetBucketSize)
      );

      for (const cluster of subClusters) {
        buckets.push(createBucket(cluster, config));
      }
    } else {
      // Cell size is reasonable, create bucket
      buckets.push(createBucket(cellRecords, config));
    }
  }

  // 4. Store buckets in Redis
  await storeBucketsInRedis(tableName, buckets);

  return buckets;
}

function createBucket(records: GeoRecord[], config: GeoConfig): GeoBucket {
  // Calculate center (centroid)
  const center = calculateCentroid(records, config);

  // Calculate bounds
  const bounds = calculateBounds(records, config);

  // Get primary location name (most common)
  const locationCounts: Record<string, number> = {};
  for (const record of records) {
    const loc = record[config.locationNameField || ''];
    if (loc) {
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    }
  }
  const locationName = Object.keys(locationCounts)
    .sort((a, b) => locationCounts[b] - locationCounts[a])[0];

  return {
    id: generateBucketId(),
    center,
    count: records.length,
    locationName,
    bounds,
    memberIds: records.map(r => r.id),
  };
}

function kMeansClustering(
  records: GeoRecord[],
  k: number
): GeoRecord[][] {
  // Standard k-means clustering on lat/lng coordinates
  // ... implementation ...
}
```

### 3. Search with Clusters

Update the search flow to leverage buckets:

```typescript
async function searchWithGeoBuckets(
  query: string,
  options: GeoSearchOptions
): Promise<SearchResult[]> {
  if (options.geo?.bucketId) {
    // Bucket-based search (FAST)
    const bucket = await redis.get(`search:geo:buckets:${tableName}:${options.geo.bucketId}`);
    const bucketData = JSON.parse(bucket);

    // Filter documents by bucket member IDs
    const memberIds = new Set(bucketData.memberIds);

    // Perform text search only on bucket members
    const textResults = await invertedIndex.search(query, {
      ...options,
      filterIds: memberIds,  // NEW: Only search these document IDs
    });

    return textResults;
  } else if (options.geo?.locationName) {
    // Location name search
    // Find all buckets matching this location
    const matchingBuckets = await findBucketsByLocation(options.geo.locationName);
    const memberIds = matchingBuckets.flatMap(b => b.memberIds);

    // Search within those bucket members
    return await invertedIndex.search(query, {
      ...options,
      filterIds: new Set(memberIds),
    });
  } else {
    // Coordinate + radius search (slower, but precise)
    return await existingRadiusSearch(query, options);
  }
}
```

## Why Clusters Matter

### Performance Comparison

**Without Clusters (Current):**
- Search query: "bus" near "nashik"
- Must check distance for ALL 3,268 documents
- Time: ~50-100ms for 3,000+ documents

**With Clusters (Target: 5 items/cluster):**
- Pre-computed: ~650 clusters (3,268 / 5)
- Search query: "bus" in Nashik cluster
- Only checks ~5-10 documents (1-2 clusters for Nashik)
- Time: ~5-10ms
- **10x faster!**

### Storage Efficiency

**Bucket metadata (per cluster):**
```json
{
  "id": "bucket_mumbai_west_01",
  "center": { "lat": 19.0760, "lng": 72.8777 },
  "count": 5,
  "locationName": "Mumbai",
  "bounds": { "north": 19.08, "south": 19.07, "east": 72.88, "west": 72.87 },
  "memberIds": ["srv_123", "srv_456", "srv_789", "srv_012", "srv_345"]
}
```

- ~200 bytes per bucket
- 650 buckets = ~130 KB total
- Negligible Redis memory overhead

## Implementation Steps

### Step 1: Add Core Methods to SqlDB

In `src/search/geo-search.ts` (or wherever your geo-search logic lives):

```typescript
export class GeoSearchManager {
  // ... existing methods ...

  async buildGeoBuckets(
    tableName: string,
    options: GeoBucketOptions
  ): Promise<GeoBucketResult> {
    // Implementation as described above
  }

  async getGeoBuckets(tableName: string): Promise<GeoBucket[]> {
    const bucketKeys = await this.redis.keys(
      `search:geo:buckets:${tableName}:*`
    );
    const buckets = await Promise.all(
      bucketKeys.map(key => this.redis.get(key))
    );
    return buckets.map(b => JSON.parse(b!)).filter(Boolean);
  }

  async searchByBucket(
    tableName: string,
    query: string,
    bucketId: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    // Implementation as described above
  }
}
```

### Step 2: Expose Methods in TableOperations

```typescript
export class TableOperations {
  // ... existing methods ...

  async buildGeoBuckets(options?: GeoBucketOptions) {
    if (!this.geoSearchManager) {
      throw new Error('Geo-search is not enabled for this table');
    }

    return await this.geoSearchManager.buildGeoBuckets(
      this.tableName,
      options || { targetBucketSize: 5, gridSizeKm: 10, minBucketSize: 3 }
    );
  }

  async getGeoBuckets() {
    if (!this.geoSearchManager) {
      throw new Error('Geo-search is not enabled for this table');
    }

    return await this.geoSearchManager.getGeoBuckets(this.tableName);
  }
}
```

### Step 3: Update Search Method

Modify the existing `search()` method to check for `options.geo.bucketId` and route to bucket-based search if provided.

### Step 4: Test

```typescript
// Build clusters
const result = await db('services').buildGeoBuckets({
  targetBucketSize: 5,
  gridSizeKm: 10,
  minBucketSize: 3,
});

console.log(`Created ${result.totalBuckets} buckets`);
// Expected: ~650 buckets for 3,268 documents

// Get buckets
const buckets = await db('services').getGeoBuckets();
console.log(`Retrieved ${buckets.length} buckets`);

// Search by bucket
const results = await db('services').search('bus', {
  geo: {
    bucketId: 'bucket_nashik_01',
  },
});
console.log(`Found ${results.length} results in Nashik cluster`);
```

## Alternative: Quick Fix for Map Visualization

If you want the map to show all locations immediately without implementing full clustering:

### Update the geo API endpoint

Modify [/api/search/[table]/geo/route.ts](../admin-ui/app/api/search/[table]/geo/route.ts):

```typescript
// Instead of treating each document as 1 location,
// group by actual lat/lng coordinates
const locationMap = new Map<string, GeoRecord[]>();

records.forEach((record: any) => {
  const lat = parseFloat(record[latField]);
  const lng = parseFloat(record[lngField]);

  // Round to 4 decimal places (~11m precision)
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  if (!locationMap.has(key)) {
    locationMap.set(key, []);
  }
  locationMap.get(key)!.push(record);
});

// Now each unique coordinate gets counted
const totalLocations = locationMap.size;
```

This will fix the "Total Locations: 1" issue and show accurate clustering on the map.

## Summary

**Current State:**
- ✅ Admin UI supports clustering
- ✅ API endpoints ready
- ❌ Core SqlDB methods not implemented
- ❌ Map shows "Total Locations: 1"

**Next Steps:**
1. Implement `buildGeoBuckets()` in core SqlDB
2. Implement `getGeoBuckets()` in core SqlDB
3. Update `search()` to support bucket-based queries
4. Test with your 3,268 services
5. Build clusters: `db('services').buildGeoBuckets({ targetBucketSize: 5 })`
6. Verify map shows ~650 clusters

**Expected Result:**
- Map shows proper clustering with density visualization
- Search by cluster is 10x faster
- Better user experience with pre-defined service areas
