# Multi-Database Architecture Plan for SqlDB

> **Supporting PostgreSQL, MySQL/MariaDB, MSSQL, MongoDB, and DuckDB**
>
> Date: 2026-01-11
> Status: Planning Phase

---

## Executive Summary

This document outlines the architecture for transforming SqlDB from a MariaDB-only library to a **database-agnostic ORM** that supports multiple database engines while maintaining all performance optimizations (Redis caching, search indexes, auto-warming).

**Supported Databases (Target):**
- **PostgreSQL** - Most popular open-source relational DB
- **MySQL/MariaDB** - Current support (will be refactored)
- **MSSQL** - Enterprise SQL Server support
- **MongoDB** - NoSQL document database
- **DuckDB** - Analytics/OLAP workloads (embedded)

---

## Research Findings

### Prisma's Approach (Driver Adapters v7+)

**Key Insight:** Prisma v7 moved to a **driver adapter system** that uses JavaScript database drivers from the ecosystem instead of built-in drivers.

**Architecture:**
```typescript
// PostgreSQL with @prisma/adapter-pg
import { Pool } from 'pg'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new Pool({ connectionString: url })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
```

**Benefits:**
- Leverage battle-tested ecosystem drivers
- No need to maintain custom database clients
- Community can add new database support easily
- Better compatibility with serverless/edge runtimes

**Limitation:**
- MongoDB support temporarily dropped in v7 (being re-added)

### Drizzle's Approach (Dialect-Specific)

**Key Insight:** Drizzle is **dialect-specific** with separate entry points per database.

**Architecture:**
```typescript
// PostgreSQL
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

// MySQL
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

// SQLite
import { drizzle } from 'drizzle-orm/better-sqlite3'
import Database from 'better-sqlite3'
```

**Benefits:**
- Zero runtime overhead (no abstraction layer)
- SQL-like syntax optimized per dialect
- Tiny bundle size (~7kb gzipped)
- Automatic type inference

**Drawback:**
- Cannot easily switch databases (requires code changes)

### TypeORM's Approach (Unified API)

**Key Insight:** TypeORM provides a **unified API** with internal abstraction layer.

**Architecture:**
```typescript
import { DataSource } from "typeorm"

const AppDataSource = new DataSource({
  type: "postgres", // or "mysql", "mssql", "mongodb", etc.
  host: "localhost",
  port: 5432,
  // ...
})
```

**Benefits:**
- Switch databases with config change only
- Broadest database support (Oracle, SAP HANA, etc.)
- Mature migration system

