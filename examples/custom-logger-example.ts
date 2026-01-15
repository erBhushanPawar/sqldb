import { configDotenv } from 'dotenv';
import { createSqlDB } from '../src';

/**
 * Example of configuring a custom logger with your application's format
 * This shows how to integrate sqldb logging with your existing logging system
 */
async function customLoggerExample() {
  configDotenv();

  const dbConfigStr = process.env.DB_CONFIG;
  if (!dbConfigStr) {
    throw new Error('DB_CONFIG not found in .env file');
  }

  const dbConfig = JSON.parse(dbConfigStr);

  // Your application name
  const APP_NAME = 'SHE CAREERS';

  // Option 1: Custom logger function
  // This is useful if you want a simple function-based logger
  const customLoggerFunction = (level: string, message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const corrId = meta?.correlationId || 'N/A';
    const levelUpper = level.toUpperCase();

    console.log(`[${timestamp}] [${levelUpper}] [${APP_NAME}] [CorrID: ${corrId}] [- AS -] ${message}`);
  };

  // Option 2: Logger instance (RECOMMENDED - see logger-instance-example.ts)
  // This is better if you want to use Winston, Pino, or a logger with methods
  const customLoggerInstance = {
    info: (message: string, meta?: any) => {
      const timestamp = new Date().toISOString();
      const corrId = meta?.correlationId || 'N/A';
      console.log(`[${timestamp}] [INFO] [${APP_NAME}] [CorrID: ${corrId}] [- AS -] ${message}`);
    },
    error: (message: string, meta?: any) => {
      const timestamp = new Date().toISOString();
      const corrId = meta?.correlationId || 'N/A';
      console.error(`[${timestamp}] [ERROR] [${APP_NAME}] [CorrID: ${corrId}] [- AS -] ${message}`);
    },
  };

  console.log('📊 Custom Logger Example\n');
  console.log('This example demonstrates how to configure a custom logger');
  console.log('that matches your application\'s logging format.\n');

  // Create DB with custom logger
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
      keyPrefix: 'custom_logger:',
    },
    cache: {
      enabled: true,
    },
    discovery: {
      autoDiscover: true,
    },
    logging: {
      level: 'info',
      logger: customLoggerInstance, // Use logger instance (recommended)
      // OR use: logger: customLoggerFunction, // Use logger function
    },
  });

  console.log('\n✅ Database initialized with custom logger\n');
  console.log('📝 Running queries with custom correlation IDs...\n');

  // Example 1: Query with correlation ID
  console.log('1️⃣  Query with correlation ID "58yG2XwM":');
  const result1 = await (db as any).provider.findMany({}, {
    limit: 10,
    correlationId: '58yG2XwM' // Pass your correlation ID
  });
  console.log(`   → Retrieved ${result1.length} providers\n`);

  await new Promise((r) => setTimeout(r, 500));

  // Example 2: Query with different correlation ID
  console.log('2️⃣  Query with correlation ID "IcozPUwz":');
  const result2 = await (db as any).service_request.findMany({}, {
    limit: 5,
    correlationId: 'IcozPUwz'
  });
  console.log(`   → Retrieved ${result2.length} service requests\n`);

  await new Promise((r) => setTimeout(r, 500));

  // Example 3: Raw query with correlation ID
  console.log('3️⃣  Raw query with correlation ID "d2NMbvQh":');
  const result3 = await (db as any).services.raw(
    'select count(*) as cnt, provider_id from services group by provider_id',
    [],
    'd2NMbvQh' // Correlation ID passed as third parameter
  );
  console.log(`   → Retrieved ${result3.length} rows\n`);

  console.log('💡 Custom Logger Benefits:\n');
  console.log('   ✅ Consistent log format across your application');
  console.log('   ✅ Correlation IDs for request tracking');
  console.log('   ✅ Easy integration with log aggregation systems');
  console.log('   ✅ Flexible formatting to match your needs\n');

  await db.close();
}

customLoggerExample().catch(console.error);
