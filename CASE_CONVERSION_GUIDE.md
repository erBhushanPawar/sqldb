# Case Conversion Guide

## Overview

SqlDB now supports **automatic case conversion** between your application code (camelCase) and your database (snake_case), eliminating the need to manually convert property names.

## How It Works

When enabled, the case conversion system:

1. **Outgoing (Application → Database)**
   - Converts object keys from `camelCase` to `snake_case`
   - Applies to: INSERT, UPDATE, DELETE, WHERE clauses
   - Example: `{ userId: 123 }` → `{ user_id: 123 }`

2. **Incoming (Database → Application)**
   - Converts object keys from `snake_case` to `camelCase`
   - Applies to: SELECT results
   - Example: `{ user_id: 123 }` → `{ userId: 123 }`

## Configuration

### Enable Case Conversion

```typescript
import { createSqlDB } from './sqldb';

const db = await createSqlDB({
  mariadb: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mydb'
  },
  redis: {
    host: 'localhost',
    port: 6379
  },
  caseConversion: {
    enabled: true,                    // Enable case conversion
    database: 'snake_case',           // Database uses snake_case
    application: 'camelCase'          // Application uses camelCase
  }
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `false` | Enable/disable case conversion |
| `database` | `'snake_case' \| 'camelCase'` | `'snake_case'` | Database column naming convention |
| `application` | `'snake_case' \| 'camelCase'` | `'camelCase'` | Application property naming convention |

## Usage Examples

### Example 1: Basic CRUD Operations

```typescript
// Your application code uses camelCase
const user = {
  userId: 1,
  firstName: 'John',
  lastName: 'Doe',
  emailAddress: 'john@example.com',
  phoneNumber: '555-1234',
  createdAt: new Date()
};

// INSERT - automatically converts to snake_case
const inserted = await db('users').insertOne(user);
// SQL: INSERT INTO users (user_id, first_name, last_name, email_address, phone_number, created_at) VALUES (?, ?, ?, ?, ?, ?)

// SELECT - automatically converts back to camelCase
const found = await db('users').findById(1);
// Returns: { userId: 1, firstName: 'John', lastName: 'Doe', emailAddress: 'john@example.com', ... }

// UPDATE - converts both data and WHERE clause
await db('users').updateOne(
  { userId: 1 },              // WHERE clause in camelCase
  { firstName: 'Jane' }       // Data in camelCase
);
// SQL: UPDATE users SET first_name = ? WHERE user_id = ?
```

### Example 2: Complex Queries with SearchFilterModel

```typescript
import { SearchFilterModel } from './types';

// Your SearchFilterModel uses camelCase
const filter = new SearchFilterModel({
  andFilter: {
    isActive: true,
    userRole: 'admin',
    createdAt: {
      minimum: new Date('2024-01-01'),
      maximum: new Date('2024-12-31')
    }
  },
  likeFilter: {
    firstName: 'John',
    emailAddress: '@example.com'
  },
  orderBy: 'createdAt',      // camelCase field name
  order: 'DESC'
});

// Automatically converts to snake_case for database
const results = await db('users').findMany(filter as any);
// SQL: SELECT * FROM users WHERE is_active = ? AND user_role = ? AND created_at BETWEEN ? AND ? AND first_name LIKE ? AND email_address LIKE ? ORDER BY created_at DESC

// Results are automatically converted back to camelCase
console.log(results[0].firstName);  // 'John'
console.log(results[0].emailAddress); // 'john@example.com'
```

### Example 3: Search with Case Conversion

```typescript
const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED',
    categoryId: 'cat-123',
    minPrice: 100,
    maxPrice: 500
  },
  selectFields: ['serviceId', 'serviceName', 'categoryId', 'priceAmount'],
  orderBy: 'createdOn',
  order: 'DESC'
});

const results = await db('services').search('plumbing', {
  filters: filter,
  highlightFields: ['serviceName', 'serviceDescription']
});

// All field names in results are camelCase
results.forEach(result => {
  console.log(result.data.serviceId);
  console.log(result.data.serviceName);
  console.log(result.highlights?.serviceName);
});
```

### Example 4: Geo-Search with Case Conversion

```typescript
const filter = new SearchFilterModel({
  andFilter: {
    status: 'PUBLISHED',
    isVerified: true,
    latitude: 40.7128,
    longitude: -74.0060
  },
  selectFields: ['serviceId', 'serviceName', 'providerName', 'priceAmount']
});

const results = await db('services').search('emergency plumber', {
  filters: filter,
  limit: 20
});

// All properties are camelCase
results.forEach(result => {
  console.log(result.data.serviceId);
  console.log(result.data.providerName);
  console.log((result as any).distance);
});
```

### Example 5: Relations with Case Conversion

```typescript
// Fetch user with related data
const user = await db('users').findOne(
  { userId: 1 },
  { withRelations: true }
);

