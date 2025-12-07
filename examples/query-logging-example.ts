import { configDotenv } from 'dotenv';
import { createSqlDB } from '../src';

async function queryLoggingExample() {
  configDotenv();

  const dbConfigStr = process.env.DB_CONFIG;
  if (!dbConfigStr) {
    throw new Error('DB_CONFIG not found in .env file');
  }

  const dbConfig = JSON.parse(dbConfigStr);

  console.log('📊 Enhanced Query Logging Example\n');
  console.log('This example demonstrates categorized query logging with:');
  console.log('  - Query type (SELECT, INSERT, UPDATE, DELETE, etc.)');
  console.log('  - Table name extraction');
  console.log('  - Execution time with performance emojis');
  console.log('  - Row count / affected rows');
  console.log('  - Automatic SQL display for slow queries (>200ms)\n');

  // Create DB with logging enabled
  const db = await createSqlDB({
    mariadb: {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      connectionLimit: 10,
      logging: true, // Enable query logging
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      keyPrefix: 'logging_example:',
    },
    cache: {
      enabled: true,
    },
    discovery: {
      autoDiscover: true,
    },
    logging: {
      level: 'info',
    },
  });

  console.log('\n✅ Database initialized\n');
  console.log('📝 Running various queries to demonstrate logging...\n');

  // Example 1: Fast SELECT query
  console.log('1️⃣  Fast SELECT query:');
  const users = await (db as any).provider.findMany({}, { limit: 5 });
  console.log(`   → Retrieved ${users.length} providers\n`);

  await new Promise((r) => setTimeout(r, 500));

  // Example 2: SELECT with filters
  console.log('2️⃣  SELECT with filters:');
  const orders = await (db as any).service_request.findMany({}, { limit: 10 });
  console.log(`   → Retrieved ${orders.length} service requests\n`);

  await new Promise((r) => setTimeout(r, 500));

  // Example 3: Single row lookup
  console.log('3️⃣  Single row lookup:');
  const user = await (db as any).provider.findOne({}, {});
  console.log(`   → Found provider: ${user ? (user as any).provider_id : 'none'}\n`);

  await new Promise((r) => setTimeout(r, 500));

  // Example 4: COUNT query
  console.log('4️⃣  COUNT query:');
  const count = await (db as any).provider.count({});
  console.log(`   → Total providers: ${count}\n`);

  await new Promise((r) => setTimeout(r, 500));

  console.log('📊 Query Logging Legend:\n');
  console.log('   ⚡ - Very fast (<10ms)');
  console.log('   🚀 - Fast (<50ms)');
  console.log('   ✅ - Good (<200ms)');
  console.log('   ⚠️  - Slow (<500ms)');
  console.log('   🐌 - Very slow (≥500ms)');
  console.log('   ❌ - Failed\n');

  console.log('💡 Benefits of Enhanced Logging:\n');
  console.log('   ✅ Easy to identify slow queries');
  console.log('   ✅ Track query types and patterns');
  console.log('   ✅ Monitor table-level performance');
  console.log('   ✅ Automatic SQL display for slow queries');
  console.log('   ✅ Visual performance indicators\n');

  await db.close();
}

queryLoggingExample().catch(console.error);
