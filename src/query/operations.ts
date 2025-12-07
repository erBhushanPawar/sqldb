import { MariaDBConnectionManager } from '../connection/mariadb';
import { CacheManager } from '../cache/cache-manager';
import { InvalidationManager } from '../cache/invalidation';
import { QueryBuilder } from './query-builder';
import { TableOperations, WhereClause, FindOptions, RelationConfig } from '../types/query';
import { CacheConfig } from '../types/config';

export class TableOperationsImpl<T = any> implements TableOperations<T> {
  private tableName: string;
  private dbManager: MariaDBConnectionManager;
  private cacheManager: CacheManager;
  private invalidationManager: InvalidationManager;
  private queryBuilder: QueryBuilder;
  private cacheConfig: Required<CacheConfig>;

  constructor(
    tableName: string,
    dbManager: MariaDBConnectionManager,
    cacheManager: CacheManager,
    invalidationManager: InvalidationManager,
    queryBuilder: QueryBuilder,
    cacheConfig: Required<CacheConfig>
  ) {
    this.tableName = tableName;
    this.dbManager = dbManager;
    this.cacheManager = cacheManager;
    this.invalidationManager = invalidationManager;
    this.queryBuilder = queryBuilder;
    this.cacheConfig = cacheConfig;
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

    // Build cache key (exclude correlationId, skipCache, and withRelations from key as they don't affect the base query result)
    const { correlationId: _, skipCache: __, withRelations: ___, ...cacheableOptions } = options || {};
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildKey(this.tableName, 'findMany', { where, options: cacheableOptions });

    // Try cache first
    if (!skipCache && this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<T[]>(cacheKey);
      if (cached !== null) {
        // If withRelations is requested, fetch and attach related data
        if (withRelations) {
          return await this.attachRelations(cached, withRelations, correlationId);
        }
        return cached;
      }
    }

    // Query database
    const { sql, params } = this.queryBuilder.buildSelect(
      this.tableName,
      where,
      options
    );

    const results = await this.dbManager.query<T[]>(sql, params, correlationId);

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
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildIdKey(this.tableName, id);

    // Try cache first
    if (this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Query database
    const { sql, params } = this.queryBuilder.buildSelectById(this.tableName, id);
    const results = await this.dbManager.query<T[]>(sql, params, correlationId);

    const result = results.length > 0 ? results[0] : null;

    // Cache result
    if (result && this.cacheManager.isEnabled()) {
      await this.cacheManager.set(cacheKey, result);
    }

    return result;
  }

  async count(where?: WhereClause<T>, correlationId?: string): Promise<number> {
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildKey(this.tableName, 'count', { where });

    // Try cache first (with shorter TTL for counts)
    if (this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<number>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Query database
    const { sql, params } = this.queryBuilder.buildCount(this.tableName, where);
    const results = await this.dbManager.query<any[]>(sql, params, correlationId);

    const count = results[0]?.count || 0;

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
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildKey(this.tableName, 'raw', { sql, params });

    // Try cache first
    if (this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<R>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    // Query database
    const result = await this.dbManager.query<R>(sql, params, correlationId);

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

          // Group records by their PK value and fetch related data for each
          for (const record of enrichedRecords) {
            const pkValue = (record as any)[rel.toColumn];
            if (pkValue !== undefined && pkValue !== null) {
              const whereClause = { [rel.fromColumn]: pkValue };
              const relatedData = await relatedOps.findMany(whereClause, { correlationId, limit: 100 });

              // Attach related data to the record
              (record as any)[rel.fromTable] = relatedData;
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

          // Fetch all related records in batch
          const relatedDataMap = new Map<any, any>();
          for (const fkValue of fkValues) {
            const whereClause = { [rel.toColumn]: fkValue };
            const relatedData = await relatedOps.findMany(whereClause, { correlationId, limit: 100 });
            if (relatedData.length > 0) {
              relatedDataMap.set(fkValue, relatedData[0]); // Use first match for 1-to-1 relations
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
}
