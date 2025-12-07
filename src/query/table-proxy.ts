import { TableOperations } from '../types/query';
import { SqlDBClient } from '../client';

export function createTableProxy(
  client: SqlDBClient,
  tableName: string
): TableOperations<any> {
  return client.getTableOperations(tableName);
}

export class TableProxyFactory {
  private client: SqlDBClient;
  private cache: Map<string, TableOperations<any>> = new Map();

  constructor(client: SqlDBClient) {
    this.client = client;
  }

  getProxy(tableName: string): TableOperations<any> {
    if (!this.cache.has(tableName)) {
      const operations = this.client.getTableOperations(tableName);
      this.cache.set(tableName, operations);
    }

    return this.cache.get(tableName)!;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
