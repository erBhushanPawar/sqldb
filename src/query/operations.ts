import { MariaDBConnectionManager } from '../connection/mariadb';
import { CacheManager } from '../cache/cache-manager';
import { InvalidationManager } from '../cache/invalidation';
import { QueryBuilder } from './query-builder';
import { TableOperations, WhereClause, FindOptions, RelationConfig } from '../types/query';
import { CacheConfig, CaseConversionConfig } from '../types/config';
import { QueryStatsTracker } from '../warming/query-stats-tracker';
import { generateQueryId } from './query-tracker';
import { SearchOptions, SearchResult, IndexStats } from '../types/search';
import { InvertedIndexManager } from '../search/inverted-index-manager';
import { SearchRanker } from '../search/search-ranker';
import { GeoSearchManager } from '../search/geo-search-manager';
import { GeoPoint, GeoDistance } from '../types/geo-search';
import { CaseConverter } from '../utils/case-converter';

export class TableOperationsImpl<T = any> implements TableOperations<T> {
  private tableName: string;
  private dbManager: MariaDBConnectionManager;
  private cacheManager: CacheManager;
  private invalidationManager: InvalidationManager;
  private queryBuilder: QueryBuilder;
  private cacheConfig: Required<CacheConfig>;
  private statsTracker?: QueryStatsTracker;
  private indexManager?: InvertedIndexManager;
  private searchRanker?: SearchRanker;
  private geoSearchManager?: GeoSearchManager;
  private caseConversionConfig?: CaseConversionConfig;

  constructor(
    tableName: string,
    dbManager: MariaDBConnectionManager,
    cacheManager: CacheManager,
    invalidationManager: InvalidationManager,
    queryBuilder: QueryBuilder,
    cacheConfig: Required<CacheConfig>,
    statsTracker?: QueryStatsTracker,
    indexManager?: InvertedIndexManager,
    searchRanker?: SearchRanker,
    geoSearchManager?: GeoSearchManager,
    caseConversionConfig?: CaseConversionConfig
  ) {
    this.tableName = tableName;
    this.dbManager = dbManager;
    this.cacheManager = cacheManager;
    this.invalidationManager = invalidationManager;
    this.queryBuilder = queryBuilder;
    this.cacheConfig = cacheConfig;
    this.statsTracker = statsTracker;
    this.indexManager = indexManager;
    this.searchRanker = searchRanker;
    this.geoSearchManager = geoSearchManager;
    this.caseConversionConfig = caseConversionConfig;
  }

  async findOne(where: WhereClause<T>, options?: FindOptions): Promise<T | null> {
    const mergedOptions: FindOptions = { ...options, limit: 1 };
    const results = await this.findMany(where, mergedOptions);
    return results.length > 0 ? results[0] : null;
  }

