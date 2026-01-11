// Type definitions for SqlDB Admin UI components

// Analytics & Stats
export interface AnalyticsStats {
  totalQueries: number;
  avgExecutionTime: number;
  cacheHitRate: number;
  activeConnections: number;
  performanceData?: PerformanceData[];
  queryTypes?: QueryTypeData[];
  tableStats?: TableStats[];
}

export interface PerformanceData {
  timestamp: string;
  avgExecutionTime: number;
  queryCount: number;
}

export interface QueryTypeData {
  type: string;
  count: number;
  avgTime: number;
}

export interface TableStats {
  table: string;
  queries: number;
  avgTime: number;
}

// Slow Queries
export interface SlowQuery {
  query: string;
  executionTime: number;
  timestamp: string;
  table?: string;
  params?: any[];
}

export interface SlowQueriesResponse {
  queries: SlowQuery[];
}

// Schema
export interface SchemaTable {
  name: string;
  rowCount?: number;
}

export interface SchemaResponse {
  tables: SchemaTable[];
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  extra?: string;
}

export interface ForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface TableIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface TableDetail {
  columns: TableColumn[];
  primaryKey?: string[];
  foreignKeys?: ForeignKey[];
  indexes?: TableIndex[];
}

// CRUD
export interface TableRecord {
  [key: string]: any;
}

export interface CrudResponse {
  records: TableRecord[];
  columns: TableColumn[];
  total: number;
  page: number;
  limit: number;
}

export interface CrudCreateRequest {
  [key: string]: any;
}

export interface CrudUpdateRequest {
  _id: any;
  [key: string]: any;
}

export interface CrudDeleteRequest {
  id: any;
}

// Search
export interface SearchResult {
  [key: string]: any;
  _score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  executionTime?: number;
}

export interface SearchIndexResponse {
  indexed: number;
  time: number;
  table: string;
}

// Cache
export interface CacheStats {
  keys: number;
  memoryUsage: number;
  hitRate: number;
  hits: number;
  misses: number;
  evictions?: number;
}

export interface CacheClearRequest {
  table?: string;
  pattern?: string;
}

export interface CacheClearResponse {
  deletedKeys: number;
  pattern?: string;
  table?: string;
}

// API Error Response
export interface ApiError {
  message: string;
  error?: any;
  statusCode?: number;
}
