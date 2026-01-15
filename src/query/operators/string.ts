import { OperatorProcessor } from '../../types/operators';

/**
 * String operators: contains, startsWith, endsWith
 * Support case-insensitive mode via mode: 'insensitive'
 */

export const containsOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(`%${value}%`);
    return `${column} LIKE ?`;
  },
};

export const startsWithOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(`${value}%`);
    return `${column} LIKE ?`;
  },
};

export const endsWithOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(`%${value}`);
    return `${column} LIKE ?`;
  },
};

/**
 * Case-insensitive versions using LOWER()
 */
export const containsInsensitiveOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(`%${value.toLowerCase()}%`);
    return `LOWER(${column}) LIKE ?`;
  },
};

export const startsWithInsensitiveOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(`${value.toLowerCase()}%`);
    return `LOWER(${column}) LIKE ?`;
  },
};

export const endsWithInsensitiveOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(`%${value.toLowerCase()}`);
    return `LOWER(${column}) LIKE ?`;
  },
};

// Export all string operators
export const stringOperators = {
  contains: containsOperator,
  startsWith: startsWithOperator,
  endsWith: endsWithOperator,
};

export const stringInsensitiveOperators = {
  contains: containsInsensitiveOperator,
  startsWith: startsWithInsensitiveOperator,
  endsWith: endsWithInsensitiveOperator,
};

/**
 * Helper to determine which string operator set to use based on mode
 */
export function getStringOperators(mode?: 'default' | 'insensitive') {
  return mode === 'insensitive' ? stringInsensitiveOperators : stringOperators;
}
