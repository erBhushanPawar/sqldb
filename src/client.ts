import {
  SmartDBConfig,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_DISCOVERY_CONFIG,
  DEFAULT_LOGGING_CONFIG,
} from './types/config';
import { TableOperations } from './types/query';
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

export class SmartDBClient {
  private config: SmartDBConfig;
  private dbManager!: MariaDBConnectionManager;
  private redisManager!: RedisConnectionManager;
  private cacheManager!: CacheManager;
  private invalidationManager!: InvalidationManager;
  private dependencyGraph!: DependencyGraph;
  private queryBuilder!: QueryBuilder;
  private tableProxyFactory!: TableProxyFactory;
  public hooks!: HooksManager;

  private initialized: boolean = false;
  private discoveredTables: Set<string> = new Set();

  constructor(config: SmartDBConfig) {
    this.config = {
      ...config,
      cache: { ...DEFAULT_CACHE_CONFIG, ...config.cache },
      discovery: { ...DEFAULT_DISCOVERY_CONFIG, ...config.discovery },
      logging: { ...DEFAULT_LOGGING_CONFIG, ...config.logging },
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.log('info', 'Initializing SmartDBClient...');

    // Initialize connection managers
    this.dbManager = new MariaDBConnectionManager(this.config.mariadb);
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

    this.initialized = true;
    this.log('info', 'SmartDBClient initialized successfully');

    // Create dynamic table accessors using Proxy
    return new Proxy(this, {
      get(target, prop: string) {
        // If prop exists on target, return it
        if (prop in target) {
          return (target as any)[prop];
        }

        // Otherwise, treat it as a table name
        if (typeof prop === 'string' && !prop.startsWith('_')) {
          return target.getTableOperations(prop);
        }

        return undefined;
      },
    }) as any;
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
    this.dependencyGraph.clear();

    await this.discoverSchema();

    this.log('info', 'Schema refreshed successfully');
  }

  getTableOperations<T = any>(tableName: string): TableOperations<T> {
    if (!this.initialized) {
      throw new Error(
        'SmartDBClient not initialized. Call initialize() first.'
      );
    }

    return new TableOperationsImpl<T>(
      tableName,
      this.dbManager,
      this.cacheManager,
      this.invalidationManager,
      this.queryBuilder,
      this.config.cache as Required<typeof DEFAULT_CACHE_CONFIG>
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

  async close(): Promise<void> {
    this.log('info', 'Closing SmartDBClient...');

    await this.cacheManager.clear();
    await this.dbManager.close();
    await this.redisManager.close();

    this.initialized = false;

    this.log('info', 'SmartDBClient closed');
  }

  private log(level: string, message: string, meta?: any): void {
    if (this.config.logging?.logger) {
      this.config.logging.logger(level, message, meta);
    }
  }
}
