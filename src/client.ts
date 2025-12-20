import {
  SqlDBConfig,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_DISCOVERY_CONFIG,
  DEFAULT_LOGGING_CONFIG,
  DEFAULT_WARMING_CONFIG,
} from './types/config';
import { TableOperations, QueryMetadata } from './types/query';
import { TableSchema } from './types/schema';
import { MariaDBConnectionManager } from './connection/mariadb';
import { RedisConnectionManager } from './connection/redis';
import { SchemaReader } from './discovery/schema-reader';
import { RelationshipParser } from './discovery/relationship-parser';
import { DependencyGraph } from './discovery/dependency-graph';
import { CacheManager } from './cache/cache-manager';
import { InvalidationManager } from './cache/invalidation';
import { QueryBuilder } from './query/query-builder';
import { TableOperationsImpl } from './query/operations';
import { TableProxyFactory } from './query/table-proxy';
import { HooksManager } from './hooks/hooks-manager';
import { InMemoryQueryTracker } from './query/query-tracker';
import { QueryStatsTracker } from './warming/query-stats-tracker';
import { AutoWarmingManager } from './warming/auto-warming-manager';
import { WarmingStats } from './types/warming';
import { CacheAPI } from './types/cache';

export class SqlDBClient {
  private config: SqlDBConfig;
  private dbManager!: MariaDBConnectionManager;
  private redisManager!: RedisConnectionManager;
  private cacheManager!: CacheManager;
  private invalidationManager!: InvalidationManager;
  private dependencyGraph!: DependencyGraph;
  private queryBuilder!: QueryBuilder;
  private tableProxyFactory!: TableProxyFactory;
  public hooks!: HooksManager;
  public queryTracker: InMemoryQueryTracker;
  public cache!: CacheAPI;

  // Auto-warming components
  private statsTracker?: QueryStatsTracker;
  private warmingManager?: AutoWarmingManager;

  private initialized: boolean = false;
  private discoveredTables: Set<string> = new Set();
  private tableSchemas: Map<string, TableSchema> = new Map();

  constructor(config: SqlDBConfig) {
    this.config = {
      ...config,
      cache: { ...DEFAULT_CACHE_CONFIG, ...config.cache },
      discovery: { ...DEFAULT_DISCOVERY_CONFIG, ...config.discovery },
      logging: { ...DEFAULT_LOGGING_CONFIG, ...config.logging },
      warming: { ...DEFAULT_WARMING_CONFIG, ...config.warming },
    };
    this.queryTracker = new InMemoryQueryTracker();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.log('info', 'Initializing SqlDBClient...');

    // Initialize connection managers
    this.dbManager = new MariaDBConnectionManager(this.config.mariadb, this.queryTracker);
    await this.dbManager.connect();
    this.log('info', 'MariaDB connected');

    this.redisManager = new RedisConnectionManager(this.config.redis);
    await this.redisManager.connect();
    this.log('info', 'Redis connected');

    // Initialize core components
    this.queryBuilder = new QueryBuilder();
    this.dependencyGraph = new DependencyGraph(
      this.config.discovery!.maxGraphDepth
    );

    this.cacheManager = new CacheManager(
      this.redisManager,
      this.config.cache as Required<typeof DEFAULT_CACHE_CONFIG>,
      this.config.redis.keyPrefix
    );

    this.invalidationManager = new InvalidationManager(
      this.cacheManager,
      this.dependencyGraph
    );

    this.hooks = new HooksManager();
    this.tableProxyFactory = new TableProxyFactory(this);

    // Expose Cache API
    this.cache = {
      invalidateTable: this.cacheManager.invalidateTable.bind(this.cacheManager),
      invalidateByPattern: this.cacheManager.invalidateByPattern.bind(this.cacheManager),
      clear: this.cacheManager.clear.bind(this.cacheManager),
      getStats: this.cacheManager.getStats.bind(this.cacheManager),
      has: this.cacheManager.has.bind(this.cacheManager),
      getTTL: this.cacheManager.getTTL.bind(this.cacheManager),
      get: this.cacheManager.get.bind(this.cacheManager),
      set: this.cacheManager.set.bind(this.cacheManager),
      delete: this.cacheManager.delete.bind(this.cacheManager),
      resetStats: this.cacheManager.resetStats.bind(this.cacheManager),
      isEnabled: this.cacheManager.isEnabled.bind(this.cacheManager),
    };

    // Run schema discovery
    if (this.config.discovery!.autoDiscover) {
      await this.discoverSchema();
    }

    // Set up refresh interval if configured
    if (this.config.discovery!.refreshInterval && this.config.discovery!.refreshInterval > 0) {
      setInterval(
        () => this.refreshSchema(),
        this.config.discovery!.refreshInterval
      );
    }

    // Initialize auto-warming system if enabled
    if (this.config.warming!.enabled) {
      this.statsTracker = new QueryStatsTracker(
        this.dbManager,
        this.config.warming!
      );
      await this.statsTracker.initialize();

      this.warmingManager = new AutoWarmingManager(
        this.dbManager,
        this.cacheManager,
        this.statsTracker,
        this.config.warming!,
        this.config.mariadb
      );
      await this.warmingManager.start();
      this.log('info', 'Auto-warming enabled');
    }

    this.initialized = true;
    this.log('info', 'SqlDBClient initialized successfully');
  }

