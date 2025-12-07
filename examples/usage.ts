import { configDotenv } from "dotenv";
import { createSqlDB, SqlDBClient, generateQueryId } from "../src";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

async function performanceTest() {
    configDotenv();
    const dbClient = await getDBClient();

    console.log('\n=== MariaDB Cache Performance Test ===\n');

    // Read queries from extracted-queries.sql
    const queriesFile = path.join(__dirname, '../extracted-queries.sql');

    if (!fs.existsSync(queriesFile)) {
        console.error(`Error: ${queriesFile} not found`);
        console.log('Please run: ./extract-queries.sh first');
        await dbClient.close();
        return;
    }

    const allQueries = fs.readFileSync(queriesFile, 'utf-8')
        .split('\n')
        .filter(q => q.trim().length > 0);

    console.log(`📊 Loaded ${allQueries.length} queries from file`);

    // Get unique queries for testing
    const uniqueQueries = [...new Set(allQueries)];
    console.log(`🔹 Unique queries: ${uniqueQueries.length}\n`);

    // Test configuration
    const testRounds = 10; // Run each query twice to test caching
    const batchSize = 20; // Process queries in batches
    const queries = uniqueQueries.slice(0, 10000); // Test first 100 unique queries

    console.log(`🎯 Testing ${queries.length} queries with ${testRounds} rounds\n`);

    // Performance metrics
    const correlationId = generateQueryId();
    const roundMetrics: Array<{
        round: number;
        totalTime: number;
        avgTime: number;
        cacheHits: number;
        cacheMisses: number;
    }> = [];

    for (let round = 1; round <= testRounds; round++) {
        console.log(`\n--- Round ${round}/${testRounds} ---`);
        const roundStart = Date.now();
        let executedCount = 0;

        // Process queries in batches
        for (let i = 0; i < queries.length; i += batchSize) {
            const batch = queries.slice(i, i + batchSize);

            await Promise.all(batch.map(async (sql) => {
                try {
                    const table = dbClient.getTableOperations('__raw__');
                    await table.raw(sql, [], correlationId);
                    executedCount++;
                } catch (error) {
                    // Silent fail for invalid queries
                }
            }));

            const progress = Math.min(i + batchSize, queries.length);
            process.stdout.write(`\rProgress: ${progress}/${queries.length} queries`);
        }

        const roundEnd = Date.now();
        const roundTime = roundEnd - roundStart;

        console.log(`\n✓ Round ${round} completed in ${roundTime}ms`);
        console.log(`  Executed: ${executedCount} queries`);
        console.log(`  Average: ${(roundTime / executedCount).toFixed(2)}ms per query`);

        roundMetrics.push({
            round,
            totalTime: roundTime,
            avgTime: roundTime / executedCount,
            cacheHits: 0,
            cacheMisses: executedCount,
        });
    }

    // Get query execution details
    const queryDetails = dbClient.getQueries(correlationId);

    console.log('\n=== Performance Summary ===\n');

    roundMetrics.forEach((metric) => {
        console.log(`Round ${metric.round}:`);
        console.log(`  Total Time: ${metric.totalTime}ms`);
        console.log(`  Avg Time/Query: ${metric.avgTime.toFixed(2)}ms`);
    });

    // Calculate cache improvement
    if (roundMetrics.length >= 2) {
        const firstRound = roundMetrics[0];
        const secondRound = roundMetrics[1];
        const improvement = ((firstRound.totalTime - secondRound.totalTime) / firstRound.totalTime) * 100;

        console.log(`\n📈 Cache Performance:`);
        console.log(`  First run: ${firstRound.totalTime}ms`);
        console.log(`  Second run (cached): ${secondRound.totalTime}ms`);
        console.log(`  Improvement: ${improvement.toFixed(2)}%`);
        console.log(`  Speedup: ${(firstRound.totalTime / secondRound.totalTime).toFixed(2)}x faster`);
    }

    // Query execution statistics
    console.log(`\n📊 Query Execution Stats:`);
    console.log(`  Total queries tracked: ${queryDetails.length}`);

    const executionTimes = queryDetails.map(q => q.executionTimeMs || 0);
    const avgExecTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    const minExecTime = Math.min(...executionTimes);
    const maxExecTime = Math.max(...executionTimes);

    console.log(`  Avg execution time: ${avgExecTime.toFixed(2)}ms`);
    console.log(`  Min execution time: ${minExecTime.toFixed(2)}ms`);
    console.log(`  Max execution time: ${maxExecTime.toFixed(2)}ms`);

    // Top 10 slowest queries
    const slowestQueries = [...queryDetails]
        .sort((a, b) => (b.executionTimeMs || 0) - (a.executionTimeMs || 0))
        .slice(0, 10);

    console.log(`\n🐌 Top 10 Slowest Queries:`);
    slowestQueries.forEach((q, idx) => {
        const truncatedSql = q.sql.substring(0, 80);
        console.log(`  ${idx + 1}. ${q.executionTimeMs?.toFixed(2)}ms - ${truncatedSql}...`);
    });

    // Save detailed results
    const resultsFile = path.join(__dirname, '../performance-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify({
        testDate: new Date().toISOString(),
        configuration: {
            totalQueries: queries.length,
            rounds: testRounds,
            batchSize,
            cacheTTL: 300,
        },
        roundMetrics,
        queryDetails: queryDetails.map(q => ({
            queryId: q.queryId,
            sql: q.sql.substring(0, 100),
            executionTimeMs: q.executionTimeMs,
            resultCount: q.resultCount,
        })),
        summary: {
            avgExecutionTime: avgExecTime,
            minExecutionTime: minExecTime,
            maxExecutionTime: maxExecTime,
        }
    }, null, 2));

    console.log(`\n✅ Detailed results saved to: ${resultsFile}`);

    // Clear queries and close
    dbClient.clearQueries();
    await dbClient.close();
    console.log('\n✓ Performance test completed!\n');
}