**Drawback:**
- Larger bundle (~300kb vs Drizzle's 7kb)
- Abstraction layer adds slight overhead

### DuckDB's Architecture (Embedded Analytics)

**Key Insight:** DuckDB is an **embedded database** (like SQLite) optimized for analytics (OLAP).

**Node.js Integration (`@duckdb/node-api`):**
```typescript
import * as duckdb from '@duckdb/node-api';

const db = new duckdb.Database(':memory:');
const conn = await db.connect();
const result = await conn.run('SELECT * FROM data WHERE amount > ?', [100]);
```

**Performance:**
- Blazing fast for analytics queries (aggregations, window functions)
- Columnar storage (vs row-based in MySQL/Postgres)
- Can query Parquet/CSV files directly
- Native support for vectorized operations

**Use Case for SqlDB:**
- Analytics/reporting workloads
- Read-heavy aggregations
- ETL pipelines
- Hybrid OLTP (Postgres) + OLAP (DuckDB) architecture

---

## SqlDB Multi-Database Architecture

### Design Philosophy: Hybrid Approach

**Best of Both Worlds:**
1. **Adapter Pattern** (like Prisma) - Use ecosystem drivers
2. **Dialect Abstraction** (like TypeORM) - Unified API for common operations
3. **Dialect-Specific Optimizations** (like Drizzle) - When needed

**Key Principles:**
- **No breaking changes** - Existing MariaDB users continue working
- **Opt-in per database** - Install only what you need
- **Redis caching works everywhere** - Database-agnostic cache layer
- **Search indexes work everywhere** - Powered by Redis, not DB-specific

---

## Architecture Design

### 1. Database Adapter Interface

**File:** `src/adapters/base-adapter.ts`

```typescript
export interface DatabaseAdapter {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  getConnectionInfo(): ConnectionInfo;

  // Query execution
  query<T>(sql: string, params?: any[]): Promise<T>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;

  // Transaction support
  beginTransaction(): Promise<Transaction>;

  // Schema introspection
  listTables(): Promise<string[]>;
  getTableSchema(tableName: string): Promise<TableSchema>;
  getForeignKeys(): Promise<ForeignKeyRelationship[]>;

  // Database-specific capabilities
  capabilities: DatabaseCapabilities;

  // Query builder (dialect-specific)
  queryBuilder: QueryBuilder;
}

export interface DatabaseCapabilities {
  supportsTransactions: boolean;
  supportsJoins: boolean;
  supportsForeignKeys: boolean;
  supportsFullTextSearch: boolean;
  supportsJsonQueries: boolean;
  supportsGeoSpatial: boolean;
  supportsWindowFunctions: boolean;
  supportsReturning: boolean;  // INSERT ... RETURNING (Postgres)
  maxParameterCount: number;    // SQL Server has 2100 limit
  databaseType: 'sql' | 'nosql';
}

export interface Transaction {
  query<T>(sql: string, params?: any[]): Promise<T>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
```

### 2. Adapter Implementations

#### A. PostgreSQL Adapter
**File:** `src/adapters/postgres-adapter.ts`

```typescript
import { Pool, PoolConfig } from 'pg';
import { DatabaseAdapter } from './base-adapter';
import { PostgresQueryBuilder } from '../query/builders/postgres-builder';

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;
  public queryBuilder: PostgresQueryBuilder;

  constructor(config: PoolConfig) {
    this.pool = new Pool(config);
    this.queryBuilder = new PostgresQueryBuilder();
  }

  get capabilities(): DatabaseCapabilities {
    return {
      supportsTransactions: true,
      supportsJoins: true,
      supportsForeignKeys: true,
      supportsFullTextSearch: true,
      supportsJsonQueries: true,
      supportsGeoSpatial: true,  // PostGIS extension
      supportsWindowFunctions: true,
      supportsReturning: true,
      maxParameterCount: 65535,
      databaseType: 'sql',
    };
  }

  async query<T>(sql: string, params?: any[]): Promise<T> {
    const result = await this.pool.query(sql, params);
    return result.rows as T;
  }

  // ... other methods
}
```

#### B. MySQL/MariaDB Adapter
**File:** `src/adapters/mysql-adapter.ts`

```typescript
import * as mariadb from 'mariadb';
import { DatabaseAdapter } from './base-adapter';
import { MySQLQueryBuilder } from '../query/builders/mysql-builder';

export class MySQLAdapter implements DatabaseAdapter {
  private pool: mariadb.Pool;
  public queryBuilder: MySQLQueryBuilder;

  constructor(config: mariadb.PoolConfig) {
    this.pool = mariadb.createPool(config);
    this.queryBuilder = new MySQLQueryBuilder();
  }

  get capabilities(): DatabaseCapabilities {
    return {
      supportsTransactions: true,
      supportsJoins: true,
      supportsForeignKeys: true,
      supportsFullTextSearch: true,  // FULLTEXT indexes
      supportsJsonQueries: true,
      supportsGeoSpatial: true,
      supportsWindowFunctions: true,  // MySQL 8.0+
      supportsReturning: false,       // No RETURNING clause
      maxParameterCount: 65535,
      databaseType: 'sql',
    };
  }

  // ... implementation
}
```

#### C. MSSQL Adapter
**File:** `src/adapters/mssql-adapter.ts`

```typescript
import * as mssql from 'mssql';
import { DatabaseAdapter } from './base-adapter';
import { MSSQLQueryBuilder } from '../query/builders/mssql-builder';

export class MSSQLAdapter implements DatabaseAdapter {
  private pool: mssql.ConnectionPool;
  public queryBuilder: MSSQLQueryBuilder;

  constructor(config: mssql.config) {
    this.pool = new mssql.ConnectionPool(config);
    this.queryBuilder = new MSSQLQueryBuilder();
  }

  get capabilities(): DatabaseCapabilities {
    return {
      supportsTransactions: true,
      supportsJoins: true,
      supportsForeignKeys: true,
      supportsFullTextSearch: true,
      supportsJsonQueries: true,      // SQL Server 2016+
      supportsGeoSpatial: true,
      supportsWindowFunctions: true,
      supportsReturning: true,        // OUTPUT clause
      maxParameterCount: 2100,        // SQL Server limit
      databaseType: 'sql',
    };
  }

  // ... implementation
}
```

#### D. MongoDB Adapter
**File:** `src/adapters/mongodb-adapter.ts`

```typescript
import { MongoClient, Db } from 'mongodb';
import { DatabaseAdapter } from './base-adapter';
import { MongoQueryBuilder } from '../query/builders/mongo-builder';

export class MongoDBAdapter implements DatabaseAdapter {
  private client: MongoClient;
  private db: Db;
  public queryBuilder: MongoQueryBuilder;

  constructor(uri: string, dbName: string) {
    this.client = new MongoClient(uri);
    this.queryBuilder = new MongoQueryBuilder();
  }

  get capabilities(): DatabaseCapabilities {
    return {
      supportsTransactions: true,     // Replica sets only
      supportsJoins: true,            // $lookup aggregation
      supportsForeignKeys: false,     // No enforced FKs
      supportsFullTextSearch: true,   // Text indexes
      supportsJsonQueries: true,      // Native JSON
      supportsGeoSpatial: true,       // 2dsphere indexes
      supportsWindowFunctions: true,  // $setWindowFields
      supportsReturning: true,
      maxParameterCount: Infinity,
      databaseType: 'nosql',
    };
  }

  // Translate SQL-like operations to MongoDB queries
  async query<T>(sql: string, params?: any[]): Promise<T> {
    // Parse SQL-like syntax and convert to MongoDB operations
    const mongoQuery = this.queryBuilder.translateToMongo(sql, params);
    return this.executeMongoQuery(mongoQuery);
  }

  // ... implementation
}
```

#### E. DuckDB Adapter
**File:** `src/adapters/duckdb-adapter.ts`

```typescript
import * as duckdb from '@duckdb/node-api';
import { DatabaseAdapter } from './base-adapter';
import { DuckDBQueryBuilder } from '../query/builders/duckdb-builder';

export class DuckDBAdapter implements DatabaseAdapter {
  private db: duckdb.Database;
  private conn: duckdb.Connection;
  public queryBuilder: DuckDBQueryBuilder;

  constructor(path: string = ':memory:') {
    this.db = new duckdb.Database(path);
    this.queryBuilder = new DuckDBQueryBuilder();
  }

  get capabilities(): DatabaseCapabilities {
    return {
      supportsTransactions: true,
      supportsJoins: true,
      supportsForeignKeys: false,     // Not enforced
      supportsFullTextSearch: true,
      supportsJsonQueries: true,
      supportsGeoSpatial: true,       // Spatial extension
      supportsWindowFunctions: true,  // Excellent window function support
      supportsReturning: false,
      maxParameterCount: Infinity,
      databaseType: 'sql',
    };
  }

  async query<T>(sql: string, params?: any[]): Promise<T> {
    const conn = await this.getConnection();
    const result = await conn.run(sql, params);
    return result as T;
  }

  // ... implementation
}
```

### 3. Unified Configuration API

**File:** `src/types/config.ts` (updated)

```typescript
export type DatabaseConfig =
  | PostgresConfig
  | MySQLConfig
  | MSSQLConfig
  | MongoDBConfig
  | DuckDBConfig;

export interface PostgresConfig {
  type: 'postgres';
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
  ssl?: boolean;
}

export interface MySQLConfig {
  type: 'mysql' | 'mariadb';
  host: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
}

export interface MSSQLConfig {
  type: 'mssql';
  server: string;
  port?: number;
  user: string;
  password: string;
  database: string;
  pool?: { max: number; min: number };
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
  };
}

export interface MongoDBConfig {
  type: 'mongodb';
  uri: string;
  database: string;
  options?: {
    maxPoolSize?: number;
    minPoolSize?: number;
  };
}

export interface DuckDBConfig {
  type: 'duckdb';
  path?: string;  // ':memory:' for in-memory
  readOnly?: boolean;
  extensions?: string[];  // ['spatial', 'json', 'httpfs']
}

export interface SqlDBConfig {
  database: DatabaseConfig;  // Changed from 'mariadb'
  redis: RedisConfig;
  cache?: CacheConfig;
  discovery?: DiscoveryConfig;
  logging?: LoggingConfig;
  warming?: WarmingConfig;
  search?: SearchConfig;     // New: search optimization features
}
```

### 4. Adapter Factory

**File:** `src/adapters/adapter-factory.ts`

```typescript
import { DatabaseConfig } from '../types/config';
import { DatabaseAdapter } from './base-adapter';
import { PostgresAdapter } from './postgres-adapter';
import { MySQLAdapter } from './mysql-adapter';
import { MSSQLAdapter } from './mssql-adapter';
import { MongoDBAdapter } from './mongodb-adapter';
import { DuckDBAdapter } from './duckdb-adapter';

export class AdapterFactory {
  static createAdapter(config: DatabaseConfig): DatabaseAdapter {
    switch (config.type) {
      case 'postgres':
        return new PostgresAdapter(config);

      case 'mysql':
      case 'mariadb':
        return new MySQLAdapter(config);

      case 'mssql':
        return new MSSQLAdapter(config);

      case 'mongodb':
        return new MongoDBAdapter(config.uri, config.database);

      case 'duckdb':
        return new DuckDBAdapter(config.path);

      default:
        throw new Error(`Unsupported database type: ${(config as any).type}`);
    }
  }
}
```

### 5. Query Builder Abstraction

**File:** `src/query/builders/base-builder.ts`

```typescript
export interface QueryBuilder {
  // SELECT
  buildSelect(
    table: string,
    where?: WhereClause,
    options?: FindOptions
  ): { sql: string; params: any[] };

  // INSERT
  buildInsert(
    table: string,
    data: any
  ): { sql: string; params: any[] };

  // UPDATE
  buildUpdate(
    table: string,
    where: WhereClause,
    data: any
  ): { sql: string; params: any[] };

  // DELETE
  buildDelete(
    table: string,
    where: WhereClause
  ): { sql: string; params: any[] };

  // Dialect-specific escaping
  escapeIdentifier(identifier: string): string;
  escapeValue(value: any): string;

  // Pagination
  buildPagination(limit?: number, offset?: number): string;

  // ORDER BY
  buildOrderBy(orderBy?: string, order?: 'ASC' | 'DESC'): string;
}
```

**Dialect-Specific Builders:**

```typescript
// PostgreSQL uses $1, $2, $3 for parameters
export class PostgresQueryBuilder implements QueryBuilder {
  buildSelect(table: string, where?: WhereClause, options?: FindOptions) {
    const params: any[] = [];
    let sql = `SELECT * FROM ${this.escapeIdentifier(table)}`;

    if (where) {
      const whereClause = this.buildWhere(where, params);
      sql += ` WHERE ${whereClause}`;
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy} ${options.order || 'ASC'}`;
    }

    if (options?.limit) {
      params.push(options.limit);
      sql += ` LIMIT $${params.length}`;
    }

    if (options?.offset) {
      params.push(options.offset);
      sql += ` OFFSET $${params.length}`;
    }

    return { sql, params };
  }

  escapeIdentifier(id: string): string {
    return `"${id.replace(/"/g, '""')}"`;
  }
}

