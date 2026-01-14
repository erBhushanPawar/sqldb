import { WhereClause, FindOptions, QueryResult, OrderByOption } from '../types/query';
import { CaseConversionConfig } from '../types/config';
import { CaseConverter } from '../utils/case-converter';

export class QueryBuilder {
  private caseConversionConfig?: CaseConversionConfig;

  constructor(caseConversionConfig?: CaseConversionConfig) {
    this.caseConversionConfig = caseConversionConfig;
  }
  buildSelect(
    table: string,
    where?: WhereClause,
    options?: FindOptions
  ): QueryResult {
    // Convert WHERE clause from camelCase to snake_case if enabled
    let convertedWhere = where;
    if (this.caseConversionConfig?.enabled && where) {
      convertedWhere = CaseConverter.objectKeysToSnake(where);
    }

    // Check if 'where' is a SearchFilterModel and extract options from it
    let effectiveOptions = options;
    let effectiveSelect = options?.select?.join(', ') || '*';

    if (convertedWhere && typeof convertedWhere === 'object' &&
        ('andFilter' in convertedWhere || 'likeFilter' in convertedWhere || 'orFilter' in convertedWhere)) {
      const filterModel = convertedWhere as any;

      // Use selectFields from SearchFilterModel if available
      if (filterModel.selectFields && Array.isArray(filterModel.selectFields) && filterModel.selectFields.length > 0) {
        // Convert select fields to snake_case if enabled
        const selectFields = this.caseConversionConfig?.enabled
          ? CaseConverter.columnsToSnake(filterModel.selectFields)
          : filterModel.selectFields;
        effectiveSelect = selectFields.join(', ');
      }

      // Merge options from SearchFilterModel with provided options
      // Convert orderBy field to snake_case if enabled
      let orderByOption = effectiveOptions?.orderBy;
      if (!orderByOption && filterModel.orderBy && filterModel.order) {
        const orderByField = this.caseConversionConfig?.enabled
          ? CaseConverter.camelToSnake(filterModel.orderBy)
          : filterModel.orderBy;
        orderByOption = {
          column: orderByField,
          direction: filterModel.order
        };
      }

      effectiveOptions = {
        ...effectiveOptions,
        limit: effectiveOptions?.limit || filterModel.limit,
        offset: effectiveOptions?.offset || filterModel.skip,
        orderBy: orderByOption
      };
    }

    let sql = `SELECT ${effectiveSelect} FROM ${table}`;
    const params: any[] = [];

    if (convertedWhere) {
      const whereClause = this.buildWhereClause(convertedWhere, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    if (effectiveOptions?.orderBy) {
      sql += this.buildOrderBy(effectiveOptions.orderBy);
    }

    if (effectiveOptions?.limit) {
      sql += ` LIMIT ?`;
      params.push(effectiveOptions.limit);
    }

    if (effectiveOptions?.offset) {
      sql += ` OFFSET ?`;
      params.push(effectiveOptions.offset);
    }

    return { sql, params };
  }

  buildCount(table: string, where?: WhereClause): QueryResult {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    // Convert WHERE clause from camelCase to snake_case if enabled
    const convertedWhere = this.caseConversionConfig?.enabled && where
      ? CaseConverter.objectKeysToSnake(where)
      : where;

    if (convertedWhere) {
      const whereClause = this.buildWhereClause(convertedWhere, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    return { sql, params };
  }

  buildInsert(table: string, data: any): QueryResult {
    // Convert data from camelCase to snake_case if enabled
    const convertedData = this.caseConversionConfig?.enabled
      ? CaseConverter.objectKeysToSnake(data)
      : data;

    const columns = Object.keys(convertedData);
    const placeholders = columns.map(() => '?').join(', ');
    const params = columns.map((col) => convertedData[col]);

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    return { sql, params };
  }

  buildInsertMany(table: string, dataArray: any[]): QueryResult {
    if (dataArray.length === 0) {
      throw new Error('Cannot insert empty array');
    }

    // Convert data from camelCase to snake_case if enabled
    const convertedDataArray = this.caseConversionConfig?.enabled
      ? dataArray.map(data => CaseConverter.objectKeysToSnake(data))
      : dataArray;

    const columns = Object.keys(convertedDataArray[0]);
    const placeholders = convertedDataArray
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');

    const params: any[] = [];
    for (const data of convertedDataArray) {
      for (const col of columns) {
        params.push(data[col]);
      }
    }

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;

    return { sql, params };
  }

  buildUpdate(table: string, where: WhereClause, data: any): QueryResult {
    // Convert data from camelCase to snake_case if enabled
    const convertedData = this.caseConversionConfig?.enabled
      ? CaseConverter.objectKeysToSnake(data)
      : data;

    // Convert WHERE clause from camelCase to snake_case if enabled
    const convertedWhere = this.caseConversionConfig?.enabled
      ? CaseConverter.objectKeysToSnake(where)
      : where;

    const columns = Object.keys(convertedData);
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const params = columns.map((col) => convertedData[col]);

    let sql = `UPDATE ${table} SET ${setClause}`;

    const whereClause = this.buildWhereClause(convertedWhere, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    return { sql, params };
  }

  buildDelete(table: string, where: WhereClause): QueryResult {
    let sql = `DELETE FROM ${table}`;
    const params: any[] = [];

    // Convert WHERE clause from camelCase to snake_case if enabled
    const convertedWhere = this.caseConversionConfig?.enabled
      ? CaseConverter.objectKeysToSnake(where)
      : where;

    const whereClause = this.buildWhereClause(convertedWhere, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    return { sql, params };
  }

  buildSelectById(table: string, id: string | number, select?: string[]): QueryResult {
    // Convert select fields to snake_case if enabled
    const convertedSelect = this.caseConversionConfig?.enabled && select
      ? CaseConverter.columnsToSnake(select)
      : select;

    const columns = convertedSelect?.join(', ') || '*';
    const sql = `SELECT ${columns} FROM ${table} WHERE id = ?`;
    return { sql, params: [id] };
  }

  buildUpdateById(table: string, id: string | number, data: any): QueryResult {
    // Convert data from camelCase to snake_case if enabled
    const convertedData = this.caseConversionConfig?.enabled
      ? CaseConverter.objectKeysToSnake(data)
      : data;

    const columns = Object.keys(convertedData);
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const params = [...columns.map((col) => convertedData[col]), id];

    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;

    return { sql, params };
  }

  buildDeleteById(table: string, id: string | number): QueryResult {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    return { sql, params: [id] };
  }

  private buildWhereClause(where: WhereClause, params: any[]): string {
    // Check if 'where' is a SearchFilterModel with builtWhereClause
    if (where && typeof where === 'object' &&
        ('andFilter' in where || 'likeFilter' in where || 'orFilter' in where)) {
      return this.buildSearchFilterModelClause(where, params);
    }

    const conditions: string[] = [];

    for (const [key, value] of Object.entries(where)) {
      if (value === null) {
        conditions.push(`${key} IS NULL`);
      } else if (value === undefined) {
        // Skip undefined values
        continue;
      } else if (Array.isArray(value)) {
        // IN clause
        const placeholders = value.map(() => '?').join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle operators like { $gt: 5 }, { $like: '%test%' }
        const operator = Object.keys(value)[0];
        const operatorValue = value[operator];

        switch (operator) {
          case '$gt':
            conditions.push(`${key} > ?`);
            params.push(operatorValue);
            break;
          case '$gte':
            conditions.push(`${key} >= ?`);
            params.push(operatorValue);
            break;
          case '$lt':
            conditions.push(`${key} < ?`);
            params.push(operatorValue);
            break;
          case '$lte':
            conditions.push(`${key} <= ?`);
            params.push(operatorValue);
            break;
          case '$ne':
            conditions.push(`${key} != ?`);
            params.push(operatorValue);
            break;
          case '$like':
            conditions.push(`${key} LIKE ?`);
            params.push(operatorValue);
            break;
          default:
            // Treat as equality
            conditions.push(`${key} = ?`);
            params.push(value);
        }
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Build WHERE clause from SearchFilterModel
   * Supports: andFilter, likeFilter, orFilter, range queries (minimum/maximum)
   */
  private buildSearchFilterModelClause(filterModel: any, params: any[]): string {
    const conditions: string[] = [];

    // Handle andFilter (exact matches and complex conditions)
    if (filterModel.andFilter && Object.keys(filterModel.andFilter).length > 0) {
      for (const [key, value] of Object.entries(filterModel.andFilter)) {
        if (value !== null && value !== undefined) {
          // Check if it's a TypeORM Like operator result
          if (typeof value === 'object' && '_type' in value && (value as any)._type === 'find-operator') {
            conditions.push(`${key} LIKE ?`);
            params.push((value as any)._value);
          }
          // Check if it's a Between operator result
          else if (typeof value === 'object' && '_type' in value && (value as any)._type === 'between') {
            conditions.push(`${key} BETWEEN ? AND ?`);
            params.push((value as any)._value[0], (value as any)._value[1]);
          }
          // Check for minimum/maximum range object
          else if (typeof value === 'object' && ('minimum' in value || 'maximum' in value)) {
            const rangeValue = value as any;
            if (rangeValue.minimum !== undefined && rangeValue.maximum !== undefined) {
              conditions.push(`${key} BETWEEN ? AND ?`);
              params.push(rangeValue.minimum, rangeValue.maximum);
            } else if (rangeValue.minimum !== undefined) {
              conditions.push(`${key} >= ?`);
              params.push(rangeValue.minimum);
            } else if (rangeValue.maximum !== undefined) {
              conditions.push(`${key} <= ?`);
              params.push(rangeValue.maximum);
            }
          }
          // Handle array for IN clause
          else if (Array.isArray(value)) {
            const placeholders = value.map(() => '?').join(', ');
            conditions.push(`${key} IN (${placeholders})`);
            params.push(...value);
          }
          // Simple equality
          else {
            conditions.push(`${key} = ?`);
            params.push(value);
          }
        }
      }
    }

    // Handle likeFilter (partial matches with LIKE)
    if (filterModel.likeFilter && Object.keys(filterModel.likeFilter).length > 0) {
      for (const [key, value] of Object.entries(filterModel.likeFilter)) {
        if (value !== null && value !== undefined) {
          conditions.push(`${key} LIKE ?`);
          // Add wildcards if not already present
          const likeValue = String(value);
          params.push(likeValue.includes('%') ? likeValue : `%${likeValue}%`);
        }
      }
    }

    // Handle orFilter (multiple OR conditions)
    if (filterModel.orFilter && Array.isArray(filterModel.orFilter) && filterModel.orFilter.length > 0) {
      const orConditions: string[] = [];
      for (const orItem of filterModel.orFilter) {
        if (orItem && typeof orItem === 'object') {
          for (const [key, value] of Object.entries(orItem)) {
            if (value !== null && value !== undefined) {
              // Check if it's a TypeORM Like operator
              if (typeof value === 'object' && '_type' in value && (value as any)._type === 'find-operator') {
                orConditions.push(`${key} LIKE ?`);
                params.push((value as any)._value);
              } else {
                orConditions.push(`${key} = ?`);
                params.push(value);
              }
            }
          }
        }
      }
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(' OR ')})`);
      }
    }

    return conditions.join(' AND ');
  }

  private buildOrderBy(orderBy: string | OrderByOption | OrderByOption[]): string {
    if (typeof orderBy === 'string') {
      return ` ORDER BY ${orderBy}`;
    }

    if (Array.isArray(orderBy)) {
      const clauses = orderBy.map(
        (opt) => `${opt.column} ${opt.direction}`
      );
      return ` ORDER BY ${clauses.join(', ')}`;
    }

    return ` ORDER BY ${orderBy.column} ${orderBy.direction}`;
  }
}