async function getDBClient(): Promise<SqlDBClient> {
    configDotenv();
    const dbConfigStr = process.env.DB_CONFIG;
    if (!dbConfigStr) {
        throw new Error('DB_CONFIG not found in .env file');
    }

    const dbConfig = JSON.parse(dbConfigStr);

    const dbClient = await createSqlDB({
        mariadb: {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
            connectionLimit: 50,
            logging: true
        },
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            keyPrefix: 'usage_example:',
        },
        cache: {
            enabled: true,
            defaultTTL: 60,
            maxKeys: 1000,
            invalidateOnWrite: true,
            cascadeInvalidation: true,
        },
        discovery: {
            autoDiscover: true,
        },
        logging: {
            level: 'info',
        },
        warming: {
            enabled: true,
            warmingPoolSize: 2

        }
    });
    return dbClient;
}

async function main() {

    const dbClient = await getDBClient()
    console.log('SqlDB client initialized successfully!');
    console.log('Discovered tables:', dbClient.getDiscoveredTables());
    const correlationId = randomUUID()
    const userTable = dbClient.getTableOperations('__raw__');
    for (let i = 1; i <= 100; i++) {
        // Example: Query a table

        const users = await userTable.raw("SELECT * FROM services_review WHERE service_id IN ('d2ccddd4-3e96-46b0-ad75-b0917106780e', '1809c51d-633f-4c25-b84e-95b7177c422f', '84fb3cec-b94f-4bcf-9952-a6bd9e3333c5', '8179401e-f0ec-47ce-aaa6-61ccfbaed192', '065534b2-56dc-4a63-aafe-434d3faedf61', '0825a4a1-e983-4aee-9ead-c6c3e669addf', '11c38144-206a-4dca-8b55-0d67c247524a', 'c319f3bd-9c93-464e-b63d-0332d2369d58', '91c2502c-74a1-435a-b9f7-3a64710a5e4f', 'df0cd39f-4820-4142-913f-d8b3005b2ffb') ORDER BY created_on DESC LIMIT 10 OFFSET 0", [], correlationId)
        // const users = await userTable.findMany({}, { limit: 10, correlationId: correlationId });
        console.log('Found users:', users.length);
    }

    const queries = await dbClient.getQueries(correlationId);
    console.log('Total queries executed:', queries.length);
    console.log('Cache stats:', dbClient.getCacheManager().getStats());

    // Close connection when done
    await dbClient.close();
    console.log('Connection closed.');
}