  async findMany(where?: WhereClause<T>, options?: FindOptions): Promise<T[]> {
    const skipCache = options?.skipCache || false;
    const correlationId = options?.correlationId;
    const withRelations = options?.withRelations;
    const startTime = Date.now();
    let results: T[];

    // Smart limit: Automatically cap large queries with relations for performance
    const effectiveOptions = { ...options };
    if (withRelations && !effectiveOptions.limit) {
      // No limit specified but relations requested - apply smart default
      effectiveOptions.limit = 1000;
      console.warn(
        `[Performance] Auto-limiting query to 1000 records (withRelations=true but no limit specified). ` +
        `Specify limit explicitly to override or use pagination for larger datasets.`
      );
    }

    // Build cache key (exclude correlationId, skipCache, and withRelations from key as they don't affect the base query result)
    const { correlationId: _, skipCache: __, withRelations: ___, ...cacheableOptions } = effectiveOptions || {};
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildKey(this.tableName, 'findMany', { where, options: cacheableOptions });

    // Try cache first
    if (!skipCache && this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<T[]>(cacheKey);
      if (cached !== null) {
        results = cached;

        // Record cache hit for stats
        if (this.statsTracker) {
          const executionTime = Date.now() - startTime;
          const queryId = generateQueryId();
          this.statsTracker.recordAccess({
            queryId,
            tableName: this.tableName,
            queryType: 'findMany',
            filters: JSON.stringify(where || {}),
            executionTimeMs: executionTime,
            cacheHit: true,
            timestamp: new Date(),
          }).catch(() => {
            // Ignore stats tracking errors
          });
        }

        // If withRelations is requested, fetch and attach related data
        if (withRelations) {
          return await this.attachRelations(results, withRelations, correlationId);
        }
        return results;
      }
    }

    // Query database
    const { sql, params } = this.queryBuilder.buildSelect(
      this.tableName,
      where,
      effectiveOptions
    );

    results = await this.dbManager.query<T[]>(sql, params, correlationId);
    const executionTime = Date.now() - startTime;

    // Record query stats for auto-warming
    if (this.statsTracker) {
      const queryId = generateQueryId();
      this.statsTracker.recordAccess({
        queryId,
        tableName: this.tableName,
        queryType: 'findMany',
        filters: JSON.stringify(where || {}),
        executionTimeMs: executionTime,
        cacheHit: false,
        timestamp: new Date(),
      }).catch(() => {
        // Ignore stats tracking errors
      });
    }

    // Cache results
    if (!skipCache && this.cacheManager.isEnabled()) {
      await this.cacheManager.set(cacheKey, results);
    }

    // If withRelations is requested, fetch and attach related data
    if (withRelations) {
      return await this.attachRelations(results, withRelations, correlationId);
    }

    return results;
  }

  async findById(id: string | number, correlationId?: string): Promise<T | null> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildIdKey(this.tableName, id);

    // Try cache first
    if (this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<T>(cacheKey);
      if (cached !== null) {
        // Record cache hit for stats
        if (this.statsTracker) {
          const executionTime = Date.now() - startTime;
          const queryId = generateQueryId();
          this.statsTracker.recordAccess({
            queryId,
            tableName: this.tableName,
            queryType: 'findById',
            filters: JSON.stringify({ id }),
            executionTimeMs: executionTime,
            cacheHit: true,
            timestamp: new Date(),
          }).catch(() => {
            // Ignore stats tracking errors
          });
        }
        return cached;
      }
    }

    // Query database
    const { sql, params } = this.queryBuilder.buildSelectById(this.tableName, id);
    const results = await this.dbManager.query<T[]>(sql, params, correlationId);
    const executionTime = Date.now() - startTime;

    const result = results.length > 0 ? results[0] : null;

    // Record query stats for auto-warming
    if (this.statsTracker) {
      const queryId = generateQueryId();
      this.statsTracker.recordAccess({
        queryId,
        tableName: this.tableName,
        queryType: 'findById',
        filters: JSON.stringify({ id }),
        executionTimeMs: executionTime,
        cacheHit: false,
        timestamp: new Date(),
      }).catch(() => {
        // Ignore stats tracking errors
      });
    }

    // Cache result
    if (result && this.cacheManager.isEnabled()) {
      await this.cacheManager.set(cacheKey, result);
    }

