import { MariaDBConnectionManager } from '../connection/mariadb';
import { TableRelationship } from '../types/schema';

export class RelationshipParser {
  private dbManager: MariaDBConnectionManager;

  constructor(dbManager: MariaDBConnectionManager) {
    this.dbManager = dbManager;
  }

  async parseRelationships(): Promise<TableRelationship[]> {
    const database = await this.getCurrentDatabase();
    return await this.getForeignKeyRelationships(database);
  }

  private async getCurrentDatabase(): Promise<string> {
    const result: any = await this.dbManager.query('SELECT DATABASE() as db');
    return result[0].db;
  }

  private async getForeignKeyRelationships(
    database: string
  ): Promise<TableRelationship[]> {
    const sql = `
      SELECT
        kcu.CONSTRAINT_NAME as constraintName,
        kcu.TABLE_NAME as fromTable,
        kcu.COLUMN_NAME as fromColumn,
        kcu.REFERENCED_TABLE_NAME as toTable,
        kcu.REFERENCED_COLUMN_NAME as toColumn,
        rc.DELETE_RULE as onDelete,
        rc.UPDATE_RULE as onUpdate
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = ?
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME
    `;

    const result: any = await this.dbManager.query(sql, [database]);

    return result.map((row: any) => ({
      constraintName: row.constraintName,
      fromTable: row.fromTable,
      fromColumn: row.fromColumn,
      toTable: row.toTable,
      toColumn: row.toColumn,
      onDelete: row.onDelete,
      onUpdate: row.onUpdate,
    }));
  }
}
