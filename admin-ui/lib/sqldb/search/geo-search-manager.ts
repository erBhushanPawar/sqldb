/**
 * Geographic search manager - combines text search with geospatial capabilities
 */

import { RedisConnectionManager } from '../connection/redis';
import {
  GeoPoint,
  GeoDistance,
  GeoSearchOptions,
  GeoSearchResult,
  GeoSearchTableConfig,
  GeoBucket,
  GeoBounds,
  GeoIndexStats,
  MAJOR_CITY_BUCKETS,
} from '../types/geo-search';
import {
  calculateDistance,
  isWithinRadius,
  calculateBounds,
  findBucket,
  isValidCoordinates,
  calculateCenterPoint,
  calculateBoundingBox,
} from './geo-utils';
import { LocationNormalizer, US_CITY_ALIASES, INTERNATIONAL_CITY_ALIASES } from './location-normalizer';

export interface GeoIndexedDocument {
  id: string | number;
  location: GeoPoint;
  data: any;
  locationName?: string;
  bucketId?: string;
}

export class GeoSearchManager {
  private redis: RedisConnectionManager;
  private tableName: string;
  private config: GeoSearchTableConfig;
  private locationNormalizer: LocationNormalizer;
  private indexKeyPrefix: string;

  constructor(
    redis: RedisConnectionManager,
    tableName: string,
    config: GeoSearchTableConfig
  ) {
    this.redis = redis;
    this.tableName = tableName;
    this.config = config;
    this.indexKeyPrefix = `geo:${tableName}`;

    // Initialize location normalizer with buckets and mappings
    const buckets = config.buckets || MAJOR_CITY_BUCKETS;
    const mappings = [
      ...(config.locationMappings || []),
      ...US_CITY_ALIASES,
      ...INTERNATIONAL_CITY_ALIASES,
    ];
    this.locationNormalizer = new LocationNormalizer(buckets, mappings);
  }

  /**
   * Index a document with geographic data
   */
  async indexDocument(doc: GeoIndexedDocument): Promise<void> {
    if (!isValidCoordinates(doc.location)) {
      throw new Error(`Invalid coordinates for document ${doc.id}: ${JSON.stringify(doc.location)}`);
    }

    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not available');
    }
    const pipeline = client.pipeline();

    // 1. Add to main geo index using Redis GEOADD
    const mainGeoKey = `${this.indexKeyPrefix}:main`;
    pipeline.geoadd(mainGeoKey, doc.location.lng, doc.location.lat, String(doc.id));

    // 2. Store document data
    const docKey = `${this.indexKeyPrefix}:doc:${doc.id}`;
    pipeline.set(docKey, JSON.stringify({
      ...doc.data,
      _geo_lat: doc.location.lat,
      _geo_lng: doc.location.lng,
      _geo_location_name: doc.locationName,
      _geo_bucket_id: doc.bucketId,
    }));

    // 3. Add to bucket index if applicable
    if (doc.bucketId) {
      const bucketKey = `${this.indexKeyPrefix}:bucket:${doc.bucketId}`;
      pipeline.sadd(bucketKey, String(doc.id));
    } else if (this.config.buckets) {
      // Auto-assign bucket
      const bucket = findBucket(doc.location, this.config.buckets);
      if (bucket) {
        const bucketKey = `${this.indexKeyPrefix}:bucket:${bucket.id}`;
        pipeline.sadd(bucketKey, String(doc.id));
        // Update document with bucket ID
        pipeline.hset(docKey, '_geo_bucket_id', bucket.id);
      }
    }

    // 4. Add to location name index if provided
    if (doc.locationName && this.config.autoNormalize) {
      const normalized = this.locationNormalizer.normalize(doc.locationName);
      if (normalized) {
        const locationKey = `${this.indexKeyPrefix}:location:${normalized.canonical}`;
        pipeline.sadd(locationKey, String(doc.id));
      }
    }

