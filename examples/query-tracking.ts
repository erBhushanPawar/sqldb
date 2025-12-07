import { createSqlDB, generateQueryId } from '../src/index';
import * as dotenv from 'dotenv';

dotenv.config();

async function demonstrateQueryTracking() {
  const db = await createSqlDB({
    mariadb: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
    cache: {
      enabled: true,
      defaultTTL: 60,
    },
  });

  try {
    // Example 1: Using correlation ID with individual operations
    console.log('\n=== Example 1: Individual Operations with Correlation ID ===');
    const correlationId1 = generateQueryId();
    console.log(`Correlation ID: ${correlationId1}\n`);

    await db.users.findMany({ status: 'active' }, { correlationId: correlationId1 });
    await db.users.count({ status: 'active' }, correlationId1);
    await db.users.findById(1, correlationId1);

    // Get all queries for this correlation ID
    const queries1 = db.getQueries(correlationId1);
    console.log(`Total queries executed: ${queries1.length}\n`);

    queries1.forEach((query, index) => {
      console.log(`Query ${index + 1}:`);
      console.log(`  Query ID: ${query.queryId}`);
      console.log(`  SQL: ${query.sql}`);
      console.log(`  Params: ${JSON.stringify(query.params)}`);
      console.log(`  Execution Time: ${query.executionTimeMs}ms`);
      console.log(`  Result Count: ${query.resultCount}`);
      console.log(`  Timestamp: ${new Date(query.startTime).toISOString()}`);
      console.log();
    });

    // Example 2: Using correlation ID for a complex operation
    console.log('\n=== Example 2: Complex Operation with Multiple Queries ===');
    const correlationId2 = generateQueryId();
    console.log(`Correlation ID: ${correlationId2}\n`);

    // Simulate a complex user registration flow
    await db.users.count(undefined, correlationId2);
    await db.users.insertOne(
      {
        name: 'Test User',
        email: 'test@example.com',
        status: 'active',
      },
      correlationId2
    );
    await db.users.findMany({ email: 'test@example.com' }, { correlationId: correlationId2 });

    const queries2 = db.getQueries(correlationId2);
    console.log(`Queries for user registration flow: ${queries2.length}\n`);

    const totalTime = queries2.reduce((sum, q) => sum + (q.executionTimeMs || 0), 0);
    console.log(`Total execution time: ${totalTime}ms`);
    console.log(`Average execution time: ${(totalTime / queries2.length).toFixed(2)}ms\n`);

    queries2.forEach((query, index) => {
      console.log(`Query ${index + 1}: ${query.sql} - ${query.executionTimeMs}ms`);
    });

    // Example 3: Get all queries (across all correlation IDs)
    console.log('\n=== Example 3: All Queries ===');
    const allQueries = db.getQueries();
    console.log(`Total queries tracked: ${allQueries.length}\n`);

    // Group by correlation ID
    const grouped = allQueries.reduce((acc, query) => {
      const corrId = query.correlationId || 'none';
      if (!acc[corrId]) acc[corrId] = [];
      acc[corrId].push(query);
      return acc;
    }, {} as Record<string, typeof allQueries>);

    Object.entries(grouped).forEach(([corrId, queries]) => {
      console.log(`Correlation ID: ${corrId}`);
      console.log(`  Queries: ${queries.length}`);
      console.log(`  Total time: ${queries.reduce((sum, q) => sum + (q.executionTimeMs || 0), 0)}ms`);
      console.log();
    });

    // Example 4: Clear queries for a specific correlation ID
    console.log('\n=== Example 4: Clear Queries ===');
    console.log(`Queries before clearing correlationId1: ${db.getQueries().length}`);
    db.clearQueries(correlationId1);
    console.log(`Queries after clearing correlationId1: ${db.getQueries().length}`);

    // Example 5: Query tracking with errors
    console.log('\n=== Example 5: Query Tracking with Errors ===');
    const correlationId3 = generateQueryId();

    try {
      // This will fail (invalid SQL)
      await db.users.raw('INVALID SQL QUERY', [], correlationId3);
    } catch (error) {
      console.log('Expected error occurred');
    }

    const errorQueries = db.getQueries(correlationId3);
    if (errorQueries.length > 0) {
      const errorQuery = errorQueries[0];
      console.log(`\nError Query Details:`);
      console.log(`  Query ID: ${errorQuery.queryId}`);
      console.log(`  SQL: ${errorQuery.sql}`);
      console.log(`  Error: ${errorQuery.error}`);
      console.log(`  Execution Time: ${errorQuery.executionTimeMs}ms`);
    }

    // Clear all queries
    db.clearQueries();
    console.log(`\nAll queries cleared. Total queries: ${db.getQueries().length}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

demonstrateQueryTracking().catch(console.error);
