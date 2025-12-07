import { configDotenv } from 'dotenv';
import { createSqlDB } from '../src';

async function autoWarmingExample() {
  configDotenv();

  const dbConfigStr = process.env.DB_CONFIG;
  if (!dbConfigStr) {
    throw new Error('DB_CONFIG not found in .env file');
  }

  const dbConfig = JSON.parse(dbConfigStr);

  console.log('🚀 Auto-Warming Example\n');
  console.log('This example demonstrates the intelligent cache warming system that:');
  console.log('  - Tracks query frequency per table');
  console.log('  - Automatically warms the most-used queries');
  console.log('  - Uses a separate connection pool (no impact on main queries)');
  console.log('  - Persists stats in __sqldb_query_stats table\n');

  // Create DB with auto-warming enabled
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
      keyPrefix: 'warming_example:',
    },
    cache: {
      enabled: true,
      defaultTTL: 300, // 5 minutes
    },
    discovery: {
      autoDiscover: true,
    },
    warming: {
      enabled: true, // Enable auto-warming
      intervalMs: 30000, // Warm every 30 seconds
      topQueriesPerTable: 5, // Warm top 5 queries per table
      minAccessCount: 2, // Must be accessed at least 2 times
      maxStatsAge: 600000, // Consider queries from last 10 minutes
      useSeperatePool: true, // Use separate connection pool
      warmingPoolSize: 2, // 2 connections for warming
      trackInDatabase: true, // Store stats in database
      statsTableName: '__sqldb_query_stats', // Stats table name
      onWarmingComplete: (stats) => {
        console.log('\n📊 Auto-Warming Complete:', {
          queriesWarmed: stats.queriesWarmed,
          queriesFailed: stats.queriesFailed,
          totalTimeMs: stats.totalTimeMs,
          cacheHitRateBefore: (stats.cacheHitRateBefore * 100).toFixed(1) + '%',
          cacheHitRateAfter: (stats.cacheHitRateAfter * 100).toFixed(1) + '%',
        });
      },
      onWarmingError: (error) => {
        console.error('\n❌ Warming Error:', error.message);
      },
    },
    logging: {
      level: 'info',
    },
  });

  console.log('✅ SqlDB initialized with auto-warming enabled\n');

  // Simulate user queries to build up statistics
  console.log('📝 Simulating user queries...\n');

  // Query 1: Frequently accessed users
  for (let i = 0; i < 5; i++) {
    const users = await (db as any).provider.findMany({}, { limit: 10 });
    console.log(`   Query ${i + 1}/5: Found ${users.length} providers`);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('');

  // Query 2: Specific user lookups
  for (let i = 0; i < 3; i++) {
    const user = await (db as any).provider.findOne({}, {});
    if (user) {
      console.log(`   Lookup ${i + 1}/3: Found provider ${(user as any).provider_id}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('');

  // Query 3: Orders with filters
  for (let i = 0; i < 4; i++) {
    const orders = await (db as any).service_request.findMany({}, { limit: 5 });
    console.log(`   Query ${i + 1}/4: Found ${orders.length} service requests`);
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log('\n📈 Query Statistics After Simulated Traffic:\n');

  // Get query statistics
  const stats = await db.getQueryStatsSummary();
  if (stats) {
    console.log('   Total Queries Tracked:', stats.totalQueries);
    console.log('   Total Accesses:', stats.totalAccesses);
    console.log('   Tables with Queries:', stats.tableCount);
    console.log('   Avg Access Count:', stats.avgAccessCount.toFixed(2));
  }

  console.log('\n⏳ Waiting for auto-warming to run (30 seconds)...');
  console.log('   (Auto-warming will pick up the most frequently accessed queries)\n');

  // Wait for auto-warming to run
  await new Promise((resolve) => setTimeout(resolve, 35000));

  // Get warming stats
  const warmingStats = db.getWarmingStats();
  if (warmingStats) {
    console.log('\n✨ Latest Warming Statistics:\n');
    console.log('   Timestamp:', warmingStats.timestamp.toISOString());
    console.log('   Queries Warmed:', warmingStats.queriesWarmed);
    console.log('   Queries Failed:', warmingStats.queriesFailed);
    console.log('   Total Time (ms):', warmingStats.totalTimeMs);
    console.log('   Cache Hit Rate Before:', (warmingStats.cacheHitRateBefore * 100).toFixed(1) + '%');
    console.log('   Cache Hit Rate After:', (warmingStats.cacheHitRateAfter * 100).toFixed(1) + '%');
    console.log('\n   Per Table:');
    for (const [table, tableStats] of Object.entries(warmingStats.tables)) {
      console.log(`     ${table}:`);
      console.log(`       - Queries Warmed: ${tableStats.queriesWarmed}`);
      console.log(`       - Avg Execution Time: ${tableStats.avgExecutionTime.toFixed(2)}ms`);
    }
  }

  console.log('\n🎯 Manual Warming Example:\n');

  // You can also trigger warming manually
  console.log('   Triggering manual cache warming...');
  const manualStats = await db.warmCache();
  if (manualStats) {
    console.log('   Manual Warming Complete:');
    console.log('     - Queries Warmed:', manualStats.queriesWarmed);
    console.log('     - Total Time:', manualStats.totalTimeMs + 'ms');
  }

  console.log('\n📊 Benefits of Auto-Warming:\n');
  console.log('   ✅ Reduced cache misses');
  console.log('   ✅ Faster response times for hot queries');
  console.log('   ✅ No impact on main query performance (separate pool)');
  console.log('   ✅ Intelligent - only warms frequently used queries');
  console.log('   ✅ Automatic - runs in background');
  console.log('   ✅ Persistent - stats survive restarts (in database)\n');

  await db.close();
}

autoWarmingExample().catch(console.error);
