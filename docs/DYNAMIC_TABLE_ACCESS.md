# Dynamic Table Access

Access your database tables directly as properties on the SmartDB client, with full TypeScript support.

## Quick Start

### Without Types (Basic)

```typescript
import { createSmartDB } from '@bhushanpawar/sqldb';

const db = await createSmartDB(config);

// Access tables dynamically
const users = await db.users.findMany();
const orders = await db.orders.findMany({ status: 'pending' });
const product = await db.products.findById(123);
```

### With Types (Recommended)

```typescript
import { createSmartDB, SmartDBWithTables } from '@bhushanpawar/sqldb';

// Define your schema
interface DatabaseSchema {
  users: {
    id: number;
    name: string;
    email: string;
    created_at: Date;
  };
  orders: {
    id: number;
    user_id: number;
    total: number;
    status: string;
  };
  products: {
    id: number;
    name: string;
    price: number;
  };
}

// Type your database
type MyDB = SmartDBWithTables<DatabaseSchema>;

const db = await createSmartDB(config) as MyDB;

// Now you have full type safety!
const users = await db.users.findMany(); // Type: DatabaseSchema['users'][]
const order = await db.orders.findById(1); // Type: DatabaseSchema['orders'] | null
```

## Comparison

### Old Way

```typescript
// Verbose and repetitive
const usersTable = db.getTableOperations('users');
const users = await usersTable.findMany();

const ordersTable = db.getTableOperations('orders');
const orders = await ordersTable.findMany({ status: 'pending' });
```

### New Way

```typescript
// Clean and intuitive
const users = await db.users.findMany();
const orders = await db.orders.findMany({ status: 'pending' });
```

## Full Example

```typescript
import { createSmartDB, SmartDBWithTables } from '@bhushanpawar/sqldb';

interface MySchema {
  users: {
    id: number;
    name: string;
    email: string;
  };
  posts: {
    id: number;
    user_id: number;
    title: string;
    content: string;
  };
}

type MyDB = SmartDBWithTables<MySchema>;

const db = await createSmartDB({
  mariadb: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'mydb',
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
  cache: {
    enabled: true,
    defaultTTL: 300,
  },
}) as MyDB;

// Read operations
const allUsers = await db.users.findMany();
const activeUsers = await db.users.findMany({ status: 'active' });
const user = await db.users.findById(1);
const userCount = await db.users.count({ status: 'active' });

// Write operations
const newUser = await db.users.insertOne({
  name: 'John Doe',
  email: 'john@example.com',
});

const updated = await db.users.updateById(1, {
  name: 'Jane Doe',
});

const deleted = await db.users.deleteById(1);

// Relations
const userWithPosts = await db.users.findOne(
  { id: 1 },
  {
    withRelations: {
      dependents: ['posts'],
      dependencies: false,
    },
  }
);

// Cache control
await db.users.invalidateCache();
await db.users.warmCache({ status: 'active' });

// Raw queries
const results = await db.users.raw(
  'SELECT * FROM users WHERE created_at > ?',
  [new Date('2024-01-01')]
);
```

## TypeScript Benefits

### 1. Autocomplete

```typescript
const db = await createSmartDB(config) as MyDB;

// IDE shows all available tables
db.users.     // ← Autocomplete suggests: findMany, findOne, findById, etc.
db.orders.    // ← Autocomplete suggests: findMany, findOne, findById, etc.
```

### 2. Type Safety

```typescript
// Compile-time error: Property 'nonexistent' does not exist
const data = await db.nonexistent.findMany();

// Compile-time error: Type 'string' is not assignable to type 'number'
await db.users.updateById('invalid', { id: 'string' });

// Correct type inference
const users = await db.users.findMany(); // Type: MySchema['users'][]
```

### 3. IntelliSense

Hover over any method to see full documentation and type information.

## Advanced Usage

### Dynamic Schema

If you don't know your schema at compile time:

```typescript
import { SmartDBWithDynamicTables } from '@bhushanpawar/sqldb';

const db = await createSmartDB(config) as SmartDBWithDynamicTables;

// Works, but no type safety
const data = await db.anyTable.findMany();
```

### Partial Schema

Define only the tables you use:

```typescript
interface MyPartialSchema {
  users: {
    id: number;
    name: string;
  };
  // Don't define tables you don't use
}

type MyDB = SmartDBWithTables<MyPartialSchema>;

const db = await createSmartDB(config) as MyDB;

// Typed access for defined tables
await db.users.findMany();

// Still works for undefined tables, but no types
await (db as any).other_table.findMany();
```

### Mix Both Approaches

```typescript
// New way for common operations
const users = await db.users.findMany();

// Old way when you need the reference
const usersTable = db.getTableOperations('users');
await usersTable.warmCache();
await usersTable.invalidateCache();
```

## Migration Guide

### From Old Code

