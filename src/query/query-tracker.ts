import { QueryMetadata, QueryTracker } from '../types/query';
import * as crypto from 'crypto';

export interface QueryMetrics {
  totalQueries: number;
  queriesByTable: Record<string, number>;
  queriesByOperation: Record<string, number>;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  slowQueries: Array<{
    query: string;
    duration: number;
    timestamp: Date;
    tableName?: string;
  }>;
  errorRate: number;
  totalErrors: number;
}

export class InMemoryQueryTracker implements QueryTracker {
  private queries: Map<string, QueryMetadata[]> = new Map();
  private allQueries: QueryMetadata[] = [];
  private slowQueryThreshold: number = 1000; // ms

  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
  }

  trackQuery(metadata: QueryMetadata): void {
    this.allQueries.push(metadata);

    if (metadata.correlationId) {
      const existing = this.queries.get(metadata.correlationId) || [];
      existing.push(metadata);
      this.queries.set(metadata.correlationId, existing);
    }
  }

  getQueries(correlationId?: string): QueryMetadata[] {
    if (correlationId) {
      return this.queries.get(correlationId) || [];
    }
    return [...this.allQueries];
  }

  clearQueries(correlationId?: string): void {
    if (correlationId) {
      this.queries.delete(correlationId);
      this.allQueries = this.allQueries.filter(
        (q) => q.correlationId !== correlationId
      );
    } else {
      this.queries.clear();
      this.allQueries = [];
    }
  }

  /**
   * Get aggregated query metrics
   */
  getMetrics(): QueryMetrics {
    const totalQueries = this.allQueries.length;

    if (totalQueries === 0) {
      return {
        totalQueries: 0,
        queriesByTable: {},
        queriesByOperation: {},
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowQueries: [],
        errorRate: 0,
        totalErrors: 0,
      };
    }

    const queriesByTable: Record<string, number> = {};
    const queriesByOperation: Record<string, number> = {};
    const durations: number[] = [];
    const slowQueries: Array<{
      query: string;
      duration: number;
      timestamp: Date;
      tableName?: string;
    }> = [];
    let totalErrors = 0;

    for (const query of this.allQueries) {
      // Count by table
      if (query.tableName) {
        queriesByTable[query.tableName] = (queriesByTable[query.tableName] || 0) + 1;
      }

      // Count by operation
      if (query.operation) {
        queriesByOperation[query.operation] = (queriesByOperation[query.operation] || 0) + 1;
      }

      // Track durations
      if (query.executionTimeMs !== undefined) {
        durations.push(query.executionTimeMs);

        // Track slow queries
        if (query.executionTimeMs >= this.slowQueryThreshold) {
          slowQueries.push({
            query: query.sql,
            duration: query.executionTimeMs,
            timestamp: new Date(query.startTime),
            tableName: query.tableName,
          });
        }
      }

      // Count errors
      if (query.error) {
        totalErrors++;
      }
    }

    // Calculate duration stats
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    // Sort slow queries by duration (descending)
    slowQueries.sort((a, b) => b.duration - a.duration);

    const errorRate = totalQueries > 0 ? (totalErrors / totalQueries) * 100 : 0;

    return {
      totalQueries,
      queriesByTable,
      queriesByOperation,
      avgDuration,
      minDuration,
      maxDuration,
      slowQueries: slowQueries.slice(0, 10), // Top 10 slow queries
      errorRate,
      totalErrors,
    };
  }

  /**
   * Reset all tracked queries and metrics
   */
  reset(): void {
    this.clearQueries();
  }

  /**
   * Set slow query threshold in milliseconds
   */
  setSlowQueryThreshold(ms: number): void {
    this.slowQueryThreshold = ms;
  }
}

/**
 * Generates a unique ID using crypto.randomUUID (Node 14.17+) or fallback
 */
export function generateQueryId(): string {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Node versions
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
