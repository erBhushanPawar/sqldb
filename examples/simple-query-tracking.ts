import { createSqlDB, generateQueryId } from '../src/index';
import * as dotenv from 'dotenv';

dotenv.config();

async function simpleQueryTrackingDemo() {
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
    console.log('\n=== Query Tracking Demo ===\n');

    // Generate a correlation ID
    const correlationId = generateQueryId();
    console.log(`Using Correlation ID: ${correlationId}\n`);

    // Execute some queries with the correlation ID
    console.log('Executing queries...');
    const customerOps = db.getTableOperations('customer');
    await customerOps.findMany({ status: 'active' }, { correlationId, limit: 5 });
    await customerOps.count(undefined, correlationId);

    // Get all queries for this correlation ID
    const queries = db.getQueries(correlationId);
    console.log(`\nTotal queries executed: ${queries.length}\n`);

    // Display query details
    queries.forEach((query, index) => {
      console.log(`Query ${index + 1}:`);
      console.log(`  ID: ${query.queryId}`);
      console.log(`  SQL: ${query.sql.substring(0, 80)}...`);
      console.log(`  Execution Time: ${query.executionTimeMs}ms`);
      console.log(`  Result Count: ${query.resultCount}`);
      console.log();
    });

    // Calculate total execution time
    const totalTime = queries.reduce((sum, q) => sum + (q.executionTimeMs || 0), 0);
    console.log(`Total execution time: ${totalTime}ms`);
    console.log(`Average execution time: ${(totalTime / queries.length).toFixed(2)}ms\n`);

    // Get all queries (including any without correlation IDs)
    const allQueries = db.getQueries();
    console.log(`Total queries tracked (all correlation IDs): ${allQueries.length}\n`);

    // Clean up
    console.log('Clearing queries for this correlation ID...');
    db.clearQueries(correlationId);
    console.log(`Queries remaining: ${db.getQueries().length}\n`);

    console.log('=== Demo Complete ===\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

simpleQueryTrackingDemo().catch(console.error);
