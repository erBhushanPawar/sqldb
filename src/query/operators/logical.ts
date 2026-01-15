/**
 * Logical operators: AND, OR, NOT
 * Used for combining multiple conditions
 */

/**
 * Process AND operator - all conditions must be true
 * @param conditions Array of WHERE conditions
 * @param buildWhereClauseFn Function to build WHERE clause (passed from QueryBuilder)
 * @param params Array to collect query parameters
 * @returns SQL string with AND conditions
 */
export function processAndOperator(
  conditions: any[],
  buildWhereClauseFn: (where: any, params: any[]) => string,
  params: any[]
): string {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return '';
  }

  const clauses: string[] = [];
  for (const condition of conditions) {
    const clause = buildWhereClauseFn(condition, params);
    if (clause) {
      clauses.push(clause);
    }
  }

  if (clauses.length === 0) {
    return '';
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return `(${clauses.join(' AND ')})`;
}

/**
 * Process OR operator - at least one condition must be true
 * @param conditions Array of WHERE conditions
 * @param buildWhereClauseFn Function to build WHERE clause (passed from QueryBuilder)
 * @param params Array to collect query parameters
 * @returns SQL string with OR conditions
 */
export function processOrOperator(
  conditions: any[],
  buildWhereClauseFn: (where: any, params: any[]) => string,
  params: any[]
): string {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return '';
  }

  const clauses: string[] = [];
  for (const condition of conditions) {
    const clause = buildWhereClauseFn(condition, params);
    if (clause) {
      clauses.push(clause);
    }
  }

  if (clauses.length === 0) {
    return '';
  }

  if (clauses.length === 1) {
    return clauses[0];
  }

  return `(${clauses.join(' OR ')})`;
}

/**
 * Process NOT operator - condition must be false
 * @param conditions Array of WHERE conditions
 * @param buildWhereClauseFn Function to build WHERE clause (passed from QueryBuilder)
 * @param params Array to collect query parameters
 * @returns SQL string with NOT conditions
 */
export function processNotOperator(
  conditions: any[],
  buildWhereClauseFn: (where: any, params: any[]) => string,
  params: any[]
): string {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return '';
  }

  const clauses: string[] = [];
  for (const condition of conditions) {
    const clause = buildWhereClauseFn(condition, params);
    if (clause) {
      clauses.push(clause);
    }
  }

  if (clauses.length === 0) {
    return '';
  }

  // If multiple conditions, combine with AND then negate
  const combined = clauses.length === 1 ? clauses[0] : `(${clauses.join(' AND ')})`;
  return `NOT ${combined}`;
}

// Export logical operators
export const logicalOperators = {
  AND: processAndOperator,
  OR: processOrOperator,
  NOT: processNotOperator,
};
