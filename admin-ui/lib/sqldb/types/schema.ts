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

/**
 * Extended column definition with additional metadata
 */
export interface ColumnDefinition extends ColumnInfo {
  name: string; // Alias for columnName
  type: string; // Alias for dataType
  nullable: boolean; // Alias for isNullable
  defaultValue: any; // Parsed columnDefault
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
  maxLength?: number; // Alias for characterMaximumLength
}

/**
 * Index definition
 */
export interface IndexDefinition {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

/**
 * Foreign key definition
 */
export interface ForeignKeyDefinition {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
  onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface TableSchema {
  tableName: string;
  columns: ColumnInfo[];
  primaryKey?: string;
  indexes?: IndexDefinition[];
  foreignKeys?: ForeignKeyDefinition[];
}

export interface TableRelationship {
  constraintName: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  onDelete?: string;
  onUpdate?: string;
}

export interface SchemaDiscoveryResult {
  tables: TableSchema[];
  relationships: TableRelationship[];
}
