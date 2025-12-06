import { QueryMetadata, QueryTracker } from '../types/query';
import * as crypto from 'crypto';

export class InMemoryQueryTracker implements QueryTracker {
  private queries: Map<string, QueryMetadata[]> = new Map();
  private allQueries: QueryMetadata[] = [];

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
