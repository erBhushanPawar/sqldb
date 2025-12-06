import { MariaDBConnectionManager } from '../connection/mariadb';
import { CacheManager } from '../cache/cache-manager';
import { InvalidationManager } from '../cache/invalidation';
import { QueryBuilder } from './query-builder';
import { TableOperations, WhereClause, FindOptions } from '../types/query';
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

    // Build cache key
    const cacheKey = this.cacheManager
      .getKeyBuilder()
      .buildKey(this.tableName, 'findMany', { where, options });

    // Try cache first
    if (!skipCache && this.cacheManager.isEnabled()) {
      const cached = await this.cacheManager.get<T[]>(cacheKey);
      if (cached !== null) {
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

    // Invalidate cache
    if (this.cacheConfig.invalidateOnWrite) {
      await this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      );
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

    // Invalidate cache
    if (this.cacheConfig.invalidateOnWrite) {
      await this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      );
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

    // Invalidate cache
    if (this.cacheConfig.invalidateOnWrite) {
      await this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      );
    }

    // Fetch and return the updated record
    if (result.affectedRows > 0) {
      return await this.findOne(where, { correlationId });
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

    // Invalidate cache
    if (this.cacheConfig.invalidateOnWrite) {
      await this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      );
    }

    return result.affectedRows || 0;
  }

  async updateById(id: string | number, data: Partial<T>, correlationId?: string): Promise<T | null> {
    const { sql, params } = this.queryBuilder.buildUpdateById(
      this.tableName,
      id,
      data
    );

    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache
    if (this.cacheConfig.invalidateOnWrite) {
      await this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      );
    }

    // Fetch and return the updated record
    if (result.affectedRows > 0) {
      return await this.findById(id, correlationId);
    }

    return null;
  }

  async deleteOne(where: WhereClause<T>, correlationId?: string): Promise<boolean> {
    const { sql, params } = this.queryBuilder.buildDelete(this.tableName, where);
    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache
    if (this.cacheConfig.invalidateOnWrite) {
      await this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      );
    }

    return (result.affectedRows || 0) > 0;
  }

  async deleteMany(where: WhereClause<T>, correlationId?: string): Promise<number> {
    const { sql, params } = this.queryBuilder.buildDelete(this.tableName, where);
    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache
    if (this.cacheConfig.invalidateOnWrite) {
      await this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      );
    }

    return result.affectedRows || 0;
  }

  async deleteById(id: string | number, correlationId?: string): Promise<boolean> {
    const { sql, params } = this.queryBuilder.buildDeleteById(this.tableName, id);
    const result: any = await this.dbManager.query(sql, params, correlationId);

    // Invalidate cache
    if (this.cacheConfig.invalidateOnWrite) {
      await this.invalidationManager.invalidateTable(
        this.tableName,
        { cascade: this.cacheConfig.cascadeInvalidation }
      );
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

  async invalidateCache(): Promise<void> {
    await this.invalidationManager.invalidateTable(this.tableName, {
      cascade: false,
    });
  }

  async warmCache(where?: WhereClause<T>, correlationId?: string): Promise<void> {
    // Pre-fetch and cache common queries
    await this.findMany(where, { correlationId });
  }
}