// MySQL uses ? for all parameters
export class MySQLQueryBuilder implements QueryBuilder {
  buildSelect(table: string, where?: WhereClause, options?: FindOptions) {
    const params: any[] = [];
    let sql = `SELECT * FROM \`${table}\``;

    if (where) {
      const whereClause = this.buildWhere(where, params);
      sql += ` WHERE ${whereClause}`;
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy} ${options.order || 'ASC'}`;
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

  escapeIdentifier(id: string): string {
    return `\`${id.replace(/`/g, '``')}\``;
  }
}

// MongoDB doesn't use SQL - translates to MongoDB queries
export class MongoQueryBuilder implements QueryBuilder {
  buildSelect(table: string, where?: WhereClause, options?: FindOptions) {
    // Return MongoDB-compatible query object instead of SQL
    const filter = this.translateWhere(where);
    const mongoOptions: any = {};

    if (options?.limit) mongoOptions.limit = options.limit;
    if (options?.offset) mongoOptions.skip = options.offset;
    if (options?.orderBy) {
      mongoOptions.sort = { [options.orderBy]: options.order === 'DESC' ? -1 : 1 };
    }

    return {
      collection: table,
      filter,
      options: mongoOptions,
    };
  }

  private translateWhere(where?: WhereClause): any {
    if (!where) return {};

    // Convert SQL-like WHERE to MongoDB filter
    // { status: 'active' } → { status: 'active' }
    // { age: { gt: 18 } } → { age: { $gt: 18 } }
    const mongoFilter: any = {};

    for (const [key, value] of Object.entries(where)) {
      if (typeof value === 'object' && value !== null) {
        // Handle operators: { gt: 18 } → { $gt: 18 }
        mongoFilter[key] = this.translateOperators(value);
      } else {
        mongoFilter[key] = value;
      }
    }

    return mongoFilter;
  }

