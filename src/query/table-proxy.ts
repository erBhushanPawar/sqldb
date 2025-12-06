import { TableOperations } from '../types/query';
import { SmartDBClient } from '../client';

export function createTableProxy(
  client: SmartDBClient,
  tableName: string
): TableOperations<any> {
  return client.getTableOperations(tableName);
}

export class TableProxyFactory {
  private client: SmartDBClient;
  private cache: Map<string, TableOperations<any>> = new Map();

  constructor(client: SmartDBClient) {
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
