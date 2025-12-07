# CLI Usage Guide

Generate TypeScript schemas from your MariaDB database using the command-line interface.

## Quick Start

### 1. Setup .env File

Create a `.env` file in your project root:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
# MariaDB Configuration (Required)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=your_database

# Redis Configuration (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 2. Generate Schema

```bash
npx @bhushanpawar/sqldb --generate-schema
```

This will:
1. Read database configuration from `.env`
2. Connect to your MariaDB database
3. Discover all tables and columns
4. Generate TypeScript interfaces with metadata
5. Save to `db-schema.ts` in your current directory

## Commands

### Generate Schema

```bash
npx @bhushanpawar/sqldb --generate-schema [options]
```

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--output <path>` | Output file path | `./db-schema.ts` |
| `--interface <name>` | Interface name | `DatabaseSchema` |
| `--no-comments` | Disable JSDoc comments | Comments enabled |
| `--with-example` | Include usage example | No example |
| `--help`, `-h` | Show help message | - |

### Show Help

```bash
npx @bhushanpawar/sqldb --help
```

## Examples

### Basic Usage

Generate schema with default settings:

```bash
npx @bhushanpawar/sqldb --generate-schema
```

Output: `./db-schema.ts`

### Custom Output Path

Save to a specific location:

```bash
npx @bhushanpawar/sqldb --generate-schema --output src/types/database.ts
```

### Custom Interface Name

Use a custom TypeScript interface name:

```bash
npx @bhushanpawar/sqldb --generate-schema --interface MyAppSchema
```

Generated file will contain:
```typescript
export interface MyAppSchema {
  // ... tables
}
```

### With Usage Example

Include a usage example in the generated file:

```bash
npx @bhushanpawar/sqldb --generate-schema --with-example
```

### Without Comments

Generate minimal schema without JSDoc comments:

```bash
npx @bhushanpawar/sqldb --generate-schema --no-comments
```

### Combined Options

```bash
npx @bhushanpawar/sqldb --generate-schema \
  --output src/db.ts \
  --interface AppDatabase \
  --with-example
```

## Environment Variables

The CLI reads from a `.env` file in the current working directory.

### Required Variables

```env
DB_HOST          # MariaDB server hostname
DB_USER          # Database username
DB_DATABASE      # Database name
```

### Optional Variables

```env
DB_PORT          # MariaDB port (default: 3306)
DB_PASSWORD      # Database password (default: empty)
REDIS_HOST       # Redis host for caching (optional)
REDIS_PORT       # Redis port (default: 6379)
```

### Example .env

```env
# Development
DB_HOST=localhost
DB_PORT=3306
DB_USER=dev_user
DB_PASSWORD=dev_pass
DB_DATABASE=myapp_dev

# Production
# DB_HOST=prod-db.example.com
# DB_USER=prod_user
# DB_PASSWORD=strong_password
# DB_DATABASE=myapp_prod
```

## Generated Output

### Default Output (With Comments)

```typescript
import { SqlDBWithTables } from '@bhushanpawar/sqldb';

/**
 * Auto-generated database schema
 * Generated on: 2025-12-07T19:33:53.840Z
 * Total tables: 15
 */
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
    /** @type timestamp | @default current_timestamp() */
    created_at?: Date | null;
  };

  // ... more tables
}

// Type for your database client
export type DB = SqlDBWithTables<DatabaseSchema>;
```

### Without Comments

```typescript
export interface DatabaseSchema {
  users: {
    user_id: string;
    email?: string | null;
    name: string;
    created_at?: Date | null;
  };
  // ... more tables
}
```

### With Example

Includes usage instructions at the end:

```typescript
/**
 * Usage example:
 *
 * import { createSqlDB } from '@bhushanpawar/sqldb';
 * import { DB } from "./db-schema";
 *
 * const db = await createSqlDB(config) as DB;
 *
 * // Now you have full type safety:
 * const users = await db.users.findMany();
 * const orders = await db.orders.findMany();
 */
```

## Workflow Integration

### NPM Scripts

Add to your `package.json`:

```json
{
  "scripts": {
    "generate-schema": "npx @bhushanpawar/sqldb --generate-schema",
    "generate-schema:prod": "npx @bhushanpawar/sqldb --generate-schema --output src/types/db.ts"
  }
}
```

Run:
```bash
npm run generate-schema
```

### Git Hooks

Pre-commit hook to ensure schema is up-to-date:

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Generate schema
npm run generate-schema

# Check if schema changed
if ! git diff --exit-code db-schema.ts > /dev/null; then
  echo "⚠️  Schema has changed. Please review and commit:"
  echo "   git add db-schema.ts"
  exit 1
fi
```

### CI/CD

#### GitHub Actions

