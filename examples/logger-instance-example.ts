import { configDotenv } from 'dotenv';
import { createSqlDB } from '../src';

/**
 * Example of using a pre-configured logger instance
 * This shows how to pass your existing application logger to sqldb
 *
 * Compatible with Winston, Pino, Bunyan, and any logger with .info(), .error() methods
 */
async function loggerInstanceExample() {
  configDotenv();

  const dbConfigStr = process.env.DB_CONFIG;
  if (!dbConfigStr) {
    throw new Error('DB_CONFIG not found in .env file');
  }

  const dbConfig = JSON.parse(dbConfigStr);

  // Your pre-configured logger instance
  // This could be Winston, Pino, or your custom logger
  const myAppLogger = {
    info: (message: string, meta?: any) => {
      const timestamp = new Date().toISOString();
      const corrId = meta?.correlationId || 'N/A';
      const appName = 'SHE CAREERS';

      // Your custom format
      console.log(`[${timestamp}] [INFO] [${appName}] [CorrID: ${corrId}] [- AS -] ${message}`);
    },

    error: (message: string, meta?: any) => {
      const timestamp = new Date().toISOString();
      const corrId = meta?.correlationId || 'N/A';
      const appName = 'SHE CAREERS';

      console.error(`[${timestamp}] [ERROR] [${appName}] [CorrID: ${corrId}] [- AS -] ${message}`);
    },

    warn: (message: string, meta?: any) => {
      const timestamp = new Date().toISOString();
      const corrId = meta?.correlationId || 'N/A';
      const appName = 'SHE CAREERS';

      console.warn(`[${timestamp}] [WARN] [${appName}] [CorrID: ${corrId}] [- AS -] ${message}`);
    },

    debug: (message: string, meta?: any) => {
      const timestamp = new Date().toISOString();
      const corrId = meta?.correlationId || 'N/A';
      const appName = 'SHE CAREERS';

      console.log(`[${timestamp}] [DEBUG] [${appName}] [CorrID: ${corrId}] [- AS -] ${message}`);
    },
  };

  console.log('📊 Logger Instance Example\n');
  console.log('This example demonstrates how to pass your pre-configured logger');
  console.log('instance to sqldb for seamless integration.\n');

  // Create DB with your logger instance
  const db = await createSqlDB({
    mariadb: {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      connectionLimit: 10,
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      keyPrefix: 'logger_instance:',
    },
    cache: {
      enabled: true,
    },
    discovery: {
      autoDiscover: true,
    },
    logging: {
      level: 'info',
      logger: myAppLogger, // Pass your logger instance directly!
    },
  });

  console.log('\n✅ Database initialized with your logger instance\n');
  console.log('📝 Running queries - watch your custom log format...\n');

  // Example 1: Query with correlation ID
  console.log('1️⃣  Query with correlation ID "58yG2XwM":');
  const result1 = await (db as any).provider.findMany({}, {
    limit: 471,
    correlationId: '58yG2XwM'
  });
  console.log(`   → Retrieved ${result1.length} providers\n`);

  await new Promise((r) => setTimeout(r, 500));

  // Example 2: Raw query
  console.log('2️⃣  Raw query with correlation ID "IcozPUwz":');
  const result2 = await (db as any).services.raw(
    'select count(*) as cnt, service_id as serviceId, category_id as categoryId from services where category_id is not null group by category_id order by cnt DESC;',
    [],
    'IcozPUwz'
  );
  console.log(`   → Retrieved ${result2.length} rows\n`);

  await new Promise((r) => setTimeout(r, 500));

  // Example 3: Another raw query
  console.log('3️⃣  Raw query with correlation ID "cemW4HQD":');
  const result3 = await (db as any).services.raw(
    'select count(*) as cnt, provider_id from services group by provider_id',
    [],
    'cemW4HQD'
  );
  console.log(`   → Retrieved ${result3.length} rows\n`);

  console.log('💡 Benefits of Logger Instance:\n');
  console.log('   ✅ Use your existing logger (Winston, Pino, etc.)');
  console.log('   ✅ No need to wrap logger in a function');
  console.log('   ✅ Consistent logging across your entire application');
  console.log('   ✅ All your logger configuration (transports, levels, etc.) just works\n');

  console.log('📖 Example with Winston:\n');
  console.log('   const winston = require("winston");');
  console.log('   const logger = winston.createLogger({ /* your config */ });');
  console.log('   ');
  console.log('   const db = await createSqlDB({');
  console.log('     logging: {');
  console.log('       level: "info",');
  console.log('       logger: logger  // Pass Winston instance directly!');
  console.log('     }');
  console.log('   });\n');

  await db.close();
}

loggerInstanceExample().catch(console.error);
