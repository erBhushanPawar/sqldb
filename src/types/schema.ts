export interface ColumnInfo {
  columnName: string;
  dataType: string;
  columnType: string; // Full type definition like 'varchar(255)' or 'int(11)'
  isNullable: boolean;
  columnKey: string; // 'PRI', 'UNI', 'MUL', ''
  columnDefault: string | null;
  extra: string; // e.g., 'auto_increment'
  characterMaximumLength?: number | null;
  numericPrecision?: number | null;
  numericScale?: number | null;
  characterSetName?: string | null;
  collationName?: string | null;
}

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  primaryKey?: string;
}

export interface TableRelationship {
  constraintName: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface SchemaDiscoveryResult {
  tables: TableSchema[];
  relationships: TableRelationship[];
}
