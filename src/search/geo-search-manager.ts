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

    const client = await this.redis.getClient();
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
    const client = await this.redis.getClient();
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
   */
  async searchByRadius(options: GeoSearchOptions): Promise<GeoSearchResult[]> {
    const client = await this.redis.getClient();
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

    // Perform geo search
    const results = await client.georadius(
      mainGeoKey,
      options.center.lng,
      options.center.lat,
      radiusM,
      'm',
      'WITHDIST',
      'ASC', // Sort by distance
      ...(options.limit ? ['COUNT', options.limit] : [])
    );

    // Process results
    const geoResults: GeoSearchResult[] = [];

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
      const maxDistance = radiusM;
      const distanceScore = 1 - distance / maxDistance;

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
   * Get index statistics
   */
  async getStats(): Promise<GeoIndexStats> {
    const client = await this.redis.getClient();
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
    const client = await this.redis.getClient();
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
