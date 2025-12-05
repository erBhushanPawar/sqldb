import { WhereClause, FindOptions, QueryResult, OrderByOption } from '../types/query';

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
