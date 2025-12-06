export type WhereClause<T = any> = Partial<T> & {
  [key: string]: any;
};

export interface OrderByOption {
  column: string;
  direction: 'ASC' | 'DESC';
}

export interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string | OrderByOption | OrderByOption[];
  select?: string[];
  skipCache?: boolean;
}

export interface TableOperations<T = any> {
  // Read operations (cache-first)
  findOne(where: WhereClause<T>): Promise<T | null>;
  findMany(where?: WhereClause<T>, options?: FindOptions): Promise<T[]>;
  findById(id: string | number): Promise<T | null>;
  count(where?: WhereClause<T>): Promise<number>;

  // Write operations (invalidate cache)
  insertOne(data: Omit<T, 'id'>): Promise<T>;
  insertMany(data: Omit<T, 'id'>[]): Promise<T[]>;
  updateOne(where: WhereClause<T>, data: Partial<T>): Promise<T | null>;
  updateMany(where: WhereClause<T>, data: Partial<T>): Promise<number>;
  updateById(id: string | number, data: Partial<T>): Promise<T | null>;
  deleteOne(where: WhereClause<T>): Promise<boolean>;
  deleteMany(where: WhereClause<T>): Promise<number>;
  deleteById(id: string | number): Promise<boolean>;

  // Direct DB access (bypass cache)
  raw<R = any>(sql: string, params?: any[]): Promise<R>;

  // Cache control
  invalidateCache(): Promise<void>;
  warmCache(where?: WhereClause<T>): Promise<void>;
}

export interface QueryResult {
  sql: string;
  params: any[];
}
