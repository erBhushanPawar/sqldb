# Singleton Pattern Usage

The SqlDB library supports singleton pattern to ensure only one database connection instance is created and reused across your application.

## Benefits

✅ **Single database connection pool** - Prevents connection exhaustion
✅ **Shared cache across application** - Better cache hit rates
✅ **Lower memory footprint** - One instance instead of multiple
✅ **Easy access anywhere** - Use `getSqlDB()` to retrieve instance
✅ **Prevents duplicate schema discovery** - Schema is discovered once

## Usage

### 1. Initialize Singleton

```typescript
import { createSqlDB } from '@bhushanpawar/sqldb';

// Create singleton instance (only once in your app)
const db = await createSqlDB({
  mariadb: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'my_database',
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
  cache: {
    enabled: true,
    defaultTTL: 300,
  },
}, { singleton: true }); // Enable singleton mode
```

### 2. Access Singleton Anywhere

```typescript
import { getSqlDB } from '@bhushanpawar/sqldb';

// In any file, get the singleton instance
const db = getSqlDB();

// Use it
const users = db.getTableOperations('users');
const allUsers = await users.findMany();
```

### 3. Clear Singleton (Testing)

```typescript
import { clearSqlDBSingleton } from '@bhushanpawar/sqldb';

// Clear singleton (useful for testing or reconnecting)
clearSqlDBSingleton();
```

## Complete Example

```typescript
// app.ts (entry point)
import { createSqlDB } from '@bhushanpawar/sqldb';

async function initializeDatabase() {
  const db = await createSqlDB({
    mariadb: { /* config */ },
    redis: { /* config */ },
    cache: { enabled: true },
  }, { singleton: true });

  console.log('Database initialized');
  return db;
}

initializeDatabase().catch(console.error);
```

```typescript
// users.service.ts
import { getSqlDB } from '@bhushanpawar/sqldb';

export async function getAllUsers() {
  const db = getSqlDB(); // Get singleton instance
  const usersTable = db.getTableOperations('users');
  return await usersTable.findMany();
}
```

```typescript
// orders.service.ts
import { getSqlDB } from '@bhushanpawar/sqldb';

export async function getUserOrders(userId: string) {
  const db = getSqlDB(); // Same instance as users.service.ts
  const ordersTable = db.getTableOperations('orders');
  return await ordersTable.findMany({ user_id: userId });
}
```

## Non-Singleton Mode

If you need multiple independent connections (rare), omit the `singleton` option:

```typescript
// Each call creates a new instance
const db1 = await createSqlDB(config); // New instance
const db2 = await createSqlDB(config); // Another new instance

console.log(db1 === db2); // false
```

## Best Practices

### ✅ Do

- Use singleton mode in production applications
- Initialize singleton once at app startup
- Use `getSqlDB()` to access the instance
- Close the connection on app shutdown

```typescript
// Graceful shutdown
process.on('SIGINT', async () => {
  const db = getSqlDB();
  await db.close();
  process.exit(0);
});
```

### ❌ Don't

- Create multiple singleton instances
- Mix singleton and non-singleton modes
- Call `createSqlDB({ ... }, { singleton: true })` multiple times with different configs

## Error Handling

```typescript
import { getSqlDB } from '@bhushanpawar/sqldb';

try {
  const db = getSqlDB();
  // Use db
} catch (error) {
  // Error: Singleton SqlDB instance not initialized.
  // Call createSqlDB first!
  console.error(error.message);
}
```

## Testing

For tests, clear the singleton between test suites:

```typescript
import { createSqlDB, clearSqlDBSingleton } from '@bhushanpawar/sqldb';

afterEach(() => {
  clearSqlDBSingleton(); // Reset for next test
});

it('should create singleton', async () => {
  const db = await createSqlDB(config, { singleton: true });
  expect(db).toBeDefined();
});
```

## Performance Impact

**Singleton Mode:**
- Schema discovery: **1 time** (14-15 seconds)
- Memory usage: **~50MB** (1 connection pool)
- Cache effectiveness: **High** (shared across app)

**Non-Singleton Mode (3 instances):**
- Schema discovery: **3 times** (42-45 seconds total)
- Memory usage: **~150MB** (3 connection pools)
- Cache effectiveness: **Low** (fragmented caches)

**Recommendation:** Always use singleton mode unless you have a specific reason not to.
