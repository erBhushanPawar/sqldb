import { OperatorProcessor } from '../../types/operators';

/**
 * Array operators: in, notIn
 * Used for filtering by membership in a set of values
 */

export const inOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    if (!Array.isArray(value)) {
      throw new Error(`'in' operator requires an array value`);
    }

    if (value.length === 0) {
      // Empty array for IN - always false
      return '1 = 0';
    }

    const placeholders = value.map(() => '?').join(', ');
    params.push(...value);
    return `${column} IN (${placeholders})`;
  },
};

export const notInOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    if (!Array.isArray(value)) {
      throw new Error(`'notIn' operator requires an array value`);
    }

    if (value.length === 0) {
      // Empty array for NOT IN - always true (matches all)
      return '1 = 1';
    }

    const placeholders = value.map(() => '?').join(', ');
    params.push(...value);
    return `${column} NOT IN (${placeholders})`;
  },
};

// Export all array operators
export const arrayOperators = {
  in: inOperator,
  notIn: notInOperator,
};