  private translateOperators(operators: any): any {
    const mongoOps: any = {};
    const mapping: Record<string, string> = {
      gt: '$gt',
      gte: '$gte',
      lt: '$lt',
      lte: '$lte',
      ne: '$ne',
      in: '$in',
      nin: '$nin',
      contains: '$regex',  // Special: contains → regex
    };

    for (const [op, val] of Object.entries(operators)) {
      const mongoOp = mapping[op] || `$${op}`;
      mongoOps[mongoOp] = val;
    }

    return mongoOps;
  }
}
```

---

## Usage Examples

### 1. PostgreSQL

```typescript
import { createSqlDB } from '@bhushanpawar/sqldb';

const db = await createSqlDB({
  database: {
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'myapp',
    connectionLimit: 20,
  },
  redis: {
    host: 'localhost',
  },
  cache: { enabled: true },
  search: { enabled: true },  // Works with any DB!
});

// Same API as before
const users = await db.users.findMany({ status: 'active' });
const user = await db.users.findById(1);

// PostgreSQL-specific: Use RETURNING clause
const newUser = await db.users.insertOne({
  name: 'John',
  email: 'john@example.com'
});
// Returns full object including auto-generated fields
```

### 2. MongoDB

```typescript
const db = await createSqlDB({
  database: {
    type: 'mongodb',
    uri: 'mongodb://localhost:27017',
    database: 'myapp',
  },
  redis: { host: 'localhost' },
  cache: { enabled: true },
  search: { enabled: true },
});

