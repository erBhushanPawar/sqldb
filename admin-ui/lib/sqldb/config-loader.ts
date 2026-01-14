/**
 * Configuration loader for SqlDB
 * Supports loading configs from multiple sources with precedence:
 * 1. Environment variable SQLDB_CONFIG_PATH (custom path)
 * 2. .sqldb/config.json (default location)
 * 3. Legacy .sqldb/search-configs.json (backwards compatibility)
 */

import fs from 'fs';
import path from 'path';

export interface GeoSearchConfig {
  enabled: boolean;
  latitudeField: string;
  longitudeField: string;
  locationNameField?: string;
}

export interface SearchFieldConfig {
  field: string;
  boost: number;
}

export interface TableSearchConfig {
  table: string;
  tokenizer?: 'simple' | 'stemming' | 'aggressive';
  minWordLength?: number;
  searchableFields: SearchFieldConfig[];
  geo?: GeoSearchConfig;
  updatedAt?: string;
}

export interface SqlDBConfigFile {
  // Global defaults
  defaults?: {
    tokenizer?: 'simple' | 'stemming' | 'aggressive';
    minWordLength?: number;
    cache?: {
      enabled?: boolean;
      defaultTTL?: number;
    };
    search?: {
      enabled?: boolean;
    };
  };

  // Table-specific configurations
  tables: {
    [tableName: string]: TableSearchConfig;
  };
}

/**
 * Get the config file path based on environment variable or default
 */
export function getConfigPath(): string {
  // Check for custom path in environment
  const customPath = process.env.SQLDB_CONFIG_PATH;
  if (customPath) {
    const resolvedPath = path.isAbsolute(customPath)
      ? customPath
      : path.join(process.cwd(), customPath);

    if (fs.existsSync(resolvedPath)) {
      console.log(`📁 Using custom SqlDB config from: ${resolvedPath}`);
      return resolvedPath;
    } else {
      console.warn(`⚠️  Custom config path not found: ${resolvedPath}`);
    }
  }

  // Default location
  const defaultPath = path.join(process.cwd(), '.sqldb', 'config.json');
  return defaultPath;
}

/**
 * Load configuration from file
 */
export function loadConfig(): SqlDBConfigFile {
  const configPath = getConfigPath();

  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(data) as SqlDBConfigFile;

      console.log(`📂 Loaded SqlDB configuration from: ${configPath}`);
      console.log(`   - Tables configured: ${Object.keys(config.tables || {}).length}`);
      console.log(`   - Defaults: ${config.defaults ? 'Yes' : 'No'}`);

      return config;
    }
  } catch (error) {
    console.error(`❌ Failed to load config from ${configPath}:`, error);
  }

  // Try legacy location for backwards compatibility
  const legacyPath = path.join(process.cwd(), '.sqldb', 'search-configs.json');
  if (fs.existsSync(legacyPath)) {
    try {
      console.log(`📂 Migrating from legacy config: ${legacyPath}`);
      const data = fs.readFileSync(legacyPath, 'utf-8');
      const legacyConfig = JSON.parse(data);

      // Convert legacy format to new format
      const newConfig: SqlDBConfigFile = {
        tables: legacyConfig,
      };

      // Save in new format
      saveConfig(newConfig);

      console.log(`✅ Migrated legacy config to new format`);
      return newConfig;
    } catch (error) {
      console.error(`❌ Failed to migrate legacy config:`, error);
    }
  }

  // Return empty config
  console.log(`ℹ️  No configuration file found, using empty config`);
  return { tables: {} };
}

/**
 * Save configuration to file
 */
export function saveConfig(config: SqlDBConfigFile): void {
  const configPath = getConfigPath();

  try {
    // Ensure directory exists
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // Write to file with pretty formatting
    fs.writeFileSync(
      configPath,
      JSON.stringify(config, null, 2),
      'utf-8'
    );

    console.log(`💾 Saved SqlDB configuration to: ${configPath}`);
  } catch (error) {
    console.error(`❌ Failed to save config to ${configPath}:`, error);
    throw error;
  }
}

/**
 * Update a single table's configuration
 */
export function updateTableConfig(
  tableName: string,
  tableConfig: TableSearchConfig
): void {
  const config = loadConfig();

  config.tables[tableName] = {
    ...tableConfig,
    updatedAt: new Date().toISOString(),
  };

  saveConfig(config);
}

/**
 * Delete a table's configuration
 */
export function deleteTableConfig(tableName: string): void {
  const config = loadConfig();

  delete config.tables[tableName];

  saveConfig(config);
}

/**
 * Get configuration for a specific table with defaults applied
 */
export function getTableConfig(
  tableName: string,
  config?: SqlDBConfigFile
): TableSearchConfig | null {
  const cfg = config || loadConfig();
  const tableConfig = cfg.tables[tableName];

  if (!tableConfig) {
    return null;
  }

  // Apply defaults
  return {
    ...tableConfig,
    tokenizer: tableConfig.tokenizer || cfg.defaults?.tokenizer || 'stemming',
    minWordLength: tableConfig.minWordLength ?? cfg.defaults?.minWordLength ?? 3,
  };
}

/**
 * Create a sample configuration file
 */
export function createSampleConfig(): void {
  const sampleConfig: SqlDBConfigFile = {
    defaults: {
      tokenizer: 'stemming',
      minWordLength: 3,
      cache: {
        enabled: true,
        defaultTTL: 3600,
      },
      search: {
        enabled: true,
      },
    },
    tables: {
      // Example table configuration
      example_table: {
        table: 'example_table',
        tokenizer: 'stemming',
        minWordLength: 3,
        searchableFields: [
          {
            field: 'title',
            boost: 2.0,
          },
          {
            field: 'description',
            boost: 1.0,
          },
        ],
        geo: {
          enabled: true,
          latitudeField: 'latitude',
          longitudeField: 'longitude',
          locationNameField: 'city',
        },
      },
    },
  };

  saveConfig(sampleConfig);
  console.log(`✅ Created sample configuration file`);
}

/**
 * Validate configuration
 */
export function validateConfig(config: SqlDBConfigFile): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate each table config
  for (const [tableName, tableConfig] of Object.entries(config.tables)) {
    if (!tableConfig.searchableFields || tableConfig.searchableFields.length === 0) {
      errors.push(`Table '${tableName}': No searchable fields defined`);
    }

    // Validate geo config if enabled
    if (tableConfig.geo?.enabled) {
      if (!tableConfig.geo.latitudeField) {
        errors.push(`Table '${tableName}': latitudeField is required when geo is enabled`);
      }
      if (!tableConfig.geo.longitudeField) {
        errors.push(`Table '${tableName}': longitudeField is required when geo is enabled`);
      }
    }

    // Validate field boosts
    for (const fieldConfig of tableConfig.searchableFields) {
      if (!fieldConfig.field) {
        errors.push(`Table '${tableName}': Field name is required`);
      }
      if (fieldConfig.boost < 0) {
        errors.push(`Table '${tableName}': Field boost must be >= 0`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
