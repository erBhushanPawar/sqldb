/**
 * Search Example
 *
 * Demonstrates how to use the Meilisearch-inspired full-text search features.
 * This example shows:
 * - Configuring search for specific tables
 * - Building search indexes
 * - Performing full-text searches with ranking
 * - Using highlights to show matched terms
 * - Comparing search performance with traditional SQL LIKE queries
 * - REST API endpoints for search functionality
 *
 * Usage:
 *   CLI Demo:  npm run search
 *   API Server: npm run search:api
 *   OR: ts-node examples/search-example.ts
 *   OR: ts-node examples/search-example.ts --api
 */

import { createSqlDB } from '../src/index';
import { SearchResult } from '../src/types/search';

// Define your table types
interface Service {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  is_active: boolean;
  created_at: Date;
}

async function searchExample() {
  console.log('🔍 Full-Text Search Example\n');

  // 1. Configure SqlDB with search enabled
  const db = await createSqlDB({
    mariadb: {
      host: 'qa-she-careers-mariadb.c9ott5sa9myf.us-east-2.rds.amazonaws.com',
      port: 3306,
      user: 'admin',
      password: 'Qx7tV2pW5sR9uY1zA4bC6dE8fG3hJ0kL_mN-pQ8sR1tU4vW',
      database: 'dev_she_careers_bhushan',
      connectionLimit: 10,
    },
    redis: {
      host: 'localhost',
      port: 6379,
      keyPrefix: 'myapp',
    },
    cache: {
      enabled: true,
      defaultTTL: 60,
    },
    // NEW: Enable search features
    search: {
      enabled: true,
      invertedIndex: {
        enabled: true,
        tables: {
          // Configure search for 'services' table
          services: {
            searchableFields: ['title', 'description', 'category'],
            tokenizer: 'stemming',  // Use Porter Stemmer for better matching
            minWordLength: 3,
            stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'],
            rebuildOnWrite: false,  // Manual rebuild for better control
            fieldBoosts: {
              title: 3.0,         // Title matches are most important
              category: 2.0,      // Category matches are important
              description: 1.0,   // Description matches are least important
            },
          },
        },
      },
    },
  });

  // Initialize the client
  await db.initialize();
  console.log('✅ Database connected and initialized\n');

  // 2. Get table operations
  const services = db.getTableOperations<Service>('services');

  // 3. Insert sample data (if needed)
  console.log('📝 Inserting sample services...');
  try {
    await services.insertMany([
      {
        title: 'Emergency Plumbing Repair',
        description: 'Expert plumbing services for emergencies. We fix leaks, burst pipes, and drainage issues quickly.',
        category: 'Plumbing',
        price: 150,
        is_active: true,
        created_at: new Date(),
      },
      {
        title: 'Professional Plumbing Installation',
        description: 'Complete plumbing installation for new homes and renovations. Certified plumbers available.',
        category: 'Plumbing',
        price: 250,
        is_active: true,
        created_at: new Date(),
      },
      {
        title: 'Electrical Wiring and Repair',
        description: 'Licensed electricians for all your electrical needs. Wiring, repairs, and installations.',
        category: 'Electrical',
        price: 120,
        is_active: true,
        created_at: new Date(),
      },
      {
        title: 'Emergency Electrical Services',
        description: 'Fast emergency electrical repair services. Available 24/7 for urgent electrical issues.',
        category: 'Electrical',
        price: 180,
        is_active: true,
        created_at: new Date(),
      },
      {
        title: 'Carpet Cleaning Services',
        description: 'Professional carpet cleaning using eco-friendly products. Deep clean for homes and offices.',
        category: 'Cleaning',
        price: 80,
        is_active: true,
        created_at: new Date(),
      },
      {
        title: 'House Cleaning and Maintenance',
        description: 'Complete house cleaning services including windows, floors, and general maintenance.',
        category: 'Cleaning',
        price: 100,
        is_active: true,
        created_at: new Date(),
      },
    ] as any);
    console.log('✅ Sample data inserted\n');
  } catch (error) {
    console.log('⚠️  Sample data may already exist, continuing...\n');
  }

  // 4. Build search index (one-time operation)
  console.log('🔨 Building search index...');
  const stats = await services.buildSearchIndex!();
  console.log(`✅ Index built:
  - Total documents: ${stats.totalDocuments}
  - Unique terms: ${stats.totalTerms}
  - Total tokens: ${stats.totalTokens}
  - Build time: ${stats.buildDurationMs}ms
  - Searchable fields: ${stats.fields.join(', ')}\n`);

  // 5. Perform search queries
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 SEARCH QUERY #1: "plumbing repair emergency"');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime1 = Date.now();
  const results1 = await services.search!('plumbing repair emergency', {
    limit: 10,
    highlightFields: ['title', 'description'],
    minScore: 0.1,
  });
  const searchTime1 = Date.now() - startTime1;

  console.log(`Found ${results1.length} results in ${searchTime1}ms\n`);

  results1.forEach((result, index) => {
    console.log(`Result #${index + 1} (Score: ${result.score.toFixed(3)})`);
    console.log(`  Title: ${result.highlights?.title || result.data.title}`);
    console.log(`  Description: ${result.highlights?.description?.substring(0, 100) || result.data.description.substring(0, 100)}...`);
    console.log(`  Category: ${result.data.category} | Price: $${result.data.price}`);
    console.log(`  Matched terms: ${result.matchedTerms?.join(', ')}\n`);
  });

  // 6. Search with filters
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 SEARCH QUERY #2: "emergency" with filters (Electrical only)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime2 = Date.now();
  const results2 = await services.search!('emergency', {
    limit: 5,
    filters: { category: 'Electrical', is_active: true },
    highlightFields: ['title', 'description'],
  });
  const searchTime2 = Date.now() - startTime2;

  console.log(`Found ${results2.length} results in ${searchTime2}ms\n`);

  results2.forEach((result, index) => {
    console.log(`Result #${index + 1} (Score: ${result.score.toFixed(3)})`);
    console.log(`  Title: ${result.highlights?.title || result.data.title}`);
    console.log(`  Description: ${result.highlights?.description || result.data.description}\n`);
  });

  // 7. Compare with traditional SQL LIKE query
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⚖️  COMPARISON: Search vs SQL LIKE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Traditional SQL LIKE query (bypassing search)
  const likeStartTime = Date.now();
  const likeResults = await services.raw<Service[]>(
    `SELECT * FROM services
     WHERE title LIKE ? OR description LIKE ? OR category LIKE ?
     LIMIT 10`,
    ['%plumbing%', '%plumbing%', '%plumbing%']
  );
  const likeTime = Date.now() - likeStartTime;

  console.log('Traditional SQL LIKE query:');
  console.log(`  Query: "WHERE title LIKE '%plumbing%' OR description LIKE '%plumbing%'"`);
  console.log(`  Results: ${likeResults.length}`);
  console.log(`  Time: ${likeTime}ms\n`);

  // Search query
  const searchStartTime = Date.now();
  const searchResults = await services.search!('plumbing', { limit: 10 });
  const searchTime = Date.now() - searchStartTime;

  console.log('Inverted Index Search:');
  console.log(`  Query: "plumbing" (with stemming and ranking)`);
  console.log(`  Results: ${searchResults.length}`);
  console.log(`  Time: ${searchTime}ms`);
  console.log(`  Performance: ${likeTime > searchTime ? `${(likeTime / searchTime).toFixed(1)}x faster` : 'Similar'}\n`);

  // 8. Get search statistics
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SEARCH INDEX STATISTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const indexStats = await services.getSearchStats!();
  if (indexStats) {
    console.log(`Table: ${indexStats.tableName}`);
    console.log(`Documents indexed: ${indexStats.totalDocuments}`);
    console.log(`Unique terms: ${indexStats.totalTerms}`);
    console.log(`Total tokens: ${indexStats.totalTokens}`);
    console.log(`Last built: ${new Date(indexStats.lastBuildTime).toISOString()}`);
    console.log(`Build duration: ${indexStats.buildDurationMs}ms`);
    console.log(`Fields: ${indexStats.fields.join(', ')}\n`);
  }

  // 9. Rebuild index (useful after bulk updates)
  console.log('🔄 Rebuilding search index...');
  const rebuildStats = await services.rebuildSearchIndex!();
  console.log(`✅ Index rebuilt in ${rebuildStats.buildDurationMs}ms\n`);

  // Close connection
  await db.close();
  console.log('✅ Database connection closed');
}