// Same API - translated to MongoDB internally
const users = await db.users.findMany({ status: 'active' });
// → db.collection('users').find({ status: 'active' }).toArray()

const user = await db.users.findOne({ email: 'john@example.com' });
// → db.collection('users').findOne({ email: 'john@example.com' })

// MongoDB-specific operators
const adults = await db.users.findMany({
  age: { gte: 18 }  // → { age: { $gte: 18 } }
});

// Text search (uses MongoDB text indexes OR Redis inverted index)
const results = await db.users.search('john smith', {
  fields: ['name', 'email']
});
```

### 3. DuckDB (Analytics)

```typescript
const db = await createSqlDB({
  database: {
    type: 'duckdb',
    path: ':memory:',  // In-memory for fast analytics
    extensions: ['spatial', 'json'],
  },
  redis: { host: 'localhost' },
  cache: { enabled: true },
});

// Load data from Parquet files (DuckDB superpower!)
await db.raw(`
  CREATE TABLE sales AS
  SELECT * FROM read_parquet('s3://bucket/sales/*.parquet')
`);

// Fast aggregations
const stats = await db.sales.raw(`
  SELECT
    category,
    SUM(amount) as total_sales,
    AVG(amount) as avg_sale,
    COUNT(*) as num_orders
  FROM sales
  WHERE date >= '2026-01-01'
  GROUP BY category
  ORDER BY total_sales DESC
`);

