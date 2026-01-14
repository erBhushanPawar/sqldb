/**
 * Geospatial search types and configuration for SqlDB
 * Enables location-based search with distance calculations, bucketing, and canonical location matching
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeoBounds {
  northEast: GeoPoint;
  southWest: GeoPoint;
}

export interface GeoDistance {
  value: number;
  unit: 'km' | 'mi' | 'm';
}

export interface GeoBucket {
  id: string;
  name?: string;
  center: GeoPoint;
  radius: GeoDistance;
  bounds?: GeoBounds;
  aliases?: string[]; // Alternative names for this location
  members?: string[]; // Document IDs in this bucket
  locationName?: string; // Primary location name for this bucket
}

export interface LocationNormalization {
  /** Original location string from data */
  original: string;
  /** Normalized canonical name */
  canonical: string;
  /** Coordinates if available */
  coordinates?: GeoPoint;
  /** Bucket ID this location belongs to */
  bucketId?: string;
  /** Alternative spellings/names */
  aliases?: string[];
}

export interface GeoSearchConfig {
  /** Enable geospatial search */
  enabled: boolean;

  /** Field names containing latitude */
  latitudeField: string;

  /** Field names containing longitude */
  longitudeField: string;

  /** Optional field containing location name/city for normalization */
  locationNameField?: string;

  /** Default distance unit */
  defaultUnit?: 'km' | 'mi' | 'm';

  /** Maximum search radius allowed (prevents overly broad searches) */
  maxRadius?: GeoDistance;

  /** Geographic buckets for regional grouping */
  buckets?: GeoBucket[];

  /** Location normalization mappings */
  locationMappings?: LocationNormalization[];

  /** Enable automatic city name normalization */
  autoNormalize?: boolean;

  /** Common location aliases (e.g., "NYC" -> "New York City") */
  commonAliases?: Record<string, string>;
}

export interface GeoSearchOptions {
  /** Search center point */
  center: GeoPoint;

  /** Search radius */
  radius: GeoDistance;

  /** Sort by distance (default: true) */
  sortByDistance?: boolean;

  /** Include distance in results */
  includeDistance?: boolean;

  /** Filter by bucket ID */
  bucketId?: string;

  /** Location name to normalize and search */
  locationName?: string;

  /** Maximum number of results */
  limit?: number;

  /** Combined text search query */
  textQuery?: string;

  /**
   * Maximum search range for cluster expansion
   * If initial search yields few results, expand up to this distance
   * Example: Initial radius 5km, maxRange 8km -> will search up to 8km if needed
   */
  maxRange?: GeoDistance;

  /**
   * Minimum results threshold to trigger expansion
   * If results < minResults, expand search radius up to maxRange
   * Default: 5
   */
  minResults?: number;

  /** Boost results within certain distance ranges */
  distanceBoost?: {
    /** Distance threshold */
    distance: GeoDistance;
    /** Boost multiplier (e.g., 2.0 = 2x relevance) */
    boost: number;
  }[];
}

export interface GeoSearchResult<T = any> {
  /** The matched document */
  document: T;

  /** Distance from search center */
  distance?: GeoDistance;

  /** Bucket this result belongs to */
  bucket?: GeoBucket;

  /** Text search score (if combined search) */
  textScore?: number;

  /** Combined relevance score */
  relevanceScore: number;
}

export interface GeoIndexStats {
  /** Total number of geo-indexed documents */
  totalDocuments: number;

  /** Number of documents in each bucket */
  bucketCounts: Record<string, number>;

  /** Geographic bounds of all indexed data */
  bounds: GeoBounds;

  /** Number of normalized locations */
  normalizedLocations: number;

  /** Index size in bytes */
  indexSize: number;

  /** Last index update timestamp */
  lastUpdated: Date;
}

export interface GeoSearchTableConfig {
  /** Latitude field name */
  latitudeField: string;

  /** Longitude field name */
  longitudeField: string;

  /** Optional location name field for normalization */
  locationNameField?: string;

