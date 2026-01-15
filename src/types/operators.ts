/**
 * Prisma-style operator types for type-safe query building
 */

// ============================================================================
// String Operators
// ============================================================================

export interface StringOperators {
  /** Matches strings containing the specified substring */
  contains?: string;
  /** Matches strings starting with the specified prefix */
  startsWith?: string;
  /** Matches strings ending with the specified suffix */
  endsWith?: string;
  /** Case-insensitive mode for string operations */
  mode?: 'default' | 'insensitive';
  /** Exact equality (same as direct value) */
  equals?: string;
  /** Not equal to */
  not?: string | StringOperators;
  /** String is in the provided array */
  in?: string[];
  /** String is not in the provided array */
  notIn?: string[];
}

// ============================================================================
// Number Operators
// ============================================================================

export interface NumberOperators {
  /** Greater than */
  gt?: number;
  /** Greater than or equal */
  gte?: number;
  /** Less than */
  lt?: number;
  /** Less than or equal */
  lte?: number;
  /** Exact equality (same as direct value) */
  equals?: number;
  /** Not equal to */
  not?: number | NumberOperators;
  /** Number is in the provided array */
  in?: number[];
  /** Number is not in the provided array */
  notIn?: number[];
}

// ============================================================================
// Date Operators
// ============================================================================

export interface DateOperators {
  /** Greater than (after) */
  gt?: Date | string;
  /** Greater than or equal (on or after) */
  gte?: Date | string;
  /** Less than (before) */
  lt?: Date | string;
  /** Less than or equal (on or before) */
  lte?: Date | string;
  /** Exact equality */
  equals?: Date | string;
  /** Not equal to */
  not?: Date | string | DateOperators;
  /** Date is in the provided array */
  in?: (Date | string)[];
  /** Date is not in the provided array */
  notIn?: (Date | string)[];
}

// ============================================================================
// Boolean Operators
// ============================================================================

export interface BooleanOperators {
  /** Exact equality (same as direct value) */
  equals?: boolean;
  /** Not equal to */
  not?: boolean;
}

// ============================================================================
// Generic Operators (for any type)
// ============================================================================

export interface GenericOperators<T> {
  /** Exact equality */
  equals?: T;
  /** Not equal to */
  not?: T | GenericOperators<T>;
  /** Value is in the provided array */
  in?: T[];
  /** Value is not in the provided array */
  notIn?: T[];
  /** Value is null */
  isNull?: boolean;
  /** Value is not null */
  isNotNull?: boolean;
}

// ============================================================================
// Relation Operators (for filtering by related data)
// ============================================================================

export interface RelationOperators<T> {
  /** At least one related record matches the condition */
  some?: T;
  /** All related records match the condition */
  every?: T;
  /** No related records match the condition */
  none?: T;
  /** Relation is set (not null) */
  is?: T | null;
  /** Relation is not set (is null) */
  isNot?: T | null;
}

// ============================================================================
// Logical Operators
// ============================================================================

export interface LogicalOperators<T> {
  /** All conditions must be true (AND) */
  AND?: WhereInput<T>[];
  /** At least one condition must be true (OR) */
  OR?: WhereInput<T>[];
  /** Condition must be false (NOT) */
  NOT?: WhereInput<T>[];
}

// ============================================================================
// Combined Where Input Type
// ============================================================================

/**
 * Maps field types to their appropriate operators
 */
export type FieldOperators<T> =
  T extends string ? (string | StringOperators) :
  T extends number ? (number | NumberOperators) :
  T extends Date ? (Date | DateOperators) :
  T extends boolean ? (boolean | BooleanOperators) :
  T extends null ? null :
  T extends Array<infer U> ? RelationOperators<WhereInput<U>> :
  T extends object ? RelationOperators<WhereInput<T>> | WhereInput<T> :
  T | GenericOperators<T>;

/**
 * Complete WHERE clause type combining field filters and logical operators
 */
export type WhereInput<T> = {
  [K in keyof T]?: FieldOperators<T[K]>;
} & LogicalOperators<T>;

// ============================================================================
// Operator Processing Types
// ============================================================================

/**
 * Internal type for operator processing
 */
export interface OperatorProcessor {
  /** Build SQL condition for this operator */
  buildCondition(
    column: string,
    value: any,
    params: any[]
  ): string;
}

/**
 * Operator registry for dynamic processing
 */
export type OperatorMap = {
  [operator: string]: OperatorProcessor;
};

// ============================================================================
// Operator Constants
// ============================================================================

export const COMPARISON_OPERATORS = ['gt', 'gte', 'lt', 'lte', 'equals', 'not'] as const;
export const ARRAY_OPERATORS = ['in', 'notIn'] as const;
export const STRING_OPERATORS = ['contains', 'startsWith', 'endsWith', 'mode'] as const;
export const NULL_OPERATORS = ['isNull', 'isNotNull'] as const;
export const RELATION_OPERATORS = ['some', 'every', 'none', 'is', 'isNot'] as const;
export const LOGICAL_OPERATORS = ['AND', 'OR', 'NOT'] as const;

export type ComparisonOperator = typeof COMPARISON_OPERATORS[number];
export type ArrayOperator = typeof ARRAY_OPERATORS[number];
export type StringOperator = typeof STRING_OPERATORS[number];
export type NullOperator = typeof NULL_OPERATORS[number];
export type RelationOperator = typeof RELATION_OPERATORS[number];
export type LogicalOperator = typeof LOGICAL_OPERATORS[number];

export type AllOperators =
  | ComparisonOperator
  | ArrayOperator
  | StringOperator
  | NullOperator
  | RelationOperator
  | LogicalOperator;

// ============================================================================
// Helper Type Guards
// ============================================================================

export function isOperatorObject(value: any): value is Record<string, any> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || value instanceof Date) {
    return false;
  }

  const keys = Object.keys(value);
  return keys.some(key =>
    COMPARISON_OPERATORS.includes(key as any) ||
    ARRAY_OPERATORS.includes(key as any) ||
    STRING_OPERATORS.includes(key as any) ||
    NULL_OPERATORS.includes(key as any) ||
    RELATION_OPERATORS.includes(key as any) ||
    LOGICAL_OPERATORS.includes(key as any)
  );
}

export function isLogicalOperator(key: string): key is LogicalOperator {
  return LOGICAL_OPERATORS.includes(key as any);
}

export function isRelationOperator(key: string): key is RelationOperator {
  return RELATION_OPERATORS.includes(key as any);
}