// Window functions (DuckDB excels here)
const rankedProducts = await db.products.raw(`
  SELECT
    name,
    category,
    revenue,
    ROW_NUMBER() OVER (PARTITION BY category ORDER BY revenue DESC) as rank
  FROM products
`);
```

### 4. Hybrid Architecture (Postgres + DuckDB)

```typescript
// OLTP (transactions) → PostgreSQL
const oltp = await createSqlDB({
  database: { type: 'postgres', /* ... */ },
  redis: { host: 'localhost' },
});

// OLAP (analytics) → DuckDB
const olap = await createSqlDB({
  database: { type: 'duckdb', path: 'analytics.duckdb' },
  redis: { host: 'localhost' },
});

// Write to PostgreSQL (transactional)
await oltp.orders.insertOne({
  user_id: 123,
  total: 99.99,
  status: 'completed',
});

// Replicate to DuckDB for analytics (background job)
await syncPostgresToDuckDB(oltp, olap);

// Run complex analytics on DuckDB (fast!)
const monthlyRevenue = await olap.orders.raw(`
  SELECT
    DATE_TRUNC('month', created_at) as month,
    SUM(total) as revenue,
    COUNT(*) as orders,
    AVG(total) as avg_order_value
  FROM orders
  WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
  GROUP BY month
  ORDER BY month
`);
```

---

## Package Structure

### Peer Dependencies (Optional)

```json
{
  "name": "@bhushanpawar/sqldb",
  "peerDependencies": {
    "pg": "^8.0.0",
    "mariadb": "^3.0.0",
    "mssql": "^10.0.0",
    "mongodb": "^6.0.0",
    "@duckdb/node-api": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "pg": { "optional": true },
    "mariadb": { "optional": true },
    "mssql": { "optional": true },
    "mongodb": { "optional": true },
    "@duckdb/node-api": { "optional": true }
  },
  "dependencies": {
    "ioredis": "^5.8.2"
  }
}
```

**Benefits:**
- Install only what you need
- Smaller bundle size (learned from Drizzle)
- Community can add new adapters easily

### Adapter Packages (Future)

```bash
# Core (no database drivers included)
npm install @bhushanpawar/sqldb

# Install specific adapter
npm install @bhushanpawar/sqldb-postgres pg
npm install @bhushanpawar/sqldb-mysql mariadb
npm install @bhushanpawar/sqldb-mssql mssql
npm install @bhushanpawar/sqldb-mongodb mongodb
npm install @bhushanpawar/sqldb-duckdb @duckdb/node-api
```

---

## Migration Path

### Phase 1: Backward Compatibility (v2.0)

**Existing users continue working without changes:**

```typescript
// OLD API (still works)
const db = await createSqlDB({
  mariadb: { host: 'localhost', user: 'root', password: 'pass', database: 'db' },
  redis: { host: 'localhost' },
});