async function dbGraph() {
    const dbClient = await getDBClient();

    const graph = await dbClient.getDependencyGraph();
    console.log(graph);
}

async function testCachePerformance() {
    const dbClient = await getDBClient();
    console.log('SqlDB client initialized successfully!\n');

    console.log('=== Cache Performance & Invalidation Test ===\n');
    console.log('Testing multiple update cycles with performance measurements\n');

    const providerTable = dbClient.getTableOperations('provider');
    const providerSchema = dbClient.getTableSchema('provider');
    const pkColumn = providerSchema?.primaryKey || 'id';

    // Warm the cache first
    console.log('🔥 Warming cache...');
    const warmStart = Date.now();
    await providerTable.warmCacheWithRelations({}, {
        depth: 1,
        warmDependents: true,
        warmDependencies: true,
    });
    console.log(`✓ Cache warmed in ${Date.now() - warmStart}ms\n`);

    // Get a test provider
    const testProviders = await providerTable.findMany({}, { limit: 1 });
    if (testProviders.length === 0) {
        console.log('⚠️  No providers found. Exiting test.\n');
        await dbClient.close();
        return;
    }

    const providerId = (testProviders[0] as any)[pkColumn];
    console.log(`Testing with provider: ${providerId}\n`);

    // Performance tracking
    const performanceResults: Array<{
        cycle: number;
        operation: string;
        timeMs: number;
        cacheHitRate: string;
        queriesExecuted: number;
    }> = [];

    // Run 5 cycles of: fetch → update → fetch
    for (let cycle = 1; cycle <= 5; cycle++) {
        console.log(`--- Cycle ${cycle}/5 ---`);

        // 1. Fetch with relations (should be fast with cache)
        dbClient.getCacheManager().resetStats();
        dbClient.clearQueries();
        const fetchStart = Date.now();

        const provider = await providerTable.findOne(
            { [pkColumn]: providerId },
            {
                withRelations: {
                    dependents: ['services', 'orders', 'bank_details'],
                    dependencies: true
                }
            }
        );

        const fetchTime = Date.now() - fetchStart;
        const fetchStats = dbClient.getCacheManager().getStats();
        const fetchQueries = dbClient.getQueries().length;

        performanceResults.push({
            cycle,
            operation: 'Fetch with relations',
            timeMs: fetchTime,
            cacheHitRate: fetchStats.hitRate,
            queriesExecuted: fetchQueries
        });

        console.log(`  Fetch: ${fetchTime}ms | Cache: ${fetchStats.hitRate} | Queries: ${fetchQueries}`);

        // 2. Update provider
        dbClient.getCacheManager().resetStats();
        dbClient.clearQueries();
        const updateStart = Date.now();

        await providerTable.updateOne(
            { [pkColumn]: providerId },
            { updated_on: new Date() }
        );

        const updateTime = Date.now() - updateStart;
        const updateQueries = dbClient.getQueries().length;

        performanceResults.push({
            cycle,
            operation: 'Update',
            timeMs: updateTime,
            cacheHitRate: 'N/A',
            queriesExecuted: updateQueries
        });

        console.log(`  Update: ${updateTime}ms | Queries: ${updateQueries}`);

        // 3. Fetch again (cache should be fresh)
        dbClient.getCacheManager().resetStats();
        dbClient.clearQueries();
        const refetchStart = Date.now();

        const updatedProvider = await providerTable.findOne(
            { [pkColumn]: providerId },
            {
                withRelations: {
                    dependents: ['services', 'orders'],
                    dependencies: false
                }
            }
        );

        const refetchTime = Date.now() - refetchStart;
        const refetchStats = dbClient.getCacheManager().getStats();
        const refetchQueries = dbClient.getQueries().length;

        performanceResults.push({
            cycle,
            operation: 'Re-fetch after update',
            timeMs: refetchTime,
            cacheHitRate: refetchStats.hitRate,
            queriesExecuted: refetchQueries
        });

        console.log(`  Re-fetch: ${refetchTime}ms | Cache: ${refetchStats.hitRate} | Queries: ${refetchQueries}\n`);
    }

    // Performance analysis
    console.log('=== Performance Analysis ===\n');

    const fetchOps = performanceResults.filter(r => r.operation === 'Fetch with relations');
    const updateOps = performanceResults.filter(r => r.operation === 'Update');
    const refetchOps = performanceResults.filter(r => r.operation === 'Re-fetch after update');

    const avgFetch = fetchOps.reduce((sum, r) => sum + r.timeMs, 0) / fetchOps.length;
    const avgUpdate = updateOps.reduce((sum, r) => sum + r.timeMs, 0) / updateOps.length;
    const avgRefetch = refetchOps.reduce((sum, r) => sum + r.timeMs, 0) / refetchOps.length;

    console.log('Average Performance:');
    console.log(`  Fetch with relations: ${avgFetch.toFixed(2)}ms`);
    console.log(`  Update operation: ${avgUpdate.toFixed(2)}ms`);
    console.log(`  Re-fetch after update: ${avgRefetch.toFixed(2)}ms\n`);

    console.log('Performance by Cycle:');
    performanceResults.forEach(r => {
        const emoji = r.timeMs < 50 ? '🚀' : r.timeMs < 100 ? '✅' : '⚠️';
        console.log(`  ${emoji} Cycle ${r.cycle} - ${r.operation}: ${r.timeMs}ms (Cache: ${r.cacheHitRate}, Queries: ${r.queriesExecuted})`);
    });

    // Performance verdict
    console.log('\n=== Performance Verdict ===');
    const allFast = performanceResults.every(r => r.timeMs < 100);
    const mostFast = performanceResults.filter(r => r.timeMs < 50).length / performanceResults.length;

    if (allFast && mostFast > 0.8) {
        console.log('🎉 EXCELLENT: All operations < 100ms, most < 50ms');
    } else if (allFast) {
        console.log('✅ GOOD: All operations < 100ms');
    } else {
        console.log('⚠️  NEEDS IMPROVEMENT: Some operations > 100ms');
    }

    console.log(`   ${(mostFast * 100).toFixed(0)}% of operations completed in < 50ms`);
    console.log(`   Avg fetch with relations: ${avgFetch.toFixed(2)}ms`);

    await dbClient.close();
    console.log('\nConnection closed.');
}

