import { MariaDBConnectionManager } from '../connection/mariadb';
import { TableSchema, ColumnInfo } from '../types/schema';
import { DiscoveryConfig } from '../types/config';

export class SchemaReader {
  private dbManager: MariaDBConnectionManager;
  private config: DiscoveryConfig;

  constructor(dbManager: MariaDBConnectionManager, config: DiscoveryConfig) {
    this.dbManager = dbManager;
    this.config = config;
  }

  async discoverTables(): Promise<TableSchema[]> {
    const database = await this.getCurrentDatabase();
    const tables = await this.getTableNames(database);
    const filteredTables = this.filterTables(tables);

    const tableSchemas: TableSchema[] = [];

    for (const tableName of filteredTables) {
      const columns = await this.getTableColumns(database, tableName);
      const primaryKey = this.findPrimaryKey(columns);

      tableSchemas.push({
        tableName,
        columns,
        primaryKey,
      });
    }

    return tableSchemas;
  }

  private async getCurrentDatabase(): Promise<string> {
    const result: any = await this.dbManager.query('SELECT DATABASE() as db');
    return result[0].db;
  }

  private async getTableNames(database: string): Promise<string[]> {
    const sql = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;

    const result: any = await this.dbManager.query(sql, [database]);
    return result.map((row: any) => row.TABLE_NAME);
  }

  private filterTables(tables: string[]): string[] {
    let filtered = tables;

    // Apply include list
    if (this.config.includeTables && this.config.includeTables.length > 0) {
      filtered = filtered.filter((table) =>
        this.config.includeTables!.includes(table)
      );
    }

    // Apply exclude list
    if (this.config.excludeTables && this.config.excludeTables.length > 0) {
      filtered = filtered.filter(
        (table) => !this.config.excludeTables!.includes(table)
      );
    }

    return filtered;
  }

  private async getTableColumns(
    database: string,
    tableName: string
  ): Promise<ColumnInfo[]> {
    const sql = `
      SELECT
        COLUMN_NAME as columnName,
        DATA_TYPE as dataType,
        COLUMN_TYPE as columnType,
        IS_NULLABLE as isNullable,
        COLUMN_KEY as columnKey,
        COLUMN_DEFAULT as columnDefault,
        EXTRA as extra,
        CHARACTER_MAXIMUM_LENGTH as characterMaximumLength,
        NUMERIC_PRECISION as numericPrecision,
        NUMERIC_SCALE as numericScale,
        CHARACTER_SET_NAME as characterSetName,
        COLLATION_NAME as collationName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `;

    const result: any = await this.dbManager.query(sql, [database, tableName]);

    return result.map((row: any) => ({
      columnName: row.columnName,
      dataType: row.dataType,
      columnType: row.columnType,
      isNullable: row.isNullable === 'YES',
      columnKey: row.columnKey || '',
      columnDefault: row.columnDefault,
      extra: row.extra || '',
      characterMaximumLength: row.characterMaximumLength,
      numericPrecision: row.numericPrecision,
      numericScale: row.numericScale,
      characterSetName: row.characterSetName,
      collationName: row.collationName,
    }));
  }

  private findPrimaryKey(columns: ColumnInfo[]): string | undefined {
    const pkColumn = columns.find((col) => col.columnKey === 'PRI');
    return pkColumn?.columnName;
  }
}