  private async discoverSchema(): Promise<void> {
    this.log('info', 'Discovering database schema...');

    const schemaReader = new SchemaReader(
      this.dbManager,
      this.config.discovery!
    );
    const relationshipParser = new RelationshipParser(this.dbManager);

    // Discover tables
    const tables = await schemaReader.discoverTables();
    this.log('info', `Discovered ${tables.length} tables`);

    for (const table of tables) {
      this.discoveredTables.add(table.tableName);
      this.tableSchemas.set(table.tableName, table);
    }

    // Discover relationships
    const relationships = await relationshipParser.parseRelationships();
    this.log('info', `Discovered ${relationships.length} relationships`);

    // Build dependency graph
    this.dependencyGraph.buildFromRelationships(relationships);

    const graphInfo = this.dependencyGraph.getGraphInfo();
    this.log('info', `Dependency graph built`, graphInfo);
  }

  async refreshSchema(): Promise<void> {
    this.log('info', 'Refreshing database schema...');

    this.discoveredTables.clear();
    this.tableSchemas.clear();
    this.dependencyGraph.clear();

    await this.discoverSchema();

    this.log('info', 'Schema refreshed successfully');
  }

  getTableOperations<T = any>(tableName: string): TableOperations<T> {
    if (!this.initialized) {
      throw new Error(
        'SqlDBClient not initialized. Call initialize() first.'
      );
    }

    return new TableOperationsImpl<T>(
      tableName,
      this.dbManager,
      this.cacheManager,
      this.invalidationManager,
      this.queryBuilder,
      this.config.cache as Required<typeof DEFAULT_CACHE_CONFIG>,
      this.statsTracker
    );
  }

  getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  getInvalidationManager(): InvalidationManager {
    return this.invalidationManager;
  }

  getDependencyGraph(): DependencyGraph {
    return this.dependencyGraph;
  }

  getDiscoveredTables(): string[] {
    return Array.from(this.discoveredTables);
  }

  getTableSchema(tableName: string): TableSchema | undefined {
    return this.tableSchemas.get(tableName);
  }

  getAllSchemas(): TableSchema[] {
    return Array.from(this.tableSchemas.values());
  }

  getQueries(correlationId?: string): QueryMetadata[] {
    return this.queryTracker.getQueries(correlationId);
  }

  clearQueries(correlationId?: string): void {
    this.queryTracker.clearQueries(correlationId);
  }

  /**
   * Get query performance metrics
   */
  getMetrics(): any {
    return this.queryTracker.getMetrics();
  }

  /**
   * Reset query metrics
   */
  resetMetrics(): void {
    this.queryTracker.reset();
  }

  async healthCheck(): Promise<{
    mariadb: boolean;
    redis: boolean;
    overall: boolean;
  }> {
    const mariadbHealthy = await this.dbManager.healthCheck();
    const redisHealthy = await this.redisManager.healthCheck();

    return {
      mariadb: mariadbHealthy,
      redis: redisHealthy,
      overall: mariadbHealthy && redisHealthy,
    };
  }

  /**
   * Get detailed connection information
   */
  getConnectionInfo(): {
    mariadb: {
      host: string;
      database: string;
      activeConnections: number;
      totalConnections: number;
      idleConnections: number;
      maxConnections: number;
      isConnected: boolean;
    };
    redis: {
      host: string;
      port: number;
      db: number;
      isConnected: boolean;
    };
  } {
    const mariadbInfo = this.dbManager.getConnectionInfo();

    return {
      mariadb: {
        ...mariadbInfo,
        isConnected: this.dbManager.isConnected(),
      },
      redis: {
        host: this.config.redis.host,
        port: this.config.redis.port || 6379,
        db: this.config.redis.db || 0,
        isConnected: this.redisManager.isConnected(),
      },
    };
  }

  /**
   * Check if the client is connected to both MariaDB and Redis
   */
  isConnected(): boolean {
    return this.dbManager.isConnected() && this.redisManager.isConnected();
  }

  /**
   * Generate TypeScript interface from database schema
   */
  generateSchema(options?: {
    interfaceName?: string;
    includeComments?: boolean;
    nullableFields?: boolean;
    withExample?: boolean;
  }): string {
    const { SchemaGenerator } = require('./cli/schema-generator');
    const generator = new SchemaGenerator(this);

    if (options?.withExample) {
      return generator.generateWithExample(options);
    }

    return generator.generateCompleteSchema(options);
  }

  async close(): Promise<void> {
    this.log('info', 'Closing SqlDBClient...');

    // Stop auto-warming if enabled
    if (this.warmingManager) {
      await this.warmingManager.stop();
    }

    await this.cacheManager.clear();
    await this.dbManager.close();
    await this.redisManager.close();

    this.initialized = false;

    this.log('info', 'SqlDBClient closed');
  }

  /**
   * Get auto-warming statistics
   */
  getWarmingStats(): WarmingStats | null {
    return this.warmingManager?.getLastWarmingStats() || null;
  }

  /**
   * Manually trigger cache warming
   */
  async warmCache(): Promise<WarmingStats | undefined> {
    if (!this.warmingManager) {
      throw new Error('Auto-warming is not enabled. Set warming.enabled = true in config.');
    }
    return await this.warmingManager.warmCache();
  }

  /**
   * Get query statistics summary
   */
  async getQueryStatsSummary(): Promise<{
    totalQueries: number;
    totalAccesses: number;
    tableCount: number;
    avgAccessCount: number;
  } | null> {
    if (!this.statsTracker) {
      return null;
    }
    return await this.statsTracker.getStatsSummary();
  }

  private log(level: string, message: string, meta?: any): void {
    if (this.config.logging?.logger) {
      this.config.logging.logger(level, message, meta);
    }
  }
}