// All property names are camelCase, including related data
console.log(user.userId);
console.log(user.firstName);
console.log(user.orders[0].orderId);        // Related table
console.log(user.orders[0].orderDate);
console.log(user.orders[0].totalAmount);
```

## How It's Implemented

### 1. Query Building Phase (Application → Database)

```typescript
// In QueryBuilder
buildInsert(table: string, data: any): QueryResult {
  const convertedData = this.caseConversionConfig?.enabled
    ? CaseConverter.objectKeysToSnake(data)
    : data;

  // Build SQL with converted data...
}
```

### 2. Query Execution Phase (Database → Application)

```typescript
// In MariaDBConnectionManager
async query<T>(sql: string, params?: any[]): Promise<T> {
  let result = await pool.query(sql, params);

  // Apply case conversion if enabled
  if (this.caseConversionConfig?.enabled && queryType === 'SELECT') {
    result = CaseConverter.objectKeysToCamel(result);
  }

  return result;
}
```

## Supported Operations

### ✅ Fully Supported

| Operation | Input Conversion | Output Conversion |
|-----------|------------------|-------------------|
| `findOne()` | WHERE clause | Result object |
| `findMany()` | WHERE clause, orderBy | Result array |
| `findById()` | - | Result object |
| `count()` | WHERE clause | - |
| `insertOne()` | Data object | Result object |
| `insertMany()` | Data array | Result array |
| `updateOne()` | WHERE clause, data | Result object |
| `updateMany()` | WHERE clause, data | - |
| `updateById()` | Data object | Result object |
| `deleteOne()` | WHERE clause | - |
| `deleteMany()` | WHERE clause | - |
| `deleteById()` | - | - |
| `search()` | Filters, orderBy | Results array |

### SearchFilterModel Support

- ✅ `andFilter` - Converted to snake_case
- ✅ `likeFilter` - Converted to snake_case
- ✅ `orFilter` - Converted to snake_case
- ✅ `orderBy` - Converted to snake_case
- ✅ `selectFields` - Converted to snake_case

## Best Practices

### 1. Use Consistent Naming in Your Code

```typescript
// ✅ Good - consistent camelCase
const user = {
  userId: 1,
  firstName: 'John',
  lastName: 'Doe'
};

// ❌ Avoid - mixing conventions
const user = {
  user_id: 1,  // Don't use snake_case in application
  firstName: 'John'
};
```

### 2. Let the System Handle Conversion

```typescript
// ✅ Good - let case conversion handle it
const filter = new SearchFilterModel({
  andFilter: {
    createdAt: { minimum: date1, maximum: date2 }
  },
  orderBy: 'createdAt'
});

// ❌ Bad - manually converting
const filter = new SearchFilterModel({
  andFilter: {
    created_at: { minimum: date1, maximum: date2 }  // Don't do this
  },
  orderBy: 'created_at'
});
```

### 3. Use TypeScript Interfaces

```typescript
// Define your interfaces in camelCase
interface User {
  userId: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  phoneNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

// TypeScript will enforce camelCase
const user: User = await db('users').findById(1);
console.log(user.firstName);  // ✅ TypeScript knows this exists
console.log(user.first_name); // ❌ TypeScript error
```

## Migration Guide

### Before (Manual Conversion)

```typescript
// You had to manually handle snake_case
const results = await db('users').findMany({
  user_role: 'admin',
  is_active: true
});

// And manually access snake_case properties
results.forEach(user => {
  console.log(user.user_id);
  console.log(user.first_name);
});
```

### After (Automatic Conversion)

```typescript
// Enable case conversion
const db = await createSqlDB({
  // ... other config
  caseConversion: {
    enabled: true,
    database: 'snake_case',
    application: 'camelCase'
  }
});

// Use camelCase everywhere
const results = await db('users').findMany({
  userRole: 'admin',
  isActive: true
});

// Access camelCase properties
results.forEach(user => {
  console.log(user.userId);
  console.log(user.firstName);
});
```

## Performance Impact

Case conversion has **minimal performance impact**:

- ✅ Only converts object keys (not values)
- ✅ Single pass through object properties
- ✅ No regex operations on large strings
- ✅ Cached conversion logic

Typical overhead: **< 1ms per query**

## Troubleshooting

### Issue: Properties are undefined

```typescript
// Problem: Case conversion not enabled
const user = await db('users').findById(1);
console.log(user.firstName);  // undefined

// Solution: Enable case conversion
caseConversion: {
  enabled: true  // Make sure this is set
}
```

### Issue: Database errors about column names

```typescript
// Problem: Wrong database format
caseConversion: {
  enabled: true,
  database: 'camelCase'  // ❌ Wrong if DB uses snake_case
}

// Solution: Match your database
caseConversion: {
  enabled: true,
  database: 'snake_case'  // ✅ Correct
}
```

## Summary

✅ **Enable once** in config
✅ **Write all code** in camelCase
✅ **Database stays** in snake_case
✅ **Automatic conversion** both ways
✅ **Works with SearchFilterModel**
✅ **Type-safe** with TypeScript
✅ **Minimal performance impact**

Your database schema can stay in `snake_case` while your application code stays clean with `camelCase`! 🎉