    return result;
  }

  async count(where?: WhereClause<T>, correlationId?: string): Promise<number> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildKey(this.tableName, 'count', { where });

    // Try cache first (with shorter TTL for counts)
    if (this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<number>(cacheKey);
      if (cached !== null) {
        // Record cache hit for stats
        if (this.statsTracker) {
          const executionTime = Date.now() - startTime;
          const queryId = generateQueryId();
          this.statsTracker.recordAccess({
            queryId,
            tableName: this.tableName,
            queryType: 'count',
            filters: JSON.stringify(where || {}),
            executionTimeMs: executionTime,
            cacheHit: true,
            timestamp: new Date(),
          }).catch(() => {
            // Ignore stats tracking errors
          });
        }
        return cached;
      }
    }

    // Query database
    const { sql, params } = this.queryBuilder.buildCount(this.tableName, where);
    const results = await this.dbManager.query<any[]>(sql, params, correlationId);
    const executionTime = Date.now() - startTime;

    const count = results[0]?.count || 0;

    // Record query stats for auto-warming
    if (this.statsTracker) {
      const queryId = generateQueryId();
      this.statsTracker.recordAccess({
        queryId,
        tableName: this.tableName,
        queryType: 'count',
        filters: JSON.stringify(where || {}),
        executionTimeMs: executionTime,
        cacheHit: false,
        timestamp: new Date(),
      }).catch(() => {
        // Ignore stats tracking errors
      });
    }

    // Cache with shorter TTL (counts change frequently)
    if (this.cacheManager.isEnabled()) {
      const shortTTL = Math.min(this.cacheConfig.defaultTTL, 30);
      await this.cacheManager.set(cacheKey, count, shortTTL);
    }

    return count;
  }

  async insertOne(data: Omit<T, 'id'>, correlationId?: string): Promise<T> {
    const { sql, params } = this.queryBuilder.buildInsert(this.tableName, data);
    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache (non-blocking fire-and-forget)
    if (this.cacheConfig.invalidateOnWrite) {
      this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      ).catch(err => console.error('[InsertOne] Cache invalidation error:', err));
    }

    // Return the inserted record with ID
    const insertedId = result.insertId;
    return { ...data, id: insertedId } as T;
  }

  async insertMany(dataArray: Omit<T, 'id'>[], correlationId?: string): Promise<T[]> {
    if (dataArray.length === 0) {
      return [];
    }

    const { sql, params } = this.queryBuilder.buildInsertMany(
      this.tableName,
      dataArray
    );
    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache (non-blocking fire-and-forget)
    if (this.cacheConfig.invalidateOnWrite) {
      this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      ).catch(err => console.error('[InsertMany] Cache invalidation error:', err));
    }

    // Return inserted records with IDs
    const firstId = result.insertId;
    return dataArray.map((data, index) => ({
      ...data,
      id: firstId + index,
    })) as T[];
  }

  async updateOne(where: WhereClause<T>, data: Partial<T>, correlationId?: string): Promise<T | null> {
    const { sql, params } = this.queryBuilder.buildUpdate(
      this.tableName,
      where,
      data
    );

    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache (non-blocking fire-and-forget)
    if (this.cacheConfig.invalidateOnWrite) {
      this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      ).catch(err => console.error('[UpdateOne] Cache invalidation error:', err));
    }

    // Return a lightweight object with just the updated fields
    // This avoids a second SELECT query while still providing useful data
    if (result.affectedRows > 0) {
      return data as T;
    }

    return null;
  }

  async updateMany(where: WhereClause<T>, data: Partial<T>, correlationId?: string): Promise<number> {
    const { sql, params } = this.queryBuilder.buildUpdate(
      this.tableName,
      where,
      data
    );

    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache (non-blocking fire-and-forget)
    if (this.cacheConfig.invalidateOnWrite) {
      this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      ).catch(err => console.error('[UpdateMany] Cache invalidation error:', err));
    }

    return result.affectedRows || 0;
  }

  async updateById(id: string | number, data: Partial<T>, correlationId?: string): Promise<T | null> {
    // First fetch the existing record before update
    const existing = await this.findById(id, correlationId);
    if (!existing) {
      return null;
    }

    const { sql, params } = this.queryBuilder.buildUpdateById(
      this.tableName,
      id,
      data
    );

    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache (non-blocking fire-and-forget)
    if (this.cacheConfig.invalidateOnWrite) {
      this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      ).catch(err => console.error('[UpdateById] Cache invalidation error:', err));
    }

    // Return merged record (existing data + updates)
    if (result.affectedRows > 0) {
      return { ...existing, ...data } as T;
    }

    return null;
  }

  async deleteOne(where: WhereClause<T>, correlationId?: string): Promise<boolean> {
    const { sql, params } = this.queryBuilder.buildDelete(this.tableName, where);
    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache (non-blocking fire-and-forget)
    if (this.cacheConfig.invalidateOnWrite) {
      this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      ).catch(err => console.error('[DeleteOne] Cache invalidation error:', err));
    }

    return (result.affectedRows || 0) > 0;
  }

  async deleteMany(where: WhereClause<T>, correlationId?: string): Promise<number> {
    const { sql, params } = this.queryBuilder.buildDelete(this.tableName, where);
    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache (non-blocking fire-and-forget)
    if (this.cacheConfig.invalidateOnWrite) {
      this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      ).catch(err => console.error('[DeleteMany] Cache invalidation error:', err));
    }

    return result.affectedRows || 0;
  }

  async deleteById(id: string | number, correlationId?: string): Promise<boolean> {
    const { sql, params } = this.queryBuilder.buildDeleteById(this.tableName, id);
    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache (non-blocking fire-and-forget)
    if (this.cacheConfig.invalidateOnWrite) {
      this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      ).catch(err => console.error('[DeleteById] Cache invalidation error:', err));
    }

    return (result.affectedRows || 0) > 0;
  }

  async raw<R = any>(sql: string, params?: any[], correlationId?: string): Promise<R> {
    const startTime = Date.now();
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildKey(this.tableName, 'raw', { sql, params });

    // Try cache first
    if (this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<R>(cacheKey);
      if (cached !== null) {
        // Record cache hit for stats (for SELECT queries)
        if (this.statsTracker && sql.trim().toUpperCase().startsWith('SELECT')) {
          const executionTime = Date.now() - startTime;
          const queryId = generateQueryId();
          this.statsTracker.recordAccess({
            queryId,
            tableName: this.tableName,
            queryType: 'raw',
            filters: JSON.stringify({ sql: sql.substring(0, 100), params }),
            executionTimeMs: executionTime,
            cacheHit: true,
            timestamp: new Date(),
          }).catch(() => {
            // Ignore stats tracking errors
          });
        }
        return cached;
      }
    }

    // Query database
    const result = await this.dbManager.query<R>(sql, params, correlationId);
    const executionTime = Date.now() - startTime;

    // Record query stats for auto-warming (for SELECT queries)
    if (this.statsTracker && sql.trim().toUpperCase().startsWith('SELECT')) {
      const queryId = generateQueryId();
      this.statsTracker.recordAccess({
        queryId,
        tableName: this.tableName,
        queryType: 'raw',
        filters: JSON.stringify({ sql: sql.substring(0, 100), params }),
        executionTimeMs: executionTime,
        cacheHit: false,
        timestamp: new Date(),
      }).catch(() => {
        // Ignore stats tracking errors
      });
    }

    // Cache with 1-minute TTL
    if (this.cacheManager.isEnabled()) {
      await this.cacheManager.set(cacheKey, result, 60);
    }

    return result;
  }

  private async attachRelations(
    records: T[],
    withRelations: boolean | RelationConfig,
    correlationId?: string
  ): Promise<T[]> {
    if (records.length === 0) {
      return records;
    }

    const relationStartTime = Date.now();
    const recordCount = records.length;

    // Performance warning for large result sets with relations
    if (recordCount > 1000) {
      console.warn(
        `[Performance Warning] Loading relations for ${recordCount} records. ` +
        `Consider adding pagination (limit/offset) to your query for better performance. ` +
        `Target: <1000 records per query.`
      );
    }

    const dependencyGraph = this.invalidationManager['dependencyGraph'];

    // Parse relation config
    let fetchDependents = false;
    let fetchDependencies = false;
    let dependentsList: string[] | undefined;
    let dependenciesList: string[] | undefined;

    if (typeof withRelations === 'boolean') {
      // If true, fetch all relations
      fetchDependents = withRelations;
      fetchDependencies = withRelations;
    } else {
      // Parse the config object
      if (withRelations.dependents === true) {
        fetchDependents = true;
      } else if (Array.isArray(withRelations.dependents)) {
        fetchDependents = true;
        dependentsList = withRelations.dependents;
      }

      if (withRelations.dependencies === true) {
        fetchDependencies = true;
      } else if (Array.isArray(withRelations.dependencies)) {
        fetchDependencies = true;
        dependenciesList = withRelations.dependencies;
      }
    }

    // Clone records to avoid mutating the cached objects
    const enrichedRecords = records.map(r => ({ ...r }));

    // Fetch dependent tables (tables that reference this table)
    if (fetchDependents) {
      const relationshipsToThisTable = dependencyGraph.getRelationshipsTo(this.tableName);

      for (const rel of relationshipsToThisTable) {
        // If specific tables are requested, filter
        if (dependentsList && !dependentsList.includes(rel.fromTable)) {
          continue;
        }

        try {
          const relatedOps = new TableOperationsImpl(
            rel.fromTable,
            this.dbManager,
            this.cacheManager,
            this.invalidationManager,
            this.queryBuilder,
            this.cacheConfig
          );

          // Collect all unique PK values to batch the query
          const pkValues = new Set<any>();
          for (const record of enrichedRecords) {
            const pkValue = (record as any)[rel.toColumn];
            if (pkValue !== undefined && pkValue !== null) {
              pkValues.add(pkValue);
            }
          }

          // Skip if no valid PK values
          if (pkValues.size === 0) {
            continue;
          }

          // Fetch all related records in a single batched query using IN clause
          const pkArray = Array.from(pkValues);
          const whereClause = { [rel.fromColumn]: pkArray };
          const relatedData = await relatedOps.findMany(whereClause as any, { correlationId });

          // Group related data by the foreign key value
          const relatedDataMap = new Map<any, any[]>();
          for (const relatedRecord of relatedData) {
            const fkValue = (relatedRecord as any)[rel.fromColumn];
            if (!relatedDataMap.has(fkValue)) {
              relatedDataMap.set(fkValue, []);
            }
            relatedDataMap.get(fkValue)!.push(relatedRecord);
          }

          // Attach related data to each record
          for (const record of enrichedRecords) {
            const pkValue = (record as any)[rel.toColumn];
            if (pkValue !== undefined && pkValue !== null) {
              (record as any)[rel.fromTable] = relatedDataMap.get(pkValue) || [];
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch dependent table ${rel.fromTable}:`, error);
        }
      }
    }

    // Fetch dependency tables (tables that this table references)
    if (fetchDependencies) {
      const relationshipsFromThisTable = dependencyGraph.getRelationshipsFrom(this.tableName);

      for (const rel of relationshipsFromThisTable) {
        // If specific tables are requested, filter
        if (dependenciesList && !dependenciesList.includes(rel.toTable)) {
          continue;
        }

        try {
          const relatedOps = new TableOperationsImpl(
            rel.toTable,
            this.dbManager,
            this.cacheManager,
            this.invalidationManager,
            this.queryBuilder,
            this.cacheConfig
          );

          // Collect all unique FK values
          const fkValues = new Set<any>();
          for (const record of enrichedRecords) {
            const fkValue = (record as any)[rel.fromColumn];
            if (fkValue !== undefined && fkValue !== null) {
              fkValues.add(fkValue);
            }
          }

          // Skip if no valid FK values
          if (fkValues.size === 0) {
            continue;
          }

          // CRITICAL FIX: Fetch all related records in a SINGLE batched query using IN clause
          // instead of one query per FK value (which causes N+1 problem)
          const fkArray = Array.from(fkValues);
          const whereClause = { [rel.toColumn]: fkArray };
          const relatedData = await relatedOps.findMany(whereClause as any, { correlationId });

          // Build a map for quick lookup
          const relatedDataMap = new Map<any, any>();
          for (const relatedRecord of relatedData) {
            const pkValue = (relatedRecord as any)[rel.toColumn];
            // Store by PK value for O(1) lookup
            if (pkValue !== undefined && pkValue !== null) {
              relatedDataMap.set(pkValue, relatedRecord);
            }
          }

          // Attach related data to records
          for (const record of enrichedRecords) {
            const fkValue = (record as any)[rel.fromColumn];
            if (fkValue !== undefined && fkValue !== null) {
              const relatedRecord = relatedDataMap.get(fkValue);
              if (relatedRecord) {
                (record as any)[rel.toTable] = relatedRecord;
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch dependency table ${rel.toTable}:`, error);
        }
      }
    }

    // Performance logging
    const relationEndTime = Date.now();
    const relationLoadTime = relationEndTime - relationStartTime;

    if (relationLoadTime > 1000) {
      console.warn(
        `[Performance] Relation loading took ${relationLoadTime}ms for ${recordCount} records. ` +
        `Consider optimizing your query or reducing the result set size.`
      );
    } else if (recordCount > 100) {
      // Log successful fast queries for large datasets
      console.log(
        `[Performance] Successfully loaded relations for ${recordCount} records in ${relationLoadTime}ms ` +
        `(${(relationLoadTime / recordCount).toFixed(2)}ms per record)`
      );
    }

    return enrichedRecords;
  }

  async invalidateCache(): Promise<void> {
    await this.invalidationManager.invalidateTable(this.tableName, {
      cascade: false,
    });
  }

  async warmCache(where?: WhereClause<T>, correlationId?: string): Promise<void> {
    // Pre-fetch and cache common queries
    await this.findMany(where, { correlationId });
  }

  async warmCacheWithRelations(
    where?: WhereClause<T>,
    options?: {
      correlationId?: string;
      depth?: number;
      warmDependents?: boolean;
      warmDependencies?: boolean;
    }
  ): Promise<void> {
    const {
      correlationId,
      depth = 1,
      warmDependents = true,
      warmDependencies = true,
    } = options || {};

    // Warm cache for current table
    const currentTableData = await this.findMany(where, { correlationId });

    if (depth <= 0) {
      return;
    }

    const dependencyGraph = this.invalidationManager['dependencyGraph'];

    // Warm dependent tables (tables that reference this table with FK)
    if (warmDependents) {
      const relationshipsToThisTable = dependencyGraph.getRelationshipsTo(this.tableName);

      for (const rel of relationshipsToThisTable) {
        try {
          const relatedOps = new TableOperationsImpl(
            rel.fromTable,
            this.dbManager,
            this.cacheManager,
            this.invalidationManager,
            this.queryBuilder,
            this.cacheConfig
          );

          // Warm general query first
          await relatedOps.findMany({}, { correlationId, limit: 100 });

          // Then warm specific queries for each record in current table
          // This ensures queries like "SELECT * FROM orders WHERE provider_id = ?" will hit cache
          for (const record of currentTableData.slice(0, 10)) { // Limit to first 10 to avoid excessive queries
            const pkValue = (record as any)[rel.toColumn];
            if (pkValue !== undefined && pkValue !== null) {
              const whereClause = { [rel.fromColumn]: pkValue };
              await relatedOps.findMany(whereClause, { correlationId, limit: 100 });
            }
          }
        } catch (error) {
          // Log but don't throw - warming is best effort
          console.warn(`Failed to warm cache for dependent table ${rel.fromTable}:`, error);
        }
      }
    }

    // Warm dependency tables (tables that this table references with FK)
    if (warmDependencies) {
      const relationshipsFromThisTable = dependencyGraph.getRelationshipsFrom(this.tableName);

      for (const rel of relationshipsFromThisTable) {
        try {
          const relatedOps = new TableOperationsImpl(
            rel.toTable,
            this.dbManager,
            this.cacheManager,
            this.invalidationManager,
            this.queryBuilder,
            this.cacheConfig
          );

          // Warm general query
          await relatedOps.findMany({}, { correlationId, limit: 100 });

          // Warm specific records that are referenced
          const referencedIds = new Set<any>();
          for (const record of currentTableData) {
            const fkValue = (record as any)[rel.fromColumn];
            if (fkValue !== undefined && fkValue !== null) {
              referencedIds.add(fkValue);
            }
          }

          // Warm each referenced record
          for (const refId of Array.from(referencedIds).slice(0, 10)) { // Limit to first 10
            const whereClause = { [rel.toColumn]: refId };
            await relatedOps.findMany(whereClause, { correlationId, limit: 100 });
          }
        } catch (error) {
          // Log but don't throw - warming is best effort
          console.warn(`Failed to warm cache for dependency table ${rel.toTable}:`, error);
        }
      }
    }
  }

  /**
   * Full-text search using inverted index
   * Returns ranked results with optional highlighting
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult<T>[]> {
    if (!this.indexManager || !this.searchRanker) {
      throw new Error(
        `Search is not enabled for table "${this.tableName}". ` +
        'Configure search in SqlDBConfig and initialize the client.'
      );
    }

    const startTime = Date.now();
    const {
      fields,
      limit = 10,
      offset = 0,
      filters,
      ranking,
      highlightFields,
      minScore = 0,
    } = options || {};

    // Step 1: Search inverted index to get document IDs
    const docIds = await this.indexManager.search(this.tableName, query, limit + offset);

    if (docIds.length === 0) {
      return [];
    }

    // Step 2: Fetch full records from database
    const idsToFetch = docIds.slice(offset, offset + limit);

    if (idsToFetch.length === 0) {
      return [];
    }

    // Detect the ID field name (id, service_id, etc.)
    const idField = this.detectIdField();

    // Build SQL IN clause manually since query builder doesn't support $in
    const placeholders = idsToFetch.map(() => '?').join(',');
    const whereFilters = filters ? Object.entries(filters).map(([key, val]) => `${key} = ?`).join(' AND ') : '';
    const sql = whereFilters
      ? `SELECT * FROM ${this.tableName} WHERE ${idField} IN (${placeholders}) AND ${whereFilters} LIMIT ?`
      : `SELECT * FROM ${this.tableName} WHERE ${idField} IN (${placeholders}) LIMIT ?`;

    const params = filters
      ? [...idsToFetch, ...Object.values(filters), limit]
      : [...idsToFetch, limit];

    let records = await this.raw<T[]>(sql, params);

    // Apply case conversion if enabled (database -> application)
    if (this.caseConversionConfig?.enabled) {
      records = CaseConverter.objectKeysToCamel(records);
    }

    // Determine the field name to use for lookup (convert to camelCase if needed)
    const lookupField = this.caseConversionConfig?.enabled
      ? CaseConverter.snakeToCamel(idField)
      : idField;

    // Create a map for quick lookup (ID as string to support UUIDs)
    const recordsMap = new Map<string, T>();
    for (const record of records) {
      const id = (record as any)[lookupField];
      if (id !== undefined && id !== null) {
        recordsMap.set(String(id), record);
      }
    }

    // Step 3: Build results array in the correct order with scores
    const results: SearchResult<T>[] = [];

    for (const docId of idsToFetch) {
      const record = recordsMap.get(docId);
      if (!record) continue;

      // Calculate relevance score (simplified for now)
      const score = this.calculateSimpleScore(query, record, fields);

      if (score < minScore) {
        continue;
      }

      const result: SearchResult<T> = {
        score,
        data: record,
      };

      // Add highlights if requested
      if (highlightFields && highlightFields.length > 0) {
        result.highlights = {};
        const queryTerms = query.toLowerCase().split(/\s+/);

        for (const field of highlightFields) {
          const fieldValue = (record as any)[field];
          if (fieldValue && typeof fieldValue === 'string') {
            result.highlights[field] = this.searchRanker.highlightText(
              fieldValue,
              queryTerms
            );
          }
        }
      }

      // Add matched terms
      result.matchedTerms = query.toLowerCase().split(/\s+/);

      results.push(result);
    }

    const executionTime = Date.now() - startTime;

    // Record stats if enabled
    if (this.statsTracker) {
      const queryId = generateQueryId();
      this.statsTracker.recordAccess({
        queryId,
        tableName: this.tableName,
        queryType: 'search',
        filters: JSON.stringify({ query, options }),
        executionTimeMs: executionTime,
        cacheHit: false,
        timestamp: new Date(),
      }).catch(() => {
        // Ignore stats tracking errors
      });
    }

    return results;
  }

  /**
   * Build search index for this table from scratch
   */
  async buildSearchIndex(): Promise<IndexStats & { geoBuckets?: any }> {
    if (!this.indexManager) {
      throw new Error(
        `Search is not enabled for table "${this.tableName}". ` +
        'Configure search in SqlDBConfig and initialize the client.'
      );
    }

    // Fetch all records from the table
    const records = await this.findMany({}, { skipCache: true });

    // Build the index
    const stats = await this.indexManager.buildIndex(this.tableName, records as any[]);

    // If geo-search is enabled, automatically build geo-buckets
    let geoBucketStats;
    if (this.geoSearchManager) {
      try {
        geoBucketStats = await this.geoSearchManager.buildGeoBuckets({
          targetBucketSize: 5,
          gridSizeKm: 10,
          minBucketSize: 3,
        });
        console.log(`✅ Geo-buckets built: ${geoBucketStats.totalBuckets} buckets created`);
      } catch (error) {
        console.error('Failed to build geo-buckets:', error);
        // Don't fail the entire index build if geo-buckets fail
      }
    }

    return {
      ...stats,
      geoBuckets: geoBucketStats,
    };
  }

  /**
   * Rebuild search index (clear and rebuild)
   */
  async rebuildSearchIndex(): Promise<IndexStats> {
    if (!this.indexManager) {
      throw new Error(
        `Search is not enabled for table "${this.tableName}". ` +
        'Configure search in SqlDBConfig and initialize the client.'
      );
    }

    // Clear existing index
    await this.indexManager.clearIndex(this.tableName);

    // Rebuild from scratch
    return await this.buildSearchIndex();
  }

  /**
   * Get search index statistics
   */
  async getSearchStats(): Promise<IndexStats | null> {
    if (!this.indexManager) {
      return null;
    }

    return await this.indexManager.getStats(this.tableName);
  }

  /**
   * Calculate a simple relevance score for a document
   * This is a fallback when full TF-IDF scoring isn't available
   */
  private calculateSimpleScore(query: string, record: T, fields?: string[]): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const searchFields = fields || Object.keys(record as any);

    let score = 0;
    let maxScore = 0;

    for (const field of searchFields) {
      const fieldValue = (record as any)[field];
      if (!fieldValue || typeof fieldValue !== 'string') {
        continue;
      }

      const lowerValue = fieldValue.toLowerCase();
      maxScore += queryTerms.length;

      for (const term of queryTerms) {
        if (lowerValue.includes(term)) {
          score += 1;

          // Bonus for exact word match
          const wordBoundaryRegex = new RegExp(`\\b${term}\\b`, 'i');
          if (wordBoundaryRegex.test(fieldValue)) {
            score += 0.5;
          }
        }
      }
    }

    return maxScore > 0 ? score / maxScore : 0;
  }

  /**
   * Detect the primary key field name for this table
   * Returns 'id', '{table}_id', or first field ending in '_id'
   */
  private detectIdField(): string {
    // Default to 'id'
    // In a real implementation, this should query the schema
    // For now, try common patterns
    const singularTable = this.tableName.replace(/s$/, ''); // services → service
    return `${singularTable}_id`;
  }

  /**
   * Build geo-buckets with dynamic clustering for this table
   * Groups geographic points into clusters based on proximity
   *
   * @param options - Clustering configuration
   * @returns Bucket statistics and list of created buckets
   */
  async buildGeoBuckets(options?: {
    targetBucketSize?: number;
    gridSizeKm?: number;
    minBucketSize?: number;
  }) {
    if (!this.geoSearchManager) {
      throw new Error(
        `Geo-search is not enabled for table "${this.tableName}". ` +
        'Configure geo-search in SqlDBConfig for this table.'
      );
    }

    const defaultOptions = {
      targetBucketSize: 5,
      gridSizeKm: 10,
      minBucketSize: 3,
      ...options,
    };

    return await this.geoSearchManager.buildGeoBuckets(defaultOptions);
  }

  /**
   * Get all pre-computed geo-buckets for this table
   * Returns clusters that were created by buildGeoBuckets()
   *
   * @returns List of geo-buckets with metadata
   */
  async getGeoBuckets() {
    if (!this.geoSearchManager) {
      throw new Error(
        `Geo-search is not enabled for table "${this.tableName}". ` +
        'Configure geo-search in SqlDBConfig for this table.'
      );
    }

    return await this.geoSearchManager.getGeoBuckets();
  }
}
