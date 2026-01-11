/**
 * Inverted Index Manager
 *
 * Manages inverted indexes stored in Redis for fast text search.
 * An inverted index maps words → document IDs for instant lookup.
 *
 * Storage structure in Redis:
 * - Key: "sqldb:index:{table}:word:{word}"
 * - Value: Sorted Set [(docId, score), ...]
 *
 * - Key: "sqldb:index:{table}:doc:{docId}"
 * - Value: Set [word1, word2, ...]
 *
 * - Key: "sqldb:index:{table}:meta"
 * - Value: Hash { lastBuild, docCount, termCount }
 */

import { Redis } from 'ioredis';
import { RedisConnectionManager } from '../connection/redis';
import { InvertedIndexConfig, IndexStats, TokenMetadata } from '../types/search';
import { Tokenizer, tokenizeFields } from './tokenizer';

export class InvertedIndexManager {
  private redis: RedisConnectionManager;
  private config: InvertedIndexConfig;
  private tokenizers: Map<string, Tokenizer> = new Map();
  private keyPrefix: string;

  constructor(redis: RedisConnectionManager, config: InvertedIndexConfig, keyPrefix?: string) {
    this.redis = redis;
    this.config = config;
    this.keyPrefix = keyPrefix || 'sqldb';

    // Initialize tokenizers for each table
    for (const [tableName, tableConfig] of Object.entries(config.tables)) {
      this.tokenizers.set(
        tableName,
        new Tokenizer({
          type: tableConfig.tokenizer,
          minWordLength: tableConfig.minWordLength,
          stopWords: tableConfig.stopWords,
          caseSensitive: tableConfig.caseSensitive,
        })
      );
    }
  }

  /**
   * Build inverted index for a table from scratch
   */
  async buildIndex(
    tableName: string,
    documents: Array<{ id: number; [key: string]: any }>
  ): Promise<IndexStats> {
    const startTime = Date.now();
    const tableConfig = this.config.tables[tableName];

    if (!tableConfig) {
      throw new Error(`No search configuration found for table: ${tableName}`);
    }

    const tokenizer = this.tokenizers.get(tableName);
    if (!tokenizer) {
      throw new Error(`No tokenizer found for table: ${tableName}`);
    }

    // Clear existing index
    await this.clearIndex(tableName);

    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not connected');
    }

    let totalTerms = 0;
    let totalTokens = 0;
    const termFrequency = new Map<string, number>(); // Track document frequency per term

    // Build index for each document
    for (const doc of documents) {
      // Try to find the document ID (supports id, {table}_id, or any numeric primary key)
      const docId = this.extractDocumentId(doc, tableName);

      // Skip documents without an ID
      if (docId === undefined || docId === null) {
        console.warn(`Skipping document without ID in table ${tableName}:`, Object.keys(doc).join(', '));
        continue;
      }

      // Tokenize all searchable fields
      const tokens = tokenizeFields(tokenizer, doc, tableConfig.searchableFields);
      totalTokens += tokens.length;

      // Group tokens by term
      const termMap = new Map<string, TokenMetadata>();
      for (const token of tokens) {
        if (!termMap.has(token.term)) {
          termMap.set(token.term, token);
        } else {
          // Merge positions
          const existing = termMap.get(token.term)!;
          existing.positions.push(...token.positions);
        }
      }

      // Store each term in Redis
      const pipeline = client.pipeline();

      for (const [term, metadata] of termMap.entries()) {
        // Calculate term frequency for this document
        const tf = metadata.positions.length;

        // Field boost (if configured)
        const fieldBoost = tableConfig.fieldBoosts?.[metadata.field] || 1.0;

        // Combine TF and field boost for initial score
        const score = tf * fieldBoost;

        // Add to inverted index: term → [docId, score]
        const wordKey = this.buildWordKey(tableName, term);
        pipeline.zadd(wordKey, score, String(docId));

        // Track document frequency
        termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
      }

      // Store document → terms mapping (for updates/deletes)
      const docKey = this.buildDocKey(tableName, docId);
      const terms = Array.from(termMap.keys());
      if (terms.length > 0) {
        pipeline.sadd(docKey, ...terms);
      }

      // Execute pipeline
      await pipeline.exec();
    }

    // Store metadata
    totalTerms = termFrequency.size;
    await this.storeMetadata(tableName, {
      tableName,
      totalDocuments: documents.length,
      totalTerms,
      totalTokens,
      lastBuildTime: Date.now(),
      buildDurationMs: Date.now() - startTime,
      fields: tableConfig.searchableFields,
    });