// Internally converted to:
// { database: { type: 'mariadb', host: 'localhost', ... }, redis: { ... } }
```

### Phase 2: Gradual Migration (v2.1+)

```typescript
// NEW API (recommended)
const db = await createSqlDB({
  database: {
    type: 'postgres',  // Just change this line!
    host: 'localhost',
    user: 'postgres',
    password: 'pass',
    database: 'db',
  },
  redis: { host: 'localhost' },
});
```

### Phase 3: Deprecation Warning (v3.0)

```typescript
// OLD API shows deprecation warning
// "DEPRECATED: Use { database: { type: 'mariadb', ... } } instead"
```

### Phase 4: Removal (v4.0)

```typescript
// OLD API removed, must use new API
```

---

## Feature Compatibility Matrix

| Feature | Postgres | MySQL | MSSQL | MongoDB | DuckDB |
|---------|----------|-------|-------|---------|--------|
| **Basic CRUD** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Transactions** | ✅ | ✅ | ✅ | ✅ (replica) | ✅ |
| **Foreign Keys** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Full-text Search** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **JSON Queries** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Geo-Spatial** | ✅ (PostGIS) | ✅ | ✅ | ✅ | ✅ (extension) |
| **Window Functions** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **RETURNING Clause** | ✅ | ❌ | ✅ (OUTPUT) | N/A | ❌ |
| **Redis Caching** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Search Indexes** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Auto-Warming** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Faceted Search** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Parquet Files** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Columnar Storage** | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Implementation Timeline

### Phase 1: Refactor Core (Weeks 1-6)
- Extract `MariaDBConnectionManager` to `MySQLAdapter`
- Create `DatabaseAdapter` interface
- Create `AdapterFactory`
- Update `SqlDBClient` to use adapters
- Maintain backward compatibility

### Phase 2: PostgreSQL Support (Weeks 7-10)
- Implement `PostgresAdapter`
- Implement `PostgresQueryBuilder`
- Test all features with Postgres
- Documentation

### Phase 3: MSSQL Support (Weeks 11-14)
- Implement `MSSQLAdapter`
- Implement `MSSQLQueryBuilder`
- Handle OUTPUT clause (similar to RETURNING)
- Documentation

### Phase 4: MongoDB Support (Weeks 15-20)
- Implement `MongoDBAdapter`
- Implement `MongoQueryBuilder` (SQL → MongoDB translation)
- Handle NoSQL specifics
- Documentation

### Phase 5: DuckDB Support (Weeks 21-24)
- Implement `DuckDBAdapter`
- Implement `DuckDBQueryBuilder`
- Integration examples (Postgres + DuckDB hybrid)
- Documentation

**Total Timeline:** 24 weeks (~6 months)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes | High | Strict backward compatibility, gradual migration |
| Adapter bugs | Medium | Comprehensive test suite per adapter |
| Performance regression | Medium | Benchmark suite, ensure abstraction is minimal |
| MongoDB complexity | High | Start simple, iterate based on feedback |
| Maintenance burden | Medium | Community contributions, adapter packages |

---

## Success Metrics

- **Zero breaking changes** for existing users in v2.0
- **>80% feature parity** across all databases
- **<5% performance overhead** from abstraction layer
- **30%+ adoption** of non-MySQL databases within 12 months
- **Active community contributions** for new adapters

---

## References

### Prisma
- [Prisma Database Adapters Architecture](https://github.com/prisma/prisma)
- [PostgreSQL Connector Documentation](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Databases Supported by Prisma ORM](https://www.prisma.io/docs/orm/reference/supported-databases)

### Drizzle ORM
- [Drizzle ORM - Why Drizzle?](https://orm.drizzle.team/docs/overview)
- [Drizzle ORM Multi-Database Support](https://blog.logrocket.com/drizzle-orm-adoption-guide/)

### TypeORM
- [Prisma ORM vs Drizzle Comparison](https://www.prisma.io/docs/orm/more/comparisons/prisma-and-drizzle)
- [Node.js ORMs in 2025](https://thedataguy.pro/blog/2025/12/nodejs-orm-comparison-2025/)

### DuckDB
- [DuckDB Node.js API](https://duckdb.org/docs/stable/clients/nodejs/overview)
- [DuckDB Node Neo Package](https://duckdb.org/docs/stable/clients/node_neo/overview)
- [Unleashing the Power of DuckDB with TypeScript](https://www.xjavascript.com/blog/duckdb-typescript/)

---

## Conclusion

By adopting a **hybrid adapter pattern** (inspired by Prisma + Drizzle + TypeORM), SqlDB can become a **universal database library** that works with PostgreSQL, MySQL, MSSQL, MongoDB, and DuckDB while maintaining:

1. **Zero breaking changes** (backward compatible)
2. **Unified API** (switch databases with config change)
3. **Performance optimizations** (Redis caching, search indexes work everywhere)
4. **Database-specific features** (when available)
5. **Minimal bundle size** (install only what you need)

**Next Step:** Refactor core to extract adapter interface and implement PostgreSQL support as proof-of-concept.