async function testCacheInvalidation() {
    const dbClient = await getDBClient();
    console.log('SqlDB client initialized successfully!\n');

    console.log('=== Cache Invalidation Test ===\n');

    const providerTable = dbClient.getTableOperations('provider');
    const servicesTable = dbClient.getTableOperations('services');

    const providerSchema = dbClient.getTableSchema('provider');
    const pkColumn = providerSchema?.primaryKey || 'id';

    // Step 1: Warm the cache
    console.log('Step 1: Warming cache...');
    const correlationId1 = randomUUID();
    await providerTable.warmCacheWithRelations({}, {
        correlationId: correlationId1,
        depth: 1,
        warmDependents: true,
        warmDependencies: true,
    });
    console.log(`✓ Cache warmed (${dbClient.getQueries(correlationId1).length} queries)\n`);

    // Step 2: Fetch provider with relations (should hit cache)
    console.log('Step 2: Fetching provider with relations (should hit cache)...');
    dbClient.getCacheManager().resetStats();
    dbClient.clearQueries();
    const correlationId2 = randomUUID();

    const providers = await providerTable.findMany({}, {
        limit: 1,
        correlationId: correlationId2,
        withRelations: {
            dependents: ['services'],
            dependencies: false
        }
    });

    const stats2 = dbClient.getCacheManager().getStats();
    const queries2 = dbClient.getQueries(correlationId2);
    console.log(`Provider fetched: ${providers.length}`);
    console.log(`Services attached: ${(providers[0] as any).services?.length || 0}`);
    console.log(`Queries executed: ${queries2.length}`);
    console.log(`Cache hit rate: ${stats2.hitRate}\n`);

    if (providers.length === 0) {
        console.log('⚠️  No providers found in database. Skipping update test.\n');
        await dbClient.close();
        return;
    }

    const providerId = (providers[0] as any)[pkColumn];

    // Step 3: Update provider (should invalidate cache)
    console.log('Step 3: Updating provider (should invalidate cache)...');
    const correlationId3 = randomUUID();

    // Get current provider data - update the updated_on timestamp
    await providerTable.updateOne(
        { [pkColumn]: providerId },
        { updated_on: new Date() },
        correlationId3
    );
    console.log(`✓ Provider updated\n`);

    // Step 4: Fetch provider again (should MISS cache due to invalidation)
    console.log('Step 4: Fetching provider again (cache should be invalidated)...');
    dbClient.getCacheManager().resetStats();
    dbClient.clearQueries();
    const correlationId4 = randomUUID();

    const providersAfterUpdate = await providerTable.findMany({}, {
        limit: 1,
        correlationId: correlationId4,
        withRelations: {
            dependents: ['services'],
            dependencies: false
        }
    });

    const stats4 = dbClient.getCacheManager().getStats();
    const queries4 = dbClient.getQueries(correlationId4);
    console.log(`Provider fetched: ${providersAfterUpdate.length}`);
    console.log(`Updated timestamp: ${(providersAfterUpdate[0] as any).updated_on}`);
    console.log(`Queries executed: ${queries4.length}`);
    console.log(`Cache hit rate: ${stats4.hitRate}`);

    if (queries4.length > 0) {
        console.log('✅ SUCCESS: Cache was properly invalidated!');
        console.log('   (Had to execute queries to fetch fresh data)\n');
    } else {
        console.log('❌ FAILURE: Cache was NOT invalidated');
        console.log('   (Should have executed queries but didn\'t)\n');
    }

    // Step 5: Verify cascade invalidation for related tables
    console.log('Step 5: Checking if related tables (services) were also invalidated...');
    dbClient.getCacheManager().resetStats();
    dbClient.clearQueries();
    const correlationId5 = randomUUID();

    const servicesAfterUpdate = await servicesTable.findMany(
        { provider_id: providerId },
        { correlationId: correlationId5 }
    );

    const stats5 = dbClient.getCacheManager().getStats();
    const queries5 = dbClient.getQueries(correlationId5);
    console.log(`Services fetched: ${servicesAfterUpdate.length}`);
    console.log(`Queries executed: ${queries5.length}`);
    console.log(`Cache hit rate: ${stats5.hitRate}`);

    if (queries5.length > 0) {
        console.log('✅ SUCCESS: Related table cache was properly invalidated (cascade worked)!\n');
    } else {
        console.log('⚠️  Related table was served from cache (cascade may not have worked)\n');
    }

    // Step 6: No need to revert timestamp update
    console.log('Step 6: Update complete (timestamp changes are expected)\n');

    // Final stats
    console.log('=== Final Summary ===');
    const finalStats = dbClient.getCacheManager().getStats();
    console.log(`Total cache operations:`);
    console.log(`  - Hits: ${finalStats.hits}`);
    console.log(`  - Misses: ${finalStats.misses}`);
    console.log(`  - Evictions: ${finalStats.evictions}`);
    console.log(`  - Overall hit rate: ${finalStats.hitRate}`);

    await dbClient.close();
    console.log('\nConnection closed.');
}

