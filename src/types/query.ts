import { WhereInput } from './operators';

/**
 * WhereClause type with full Prisma-style operator support
 *
 * Supports:
 * - Simple equality: { age: 25 }
 * - Operators: { age: { gte: 18, lte: 65 } }
 * - Arrays (legacy IN): { status: ['active', 'pending'] }
 * - Logical operators: { OR: [...], AND: [...], NOT: [...] }
 * - String operators: { email: { contains: '@example.com', mode: 'insensitive' } }
 * - Null checks: { deletedAt: null } or { deletedAt: { isNull: true } }
 */
export type WhereClause<T = any> = WhereInput<T> | (Partial<T> & {
  [key: string]: any;
});

export interface OrderByOption {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface RelationConfig {
  // Fetch tables that reference this table (e.g., for a provider, fetch orders, services, etc.)
  dependents?: boolean | string[];

  // Fetch tables that this table references (e.g., for an order, fetch the provider, user, etc.)
  dependencies?: boolean | string[];

  // Maximum depth for nested relations (default: 1)
  depth?: number;
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string | OrderByOption | OrderByOption[];
  select?: string[];
  skipCache?: boolean;
  correlationId?: string;

  // Automatically fetch related data
  withRelations?: boolean | RelationConfig;
}

export interface TableOperations<T = any> {
  // Read operations (cache-first)
  findOne(where: WhereClause<T>, options?: FindOptions): Promise<T | null>;
  findMany(where?: WhereClause<T>, options?: FindOptions): Promise<T[]>;
  findById(id: string | number, correlationId?: string): Promise<T | null>;
  count(where?: WhereClause<T>, correlationId?: string): Promise<number>;

  // Write operations (invalidate cache)
  insertOne(data: Omit<T, 'id'>, correlationId?: string): Promise<T>;
  insertMany(data: Omit<T, 'id'>[], correlationId?: string): Promise<T[]>;
  updateOne(where: WhereClause<T>, data: Partial<T>, correlationId?: string): Promise<T | null>;
  updateMany(where: WhereClause<T>, data: Partial<T>, correlationId?: string): Promise<number>;
  updateById(id: string | number, data: Partial<T>, correlationId?: string): Promise<T | null>;
  deleteOne(where: WhereClause<T>, correlationId?: string): Promise<boolean>;
  deleteMany(where: WhereClause<T>, correlationId?: string): Promise<number>;
  deleteById(id: string | number, correlationId?: string): Promise<boolean>;

  // Direct DB access (bypass cache)
  raw<R = any>(sql: string, params?: any[], correlationId?: string): Promise<R>;

  // Cache control
  invalidateCache(): Promise<void>;
  warmCache(where?: WhereClause<T>, correlationId?: string): Promise<void>;
  warmCacheWithRelations(
    where?: WhereClause<T>,
    options?: {
      correlationId?: string;
      depth?: number;
      warmDependents?: boolean;
      warmDependencies?: boolean;
    }
  ): Promise<void>;

  // Search operations (inverted index)
  search?(query: string, options?: import('../types/search').SearchOptions): Promise<import('../types/search').SearchResult<T>[]>;
  buildSearchIndex?(): Promise<import('../types/search').IndexStats>;
  rebuildSearchIndex?(): Promise<import('../types/search').IndexStats>;
  getSearchStats?(): Promise<import('../types/search').IndexStats | null>;

  // Geo-search operations (clustering)
  buildGeoBuckets?(options?: {
    targetBucketSize?: number;
    gridSizeKm?: number;
    minBucketSize?: number;
  }): Promise<{
    totalBuckets: number;
    buckets: import('../types/geo-search').GeoBucket[];
    avgBucketSize: number;
  }>;
  getGeoBuckets?(): Promise<Array<{
    id: string;
    center: import('../types/geo-search').GeoPoint;
    radius: import('../types/geo-search').GeoDistance;
    count: number;
    locationName?: string;
    bounds?: any;
  }>>;
}

export interface QueryResult {
  sql: string;
  params: any[];
}

export interface QueryMetadata {
  queryId: string;
  correlationId?: string;
  sql: string;
  params?: any[];
  startTime: number;
  endTime?: number;
  executionTimeMs?: number;
  resultCount?: number;
  tableName?: string;
  operation?: string;
  error?: string;
}

export interface QueryTracker {
  trackQuery(metadata: QueryMetadata): void;
  getQueries(correlationId?: string): QueryMetadata[];
  clearQueries(correlationId?: string): void;
}