// Run the CLI example only if --api flag is NOT present
if (require.main === module && !process.argv.includes('--api')) {
  searchExample()
    .then(() => {
      console.log('\n✨ Search example completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { searchExample };

/**
 * ============================================================================
 * REST API ENDPOINT EXAMPLES
 * ============================================================================
 *
 * This file can run in two modes:
 *
 * 1. CLI Demo Mode (default):
 *    - Runs the searchExample() function above
 *    - Demonstrates search features with console output
 *    - Usage: npm run search OR ts-node examples/search-example.ts
 *
 * 2. API Server Mode (--api flag):
 *    - Starts an Express.js REST API server
 *    - Provides HTTP endpoints for search operations
 *    - Usage: npm run search:api OR ts-node examples/search-example.ts --api
 *    - Server runs on http://localhost:3090 (or PORT environment variable)
 *
 * Below are the Express.js endpoint implementations.
 */

import express, { Request, Response } from 'express';

// Shared database instance (initialized once)
let dbInstance: any = null;

/**
 * Initialize database connection
 */
async function initializeDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const { createSqlDB } = await import('../src/index');

  dbInstance = await createSqlDB({
    mariadb: {
      host: 'qa-she-careers-mariadb.c9ott5sa9myf.us-east-2.rds.amazonaws.com',
      port: 3306,
      user: 'admin',
      password: 'Qx7tV2pW5sR9uY1zA4bC6dE8fG3hJ0kL_mN-pQ8sR1tU4vW',
      database: 'dev_she_careers_bhushan',
      connectionLimit: 10,
    },
    redis: {
      host: 'localhost',
      port: 6379,
      keyPrefix: 'myapp',
    },
    cache: {
      enabled: true,
      defaultTTL: 60,
    },
    search: {
      enabled: true,
      invertedIndex: {
        enabled: true,
        tables: {
          services: {
            searchableFields: ['title', 'description', 'category'],
            tokenizer: 'stemming',
            minWordLength: 3,
            stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'],
            fieldBoosts: {
              title: 3.0,
              category: 2.0,
              description: 1.0,
            },
          },
        },
      },
    },
  });

  await dbInstance.initialize();
  console.log('✅ Database initialized for API');

  return dbInstance;
}

/**
 * Create Express app with search endpoints
 */
export function createSearchAPI() {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const db = await initializeDatabase();
      const health = await db.healthCheck();
      res.json({
        status: health.overall ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        ...health,
      });
    } catch (error: any) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
      });
    }
  });

  /**
   * POST /api/search/services
   *
   * Search for services using full-text search
   *
   * Body:
   * {
   *   "query": "plumbing repair",
   *   "limit": 10,
   *   "offset": 0,
   *   "highlightFields": ["title", "description"],
   *   "minScore": 0.1,
   *   "filters": {
   *     "is_active": 1
   *   }
   * }
   */
  app.post('/api/search/services', async (req: Request, res: Response) => {
    try {
      const {
        query,
        limit = 10,
        offset = 0,
        highlightFields = [],
        minScore = 0,
        filters = {},
      } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: 'Query parameter is required and must be a string',
        });
      }

      const db = await initializeDatabase();
      const services = db.getTableOperations('services');

      const startTime = Date.now();
      const results = await services.search!(query, {
        limit,
        offset,
        highlightFields,
        minScore,
        filters,
      });
      const searchTime = Date.now() - startTime;

      res.json({
        success: true,
        query,
        results: results.length,
        data: results,
        meta: {
          searchTimeMs: searchTime,
          limit,
          offset,
        },
      });
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/search/services?q=plumbing&limit=10
   *
   * Simple GET-based search endpoint
   */
  app.get('/api/search/services', async (req: Request, res: Response) => {
    try {
      const {
        q,
        limit = '10',
        offset = '0',
        minScore = '0',
        highlight = 'title,description',
      } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({
          error: 'Query parameter "q" is required',
        });
      }

      const db = await initializeDatabase();
      const services = db.getTableOperations('services');

      const highlightFields = highlight ? String(highlight).split(',') : [];

      const startTime = Date.now();
      const results = await services.search!(q, {
        limit: parseInt(String(limit), 10),
        offset: parseInt(String(offset), 10),
        highlightFields,
        minScore: parseFloat(String(minScore)),
      });
      const searchTime = Date.now() - startTime;

      res.json({
        success: true,
        query: q,
        results: results.length,
        data: results,
        meta: {
          searchTimeMs: searchTime,
          limit: parseInt(String(limit), 10),
          offset: parseInt(String(offset), 10),
        },
      });
    } catch (error: any) {
      console.error('Search error:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/search/index/services/build
   *
   * Build or rebuild the search index for services table
   */
  app.post('/api/search/index/services/build', async (req: Request, res: Response) => {
    try {
      const { rebuild = false } = req.body;

      const db = await initializeDatabase();
      const services = db.getTableOperations('services');

      const stats = rebuild
        ? await services.rebuildSearchIndex!()
        : await services.buildSearchIndex!();

      res.json({
        success: true,
        action: rebuild ? 'rebuild' : 'build',
        stats,
      });
    } catch (error: any) {
      console.error('Index build error:', error);
      res.status(500).json({
        error: 'Failed to build index',
        message: error.message,
      });
    }
  });

  /**
   * GET /api/search/index/services/stats
   *
   * Get search index statistics
   */
  app.get('/api/search/index/services/stats', async (req: Request, res: Response) => {
    try {
      const db = await initializeDatabase();
      const services = db.getTableOperations('services');

      const stats = await services.getSearchStats!();

      if (!stats) {
        return res.status(404).json({
          error: 'Index not found',
          message: 'Search index has not been built for this table',
        });
      }

      res.json({
        success: true,
        stats: {
          ...stats,
          lastBuildTimeFormatted: new Date(stats.lastBuildTime).toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Stats error:', error);
      res.status(500).json({
        error: 'Failed to get stats',
        message: error.message,
      });
    }
  });

  /**
   * POST /api/search/autocomplete
   *
   * Autocomplete endpoint (uses simple prefix matching for now)
   */
  app.post('/api/search/autocomplete', async (req: Request, res: Response) => {
    try {
      const { query, limit = 5 } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: 'Query parameter is required',
        });
      }

      const db = await initializeDatabase();
      const services = db.getTableOperations('services');

      // Use search with very low min score for autocomplete
      const results = await services.search!(query, {
        limit,
        highlightFields: ['title'],
        minScore: 0.1,
      });

      // Extract unique titles for autocomplete suggestions
      const suggestions = results
        .map((r: SearchResult<Service>) => r.data.title)
        .filter((title: string, index: number, arr: string[]) => arr.indexOf(title) === index)
        .slice(0, limit);

      res.json({
        success: true,
        query,
        suggestions,
      });
    } catch (error: any) {
      console.error('Autocomplete error:', error);
      res.status(500).json({
        error: 'Autocomplete failed',
        message: error.message,
      });
    }
  });

  return app;
}

/**
 * Start the API server
 */
export async function startSearchAPI(port: number = 3000) {
  const app = createSearchAPI();

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`\n🚀 Search API Server Running`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📍 URL: http://localhost:${port}`);
      console.log(`\n📚 Available Endpoints:`);
      console.log(`   GET  /health`);
      console.log(`   GET  /api/search/services?q=plumbing&limit=10`);
      console.log(`   POST /api/search/services`);
      console.log(`   POST /api/search/index/services/build`);
      console.log(`   GET  /api/search/index/services/stats`);
      console.log(`   POST /api/search/autocomplete`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      console.log(`💡 Example requests:\n`);
      console.log(`   # Simple search`);
      console.log(`   curl "http://localhost:${port}/api/search/services?q=plumbing&limit=5"\n`);
      console.log(`   # Advanced search`);
      console.log(`   curl -X POST http://localhost:${port}/api/search/services \\`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{"query":"plumbing repair","limit":10,"highlightFields":["title","description"]}'\n`);
      console.log(`   # Build index`);
      console.log(`   curl -X POST http://localhost:${port}/api/search/index/services/build\n`);
      console.log(`   # Get stats`);
      console.log(`   curl http://localhost:${port}/api/search/index/services/stats\n`);

      resolve();
    });

    server.on('error', reject);
  });
}

// Allow running as API server
if (process.argv.includes('--api')) {
  const port = parseInt(process.env.PORT || '3090', 10);
  startSearchAPI(port)
    .then(() => {
      console.log('✅ Server started successfully');
    })
    .catch((error) => {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    });
}
