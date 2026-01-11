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

    // Fetch all columns in a single query for better performance
    const allColumns = await this.getAllTableColumns(database, filteredTables);

    // Fetch all indexes
    const allIndexes = await this.getAllTableIndexes(database, filteredTables);

    // Fetch all foreign keys
    const allForeignKeys = await this.getAllTableForeignKeys(database, filteredTables);

    const tableSchemas: TableSchema[] = filteredTables.map((tableName) => {
      const columns = allColumns.get(tableName) || [];
      const primaryKey = this.findPrimaryKey(columns);
      const indexes = allIndexes.get(tableName) || [];
      const foreignKeys = allForeignKeys.get(tableName) || [];

      return {
        tableName,
        columns,
        primaryKey,
        indexes,
        foreignKeys,
      };
    });

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

  private async getAllTableColumns(
    database: string,
    tableNames: string[]
  ): Promise<Map<string, ColumnInfo[]>> {
    if (tableNames.length === 0) {
      return new Map();
    }

    // Create placeholders for IN clause
    const placeholders = tableNames.map(() => '?').join(',');

    const sql = `
      SELECT
        TABLE_NAME as tableName,
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
        COLLATION_NAME as collationName,
        ORDINAL_POSITION as ordinalPosition
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME IN (${placeholders})
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `;

    const result: any = await this.dbManager.query(sql, [database, ...tableNames]);

    // Group columns by table name
    const columnsByTable = new Map<string, ColumnInfo[]>();

    for (const row of result) {
      const tableName = row.tableName;

      if (!columnsByTable.has(tableName)) {
        columnsByTable.set(tableName, []);
      }

      columnsByTable.get(tableName)!.push({
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
      });
    }

    return columnsByTable;
  }


  private async getAllTableIndexes(
    database: string,
    tableNames: string[]
  ): Promise<Map<string, any[]>> {
    if (tableNames.length === 0) {
      return new Map();
    }

    const placeholders = tableNames.map(() => '?').join(',');

    const sql = `
      SELECT
        TABLE_NAME as tableName,
        INDEX_NAME as indexName,
        COLUMN_NAME as columnName,
        NON_UNIQUE as nonUnique,
        SEQ_IN_INDEX as seqInIndex
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME IN (${placeholders})
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
    `;

    const result: any = await this.dbManager.query(sql, [database, ...tableNames]);

    // Group indexes by table and index name
    const indexesByTable = new Map<string, any[]>();

    const indexMap = new Map<string, any>();

    for (const row of result) {
      const key = `${row.tableName}:${row.indexName}`;

      if (!indexMap.has(key)) {
        indexMap.set(key, {
          name: row.indexName,
          columns: [],
          isUnique: row.nonUnique === 0,
          isPrimary: row.indexName === 'PRIMARY',
        });
      }

      indexMap.get(key)!.columns.push(row.columnName);
    }

    // Group by table
    for (const [key, index] of indexMap) {
      const tableName = key.split(':')[0];
      if (!indexesByTable.has(tableName)) {
        indexesByTable.set(tableName, []);
      }
      indexesByTable.get(tableName)!.push(index);
    }

    return indexesByTable;
  }

  private async getAllTableForeignKeys(
    database: string,
    tableNames: string[]
  ): Promise<Map<string, any[]>> {
    if (tableNames.length === 0) {
      return new Map();
    }

    const placeholders = tableNames.map(() => '?').join(',');

    const sql = `
      SELECT
        kcu.TABLE_NAME as tableName,
        kcu.COLUMN_NAME as columnName,
        kcu.REFERENCED_TABLE_NAME as referencedTable,
        kcu.REFERENCED_COLUMN_NAME as referencedColumn,
        rc.DELETE_RULE as onDelete,
        rc.UPDATE_RULE as onUpdate
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = ?
      AND kcu.TABLE_NAME IN (${placeholders})
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME
    `;

    const result: any = await this.dbManager.query(sql, [database, ...tableNames]);

    // Group foreign keys by table
    const foreignKeysByTable = new Map<string, any[]>();

    for (const row of result) {
      const tableName = row.tableName;

      if (!foreignKeysByTable.has(tableName)) {
        foreignKeysByTable.set(tableName, []);
      }

      foreignKeysByTable.get(tableName)!.push({
        columnName: row.columnName,
        referencedTable: row.referencedTable,
        referencedColumn: row.referencedColumn,
        onDelete: row.onDelete || 'NO ACTION',
        onUpdate: row.onUpdate || 'NO ACTION',
      });
    }

    return foreignKeysByTable;
  }

  private findPrimaryKey(columns: ColumnInfo[]): string | undefined {
    const pkColumn = columns.find((col) => col.columnKey === 'PRI');
    return pkColumn?.columnName;
  }
}