async function fetchWithRelationsExample() {
    const dbClient = await getDBClient();
    console.log('SqlDB client initialized successfully!\n');

    console.log('=== Fetch with Relations Example ===\n');

    const providerTable = dbClient.getTableOperations('provider');
    const correlationId = randomUUID();

    // First warm the cache
    console.log('Warming cache...');
    await providerTable.warmCacheWithRelations({}, {
        correlationId,
        depth: 1,
        warmDependents: true,
        warmDependencies: true,
    });
    console.log('Cache warmed!\n');

    // Reset stats to see clean metrics
    dbClient.getCacheManager().resetStats();
    dbClient.clearQueries();

    // Example 1: Fetch provider with ALL relations
    console.log('--- Example 1: Fetch with ALL relations ---');
    const correlationId1 = randomUUID();
    const providerSchema = dbClient.getTableSchema('provider');
    const pkColumn = providerSchema?.primaryKey || 'id';

    const providersWithAllRelations = await providerTable.findMany(
        {},
        {
            limit: 10,
            correlationId: correlationId1,
            withRelations: true, // Fetch all related tables
        }
    );

    if (providersWithAllRelations.length > 0) {
        for (const provider of providersWithAllRelations) {
            console.log(`Provider ID: ${provider[pkColumn]}`);
            console.log(`Related tables attached:`);

            // List all attached relations
            const relatedTables = Object.keys(provider).filter(key =>
                Array.isArray(provider[key]) || (typeof provider[key] === 'object' && provider[key] !== null && !provider[key].constructor.name.includes('Date'))
            );
            relatedTables.forEach(table => {
                const value = provider[table];
                if (Array.isArray(value)) {
                    console.log(`  - ${table}: ${value.length} records`);
                } else {
                    console.log(`  - ${table}: 1 record`);
                }
            });
        }
    }

    const queries1 = dbClient.getQueries(correlationId1);
    const stats1 = dbClient.getCacheManager().getStats();
    console.log(`\nQueries executed: ${queries1.length}`);
    console.log(`Cache hit rate: ${stats1.hitRate}\n`);

    // Example 2: Fetch provider with SPECIFIC relations only
    console.log('--- Example 2: Fetch with SPECIFIC relations ---');
    dbClient.getCacheManager().resetStats();
    dbClient.clearQueries();
    const correlationId2 = randomUUID();

    const providersWithSpecificRelations = await providerTable.findMany(
        {},
        {
            limit: 1,
            correlationId: correlationId2,
            withRelations: {
                dependents: ['orders', 'services'], // Only fetch orders and services
                dependencies: false, // Don't fetch user
            },
        }
    );

    if (providersWithSpecificRelations.length > 0) {
        const provider = providersWithSpecificRelations[0] as any;
        console.log(`Provider ID: ${provider[pkColumn]}`);
        console.log(`Related tables:`);
        console.log(`  - orders: ${provider.orders?.length || 0} records`);
        console.log(`  - services: ${provider.services?.length || 0} records`);
        console.log(`  - user: ${provider.user ? 'attached' : 'NOT attached (as expected)'}`);
    }

    const queries2 = dbClient.getQueries(correlationId2);
    const stats2 = dbClient.getCacheManager().getStats();
    console.log(`\nQueries executed: ${queries2.length}`);
    console.log(`Cache hit rate: ${stats2.hitRate}\n`);

    // Example 3: Fetch single provider with relations using findOne
    console.log('--- Example 3: Find ONE provider with relations ---');
    dbClient.getCacheManager().resetStats();
    dbClient.clearQueries();
    const correlationId3 = randomUUID();

    const sampleProviders = await providerTable.findMany({}, { limit: 1 });
    if (sampleProviders.length > 0) {
        const providerId = (sampleProviders[0] as any)[pkColumn];

        const providerWithRelations = await providerTable.findOne(
            { [pkColumn]: providerId },
            {
                correlationId: correlationId3,
                withRelations: {
                    dependents: ['orders', 'services', 'bank_details'],
                    dependencies: true,
                },
            }
        );

        if (providerWithRelations) {
            const provider = providerWithRelations as any;
            console.log(`Provider ID: ${provider[pkColumn]}`);
            console.log(`Related data:`);
            console.log(`  - orders: ${provider.orders?.length || 0} records`);
            console.log(`  - services: ${provider.services?.length || 0} records`);
            console.log(`  - bank_details: ${provider.bank_details?.length || 0} records`);
            console.log(`  - user: ${provider.user ? 'attached' : 'not found'}`);
        }

        const queries3 = dbClient.getQueries(correlationId3);
        const stats3 = dbClient.getCacheManager().getStats();
        console.log(`\nQueries executed: ${queries3.length}`);
        console.log(`Cache hit rate: ${stats3.hitRate}`);

        if (stats3.hitRate === '100.00%') {
            console.log('✅ SUCCESS: All queries served from cache!');
        }
    }

    await dbClient.close();
    console.log('\nConnection closed.');
}