```yaml
name: Schema Check

on: [push, pull_request]

jobs:
  schema-check:
    runs-on: ubuntu-latest

    services:
      mariadb:
        image: mariadb:10
        env:
          MYSQL_ROOT_PASSWORD: test
          MYSQL_DATABASE: testdb
        ports:
          - 3306:3306

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Generate schema
        env:
          DB_HOST: localhost
          DB_USER: root
          DB_PASSWORD: test
          DB_DATABASE: testdb
        run: npx @bhushanpawar/sqldb --generate-schema

      - name: Check if schema is current
        run: |
          git diff --exit-code db-schema.ts || {
            echo "Schema is out of date!"
            exit 1
          }
```

## Troubleshooting

### Error: .env file not found

**Problem:** CLI can't find the `.env` file

**Solution:**
1. Ensure `.env` exists in your current directory
2. Or create it from the example: `cp .env.example .env`

### Error: Missing required environment variables

**Problem:** Required database credentials are missing

**Solution:** Check your `.env` file contains:
```env
DB_HOST=localhost
DB_USER=root
DB_DATABASE=mydb
```

### Error: Connection refused

**Problem:** Can't connect to MariaDB

**Solution:**
1. Verify MariaDB is running: `mysql -u root -p`
2. Check host and port in `.env`
3. Verify credentials are correct

### Error: Permission denied

**Problem:** User doesn't have permission to query INFORMATION_SCHEMA

**Solution:**
```sql
GRANT SELECT ON information_schema.* TO 'your_user'@'localhost';
FLUSH PRIVILEGES;
```

### Schema file is too large

**Problem:** Generated file is very large with many tables

**Solution:** Limit tables in database connection:
- Modify your application code to use `includeTables` config
- Or manually edit the generated file to keep only needed tables

## Best Practices

### 1. Version Control

**Do commit** the generated schema file:
```bash
git add db-schema.ts
git commit -m "Update database schema"
```

Benefits:
- Type safety without database access
- Schema changes visible in git history
- Enables offline development

### 2. Separate .env Files

Use different `.env` files for different environments:

```bash
# Development
cp .env.example .env.dev
# Edit .env.dev with dev database

# Production
cp .env.example .env.prod
# Edit .env.prod with prod database

# Generate from specific env file
DB_HOST=localhost npx @bhushanpawar/sqldb --generate-schema
```

### 3. Automate Regeneration

Regenerate schema after database migrations:

```bash
# Run migration
npm run migrate:up

# Regenerate schema
npm run generate-schema

# Commit both
git add migrations/ db-schema.ts
git commit -m "Add users table"
```

### 4. Use in Scripts

```javascript
// scripts/setup-db.js
const { execSync } = require('child_process');

async function setup() {
  console.log('Running migrations...');
  execSync('npm run migrate:up', { stdio: 'inherit' });

  console.log('Generating schema...');
  execSync('npx @bhushanpawar/sqldb --generate-schema', { stdio: 'inherit' });

  console.log('✅ Database setup complete!');
}

setup();
```

### 5. Multiple Databases

Generate schemas for multiple databases:

```bash
# User database
DB_DATABASE=users_db npx @bhushanpawar/sqldb --generate-schema --output src/schemas/users.ts

# Orders database
DB_DATABASE=orders_db npx @bhushanpawar/sqldb --generate-schema --output src/schemas/orders.ts
```

## Advanced Usage

### Custom Configuration

For complex setups, create a custom script:

```typescript
// scripts/generate-custom-schema.ts
import { createSqlDB } from '@bhushanpawar/sqldb';
import { configDotenv } from 'dotenv';
import * as fs from 'fs';

configDotenv();

async function generate() {
  const db = await createSqlDB({
    mariadb: {
      host: process.env.DB_HOST!,
      user: process.env.DB_USER!,
      password: process.env.DB_PASSWORD!,
      database: process.env.DB_DATABASE!,
    },
    discovery: {
      autoDiscover: true,
      // Only include specific tables
      includeTables: ['users', 'orders', 'products'],
    },
  });

  const schema = db.generateSchema({
    interfaceName: 'MyCustomSchema',
    includeComments: true,
    withExample: true,
  });

  // Add custom header
  const output = `
// This file is auto-generated. DO NOT EDIT.
// Generated: ${new Date().toISOString()}
// Generator: custom-script

${schema}
  `.trim();

  fs.writeFileSync('src/db-schema.ts', output);

  await db.close();
}

generate();
```

Run:
```bash
npx ts-node scripts/generate-custom-schema.ts
```

## Summary

The CLI provides a simple, zero-configuration way to generate TypeScript schemas:

✅ **Simple**: Just create `.env` and run one command
✅ **Fast**: Connects, discovers, and generates in seconds
✅ **Flexible**: Multiple output options and configurations
✅ **Safe**: Validates environment variables before connecting
✅ **Automated**: Easy to integrate with scripts and CI/CD

Start using:
```bash
npx @bhushanpawar/sqldb --generate-schema
```
