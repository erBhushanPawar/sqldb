# Schema Generator

Automatically generate TypeScript interfaces from your MariaDB database schema with rich metadata.

## Features

- **Auto-discovery**: Scans your database and generates TypeScript interfaces
- **Rich Metadata**: Includes column types, constraints, defaults, and more
- **Type Safety**: Proper TypeScript type mapping (UUID → string, INT → number, etc.)
- **Column Details**: Max length, precision, scale, character sets
- **Default Values**: Shows column defaults in comments
- **Usage Examples**: Generates example code showing how to use the types

## Quick Start

```typescript
import { createSmartDB } from '@bhushanpawar/sqldb';

const db = await createSmartDB(config);

// Generate schema with all metadata
const schema = db.generateSchema({
  interfaceName: 'DatabaseSchema',
  includeComments: true,
  nullableFields: true,
  withExample: true,
});

console.log(schema);
```

## Options

```typescript
interface GenerateSchemaOptions {
  // Name of the generated interface (default: 'DatabaseSchema')
  interfaceName?: string;

  // Include JSDoc comments with metadata (default: true)
  includeComments?: boolean;

  // Add ' | null' to nullable fields (default: true)
  nullableFields?: boolean;

  // Include usage example at the end (default: false)
  withExample?: boolean;
}
```

## Generated Output Example

### With Metadata (Recommended)

```typescript
export interface DatabaseSchema {
  /**
   * Table: users
   * Primary key: user_id
   */
  users: {
    /** @type uuid | @default uuid() */
    user_id: string;

    /** @type varchar(255) | @maxLength 255 | @default NULL */
    email?: string | null;

    /** @type varchar(100) | @maxLength 100 */
    name: string;

    /** @type decimal(10,2) | @precision 10,2 | @default 0.00 */
    balance?: number | null;

    /** @type int(11) | @precision 10,0 | @default 0 */
    login_count?: number | null;

    /** @type timestamp | @default current_timestamp() */
    created_at?: Date | null;

    /** @type timestamp | @default current_timestamp() | @extra on update current_timestamp() */
    updated_at?: Date | null;
  };
}
```

### Metadata Fields

The generated comments include:

| Tag | Description | Example |
|-----|-------------|---------|
| `@type` | Full SQL column type | `varchar(255)`, `int(11)`, `decimal(10,2)` |
| `@maxLength` | Maximum character length (for strings) | `255` |
| `@precision` | Numeric precision and scale | `10,2` (10 digits, 2 decimal places) |
| `@default` | Default value | `uuid()`, `NULL`, `0`, `current_timestamp()` |
| `@extra` | Additional column info | `auto_increment`, `on update current_timestamp()` |

## Type Mapping

SQL types are mapped to TypeScript as follows:

| SQL Type | TypeScript Type |
|----------|----------------|
| `uuid`, `char`, `varchar`, `text` | `string` |
| `int`, `bigint`, `decimal`, `float`, `double` | `number` |
| `date`, `datetime`, `timestamp` | `Date` |
| `boolean`, `tinyint(1)` | `boolean` |
| `json` | `any` |

## CLI Example

Create a script to generate and save your schema:

```typescript
// scripts/generate-schema.ts
import { createSmartDB } from '@bhushanpawar/sqldb';
import * as fs from 'fs';

async function generateSchema() {
  const db = await createSmartDB({
    mariadb: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'mydb',
    },
    redis: {
      host: 'localhost',
      port: 6379,
    },
    discovery: {
      autoDiscover: true,
    },
  });

  // Generate schema with metadata and examples
  const schema = db.generateSchema({
    interfaceName: 'MyDatabaseSchema',
    includeComments: true,
    nullableFields: true,
    withExample: true,
  });

  // Save to file
  fs.writeFileSync('src/db-schema.ts', schema);

  console.log('✅ Schema generated successfully!');

  await db.close();
}

generateSchema().catch(console.error);
```

Run it:

```bash
npx ts-node scripts/generate-schema.ts
```

## Usage with Generated Schema

Once you've generated your schema, use it for full type safety:

```typescript
import { createSmartDB, SmartDBWithTables } from '@bhushanpawar/sqldb';
import { MyDatabaseSchema } from './db-schema';

// Type your database
type DB = SmartDBWithTables<MyDatabaseSchema>;

const db = await createSmartDB(config) as DB;

// Now you have full type safety and autocomplete!
const users = await db.users.findMany();
// users is typed as MyDatabaseSchema['users'][]

const user = await db.users.findById('123');
// user is typed as MyDatabaseSchema['users'] | null

// TypeScript will catch errors:
const invalid = await db.nonexistent.findMany(); // ❌ Compile error!
```

## Benefits