  /** Table-specific geo buckets */
  buckets?: GeoBucket[];

  /** Location normalization for this table */
  locationMappings?: LocationNormalization[];

  /** Enable auto-normalization for this table */
  autoNormalize?: boolean;

  /** Default search radius for this table */
  defaultRadius?: GeoDistance;

  /** Combine with text search fields */
  combineWithTextSearch?: boolean;
}

/**
 * Pre-defined major city buckets for common use cases
 */
export const MAJOR_CITY_BUCKETS: GeoBucket[] = [
  {
    id: 'nyc',
    name: 'New York City',
    center: { lat: 40.7128, lng: -74.006 },
    radius: { value: 50, unit: 'km' },
    aliases: ['NYC', 'New York', 'Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'],
  },
  {
    id: 'la',
    name: 'Los Angeles',
    center: { lat: 34.0522, lng: -118.2437 },
    radius: { value: 50, unit: 'km' },
    aliases: ['LA', 'Los Angeles', 'Hollywood', 'Santa Monica', 'Venice'],
  },
  {
    id: 'chicago',
    name: 'Chicago',
    center: { lat: 41.8781, lng: -87.6298 },
    radius: { value: 40, unit: 'km' },
    aliases: ['Chicago', 'Chi-Town', 'The Windy City'],
  },
  {
    id: 'houston',
    name: 'Houston',
    center: { lat: 29.7604, lng: -95.3698 },
    radius: { value: 40, unit: 'km' },
    aliases: ['Houston', 'H-Town'],
  },
  {
    id: 'phoenix',
    name: 'Phoenix',
    center: { lat: 33.4484, lng: -112.074 },
    radius: { value: 40, unit: 'km' },
    aliases: ['Phoenix', 'PHX'],
  },
  {
    id: 'sf',
    name: 'San Francisco',
    center: { lat: 37.7749, lng: -122.4194 },
    radius: { value: 30, unit: 'km' },
    aliases: ['SF', 'San Francisco', 'San Fran', 'The City'],
  },
  {
    id: 'seattle',
    name: 'Seattle',
    center: { lat: 47.6062, lng: -122.3321 },
    radius: { value: 35, unit: 'km' },
    aliases: ['Seattle', 'SEA'],
  },
  {
    id: 'miami',
    name: 'Miami',
    center: { lat: 25.7617, lng: -80.1918 },
    radius: { value: 35, unit: 'km' },
    aliases: ['Miami', 'MIA', 'Miami Beach'],
  },
  {
    id: 'boston',
    name: 'Boston',
    center: { lat: 42.3601, lng: -71.0589 },
    radius: { value: 30, unit: 'km' },
    aliases: ['Boston', 'BOS'],
  },
  {
    id: 'london',
    name: 'London',
    center: { lat: 51.5074, lng: -0.1278 },
    radius: { value: 50, unit: 'km' },
    aliases: ['London', 'LDN'],
  },
  {
    id: 'paris',
    name: 'Paris',
    center: { lat: 48.8566, lng: 2.3522 },
    radius: { value: 40, unit: 'km' },
    aliases: ['Paris', 'PAR'],
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    center: { lat: 35.6762, lng: 139.6503 },
    radius: { value: 50, unit: 'km' },
    aliases: ['Tokyo', 'TYO'],
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    center: { lat: 19.076, lng: 72.8777 },
    radius: { value: 40, unit: 'km' },
    aliases: ['Mumbai', 'Bombay', 'BOM'],
  },
  {
    id: 'delhi',
    name: 'Delhi',
    center: { lat: 28.6139, lng: 77.209 },
    radius: { value: 40, unit: 'km' },
    aliases: ['Delhi', 'New Delhi', 'DEL'],
  },
  {
    id: 'bangalore',
    name: 'Bangalore',
    center: { lat: 12.9716, lng: 77.5946 },
    radius: { value: 35, unit: 'km' },
    aliases: ['Bangalore', 'Bengaluru', 'BLR'],
  },
];
