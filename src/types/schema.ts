export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnKey: string; // 'PRI', 'UNI', 'MUL', ''
  columnDefault: string | null;
  extra: string; // e.g., 'auto_increment'
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
