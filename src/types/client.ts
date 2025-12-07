import { SmartDBClient } from '../client';
import { TableOperations } from './query';

/**
 * Helper type to add dynamic table access to SmartDBClient
 *
 * Usage:
 * ```typescript
 * interface MySchema {
 *   users: { id: number; name: string; email: string };
 *   orders: { id: number; user_id: number; total: number };
 *   products: { id: number; name: string; price: number };
 * }
 *
 * type MyDB = SmartDBWithTables<MySchema>;
 * const db = await createSmartDB(config) as MyDB;
 *
 * // Now you have full type safety:
 * const users = await db.users.findMany(); // users: { id: number; name: string; email: string }[]
 * const order = await db.orders.findById(1); // order: { id: number; user_id: number; total: number } | null
 * ```
 */
export type SmartDBWithTables<TSchema extends Record<string, any>> = SmartDBClient & {
  [K in keyof TSchema]: TableOperations<TSchema[K]>;
};

/**
 * For cases where you don't have a schema defined,
 * you can use this type to get basic dynamic table access
 */
export type SmartDBWithDynamicTables = SmartDBClient & {
  [tableName: string]: TableOperations<any>;
};