```typescript
// Before
const usersOps = db.getTableOperations('users');
const users = await usersOps.findMany({ status: 'active' });

const ordersOps = db.getTableOperations('orders');
const orders = await ordersOps.findMany({ user_id: 123 });

// After
const users = await db.users.findMany({ status: 'active' });
const orders = await db.orders.findMany({ user_id: 123 });
```

### Gradual Migration

You can mix both styles:

```typescript
// Old style (still works)
const usersOld = await db.getTableOperations('users').findMany();

// New style
const usersNew = await db.users.findMany();

// Both work simultaneously
```

## Performance

Dynamic table access has **zero runtime overhead**. The Proxy simply redirects to `getTableOperations()`, so performance is identical.

```typescript
// These are exactly the same at runtime
const a = await db.users.findMany();
const b = await db.getTableOperations('users').findMany();
```

## Backwards Compatibility

✅ Fully backwards compatible
✅ Old code continues to work
✅ No breaking changes
✅ Opt-in feature

## Best Practices

### ✅ Do

```typescript
// Define schema for tables you use
interface MySchema {
  users: { id: number; name: string };
  orders: { id: number; total: number };
}

type MyDB = SmartDBWithTables<MySchema>;
const db = await createSmartDB(config) as MyDB;

// Use dynamic access
const users = await db.users.findMany();
```

### ❌ Don't

```typescript
// Don't use 'as any' everywhere
const users = await (db as any).users.findMany();

// Instead, define proper types
type MyDB = SmartDBWithTables<MySchema>;
const db = await createSmartDB(config) as MyDB;
const users = await db.users.findMany(); // Fully typed!
```

## IDE Support

Works with:
- ✅ VS Code
- ✅ WebStorm
- ✅ Sublime Text (with TypeScript plugin)
- ✅ Vim/Neovim (with LSP)
- ✅ Any editor with TypeScript support

## Common Patterns

### Pattern 1: Service Layer

```typescript
// database.ts
export interface AppSchema {
  users: UserModel;
  orders: OrderModel;
  products: ProductModel;
}

export type AppDB = SmartDBWithTables<AppSchema>;

export async function createDatabase(): Promise<AppDB> {
  return await createSmartDB(config) as AppDB;
}

// user.service.ts
import { createDatabase } from './database';

export class UserService {
  private db!: AppDB;

  async init() {
    this.db = await createDatabase();
  }

  async getAllUsers() {
    return await this.db.users.findMany();
  }

  async getUserById(id: number) {
    return await this.db.users.findById(id);
  }
}
```

### Pattern 2: Repository Pattern

```typescript
export class UserRepository {
  constructor(private db: AppDB) {}

  async findAll() {
    return this.db.users.findMany();
  }

  async findById(id: number) {
    return this.db.users.findById(id);
  }

  async create(data: Omit<User, 'id'>) {
    return this.db.users.insertOne(data);
  }
}
```

### Pattern 3: Singleton with Types

```typescript
// database.ts
import { createSmartDB, getSmartDB, SmartDBWithTables } from '@bhushanpawar/sqldb';

type AppDB = SmartDBWithTables<AppSchema>;

export async function initDatabase(): Promise<AppDB> {
  return await createSmartDB(config, { singleton: true }) as AppDB;
}

export function getDatabase(): AppDB {
  return getSmartDB() as AppDB;
}

// usage.ts
import { getDatabase } from './database';

const db = getDatabase();
const users = await db.users.findMany(); // Fully typed!
```

## Troubleshooting

### Q: Why do I get "Property 'users' does not exist"?

**A:** You need to type your database with `SmartDBWithTables`:

```typescript
// Wrong
const db = await createSmartDB(config);
await db.users.findMany(); // Error!

// Right
type MyDB = SmartDBWithTables<MySchema>;
const db = await createSmartDB(config) as MyDB;
await db.users.findMany(); // Works!
```

### Q: Can I use this with JavaScript (not TypeScript)?

**A:** Yes! Dynamic table access works in JavaScript too:

```javascript
const db = await createSmartDB(config);
const users = await db.users.findMany(); // Works!
```

You just won't get type checking and autocomplete.

### Q: Does this work with singleton mode?

**A:** Yes!

```typescript
const db = await createSmartDB(config, { singleton: true }) as MyDB;
const users = await db.users.findMany(); // Works!

// Later, anywhere in your app
const db2 = getSmartDB() as MyDB;
const orders = await db2.orders.findMany(); // Works!
```

## Summary

✅ **Cleaner syntax**: `db.users` vs `db.getTableOperations('users')`
✅ **Full TypeScript support**: Define schema once, get types everywhere
✅ **Zero runtime overhead**: Proxy redirects to existing methods
✅ **Backwards compatible**: Old code keeps working
✅ **IDE friendly**: Full autocomplete and IntelliSense
