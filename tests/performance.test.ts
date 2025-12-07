import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import * as dotenv from 'dotenv';
import { createSqlDB, SqlDBClient } from '../src/index';

dotenv.config();

describe('Performance Tests', () => {
  let client: any; // SqlDBClient with dynamic table accessors
  const TEST_ITERATIONS = 1000;
  const TARGET_TIME_MS = 60000; // 1 minute

  before(async function () {
    this.timeout(30000);

    // Parse DB config from .env
    const dbConfigStr = process.env.DB_CONFIG;
    if (!dbConfigStr) {
      throw new Error('DB_CONFIG not found in .env file');
    }

    const dbConfig = JSON.parse(dbConfigStr);

    // First, create a temporary client to set up the table
    const tempClient = await createSqlDB({
      mariadb: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        connectionLimit: 50, // Increased for concurrent performance tests
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        keyPrefix: 'perf_test:',
      },
      cache: {
        enabled: false,
      },
      discovery: {
        autoDiscover: false,
      },
      logging: {
        level: 'error',
      },
    });

    const rawDbManager = (tempClient as any).dbManager;

    // Create test table
    await rawDbManager.query(`
      CREATE TABLE IF NOT EXISTS performance_test (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        value INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Clear existing data
    await rawDbManager.query('DELETE FROM performance_test');

    // Insert test data
    console.log('Setting up test data...');
    const insertPromises = [];
    for (let i = 1; i <= 100; i++) {
      insertPromises.push(
        rawDbManager.query(
          'INSERT INTO performance_test (name, value) VALUES (?, ?)',
          [`test_${i}`, i * 10]
        )
      );
    }
    await Promise.all(insertPromises);
    console.log('Test data ready');

    // Close temp client
    await (tempClient as SqlDBClient).close();

    // Now create the actual client with discovery enabled
    client = await createSqlDB({
      mariadb: {
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        connectionLimit: 50, // Increased for concurrent performance tests
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        keyPrefix: 'perf_test:',
      },
      cache: {
        enabled: true,
        defaultTTL: 60, // 60 seconds
        maxKeys: 10000,
        invalidateOnWrite: true,
        cascadeInvalidation: true,
      },
      discovery: {
        autoDiscover: true,
        includeTables: ['performance_test'],
      },
      logging: {
        level: 'error', // Reduce logging during perf tests
      },
    });

    console.log('SqlDB client initialized with performance_test table');
    console.log('Discovered tables:', (client as SqlDBClient).getDiscoveredTables());
  });

  after(async function () {
    this.timeout(10000);
    if (client) {
      const rawDbManager = (client as any).dbManager;
      await rawDbManager.query('DROP TABLE IF EXISTS performance_test');
      await (client as SqlDBClient).close();
    }
  });

  describe('1000 Requests Benchmark', () => {
    it('should handle 1000 cached reads within 60 seconds', async function () {
      this.timeout(TARGET_TIME_MS + 20000);

      const perfTable = (client as SqlDBClient).getTableOperations('performance_test');

      // Warm up the cache first to get realistic cached performance
      console.log('\n🔥 Warming up cache with sample queries...');
      await perfTable.findById(1);
      await perfTable.findById(50);
      await perfTable.findOne({ value: 100 });
      await perfTable.findMany({}, { limit: 10 });

      console.log(`\n⚡ Starting benchmark: ${TEST_ITERATIONS} requests...`);
      const startTime = Date.now();

      // Execute 1000 requests in batches to avoid overwhelming the pool
      const batchSize = 100;
      const results: any[] = [];

      for (let batch = 0; batch < TEST_ITERATIONS / batchSize; batch++) {
        const promises: Promise<any>[] = [];

        for (let i = 0; i < batchSize; i++) {
          const idx = batch * batchSize + i;
          const opType = idx % 3;

          if (opType === 0) {
            // Repeatedly query same IDs to benefit from cache
            promises.push(perfTable.findById((idx % 20) + 1)); // Only 20 unique IDs
          } else if (opType === 1) {
            promises.push(perfTable.findOne({ value: ((idx % 10) * 100) })); // Only 10 unique values
          } else {
            promises.push(perfTable.findMany({}, { limit: 10 })); // Same query
          }
        }

        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`\n📊 Performance Results:`);
      console.log(`   Total Requests: ${TEST_ITERATIONS}`);
      console.log(`   Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
      console.log(`   Requests/sec: ${(TEST_ITERATIONS / (duration / 1000)).toFixed(2)}`);
      console.log(`   Avg Response Time: ${(duration / TEST_ITERATIONS).toFixed(2)}ms`);
      console.log(`   Unique Keys Queried: 20 IDs + 10 values + 1 findMany = ~31 unique cache entries`);
      console.log(`   Cache Efficiency: High (repeated queries benefit from cache)`);
      console.log(`   Target: ${TARGET_TIME_MS}ms (${TARGET_TIME_MS / 1000}s)`);
      console.log(`   Status: ${duration <= TARGET_TIME_MS ? '✅ PASSED' : '❌ FAILED'}`);

      expect(results).to.have.lengthOf(TEST_ITERATIONS);
      expect(duration).to.be.lessThan(TARGET_TIME_MS);
    });

    it('should demonstrate cache vs DB performance difference', async function () {
      this.timeout(30000);

      const iterations = 50;
      const perfTable = (client as SqlDBClient).getTableOperations('performance_test');
      const rawDbManager = (client as any).dbManager;

      // Clear Redis cache to start fresh
      const cacheManager = (client as SqlDBClient).getCacheManager();
      await cacheManager.clear();

      console.log('\n📊 Running cache vs direct DB comparison...');

      // Test 1: Direct DB queries (bypassing cache)
      console.log('\n🗄️  Phase 1: Direct DB queries (no cache)...');
      const dbStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await rawDbManager.query('SELECT * FROM performance_test WHERE id = ?', [5]);
      }
      const dbDuration = Date.now() - dbStart;

      // Test 2: First cached query (cache miss + population)
      console.log('🔥 Phase 2: First cached query (cache miss)...');
      const firstCachedStart = Date.now();
      await perfTable.findById(10);
      const firstCachedDuration = Date.now() - firstCachedStart;

      // Test 3: Subsequent cached queries (cache hits)
      console.log('⚡ Phase 3: Cached queries (cache hits)...');
      const cachedStart = Date.now();
      for (let i = 0; i < iterations; i++) {
        await perfTable.findById(10);
      }
      const cachedDuration = Date.now() - cachedStart;

      const avgDbTime = dbDuration / iterations;
      const avgCachedTime = cachedDuration / iterations;
      const speedup = avgDbTime / avgCachedTime;

      console.log(`\n📊 Performance Comparison:`);
      console.log(`   Direct DB (${iterations}x):     ${dbDuration}ms (avg: ${avgDbTime.toFixed(2)}ms per query)`);
      console.log(`   First Cached Query:     ${firstCachedDuration}ms (includes cache population)`);
      console.log(`   Cached Queries (${iterations}x):  ${cachedDuration}ms (avg: ${avgCachedTime.toFixed(2)}ms per query)`);
      console.log(`   Cache Speedup:          ${speedup.toFixed(2)}x faster`);
      console.log(`   Performance Gain:       ${((speedup - 1) * 100).toFixed(1)}% improvement`);

      // Cache should be faster than direct DB
      expect(avgCachedTime).to.be.lessThan(avgDbTime);
      expect(speedup).to.be.greaterThan(1);
    });

    it('should handle concurrent mixed operations', async function () {
      this.timeout(60000);

      const operations = 500;
      console.log(`\n🔀 Running ${operations} mixed operations...`);

      const startTime = Date.now();
      const promises: Promise<any>[] = [];
      const rawDbManager = (client as any).dbManager;
      const perfTable = (client as SqlDBClient).getTableOperations('performance_test');

      for (let i = 0; i < operations; i++) {
        const opType = i % 3;

        if (opType === 0) {
          // Read operation
          promises.push(
            perfTable.findById((i % 100) + 1)
          );
        } else if (opType === 1) {
          // Write operation (bypasses cache and invalidates)
          promises.push(
            rawDbManager.query('UPDATE performance_test SET value = value + 1 WHERE id = ?', [(i % 100) + 1])
          );
        } else {
          // Another read query
          promises.push(
            perfTable.findMany({}, { limit: 5 })
          );
        }
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`\n📊 Mixed Operations Results:`);
      console.log(`   Total Operations: ${operations}`);
      console.log(`   Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
      console.log(`   Operations/sec: ${(operations / (duration / 1000)).toFixed(2)}`);

      expect(duration).to.be.lessThan(30000); // Should complete in under 30s
    });
  });

  describe('Stress Test', () => {
    it('should handle burst traffic', async function () {
      this.timeout(40000);

      const burstSize = 200;
      const bursts = 5;
      const perfTable = (client as SqlDBClient).getTableOperations('performance_test');

      console.log(`\n💥 Running ${bursts} bursts of ${burstSize} requests each...`);

      const startTime = Date.now();

      for (let burst = 0; burst < bursts; burst++) {
        const promises: Promise<any>[] = [];
        for (let i = 0; i < burstSize; i++) {
          promises.push(
            perfTable.findById((i % 100) + 1)
          );
        }
        await Promise.all(promises);
        console.log(`   Burst ${burst + 1}/${bursts} completed`);
      }

      const duration = Date.now() - startTime;
      const totalRequests = burstSize * bursts;

      console.log(`\n📊 Burst Test Results:`);
      console.log(`   Total Requests: ${totalRequests}`);
      console.log(`   Duration: ${duration}ms (${(duration / 1000).toFixed(2)}s)`);
      console.log(`   Requests/sec: ${(totalRequests / (duration / 1000)).toFixed(2)}`);

      expect(duration).to.be.lessThan(35000);
    });
  });

  describe('FindMany Performance', () => {
    it('should efficiently handle findMany operations with various filters', async function () {
      this.timeout(20000);

      const iterations = 200;
      const perfTable = (client as SqlDBClient).getTableOperations('performance_test');
      console.log(`\n🔍 Testing findMany (${iterations} operations)...`);

      const startTime = Date.now();

      const promises: Promise<any>[] = [];
      for (let i = 0; i < iterations; i++) {
        const opType = i % 3;

        if (opType === 0) {
          promises.push(
            perfTable.findMany({}, { limit: 10 })
          );
        } else if (opType === 1) {
          promises.push(
            perfTable.findMany({ value: i * 10 }, { limit: 5 })
          );
        } else {
          promises.push(
            perfTable.findMany({}, {
              limit: 20,
              orderBy: { column: 'id', direction: 'DESC' }
            })
          );
        }
      }

      await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`\n📊 FindMany Results:`);
      console.log(`   Operations: ${iterations}`);
      console.log(`   Duration: ${duration}ms`);
      console.log(`   Avg Time: ${(duration / iterations).toFixed(2)}ms`);
      console.log(`   Operations/sec: ${(iterations / (duration / 1000)).toFixed(2)}`);

      expect(duration).to.be.lessThan(15000);
    });
  });

  describe('Sustained Load Test', () => {
    it('should maintain performance under sustained load', async function () {
      this.timeout(40000);

      const perfTable = (client as SqlDBClient).getTableOperations('performance_test');
      const durationSeconds = 10;
      const targetRPS = 100; // Target requests per second

      console.log(`\n⏱️  Running sustained load test for ${durationSeconds} seconds...`);
      console.log(`   Target: ${targetRPS} requests/sec`);

      const startTime = Date.now();
      const endTime = startTime + (durationSeconds * 1000);
      let requestCount = 0;
      const latencies: number[] = [];

      while (Date.now() < endTime) {
        const reqStart = Date.now();

        // Mix of operations
        const opType = requestCount % 4;
        if (opType === 0) {
          await perfTable.findById((requestCount % 50) + 1);
        } else if (opType === 1) {
          await perfTable.findOne({ value: (requestCount % 20) * 10 });
        } else if (opType === 2) {
          await perfTable.findMany({}, { limit: 5 });
        } else {
          await perfTable.findMany({ value: (requestCount % 10) * 100 }, { limit: 3 });
        }

        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);
        requestCount++;

        // Control rate to hit target RPS
        const elapsed = Date.now() - startTime;
        const expectedRequests = Math.floor((elapsed / 1000) * targetRPS);
        if (requestCount > expectedRequests) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      const totalDuration = Date.now() - startTime;
      const actualRPS = requestCount / (totalDuration / 1000);

      // Calculate latency percentiles
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;

      console.log(`\n📊 Sustained Load Results:`);
      console.log(`   Duration: ${(totalDuration / 1000).toFixed(2)}s`);
      console.log(`   Total Requests: ${requestCount}`);
      console.log(`   Actual RPS: ${actualRPS.toFixed(2)}`);
      console.log(`   Latency (avg): ${avg.toFixed(2)}ms`);
      console.log(`   Latency (p50): ${p50}ms`);
      console.log(`   Latency (p95): ${p95}ms`);
      console.log(`   Latency (p99): ${p99}ms`);
      console.log(`   Performance: ${actualRPS >= targetRPS * 0.9 ? '✅ GOOD' : '⚠️  NEEDS IMPROVEMENT'}`);

      expect(actualRPS).to.be.greaterThan(targetRPS * 0.8); // Allow 20% variance
      expect(p95).to.be.lessThan(100); // 95th percentile should be under 100ms
    });
  });
});
