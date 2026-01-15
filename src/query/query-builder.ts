import { WhereClause, FindOptions, QueryResult, OrderByOption } from '../types/query';
import { isOperatorObject, isLogicalOperator } from '../types/operators';
import { fieldOperators, logicalOperators, getStringOperators, isKnownOperator } from './operators';

export class QueryBuilder {
  buildSelect(
    table: string,
    where?: WhereClause,
    options?: FindOptions
  ): QueryResult {
    const select = options?.select?.join(', ') || '*';
    let sql = `SELECT ${select} FROM ${table}`;
    const params: any[] = [];

    if (where) {
      const whereClause = this.buildWhereClause(where, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    if (options?.orderBy) {
      sql += this.buildOrderBy(options.orderBy);
    }

    if (options?.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options?.offset) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }

    return { sql, params };
  }

  buildCount(table: string, where?: WhereClause): QueryResult {
    let sql = `SELECT COUNT(*) as count FROM ${table}`;
    const params: any[] = [];

    if (where) {
      const whereClause = this.buildWhereClause(where, params);
      if (whereClause) {
        sql += ` WHERE ${whereClause}`;
      }
    }

    return { sql, params };
  }

  buildInsert(table: string, data: any): QueryResult {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const params = columns.map((col) => data[col]);

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    return { sql, params };
  }

  buildInsertMany(table: string, dataArray: any[]): QueryResult {
    if (dataArray.length === 0) {
      throw new Error('Cannot insert empty array');
    }

    const columns = Object.keys(dataArray[0]);
    const placeholders = dataArray
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');

    const params: any[] = [];
    for (const data of dataArray) {
      for (const col of columns) {
        params.push(data[col]);
      }
    }

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`;

    return { sql, params };
  }

  buildUpdate(table: string, where: WhereClause, data: any): QueryResult {
    const columns = Object.keys(data);
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const params = columns.map((col) => data[col]);

    let sql = `UPDATE ${table} SET ${setClause}`;

    const whereClause = this.buildWhereClause(where, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    return { sql, params };
  }

  buildDelete(table: string, where: WhereClause): QueryResult {
    let sql = `DELETE FROM ${table}`;
    const params: any[] = [];

    const whereClause = this.buildWhereClause(where, params);
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }

    return { sql, params };
  }

  buildSelectById(table: string, id: string | number, select?: string[]): QueryResult {
    const columns = select?.join(', ') || '*';
    const sql = `SELECT ${columns} FROM ${table} WHERE id = ?`;
    return { sql, params: [id] };
  }

  buildUpdateById(table: string, id: string | number, data: any): QueryResult {
    const columns = Object.keys(data);
    const setClause = columns.map((col) => `${col} = ?`).join(', ');
    const params = [...columns.map((col) => data[col]), id];

    const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;

    return { sql, params };
  }

  buildDeleteById(table: string, id: string | number): QueryResult {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    return { sql, params: [id] };
  }

  private buildWhereClause(where: WhereClause, params: any[]): string {
    const conditions: string[] = [];

    for (const [key, value] of Object.entries(where)) {
      // Handle logical operators (AND, OR, NOT)
      if (isLogicalOperator(key)) {
        const logicalFn = logicalOperators[key];
        const clause = logicalFn(value, this.buildWhereClause.bind(this), params);
        if (clause) {
          conditions.push(clause);
        }
        continue;
      }

      // Handle undefined - skip
      if (value === undefined) {
        continue;
      }

      // Handle null - direct IS NULL check
      if (value === null) {
        conditions.push(`${key} IS NULL`);
        continue;
      }

      // Handle Date objects - treat as equality
      if (value instanceof Date) {
        conditions.push(`${key} = ?`);
        params.push(value);
        continue;
      }

      // Handle arrays - backward compatible IN clause (with deprecation path)
      if (Array.isArray(value)) {
        // Legacy array syntax: { age: [18, 21, 25] } -> age IN (18, 21, 25)
        // Still supported for backward compatibility
        if (value.length === 0) {
          conditions.push('1 = 0'); // Empty array = no match
        } else {
          const placeholders = value.map(() => '?').join(', ');
          conditions.push(`${key} IN (${placeholders})`);
          params.push(...value);
        }
        continue;
      }

      // Handle operator objects: { age: { gte: 18, lte: 65 } }
      if (isOperatorObject(value)) {
        const operatorConditions: string[] = [];
        let caseInsensitive = false;

        // Check for mode option (for string operators)
        if (value.mode === 'insensitive') {
          caseInsensitive = true;
        }

        // Get appropriate string operators based on mode
        const stringOps = caseInsensitive ? getStringOperators('insensitive') : getStringOperators('default');

        // Process each operator in the object
        for (const [operator, operatorValue] of Object.entries(value)) {
          // Skip mode as it's a modifier, not an operator
          if (operator === 'mode') {
            continue;
          }

          // Check if it's a known operator
          if (isKnownOperator(operator)) {
            // Use string operators if available and case-insensitive mode is set
            if (operator in stringOps && caseInsensitive) {
              const processor = stringOps[operator as keyof typeof stringOps];
              const condition = processor.buildCondition(key, operatorValue, params);
              operatorConditions.push(condition);
            } else if (operator in fieldOperators) {
              const processor = fieldOperators[operator];
              const condition = processor.buildCondition(key, operatorValue, params);
              operatorConditions.push(condition);
            } else {
              // Logical operators shouldn't appear here, but handle gracefully
              console.warn(`Unexpected operator '${operator}' in field context`);
            }
          } else {
            // Unknown operator - treat the whole object as a value (backward compatibility)
            conditions.push(`${key} = ?`);
            params.push(value);
            break;
          }
        }

        if (operatorConditions.length > 0) {
          // Multiple operators on same field are AND'd together
          if (operatorConditions.length === 1) {
            conditions.push(operatorConditions[0]);
          } else {
            conditions.push(`(${operatorConditions.join(' AND ')})`);
          }
        }
        continue;
      }

      // Handle legacy $ operators for backward compatibility
      if (typeof value === 'object' && value !== null) {
        const operator = Object.keys(value)[0];
        const operatorValue = value[operator];

        // Legacy operators: $gt, $gte, $lt, $lte, $ne, $like
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
            // Not a legacy operator - treat as equality with object value
            conditions.push(`${key} = ?`);
            params.push(value);
        }
        continue;
      }

      // Default: simple equality
      conditions.push(`${key} = ?`);
      params.push(value);
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
