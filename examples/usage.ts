import { configDotenv } from "dotenv";
import { createSmartDB, SmartDBClient, generateQueryId } from "../src";
import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";

async function performanceTest() {
    configDotenv();
    const dbConfigStr = process.env.DB_CONFIG;
    if (!dbConfigStr) {
        throw new Error('DB_CONFIG not found in .env file');
    }

    const dbConfig = JSON.parse(dbConfigStr);

    const dbClient = await createSmartDB({
        mariadb: {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
            connectionLimit: 50,
        },
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            keyPrefix: 'perf_test:',
        },
        cache: {
            enabled: true,
            defaultTTL: 300, // 5 minutes for performance testing
            maxKeys: 10000,
        },
        discovery: {
            autoDiscover: false, // Skip discovery for faster startup
        },
        logging: {
            level: 'info',
        },
    });

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

async function main() {
    configDotenv();
    const dbConfigStr = process.env.DB_CONFIG;
    if (!dbConfigStr) {
        throw new Error('DB_CONFIG not found in .env file');
    }

    const dbConfig = JSON.parse(dbConfigStr);

    const dbClient = await createSmartDB({
        mariadb: {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
            connectionLimit: 50,
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
        },
        discovery: {
            autoDiscover: true,
        },
        logging: {
            level: 'info',
        },
    });

    console.log('SmartDB client initialized successfully!');
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

// Run the example or performance test
const args = process.argv.slice(2);
const command = args[0];

if (command === 'perf' || command === 'performance') {
    performanceTest().catch(console.error);
} else {
    main().catch(console.error);
}