    return {
      tableName,
      totalDocuments: documents.length,
      totalTerms,
      totalTokens,
      lastBuildTime: Date.now(),
      buildDurationMs: Date.now() - startTime,
      fields: tableConfig.searchableFields,
    };
  }

  /**
   * Update index for a single document
   */
  async updateDocument(
    tableName: string,
    docId: string | number,
    data: Record<string, any>
  ): Promise<void> {
    const tableConfig = this.config.tables[tableName];
    if (!tableConfig) {
      throw new Error(`No search configuration found for table: ${tableName}`);
    }

    const tokenizer = this.tokenizers.get(tableName);
    if (!tokenizer) {
      throw new Error(`No tokenizer found for table: ${tableName}`);
    }

    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not connected');
    }

    // First, remove old document from index
    await this.deleteDocument(tableName, docId);

    // Tokenize new data
    const tokens = tokenizeFields(tokenizer, data, tableConfig.searchableFields);

    // Group tokens by term
    const termMap = new Map<string, TokenMetadata>();
    for (const token of tokens) {
      if (!termMap.has(token.term)) {
        termMap.set(token.term, token);
      } else {
        const existing = termMap.get(token.term)!;
        existing.positions.push(...token.positions);
      }
    }

    // Store each term in Redis
    const pipeline = client.pipeline();

    for (const [term, metadata] of termMap.entries()) {
      const tf = metadata.positions.length;
      const fieldBoost = tableConfig.fieldBoosts?.[metadata.field] || 1.0;
      const score = tf * fieldBoost;

      const wordKey = this.buildWordKey(tableName, term);
      pipeline.zadd(wordKey, score, String(docId));
    }

    // Store document → terms mapping
    const docKey = this.buildDocKey(tableName, docId);
    const terms = Array.from(termMap.keys());
    if (terms.length > 0) {
      pipeline.sadd(docKey, ...terms);
    }

    await pipeline.exec();
  }

  /**
   * Delete document from index
   */
  async deleteDocument(tableName: string, docId: string | number): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not connected');
    }

    // Get all terms for this document
    const docKey = this.buildDocKey(tableName, docId);
    const terms = await client.smembers(docKey);

    if (terms.length === 0) {
      return;
    }

    // Remove document from each term's sorted set
    const pipeline = client.pipeline();

    for (const term of terms) {
      const wordKey = this.buildWordKey(tableName, term);
      pipeline.zrem(wordKey, String(docId));
    }

    // Delete document key
    pipeline.del(docKey);

    await pipeline.exec();
  }

  /**
   * Search for documents matching query terms
   * Returns document IDs as strings (supports both numeric IDs and UUIDs)
   */
  async search(tableName: string, query: string, limit: number = 10): Promise<string[]> {
    const tableConfig = this.config.tables[tableName];
    if (!tableConfig) {
      throw new Error(`No search configuration found for table: ${tableName}`);
    }

    const tokenizer = this.tokenizers.get(tableName);
    if (!tokenizer) {
      throw new Error(`No tokenizer found for table: ${tableName}`);
    }

    const client = this.redis.getClient();
    if (!client) {
      throw new Error('Redis client not connected');
    }

    // Tokenize query
    const tokens = tokenizer.tokenize(query);
    if (tokens.length === 0) {
      return [];
    }

    const terms = tokenizer.getUniqueTerms(tokens);

    // If single term, just get documents for that term
    if (terms.length === 1) {
      const wordKey = this.buildWordKey(tableName, terms[0]);
      const results = await client.zrevrange(wordKey, 0, limit - 1);
      return results; // Already strings
    }

    // Multiple terms: use Redis ZINTERSTORE for intersection
    const tempKey = `${this.keyPrefix}:temp:search:${Date.now()}`;
    const wordKeys = terms.map(term => this.buildWordKey(tableName, term));

    try {
      // Intersect all term keys (documents must contain ALL terms)
      await client.zinterstore(tempKey, terms.length, ...wordKeys, 'AGGREGATE', 'SUM');

      // Get top results
      const results = await client.zrevrange(tempKey, 0, limit - 1);

      return results; // Already strings
    } finally {
      // Clean up temp key
      await client.del(tempKey);
    }
  }

  /**
   * Get document IDs for a specific term
   */
  async getDocumentsForTerm(tableName: string, term: string, limit: number = 100): Promise<string[]> {
    const client = this.redis.getClient();
    if (!client) {
      return [];
    }

    const wordKey = this.buildWordKey(tableName, term);
    const results = await client.zrevrange(wordKey, 0, limit - 1);

    return results; // Already strings
  }

  /**
   * Get statistics for an index
   */
  async getStats(tableName: string): Promise<IndexStats | null> {
    const client = this.redis.getClient();
    if (!client) {
      return null;
    }

    const metaKey = this.buildMetaKey(tableName);
    const meta = await client.hgetall(metaKey);

    if (!meta || Object.keys(meta).length === 0) {
      return null;
    }

    return {
      tableName,
      totalDocuments: parseInt(meta.totalDocuments || '0', 10),
      totalTerms: parseInt(meta.totalTerms || '0', 10),
      totalTokens: parseInt(meta.totalTokens || '0', 10),
      lastBuildTime: parseInt(meta.lastBuildTime || '0', 10),
      buildDurationMs: parseInt(meta.buildDurationMs || '0', 10),
      fields: meta.fields ? JSON.parse(meta.fields) : [],
    };
  }

  /**
   * Clear entire index for a table
   */
  async clearIndex(tableName: string): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      return;
    }

    // Delete all keys matching the table pattern
    const pattern = `${this.keyPrefix}:index:${tableName}:*`;
    const keys = await this.redis.scan(pattern);

    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  /**
   * Get all indexed terms for a table
   */
  async getAllTerms(tableName: string, limit: number = 1000): Promise<string[]> {
    const client = this.redis.getClient();
    if (!client) {
      return [];
    }

    const pattern = `${this.keyPrefix}:index:${tableName}:word:*`;
    const keys = await this.redis.scan(pattern);

    // Extract term from key
    const prefix = `${this.keyPrefix}:index:${tableName}:word:`;
    const terms = keys.map(key => key.substring(prefix.length)).slice(0, limit);

    return terms;
  }

  /**
   * Check if index exists for a table
   */
  async indexExists(tableName: string): Promise<boolean> {
    const stats = await this.getStats(tableName);
    return stats !== null && stats.totalDocuments > 0;
  }

  // ========== Private Helper Methods ==========

  private buildWordKey(tableName: string, term: string): string {
    return `${this.keyPrefix}:index:${tableName}:word:${term}`;
  }

  private buildDocKey(tableName: string, docId: string | number): string {
    return `${this.keyPrefix}:index:${tableName}:doc:${docId}`;
  }

  private buildMetaKey(tableName: string): string {
    return `${this.keyPrefix}:index:${tableName}:meta`;
  }

  private async storeMetadata(tableName: string, stats: IndexStats): Promise<void> {
    const client = this.redis.getClient();
    if (!client) {
      return;
    }

    const metaKey = this.buildMetaKey(tableName);
    await client.hset(metaKey, {
      totalDocuments: stats.totalDocuments.toString(),
      totalTerms: stats.totalTerms.toString(),
      totalTokens: stats.totalTokens.toString(),
      lastBuildTime: stats.lastBuildTime.toString(),
      buildDurationMs: stats.buildDurationMs.toString(),
      fields: JSON.stringify(stats.fields),
    });
  }

  /**
   * Extract document ID from a record
   * Supports: id, {table}_id, or first field ending in '_id'
   * Returns a string representation for Redis storage (works with both UUIDs and numbers)
   */
  private extractDocumentId(doc: Record<string, any>, tableName: string): string | undefined {
    // Try 'id' first
    if (doc.id !== undefined && doc.id !== null) {
      return String(doc.id);
    }

    // Try '{table}_id' (e.g., service_id, user_id)
    const tableIdField = `${tableName.replace(/s$/, '')}_id`; // services → service_id
    if (doc[tableIdField] !== undefined && doc[tableIdField] !== null) {
      return String(doc[tableIdField]);
    }

    // Try exact table name with _id
    const exactTableIdField = `${tableName}_id`;
    if (doc[exactTableIdField] !== undefined && doc[exactTableIdField] !== null) {
      return String(doc[exactTableIdField]);
    }

    // As last resort, find first field that ends with '_id'
    for (const key of Object.keys(doc)) {
      if (key.endsWith('_id') && doc[key] !== undefined && doc[key] !== null) {
        return String(doc[key]);
      }
    }

    return undefined;
  }
}
