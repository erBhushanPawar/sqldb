/**
 * Utility for converting between snake_case and camelCase
 */
export class CaseConverter {
  /**
   * Convert snake_case to camelCase
   */
  static snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  static camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Convert object keys from snake_case to camelCase
   */
  static objectKeysToCamel<T = any>(obj: any): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.objectKeysToCamel(item)) as any;
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
      const converted: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const camelKey = this.snakeToCamel(key);
          converted[camelKey] = this.objectKeysToCamel(obj[key]);
        }
      }
      return converted;
    }

    return obj;
  }

  /**
   * Convert object keys from camelCase to snake_case
   */
  static objectKeysToSnake<T = any>(obj: any): T {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.objectKeysToSnake(item)) as any;
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
      const converted: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const snakeKey = this.camelToSnake(key);
          converted[snakeKey] = this.objectKeysToSnake(obj[key]);
        }
      }
      return converted;
    }

    return obj;
  }

  /**
   * Convert array of column names from snake_case to camelCase
   */
  static columnsToCamel(columns: string[]): string[] {
    return columns.map((col) => this.snakeToCamel(col));
  }

  /**
   * Convert array of column names from camelCase to snake_case
   */
  static columnsToSnake(columns: string[]): string[] {
    return columns.map((col) => this.camelToSnake(col));
  }

  /**
   * Convert WHERE clause object keys from camelCase to snake_case
   */
  static whereClauseToSnake(where: Record<string, any>): Record<string, any> {
    return this.objectKeysToSnake(where);
  }

  /**
   * Convert WHERE clause object keys from snake_case to camelCase
   */
  static whereClauseToCamel(where: Record<string, any>): Record<string, any> {
    return this.objectKeysToCamel(where);
  }
}