    await pipeline.exec();
  }

  /**
   * Batch index multiple documents
   */
  async indexDocuments(docs: GeoIndexedDocument[]): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not available');
    }
    const pipeline = client.pipeline();

    const mainGeoKey = `${this.indexKeyPrefix}:main`;

    for (const doc of docs) {
      if (!isValidCoordinates(doc.location)) {
        console.warn(`Skipping document ${doc.id} with invalid coordinates`);
        continue;
      }

      // Add to geo index
      pipeline.geoadd(mainGeoKey, doc.location.lng, doc.location.lat, String(doc.id));

      // Store document
      const docKey = `${this.indexKeyPrefix}:doc:${doc.id}`;
      const docData: any = {
        ...doc.data,
        _geo_lat: doc.location.lat,
        _geo_lng: doc.location.lng,
      };

      if (doc.locationName) {
        docData._geo_location_name = doc.locationName;
      }

      // Auto-assign bucket if enabled
      if (this.config.buckets) {
        const bucket = findBucket(doc.location, this.config.buckets);
        if (bucket) {
          docData._geo_bucket_id = bucket.id;
          const bucketKey = `${this.indexKeyPrefix}:bucket:${bucket.id}`;
          pipeline.sadd(bucketKey, String(doc.id));
        }
      }

      pipeline.set(docKey, JSON.stringify(docData));

      // Location name indexing
      if (doc.locationName && this.config.autoNormalize) {
        const normalized = this.locationNormalizer.normalize(doc.locationName);
        if (normalized) {
          const locationKey = `${this.indexKeyPrefix}:location:${normalized.canonical}`;
          pipeline.sadd(locationKey, String(doc.id));
        }
      }
    }

    await pipeline.exec();
  }

  /**
   * Search for documents within a radius
   * Supports automatic cluster expansion if results are insufficient
   */
  async searchByRadius(options: GeoSearchOptions): Promise<GeoSearchResult[]> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not available');
    }
    const mainGeoKey = `${this.indexKeyPrefix}:main`;

    // Convert radius to meters for Redis GEORADIUS
    let radiusM: number;
    switch (options.radius.unit) {
      case 'km':
        radiusM = options.radius.value * 1000;
        break;
      case 'mi':
        radiusM = options.radius.value * 1609.34;
        break;
      default:
        radiusM = options.radius.value;
    }

    // Perform initial geo search
    let results = await client.georadius(
      mainGeoKey,
      options.center.lng,
      options.center.lat,
      radiusM,
      'm',
      'WITHDIST',
      'ASC', // Sort by distance
      ...(options.limit ? ['COUNT', options.limit] : [])
    );

    // Check if cluster expansion is needed
    const minResults = options.minResults ?? 5;
    const hasMaxRange = options.maxRange !== undefined;
    const needsExpansion = hasMaxRange && results.length < minResults;

    if (needsExpansion) {
      // Convert maxRange to meters
      let maxRangeM: number;
      switch (options.maxRange!.unit) {
        case 'km':
          maxRangeM = options.maxRange!.value * 1000;
          break;
        case 'mi':
          maxRangeM = options.maxRange!.value * 1609.34;
          break;
        default:
          maxRangeM = options.maxRange!.value;
      }

      // Only expand if maxRange is larger than current radius
      if (maxRangeM > radiusM) {
        // Expand search to maxRange
        results = await client.georadius(
          mainGeoKey,
          options.center.lng,
          options.center.lat,
          maxRangeM,
          'm',
          'WITHDIST',
          'ASC',
          ...(options.limit ? ['COUNT', options.limit] : [])
        );
      }
    }

    // Process results
    const geoResults: GeoSearchResult[] = [];
    const originalRadiusM = radiusM;

    for (const result of results) {
      const [id, distanceStr] = result as [string, string];
      const distance = parseFloat(distanceStr);

      // Fetch document data
      const docKey = `${this.indexKeyPrefix}:doc:${id}`;
      const docDataStr = await client.get(docKey);

      if (!docDataStr) continue;

      const docData = JSON.parse(docDataStr);

      // Extract geo metadata
      const {
        _geo_lat,
        _geo_lng,
        _geo_location_name,
        _geo_bucket_id,
        ...documentData
      } = docData;

      // Calculate relevance score based on distance
      // Results within original radius get higher scores
      const maxDistance = needsExpansion ? this.convertToMeters(options.maxRange!) : radiusM;
      const baseDistanceScore = 1 - distance / maxDistance;

      // Apply penalty for results outside original radius (if expansion occurred)
      let distanceScore = baseDistanceScore;
      if (needsExpansion && distance > originalRadiusM) {
        // Results beyond original radius get a penalty (0.7x score)
        distanceScore = baseDistanceScore * 0.7;
      }

      // Apply distance boost if configured
      let boost = 1.0;
      if (options.distanceBoost) {
        for (const boostConfig of options.distanceBoost) {
          const boostDistanceM = this.convertToMeters(boostConfig.distance);
          if (distance <= boostDistanceM) {
            boost = Math.max(boost, boostConfig.boost);
          }
        }
      }

      const relevanceScore = distanceScore * boost;

      // Get bucket if available
      let bucket: GeoBucket | undefined;
      if (_geo_bucket_id && this.config.buckets) {
        bucket = this.config.buckets.find((b) => b.id === _geo_bucket_id);
      }

      geoResults.push({
        document: documentData,
        distance: options.includeDistance !== false ? {
          value: this.convertFromMeters(distance, options.radius.unit),
          unit: options.radius.unit,
        } : undefined,
        bucket,
        relevanceScore,
      });
    }

    return geoResults;
  }

  /**
   * Search by location name (with normalization)
   */
  async searchByLocationName(
    locationName: string,
    options?: Partial<GeoSearchOptions>
  ): Promise<GeoSearchResult[]> {
    // Normalize location name
    const normalized = this.locationNormalizer.normalize(locationName);

    if (!normalized || !normalized.coordinates) {
      // Try to get from bucket
      const bucket = this.locationNormalizer.getBucket(locationName);
      if (bucket) {
        // Search within bucket
        return this.searchByRadius({
          center: bucket.center,
          radius: bucket.radius,
          ...options,
        } as GeoSearchOptions);
      }

      throw new Error(`Cannot find coordinates for location: ${locationName}`);
    }

    // Use normalized coordinates for search
    const radius = options?.radius || this.config.defaultRadius || { value: 25, unit: 'km' };

    return this.searchByRadius({
      center: normalized.coordinates,
      radius,
      includeDistance: true,
      sortByDistance: true,
      ...options,
    } as GeoSearchOptions);
  }

  /**
   * Search within a specific bucket
   */
  async searchByBucket(bucketId: string, limit?: number): Promise<GeoSearchResult[]> {
    const bucket = this.config.buckets?.find((b) => b.id === bucketId);
    if (!bucket) {
      throw new Error(`Bucket not found: ${bucketId}`);
    }

    return this.searchByRadius({
      center: bucket.center,
      radius: bucket.radius,
      bucketId,
      limit,
      includeDistance: true,
    });
  }

  /**
   * Build geo-buckets with dynamic clustering
   */
  async buildGeoBuckets(options: {
    targetBucketSize: number;
    gridSizeKm: number;
    minBucketSize: number;
  }): Promise<{
    totalBuckets: number;
    buckets: GeoBucket[];
    avgBucketSize: number;
  }> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not available');
    }
    const mainGeoKey = `${this.indexKeyPrefix}:main`;

    // 1. Fetch all document IDs and their coordinates
    const allMembers = await client.zrange(mainGeoKey, 0, -1);
    if (allMembers.length === 0) {
      return { totalBuckets: 0, buckets: [], avgBucketSize: 0 };
    }

    // 2. Fetch coordinates for all members
    const pipeline = client.pipeline();
    for (const memberId of allMembers) {
      pipeline.geopos(mainGeoKey, memberId);
    }
    const positions = await pipeline.exec();

    // 3. Build document records
    const records: Array<{
      id: string;
      lat: number;
      lng: number;
      locationName?: string;
    }> = [];

    for (let i = 0; i < allMembers.length; i++) {
      const posResult = positions![i][1];

      // GEOPOS returns an array with [longitude, latitude] as the first element
      const pos = posResult ? posResult[0] : null;

      if (!pos || !Array.isArray(pos) || pos.length !== 2) {
        console.warn(`No valid position data for member ${allMembers[i]}, got:`, posResult);
        continue;
      }

      const [lngStr, latStr] = pos;
      const lng = parseFloat(lngStr);
      const lat = parseFloat(latStr);

      // Skip records with invalid coordinates
      if (isNaN(lat) || isNaN(lng)) {
        console.warn(`Skipping member ${allMembers[i]} with invalid coordinates: lat=${latStr}→${lat}, lng=${lngStr}→${lng}`);
        continue;
      }

      // Fetch location name if available
      const docKey = `${this.indexKeyPrefix}:doc:${allMembers[i]}`;
      const docDataStr = await client.get(docKey);
      let locationName: string | undefined;

      if (docDataStr) {
        const docData = JSON.parse(docDataStr);
        locationName = docData._geo_location_name;
      }

      records.push({ id: allMembers[i], lat, lng, locationName });
    }

    // 4. Create grid-based clusters
    const gridSizeDeg = options.gridSizeKm / 111; // Approximate km to degrees
    const gridCells = new Map<string, typeof records>();

    for (const record of records) {
      const cellLat = Math.floor(record.lat / gridSizeDeg) * gridSizeDeg;
      const cellLng = Math.floor(record.lng / gridSizeDeg) * gridSizeDeg;
      const cellKey = `${cellLat.toFixed(4)},${cellLng.toFixed(4)}`;

      if (!gridCells.has(cellKey)) {
        gridCells.set(cellKey, []);
      }
      gridCells.get(cellKey)!.push(record);
    }

    // 5. Process cells into buckets
    const buckets: GeoBucket[] = [];
    let bucketIdCounter = 1;

    for (const [cellKey, cellRecords] of gridCells.entries()) {
      if (cellRecords.length < options.minBucketSize) {
        // Too few items, skip or merge later
        continue;
      }

      if (cellRecords.length > options.targetBucketSize * 3) {
        // Cell too large, subdivide using k-means
        const numClusters = Math.ceil(cellRecords.length / options.targetBucketSize);
        const subClusters = this.kMeansClustering(cellRecords, numClusters);

        for (const cluster of subClusters) {
          if (cluster.length >= options.minBucketSize) {
            buckets.push(this.createBucket(cluster, bucketIdCounter++));
          }
        }
      } else {
        // Cell size is reasonable
        buckets.push(this.createBucket(cellRecords, bucketIdCounter++));
      }
    }

    // 6. Store buckets in Redis

    // IMPORTANT: ioredis SCAN needs manual prefix, but DEL auto-prefixes
    const keyPrefix = (client as any).options?.keyPrefix || '';

    // Clear existing buckets FIRST (not in pipeline) - Use SCAN instead of KEYS
    const oldBucketKeys: string[] = [];
    const oldBucketDataKeys: string[] = [];

    // Scan for old bucket keys - SCAN pattern needs manual prefix
    let bucketCursor = '0';
    do {
      const [nextCursor, matchedKeys] = await client.scan(
        bucketCursor,
        'MATCH',
        `${keyPrefix}${this.indexKeyPrefix}:bucket:*`,
        'COUNT',
        100
      );
      bucketCursor = nextCursor;
      oldBucketKeys.push(...matchedKeys);
    } while (bucketCursor !== '0');

    // Scan for old bucket-data keys - SCAN pattern needs manual prefix
    let dataCursor = '0';
    do {
      const [nextCursor, matchedKeys] = await client.scan(
        dataCursor,
        'MATCH',
        `${keyPrefix}${this.indexKeyPrefix}:bucket-data:*`,
        'COUNT',
        100
      );
      dataCursor = nextCursor;
      oldBucketDataKeys.push(...matchedKeys);
    } while (dataCursor !== '0');

    console.log(`🧹 Clearing ${oldBucketKeys.length} old bucket keys and ${oldBucketDataKeys.length} old bucket-data keys`);

    // DEL auto-adds prefix, so strip it from SCAN results
    if (oldBucketKeys.length > 0) {
      const keysWithoutPrefix = oldBucketKeys.map(k =>
        k.startsWith(keyPrefix) ? k.substring(keyPrefix.length) : k
      );
      await client.del(...keysWithoutPrefix);
    }
    if (oldBucketDataKeys.length > 0) {
      const keysWithoutPrefix = oldBucketDataKeys.map(k =>
        k.startsWith(keyPrefix) ? k.substring(keyPrefix.length) : k
      );
      await client.del(...keysWithoutPrefix);
    }

    // Now create pipeline for storing new buckets
    const storePipeline = client.pipeline();

    // Store new buckets
    console.log(`💾 Storing ${buckets.length} new geo-buckets with prefix: ${this.indexKeyPrefix}`);
    console.log(`   Redis client status: ${client.status}`);
    console.log(`   Sample key to store: ${this.indexKeyPrefix}:bucket-data:bucket_1`);

    for (const bucket of buckets) {
      const bucketKey = `${this.indexKeyPrefix}:bucket:${bucket.id}`;
      const bucketDataKey = `${this.indexKeyPrefix}:bucket-data:${bucket.id}`;

      // Store member IDs (only if members exist)
      if (bucket.members && bucket.members.length > 0) {
        storePipeline.sadd(bucketKey, ...bucket.members);
      }

      // Store bucket metadata
      storePipeline.set(bucketDataKey, JSON.stringify({
        id: bucket.id,
        center: bucket.center,
        radius: bucket.radius,
        count: bucket.members?.length || 0,
        locationName: bucket.locationName,
        bounds: bucket.bounds,
      }));
    }

    const pipelineResults = await storePipeline.exec();
    console.log(`✅ Stored buckets to Redis. Pipeline executed ${pipelineResults?.length || 0} commands`);

    // Check for errors in pipeline results
    if (pipelineResults) {
      const errors = pipelineResults.filter(([err]) => err !== null);
      if (errors.length > 0) {
        console.error(`❌ Pipeline execution had ${errors.length} errors:`, errors.slice(0, 3));
      }
    }

    // Verify storage using SCAN instead of KEYS - SCAN pattern needs manual prefix
    const verifyKeys: string[] = [];
    let verifyCursor = '0';
    do {
      const [nextCursor, matchedKeys] = await client.scan(
        verifyCursor,
        'MATCH',
        `${keyPrefix}${this.indexKeyPrefix}:bucket-data:*`,
        'COUNT',
        100
      );
      verifyCursor = nextCursor;
      verifyKeys.push(...matchedKeys);
    } while (verifyCursor !== '0');

    console.log(`✔️  Verification: ${verifyKeys.length} bucket-data keys now exist in Redis`);

    if (verifyKeys.length === 0 && buckets.length > 0) {
      console.error(`⚠️  STORAGE FAILED! Expected ${buckets.length} keys but found 0`);
      console.error(`   Index key prefix: ${this.indexKeyPrefix}`);
      console.error(`   Redis keyPrefix: ${keyPrefix}`);
      console.error(`   Sample bucket key would be: ${keyPrefix}${this.indexKeyPrefix}:bucket-data:bucket_1`);

      // Try to manually check one key - GET auto-adds prefix
      const testKey = `${this.indexKeyPrefix}:bucket-data:bucket_1`;
      const testValue = await client.get(testKey);
      console.error(`   Manual check of ${testKey}: ${testValue ? 'EXISTS' : 'NOT FOUND'}`);
    }

    // Calculate stats
    const totalItems = buckets.reduce((sum, b) => sum + (b.members?.length || 0), 0);
    const avgBucketSize = buckets.length > 0 ? totalItems / buckets.length : 0;

    return {
      totalBuckets: buckets.length,
      buckets,
      avgBucketSize: parseFloat(avgBucketSize.toFixed(1)),
    };
  }

  /**
   * Get all geo-buckets for this table
   */
  async getGeoBuckets(): Promise<Array<{
    id: string;
    center: GeoPoint;
    radius: GeoDistance;
    count: number;
    locationName?: string;
    bounds?: any;
  }>> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not available');
    }

    // IMPORTANT: ioredis SCAN command does NOT auto-prefix patterns
    // We need to manually add the keyPrefix for SCAN patterns
    const keyPrefix = (client as any).options?.keyPrefix || '';
    const searchPattern = `${keyPrefix}${this.indexKeyPrefix}:bucket-data:*`;
    console.log(`🔍 Searching for geo-buckets with pattern: ${searchPattern}`);

    // Use SCAN instead of KEYS - SCAN patterns need manual prefix
    const bucketDataKeys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, matchedKeys] = await client.scan(
        cursor,
        'MATCH',
        searchPattern,
        'COUNT',
        100
      );
      cursor = nextCursor;
      bucketDataKeys.push(...matchedKeys);
    } while (cursor !== '0');

    console.log(`📋 Found ${bucketDataKeys.length} bucket data keys:`, bucketDataKeys.slice(0, 5));

    if (bucketDataKeys.length === 0) {
      // Check if any geo keys exist at all using SCAN
      const allGeoKeys: string[] = [];
      let geoCursor = '0';

      do {
        const [nextCursor, matchedKeys] = await client.scan(
          geoCursor,
          'MATCH',
          `${keyPrefix}${this.indexKeyPrefix}:*`,
          'COUNT',
          100
        );
        geoCursor = nextCursor;
        allGeoKeys.push(...matchedKeys);
      } while (geoCursor !== '0' && allGeoKeys.length < 20);

      console.log(`ℹ️  Total geo keys for ${this.tableName}:`, allGeoKeys.length);
      if (allGeoKeys.length > 0) {
        console.log(`   Sample keys:`, allGeoKeys.slice(0, 10));
      }
      return [];
    }

    // For GET commands, ioredis auto-adds prefix, so we need to strip it from SCAN results
    const pipeline = client.pipeline();
    for (const key of bucketDataKeys) {
      // Remove the prefix from the key since GET will add it back
      const keyWithoutPrefix = key.startsWith(keyPrefix) ? key.substring(keyPrefix.length) : key;
      pipeline.get(keyWithoutPrefix);
    }

    const results = await pipeline.exec();
    const buckets: any[] = [];

    for (const result of results!) {
      const bucketDataStr = result[1] as string;
      if (bucketDataStr) {
        buckets.push(JSON.parse(bucketDataStr));
      }
    }

    console.log(`✅ Retrieved ${buckets.length} geo-buckets from Redis`);
    return buckets;
  }

  /**
   * Simple k-means clustering
   */
  private kMeansClustering(
    records: Array<{ id: string; lat: number; lng: number; locationName?: string }>,
    k: number
  ): Array<typeof records> {
    if (records.length <= k) {
      return records.map(r => [r]);
    }

    // Initialize centroids randomly
    const centroids: Array<{ lat: number; lng: number }> = [];
    const usedIndices = new Set<number>();

    for (let i = 0; i < k; i++) {
      let idx: number;
      do {
        idx = Math.floor(Math.random() * records.length);
      } while (usedIndices.has(idx));
      usedIndices.add(idx);
      centroids.push({ lat: records[idx].lat, lng: records[idx].lng });
    }

    // Iterate until convergence (max 20 iterations)
    for (let iter = 0; iter < 20; iter++) {
      // Assign records to nearest centroid
      const clusters: Array<typeof records> = Array.from({ length: k }, () => []);

      for (const record of records) {
        let minDist = Infinity;
        let nearestCluster = 0;

        for (let i = 0; i < k; i++) {
          const dist = calculateDistance(
            { lat: record.lat, lng: record.lng },
            centroids[i]
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCluster = i;
          }
        }

        clusters[nearestCluster].push(record);
      }

      // Recalculate centroids
      let changed = false;
      for (let i = 0; i < k; i++) {
        if (clusters[i].length === 0) continue;

        const newLat = clusters[i].reduce((sum, r) => sum + r.lat, 0) / clusters[i].length;
        const newLng = clusters[i].reduce((sum, r) => sum + r.lng, 0) / clusters[i].length;

        if (Math.abs(newLat - centroids[i].lat) > 0.0001 || Math.abs(newLng - centroids[i].lng) > 0.0001) {
          changed = true;
        }

        centroids[i] = { lat: newLat, lng: newLng };
      }

      if (!changed) break;
    }

    // Return clusters with at least one member
    const clusters: Array<typeof records> = Array.from({ length: k }, () => []);
    for (const record of records) {
      let minDist = Infinity;
      let nearestCluster = 0;

      for (let i = 0; i < k; i++) {
        const dist = calculateDistance(
          { lat: record.lat, lng: record.lng },
          centroids[i]
        );
        if (dist < minDist) {
          minDist = dist;
          nearestCluster = i;
        }
      }

      clusters[nearestCluster].push(record);
    }

    return clusters.filter(c => c.length > 0);
  }

  /**
   * Create a bucket from a cluster of records
   */
  private createBucket(
    records: Array<{ id: string; lat: number; lng: number; locationName?: string }>,
    bucketId: number
  ): GeoBucket {
    // Calculate centroid
    const centerLat = records.reduce((sum, r) => sum + r.lat, 0) / records.length;
    const centerLng = records.reduce((sum, r) => sum + r.lng, 0) / records.length;
    const center: GeoPoint = { lat: centerLat, lng: centerLng };

    // Calculate max distance from center (for radius)
    let maxDist = 0;
    for (const record of records) {
      const dist = calculateDistance(center, { lat: record.lat, lng: record.lng });
      maxDist = Math.max(maxDist, dist);
    }

    // Add 10% buffer to radius
    const radiusKm = maxDist * 1.1;

    // Calculate bounding box
    const lats = records.map(r => r.lat);
    const lngs = records.map(r => r.lng);
    const bounds: GeoBounds = {
      northEast: {
        lat: Math.max(...lats),
        lng: Math.max(...lngs),
      },
      southWest: {
        lat: Math.min(...lats),
        lng: Math.min(...lngs),
      },
    };

    // Determine primary location name (most common)
    const locationCounts: Record<string, number> = {};
    for (const record of records) {
      if (record.locationName) {
        const loc = record.locationName.toLowerCase();
        locationCounts[loc] = (locationCounts[loc] || 0) + 1;
      }
    }

    const locationName = Object.keys(locationCounts).length > 0
      ? Object.entries(locationCounts)
          .sort(([, a], [, b]) => b - a)[0][0]
      : undefined;

    return {
      id: `bucket_${bucketId}`,
      center,
      radius: { value: radiusKm, unit: 'km' },
      members: records.map(r => r.id),
      locationName,
      bounds,
    };
  }

  /**
   * Get index statistics
   */
  async getStats(): Promise<GeoIndexStats> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not available');
    }
    const mainGeoKey = `${this.indexKeyPrefix}:main`;

    // Get total documents
    const totalDocuments = await client.zcard(mainGeoKey);

    // Get bucket counts
    const bucketCounts: Record<string, number> = {};
    if (this.config.buckets) {
      for (const bucket of this.config.buckets) {
        const bucketKey = `${this.indexKeyPrefix}:bucket:${bucket.id}`;
        const count = await client.scard(bucketKey);
        bucketCounts[bucket.id] = count;
      }
    }

    // Calculate geographic bounds (would require fetching all docs - expensive)
    // For now, return null and calculate on demand if needed
    const bounds = {
      northEast: { lat: 90, lng: 180 },
      southWest: { lat: -90, lng: -180 },
    };

    // Get index size estimate
    const keys = await client.keys(`${this.indexKeyPrefix}:*`);
    let indexSize = 0;
    for (const key of keys.slice(0, 100)) { // Sample first 100 keys
      const memory = await client.memory('USAGE', key);
      if (memory) indexSize += memory;
    }
    indexSize = Math.round((indexSize / Math.min(keys.length, 100)) * keys.length);

    return {
      totalDocuments,
      bucketCounts,
      bounds,
      normalizedLocations: this.locationNormalizer.getStats().totalCanonical,
      indexSize,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clear all geo indexes for this table
   */
  async clearIndex(): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not available');
    }
    const keys = await client.keys(`${this.indexKeyPrefix}:*`);

    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  /**
   * Helper: Convert distance to meters
   */
  private convertToMeters(distance: GeoDistance): number {
    switch (distance.unit) {
      case 'km':
        return distance.value * 1000;
      case 'mi':
        return distance.value * 1609.34;
      default:
        return distance.value;
    }
  }

  /**
   * Helper: Convert meters to target unit
   */
  private convertFromMeters(meters: number, unit: 'km' | 'mi' | 'm'): number {
    switch (unit) {
      case 'km':
        return meters / 1000;
      case 'mi':
        return meters / 1609.34;
      default:
        return meters;
    }
  }
}
