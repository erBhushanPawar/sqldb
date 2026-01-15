import { OperatorProcessor } from '../../types/operators';

/**
 * Null operators: isNull, isNotNull
 * Used for checking null/not null values
 */

export const isNullOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    // value should be true for IS NULL, false for IS NOT NULL
    return value ? `${column} IS NULL` : `${column} IS NOT NULL`;
  },
};

export const isNotNullOperator: OperatorProcessor = {
  buildCondition(column: string, value: any, params: any[]): string {
    // value should be true for IS NOT NULL, false for IS NULL
    return value ? `${column} IS NOT NULL` : `${column} IS NULL`;
  },
};

// Export all null operators
export const nullOperators = {
  isNull: isNullOperator,
  isNotNull: isNotNullOperator,
};