### 1. Type Safety

```typescript
// TypeScript knows the exact shape of your data
const user = await db.users.findById('123');

if (user) {
  console.log(user.email); // ✅ TypeScript knows 'email' exists
  console.log(user.foo);   // ❌ Compile error: Property 'foo' does not exist
}
```

### 2. IDE Autocomplete

Your IDE will suggest:
- All table names when you type `db.`
- All column names when you access results
- All methods available on tables

### 3. Documentation

The generated comments serve as documentation:
```typescript
/** @type varchar(255) | @maxLength 255 | @default NULL */
email?: string | null;
```

Developers can see:
- The column accepts strings up to 255 characters
- The column is nullable
- The default value is NULL

### 4. Refactoring Safety

If your database schema changes:
1. Regenerate the schema file
2. TypeScript will show errors where your code needs updating
3. Fix the errors
4. Deploy with confidence

## Advanced: Partial Schemas

Generate schema for specific tables only:

```typescript
const db = await createSmartDB({
  // ... config
  discovery: {
    autoDiscover: true,
    includeTables: ['users', 'orders', 'products'], // Only these tables
  },
});

const schema = db.generateSchema({
  interfaceName: 'MyPartialSchema',
  includeComments: true,
});
```

## Best Practices

### 1. Automate Schema Generation

Add to your `package.json`:

```json
{
  "scripts": {
    "generate-schema": "ts-node scripts/generate-schema.ts"
  }
}
```

Run before builds:
```bash
npm run generate-schema && npm run build
```

### 2. Version Control

**Do commit** the generated schema file:
- Provides type safety without database access
- Documents schema changes in git history
- Enables offline development

### 3. Keep Schema Fresh

Regenerate after database migrations:

```bash
# Run migration
npm run migrate

# Regenerate schema
npm run generate-schema

# Commit both
git add migrations/ src/db-schema.ts
git commit -m "Add user preferences table"
```

### 4. Use with CI/CD

```yaml
# .github/workflows/ci.yml
- name: Check schema is up to date
  run: |
    npm run generate-schema
    git diff --exit-code src/db-schema.ts || (
      echo "Schema is out of date! Run npm run generate-schema"
      exit 1
    )
```

## Comparison with Other Tools

### vs Prisma

| Feature | SmartDB Schema Generator | Prisma |
|---------|-------------------------|--------|
| Source of truth | Database | Schema file |
| Sync direction | DB → Code | Code → DB |
| Learning curve | Low (uses DB you know) | Medium (new schema syntax) |
| Migration strategy | Any tool you like | Prisma Migrate |
| Metadata in types | Yes (JSDoc) | Limited |

### vs TypeORM

| Feature | SmartDB Schema Generator | TypeORM |
|---------|-------------------------|---------|
| Approach | Interface generation | Entity decorators |
| Runtime overhead | Zero | Reflection metadata |
| Type safety | Full | Full |
| Metadata | Rich JSDoc comments | Decorator parameters |

### vs Kysely

| Feature | SmartDB Schema Generator | Kysely |
|---------|-------------------------|--------|
| Type inference | Generated interfaces | Manual types |
| Setup effort | One command | Manual typing |
| Maintenance | Regenerate when needed | Manual updates |

## Troubleshooting

### Q: Generated file has errors

**A:** Make sure you've built the project first:
```bash
npm run build
```

### Q: UUID columns showing as 'any'

**A:** Update to the latest version. UUID support was added in v1.0.1:
```bash
npm update @bhushanpawar/sqldb
```

### Q: Schema is too large

**A:** Generate schema only for tables you use:
```typescript
discovery: {
  includeTables: ['users', 'orders', 'products']
}
```

### Q: Want to customize type mapping

**A:** Fork the SchemaGenerator class and modify `mapSQLTypeToTypeScript()`:

```typescript
import { SchemaGenerator } from '@bhushanpawar/sqldb';

class MySchemaGenerator extends SchemaGenerator {
  protected mapSQLTypeToTypeScript(sqlType: string): string {
    // Your custom mapping
    if (sqlType === 'my_custom_type') {
      return 'MyCustomType';
    }
    return super.mapSQLTypeToTypeScript(sqlType);
  }
}
```

## Examples

See the [examples/generate-schema.ts](examples/generate-schema.ts) file for a complete working example.

## Summary

The Schema Generator provides:

✅ **Automatic TypeScript interface generation**
✅ **Rich metadata in JSDoc comments**
✅ **Proper type mapping (UUID → string, etc.)**
✅ **Column constraints and defaults**
✅ **Zero runtime overhead**
✅ **Full IDE support**
✅ **Easy to automate**

Generate once, enjoy type safety everywhere!
