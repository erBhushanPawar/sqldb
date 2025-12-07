import { SmartDBClient } from '../client';
import { TableSchema } from '../types/schema';

export interface GenerateSchemaOptions {
  outputPath?: string;
  interfaceName?: string;
  includeComments?: boolean;
  nullableFields?: boolean;
}

export class SchemaGenerator {
  private client: SmartDBClient;

  constructor(client: SmartDBClient) {
    this.client = client;
  }

  /**
   * Generate TypeScript interface from discovered schema
   */
  generateTypeScriptInterface(options: GenerateSchemaOptions = {}): string {
    const {
      interfaceName = 'DatabaseSchema',
      includeComments = true,
      nullableFields = true,
    } = options;

    const tables = this.client.getDiscoveredTables();
    const lines: string[] = [];

    // Add header comment
    if (includeComments) {
      lines.push('/**');
      lines.push(' * Auto-generated database schema');
      lines.push(` * Generated on: ${new Date().toISOString()}`);
      lines.push(` * Total tables: ${tables.length}`);
      lines.push(' */');
    }

    // Start interface
    lines.push(`export interface ${interfaceName} {`);

    // Generate type for each table
    for (const tableName of tables.sort()) {
      const schema = this.client.getTableSchema(tableName);

      if (!schema) {
        continue;
      }

      if (includeComments) {
        lines.push(`  /**`);
        lines.push(`   * Table: ${tableName}`);
        if (schema.primaryKey) {
          lines.push(`   * Primary key: ${schema.primaryKey}`);
        }
        lines.push(`   */`);
      }

      lines.push(`  ${tableName}: {`);

      // Generate fields
      for (const column of schema.columns) {
        const tsType = this.mapSQLTypeToTypeScript(column.dataType);
        const nullable = nullableFields && column.isNullable ? ' | null' : '';
        const optional = column.isNullable ? '?' : '';

        if (includeComments) {
          const commentParts: string[] = [];

          // Add column type
          commentParts.push(`@type ${column.columnType}`);

          // Add character max length
          if (column.characterMaximumLength) {
            commentParts.push(`@maxLength ${column.characterMaximumLength}`);
          }

          // Add numeric precision and scale
          if (column.numericPrecision !== null && column.numericPrecision !== undefined) {
            if (column.numericScale !== null && column.numericScale !== undefined) {
              commentParts.push(`@precision ${column.numericPrecision},${column.numericScale}`);
            } else {
              commentParts.push(`@precision ${column.numericPrecision}`);
            }
          }

          // Add default value
          if (column.columnDefault !== null) {
            commentParts.push(`@default ${column.columnDefault}`);
          }

          // Add extra info (auto_increment, etc.)
          if (column.extra) {
            commentParts.push(`@extra ${column.extra}`);
          }

          if (commentParts.length > 0) {
            lines.push(`    /** ${commentParts.join(' | ')} */`);
          }
        }

        lines.push(`    ${column.columnName}${optional}: ${tsType}${nullable};`);
      }

      lines.push(`  };`);
      lines.push('');
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Map SQL data types to TypeScript types
   */
  private mapSQLTypeToTypeScript(sqlType: string): string {
    const type = sqlType.toLowerCase();

    // UUID types
    if (type.includes('uuid')) {
      return 'string';
    }

    // Numeric types
    if (type.includes('int') || type.includes('decimal') || type.includes('float') ||
        type.includes('double') || type.includes('numeric')) {
      return 'number';
    }

    // String types
    if (type.includes('char') || type.includes('text') || type.includes('varchar') ||
        type.includes('binary') || type.includes('blob') || type.includes('enum') ||
        type.includes('set')) {
      return 'string';
    }

    // Date/Time types
    if (type.includes('date') || type.includes('time') || type.includes('year')) {
      return 'Date';
    }

    // Boolean
    if (type.includes('bool') || type.includes('bit')) {
      return 'boolean';
    }

    // JSON
    if (type.includes('json')) {
      return 'any';
    }

    // Default to any for unknown types
    return 'any';
  }

  /**
   * Generate schema with SmartDBWithTables type
   */
  generateCompleteSchema(options: GenerateSchemaOptions = {}): string {
    const interfaceName = options.interfaceName || 'DatabaseSchema';
    const interfaceCode = this.generateTypeScriptInterface(options);

    const lines: string[] = [];
    lines.push("import { SmartDBWithTables } from '@bhushanpawar/sqldb';");
    lines.push('');
    lines.push(interfaceCode);
    lines.push('');
    lines.push(`// Type for your database client`);
    lines.push(`export type DB = SmartDBWithTables<${interfaceName}>;`);

    return lines.join('\n');
  }

  /**
   * Generate schema with usage example
   */
  generateWithExample(options: GenerateSchemaOptions = {}): string {
    const schemaCode = this.generateCompleteSchema(options);

    const lines: string[] = [];
    lines.push(schemaCode);
    lines.push('');
    lines.push('/**');
    lines.push(' * Usage example:');
    lines.push(' *');
    lines.push(" * import { createSmartDB } from '@bhushanpawar/sqldb';");
    lines.push(' * import { DB } from "./db-schema";');
    lines.push(' *');
    lines.push(' * const db = await createSmartDB(config) as DB;');
    lines.push(' *');
    lines.push(' * // Now you have full type safety:');

    // Add example for first few tables
    const tables = this.client.getDiscoveredTables().slice(0, 3);
    for (const tableName of tables) {
      lines.push(` * const ${tableName} = await db.${tableName}.findMany();`);
    }

    lines.push(' */');

    return lines.join('\n');
  }
}