async function warmCacheWithRelationsExample() {
    const dbClient = await getDBClient();
    console.log('SqlDB client initialized successfully!');

    // Example: Warm cache for provider table and all related tables
    const providerTable = dbClient.getTableOperations('provider');

    console.log('\n=== Warming Cache with Relations ===');
    console.log('Warming cache for provider and related tables...\n');

    const correlationId = randomUUID();

    // Warm cache for provider and all tables that reference it (dependents)
    // This will pre-load: provider, account_subscription, bank_details,
    // firebase_tokens, location_info, opening_hours, orders, promo_codes, etc.
    await providerTable.warmCacheWithRelations({}, {
        correlationId,
        depth: 1,
        warmDependents: true,  // Warm tables that reference provider
        warmDependencies: true, // Warm tables that provider references (user)
    });

    const queries = dbClient.getQueries(correlationId);
    console.log(`Total tables warmed: ${queries.length}`);
    console.log('Tables warmed:', queries.map(q => {
        const match = q.sql.match(/FROM\s+(\w+)/i);
        return match ? match[1] : 'unknown';
    }));

    const stats = dbClient.getCacheManager().getStats();
    console.log('\nCache stats after warming:', stats);

    // Now queries to these tables will be served from cache
    console.log('\n=== Testing Cache Hits ===');
    dbClient.getCacheManager().resetStats(); // Reset to see fresh stats
    const correlationId2 = randomUUID();

    // These should hit cache since we warmed with same query pattern
    const providers = await providerTable.findMany({}, { correlationId: correlationId2, limit: 100 });
    console.log(`Fetched ${providers.length} providers (should be cached)`);

    const ordersTable = dbClient.getTableOperations('orders');
    const orders = await ordersTable.findMany({}, { correlationId: correlationId2, limit: 100 });
    console.log(`Fetched ${orders.length} orders (should be cached)`);

    const servicesTable = dbClient.getTableOperations('services');
    const services = await servicesTable.findMany({}, { correlationId: correlationId2, limit: 100 });
    console.log(`Fetched ${services.length} services (should be cached)`);

    const queries2 = dbClient.getQueries(correlationId2);
    console.log(`\nQueries executed: ${queries2.length}`);

    if (queries2.length === 0) {
        console.log('✅ SUCCESS: All queries served from cache!');
    } else {
        console.log('⚠️  Cache misses detected. Queries executed:');
        queries2.forEach(q => {
            const match = q.sql.match(/FROM\s+(\w+)/i);
            console.log(`  - ${match ? match[1] : 'unknown'}: ${q.executionTimeMs}ms`);
        });
    }

    const finalStats = dbClient.getCacheManager().getStats();
    console.log('\nFinal cache stats:', finalStats);
    console.log(`Cache hit rate: ${finalStats.hitRate}`);

    // Test real-world scenario: Fetch provider with all related data
    console.log('\n=== Real-World Test: Fetch Provider with Related Data ===');
    dbClient.getCacheManager().resetStats();
    const correlationId3 = randomUUID();

    // Get a provider
    const sampleProviders = await providerTable.findMany({}, { correlationId: correlationId3, limit: 1 });

    if (sampleProviders.length > 0) {
        // Get primary key from table schema
        const providerSchema = dbClient.getTableSchema('provider');
        const pkColumn = providerSchema?.primaryKey || 'id';
        const providerId = (sampleProviders[0] as any)[pkColumn];
        console.log(`\nFetching all data for provider: ${providerId} (using PK: ${pkColumn})`);

        // Fetch provider using primary key column
        const providerData = await providerTable.findOne({ [pkColumn]: providerId }, { correlationId: correlationId3 });

        // Fetch related data
        const ordersTable = dbClient.getTableOperations('orders');
        const servicesTable = dbClient.getTableOperations('services');
        const bankDetailsTable = dbClient.getTableOperations('bank_details');
        const locationInfoTable = dbClient.getTableOperations('location_info');
        const openingHoursTable = dbClient.getTableOperations('opening_hours');

        const providerOrders = await ordersTable.findMany({ provider_id: providerId }, { correlationId: correlationId3, limit: 100 });
        const providerServices = await servicesTable.findMany({ provider_id: providerId }, { correlationId: correlationId3, limit: 100 });
        const providerBankDetails = await bankDetailsTable.findMany({ provider_id: providerId }, { correlationId: correlationId3, limit: 100 });
        const providerLocation = await locationInfoTable.findMany({ provider_id: providerId }, { correlationId: correlationId3, limit: 100 });
        const providerHours = await openingHoursTable.findMany({ provider_id: providerId }, { correlationId: correlationId3, limit: 100 });

        console.log(`\nProvider data fetched:`);
        console.log(`  - Provider: ${providerData ? 'Found' : 'Not found'}`);
        console.log(`  - Orders: ${providerOrders.length}`);
        console.log(`  - Services: ${providerServices.length}`);
        console.log(`  - Bank Details: ${providerBankDetails.length}`);
        console.log(`  - Location Info: ${providerLocation.length}`);
        console.log(`  - Opening Hours: ${providerHours.length}`);

        const queries3 = dbClient.getQueries(correlationId3);
        console.log(`\nTotal queries executed: ${queries3.length}`);

        const relatedStats = dbClient.getCacheManager().getStats();
        console.log(`Cache hits: ${relatedStats.hits}, Cache misses: ${relatedStats.misses}`);
        console.log(`Cache hit rate: ${relatedStats.hitRate}`);

        if (relatedStats.hits > relatedStats.misses) {
            console.log('✅ SUCCESS: Most queries served from cache!');
        }
    }

    await dbClient.close();
    console.log('\nConnection closed.');
}

// Run the example or performance test
const args = process.argv.slice(2);
const command = args[0];

if (command === 'perf' || command === 'performance') {
    performanceTest().catch(console.error);
} else if (command === 'warm') {
    warmCacheWithRelationsExample().catch(console.error);
} else if (command === 'graph') {
    dbGraph().catch(console.error);
} else if (command === 'relations') {
    fetchWithRelationsExample().catch(console.error);
} else if (command === 'invalidation' || command === 'test-invalidation') {
    testCacheInvalidation().catch(console.error);
} else if (command === 'cache-perf' || command === 'test-perf') {
    testCachePerformance().catch(console.error);
} else {
    main().catch(console.error);
}


