import * as crypto from 'crypto';

export class CacheKeyBuilder {
  private prefix: string;

  constructor(prefix: string = 'sdc') {
    this.prefix = prefix;
  }

  buildKey(table: string, operation: string, params: any): string {
    const hash = this.generateHash(params);
    return `${this.prefix}:${table}:${operation}:${hash}`;
  }

  buildIdKey(table: string, id: string | number): string {
    return `${this.prefix}:${table}:id:${id}`;
  }

  buildTablePattern(table: string): string {
    return `${this.prefix}:${table}:*`;
  }

  buildOperationPattern(table: string, operation: string): string {
    return `${this.prefix}:${table}:${operation}:*`;
  }

  private generateHash(params: any): string {
    // Normalize the params for consistent hashing
    const normalized = this.normalizeParams(params);
    const jsonString = JSON.stringify(normalized);

    // For short strings, use the string directly
    if (jsonString.length <= 50) {
      return Buffer.from(jsonString).toString('base64url').substring(0, 20);
    }

    // For longer strings, use MD5 hash
    return crypto.createHash('md5').update(jsonString).digest('hex').substring(0, 16);
  }

  private normalizeParams(params: any): any {
    if (params === null || params === undefined) {
      return null;
    }

    if (Array.isArray(params)) {
      return params.map((item) => this.normalizeParams(item));
    }

    if (typeof params === 'object') {
      const normalized: any = {};
      const keys = Object.keys(params).sort();

      for (const key of keys) {
        normalized[key] = this.normalizeParams(params[key]);
      }

      return normalized;
    }

    return params;
  }

  parseKey(key: string): { table: string; operation: string; hash: string } | null {
    const parts = key.split(':');

    if (parts.length < 4 || parts[0] !== this.prefix) {
      return null;
    }

    return {
      table: parts[1],
      operation: parts[2],
      hash: parts[3],
    };
  }

  matchesPattern(key: string, pattern: string): boolean {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return regex.test(key);
  }
}
