/**
 * Centralized operator registry
 * Exports all operators in a unified structure
 */

import { OperatorMap } from '../../types/operators';
import { comparisonOperators } from './comparison';
import { stringOperators, stringInsensitiveOperators, getStringOperators } from './string';
import { arrayOperators } from './array';
import { nullOperators } from './null';
import { logicalOperators } from './logical';

/**
 * All field-level operators (non-logical)
 */
export const fieldOperators: OperatorMap = {
  ...comparisonOperators,
  ...stringOperators,
  ...arrayOperators,
  ...nullOperators,
};

/**
 * Export logical operators separately (they have different signatures)
 */
export { logicalOperators };

/**
 * Export string operator helpers
 */
export { getStringOperators, stringInsensitiveOperators };

/**
 * Export individual operator modules for direct access
 */
export { comparisonOperators } from './comparison';
export { stringOperators } from './string';
export { arrayOperators } from './array';
export { nullOperators } from './null';

/**
 * Check if a key is a recognized operator
 */
export function isKnownOperator(key: string): boolean {
  return key in fieldOperators || key === 'AND' || key === 'OR' || key === 'NOT' || key === 'mode';
}
