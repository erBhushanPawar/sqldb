import { OperatorProcessor } from '../../types/operators';

/**
 * Comparison operators: gt, gte, lt, lte, equals, not
 * Used for numeric, date, and comparable value filtering
 */

export const gtOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(value);
    return `${column} > ?`;
  },
};

export const gteOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(value);
    return `${column} >= ?`;
  },
};

export const ltOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(value);
    return `${column} < ?`;
  },
};

export const lteOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    params.push(value);
    return `${column} <= ?`;
  },
};

export const equalsOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    if (value === null) {
      return `${column} IS NULL`;
    }
    params.push(value);
    return `${column} = ?`;
  },
};

export const notOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    if (value === null) {
      return `${column} IS NOT NULL`;
    }

    // Handle nested operators in NOT
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      // NOT with nested operators
      // This will be handled by the main buildWhereClause recursively
      // For now, just handle simple NOT
      params.push(value);
      return `${column} != ?`;
    }

    params.push(value);
    return `${column} != ?`;
  },
};

// Export all comparison operators
export const comparisonOperators = {
  gt: gtOperator,
  gte: gteOperator,
  lt: ltOperator,
  lte: lteOperator,
  equals: equalsOperator,
  not: notOperator,
};
