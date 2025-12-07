# CLI Quick Start

Generate TypeScript schemas from your MariaDB database in 3 simple steps.

## 🚀 Quick Start (30 seconds)

### Step 1: Create .env file

```bash
cat > .env << EOF
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=your_database
EOF
```

### Step 2: Generate schema

```bash
npx @bhushanpawar/sqldb --generate-schema
```

### Step 3: Use it!

```typescript
import { createSqlDB, SqlDBWithTables } from '@bhushanpawar/sqldb';
import { DatabaseSchema } from './db-schema';

type DB = SqlDBWithTables<DatabaseSchema>;
const db = await createSqlDB(config) as DB;

// Full type safety! ✨
const users = await db.users.findMany();
const orders = await db.orders.findById(123);
```

That's it! 🎉

## What You Get

✅ **TypeScript interfaces** for all your tables
✅ **Rich metadata** (column types, constraints, defaults)
✅ **Full type safety** with autocomplete
✅ **UUID properly typed** as `string` (not `any`)
✅ **Zero configuration** - just needs .env file

## Example Output

```typescript
export interface DatabaseSchema {
  users: {
    /** @type uuid | @default uuid() */
    user_id: string;

    /** @type varchar(255) | @maxLength 255 | @default NULL */
    email?: string | null;

    /** @type int(11) | @precision 10,0 | @default 0 */
    login_count?: number | null;

    /** @type decimal(10,2) | @precision 10,2 | @default 0.00 */
    balance?: number | null;
  };
}
```

## CLI Options

```bash
# Custom output path
npx @bhushanpawar/sqldb --generate-schema --output src/types/db.ts

# Custom interface name
npx @bhushanpawar/sqldb --generate-schema --interface MyDB

# With usage example
npx @bhushanpawar/sqldb --generate-schema --with-example

# No comments (minimal)
npx @bhushanpawar/sqldb --generate-schema --no-comments
```

## Environment Variables

### Required
```env
DB_HOST=localhost        # MariaDB host
DB_USER=root            # Database user
DB_DATABASE=mydb        # Database name
```

### Optional
```env
DB_PORT=3306            # Default: 3306
DB_PASSWORD=secret      # Default: empty
REDIS_HOST=localhost    # For caching (optional)
REDIS_PORT=6379        # Default: 6379
```

## Common Use Cases

### Local Development

```bash
# .env
DB_HOST=localhost
DB_USER=dev
DB_PASSWORD=dev123
DB_DATABASE=myapp_dev

npx @bhushanpawar/sqldb --generate-schema
```

### Production Schema

```bash
# .env.prod
DB_HOST=prod-db.example.com
DB_USER=readonly
DB_PASSWORD=****
DB_DATABASE=myapp_prod

# Load prod env and generate
cat .env.prod > .env
npx @bhushanpawar/sqldb --generate-schema --output src/prod-schema.ts
```

### CI/CD Integration

```yaml
# .github/workflows/schema-check.yml
- name: Generate schema
  run: npx @bhushanpawar/sqldb --generate-schema

- name: Check if up-to-date
  run: git diff --exit-code db-schema.ts
```

## Help

```bash
npx @bhushanpawar/sqldb --help
```

## Full Documentation

- [CLI Usage Guide](CLI_USAGE.md) - Complete CLI documentation
- [Schema Generator](SCHEMA_GENERATOR.md) - Schema generation features
- [README](README.md) - Full library documentation

## Benefits Over Manual Types

| Manual | CLI Generated |
|--------|---------------|
| ❌ Tedious to write | ✅ Auto-generated |
| ❌ Gets out of sync | ✅ Always current |
| ❌ Easy to make mistakes | ✅ Accurate from DB |
| ❌ No metadata | ✅ Rich JSDoc comments |
| ❌ Time consuming | ✅ Takes seconds |

## Next Steps

After generating your schema:

1. **Commit it** to version control
2. **Use it** in your application code
3. **Regenerate** after schema changes
4. **Enjoy** full type safety! 🎉

```bash
git add db-schema.ts
git commit -m "Add generated database schema"
```

Happy coding! 🚀
