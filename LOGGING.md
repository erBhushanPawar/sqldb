# Query Logging in SqlDB

SqlDB provides flexible query logging that integrates seamlessly with your existing application logger.

## Features

- ✅ **Logger Instance Support**: Pass your pre-configured Winston, Pino, or custom logger directly
- ✅ **Function Logger Support**: Use a simple logging function for custom formats
- ✅ **Correlation ID Tracking**: Track queries across your application with correlation IDs
- ✅ **Performance Indicators**: Visual emojis show query performance (⚡ fast, 🐌 slow)
- ✅ **Automatic Metadata**: Includes query type, table name, execution time, and result count
- ✅ **Flexible Format**: Format logs however your application needs

## Configuration

### Option 1: Logger Instance (Recommended)

Pass your existing logger instance directly. Works with Winston, Pino, Bunyan, or any logger with `.info()`, `.error()`, `.warn()`, `.debug()` methods.

```typescript
import { createSqlDB } from '@bhushanpawar/sqldb';

// Your existing logger
const myAppLogger = {
  info: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const corrId = meta?.correlationId || 'N/A';
    console.log(`[${timestamp}] [INFO] [APP] [CorrID: ${corrId}] ${message}`);
  },
  error: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const corrId = meta?.correlationId || 'N/A';
    console.error(`[${timestamp}] [ERROR] [APP] [CorrID: ${corrId}] ${message}`);
  },
  // ... warn, debug, etc.
};

const db = await createSqlDB({
  mariadb: { /* ... */ },
  redis: { /* ... */ },
  logging: {
    level: 'info',
    logger: myAppLogger, // Pass your logger instance
  },
});
```

### Option 2: Logger Function

Use a simple function for custom formatting:

```typescript
const db = await createSqlDB({
  mariadb: { /* ... */ },
  redis: { /* ... */ },
  logging: {
    level: 'info',
    logger: (level, message, meta) => {
      console.log(`[${level.toUpperCase()}] ${message}`, meta);
    },
  },
});
```

## Using Correlation IDs

Correlation IDs help you track queries across your application. Pass them to any query method:

### With findMany/findOne (via options)
```typescript
await db.provider.findMany({}, {
  limit: 10,
  correlationId: 'user-request-58yG2XwM'
});
```

### With other operations (direct parameter)
```typescript
await db.provider.findById(123, 'user-request-58yG2XwM');
await db.provider.insertOne(data, 'user-request-IcozPUwz');
await db.provider.updateById(123, data, 'user-request-d2NMbvQh');
await db.provider.deleteById(123, 'user-request-cemW4HQD');
```

### With raw queries
```typescript
await db.services.raw(
  'SELECT * FROM services WHERE provider_id = ?',
  [providerId],
  'user-request-58yG2XwM'
);
```

## Log Format

Each query log includes:

**Message Format:**
```
✅ Query Result: | "SELECT * FROM users WHERE id = ?" | 142 | {}
```

**Metadata Object:**
```typescript
{
  correlationId: 'user-request-58yG2XwM',
  queryType: 'SELECT',
  tableName: 'users',
  executionTimeMs: 12,
  resultCount: 142
}
```

## Performance Indicators

Logs include visual emojis based on execution time:

- ⚡ **Very fast** (<10ms)
- 🚀 **Fast** (<50ms)
- ✅ **Good** (<200ms)
- ⚠️ **Slow** (<500ms)
- 🐌 **Very slow** (≥500ms)
- ❌ **Failed** (error occurred)

## Examples

### With Winston

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'queries.log' })
  ]
});

const db = await createSqlDB({
  logging: {
    level: 'info',
    logger: logger  // Winston instance
  }
});
```

### With Pino

```typescript
import pino from 'pino';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty'
  }
});

const db = await createSqlDB({
  logging: {
    level: 'info',
    logger: logger  // Pino instance
  }
});
```

### Custom Format (Your Format)

```typescript
const logger = {
  info: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const corrId = meta?.correlationId || 'N/A';
    const appName = 'SHE CAREERS';

    console.log(
      `[${timestamp}] [INFO] [${appName}] [CorrID: ${corrId}] [- AS -] ${message}`
    );
  },
  error: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const corrId = meta?.correlationId || 'N/A';
    const appName = 'SHE CAREERS';

    console.error(
      `[${timestamp}] [ERROR] [${appName}] [CorrID: ${corrId}] [- AS -] ${message}`
    );
  }
};

const db = await createSqlDB({
  logging: {
    level: 'info',
    logger: logger
  }
});
```

**Output:**
```
[2026-01-14T10:02:26.944Z] [INFO] [SHE CAREERS] [CorrID: 58yG2XwM] [- AS -] ✅ Query Result: | "select count(*) as cnt, service_id as serviceId, category_id as categoryId from services where category_id is not null group by category_id order by cnt DESC;" | 142 | {}
```

## Log Levels

Available log levels:
- `debug` - Very verbose, includes all queries
- `info` - Normal operation, includes all queries (default)
- `warn` - Warnings only
- `error` - Errors only
- `none` - Disable logging

```typescript
const db = await createSqlDB({
  logging: {
    level: 'error',  // Only log errors
    logger: myLogger
  }
});
```

## Complete Example

See the examples directory:
- [examples/logger-instance-example.ts](examples/logger-instance-example.ts) - Full example with logger instance
- [examples/custom-logger-example.ts](examples/custom-logger-example.ts) - Custom logger function
- [examples/query-logging-example.ts](examples/query-logging-example.ts) - Basic logging demo

## TypeScript Types

```typescript
import { LoggerInstance, LoggingConfig } from '@bhushanpawar/sqldb';

// Logger instance interface
interface LoggerInstance {
  log?: (message: string, ...meta: any[]) => void;
  info?: (message: string, ...meta: any[]) => void;
  warn?: (message: string, ...meta: any[]) => void;
  error?: (message: string, ...meta: any[]) => void;
  debug?: (message: string, ...meta: any[]) => void;
}

// Logging configuration
interface LoggingConfig {
  level?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  logger?: LoggerInstance | ((level: string, message: string, meta?: any) => void);
}
```

## Migration from Old Version

**Before (not working):**
```typescript
const db = await createSqlDB({
  mariadb: {
    // ...
    logging: true,  // ❌ This didn't work
  },
  logging: {
    level: 'info',  // ❌ This was ignored
  }
});
```

**After (working):**
```typescript
const db = await createSqlDB({
  mariadb: {
    // ... (no logging property here)
  },
  logging: {
    level: 'info',
    logger: myAppLogger,  // ✅ Works!
  }
});
```
