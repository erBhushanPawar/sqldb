#!/usr/bin/env node

import { configDotenv } from 'dotenv';
import { createSmartDB } from '../index';
import * as fs from 'fs';
import * as path from 'path';

interface CliOptions {
  output?: string;
  interfaceName?: string;
  includeComments?: boolean;
  withExample?: boolean;
}

async function generateSchema(options: CliOptions = {}) {
  // Load .env from current directory
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env file not found in current directory');
    console.error('');
    console.error('Please create a .env file with the following variables:');
    console.error('  DB_HOST=localhost');
    console.error('  DB_PORT=3306');
    console.error('  DB_USER=root');
    console.error('  DB_PASSWORD=your_password');
    console.error('  DB_DATABASE=your_database');
    console.error('  REDIS_HOST=localhost');
    console.error('  REDIS_PORT=6379');
    process.exit(1);
  }

  configDotenv({ path: envPath });

  // Validate required env variables
  const required = ['DB_HOST', 'DB_USER', 'DB_DATABASE'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ Error: Missing required environment variables: ${missing.join(', ')}`);
    console.error('');
    console.error('Your .env file must contain:');
    console.error('  DB_HOST=localhost');
    console.error('  DB_PORT=3306');
    console.error('  DB_USER=root');
    console.error('  DB_PASSWORD=your_password');
    console.error('  DB_DATABASE=your_database');
    console.error('  REDIS_HOST=localhost (optional)');
    console.error('  REDIS_PORT=6379 (optional)');
    process.exit(1);
  }

  console.log('🔍 Connecting to database and discovering schema...\n');

  try {
    const config: any = {
      mariadb: {
        host: process.env.DB_HOST!,
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_DATABASE!,
        connectionLimit: 10,
      },
      cache: {
        enabled: !!process.env.REDIS_HOST,
      },
      discovery: {
        autoDiscover: true,
      },
      logging: {
        level: 'error',
      },
    };

    // Only add Redis config if REDIS_HOST is provided
    if (process.env.REDIS_HOST) {
      config.redis = {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        keyPrefix: 'schema_gen:',
      };
    }

    const db = await createSmartDB(config);

    const tables = db.getDiscoveredTables();
    console.log(`✅ Discovered ${tables.length} tables\n`);

    // Generate schema
    console.log('📝 Generating TypeScript schema...\n');

    const schema = db.generateSchema({
      interfaceName: options.interfaceName || 'DatabaseSchema',
      includeComments: options.includeComments !== false,
      nullableFields: true,
      withExample: options.withExample || false,
    });

    // Determine output path
    const outputPath = options.output || path.join(process.cwd(), 'db-schema.ts');
    fs.writeFileSync(outputPath, schema);

    console.log(`💾 Schema saved to: ${outputPath}\n`);

    // Show preview
    const lines = schema.split('\n');
    console.log('📄 Preview (first 30 lines):');
    console.log('─'.repeat(80));
    console.log(lines.slice(0, 30).join('\n'));
    if (lines.length > 30) {
      console.log(`\n... (${lines.length - 30} more lines)`);
    }
    console.log('─'.repeat(80));
    console.log('');

    // Show usage
    console.log('🚀 Next steps:\n');
    console.log('1. Import and use in your code:\n');
    console.log('   import { createSmartDB, SmartDBWithTables } from "@bhushanpawar/sqldb";');
    console.log('   import { DatabaseSchema } from "./db-schema";\n');
    console.log('   type DB = SmartDBWithTables<DatabaseSchema>;');
    console.log('   const db = await createSmartDB(config) as DB;\n');
    console.log('   // Full type safety!');
    const sampleTables = tables.slice(0, 3);
    for (const table of sampleTables) {
      console.log(`   const ${table} = await db.${table}.findMany();`);
    }
    console.log('');

    await db.close();
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log('');
    console.log('SmartDB CLI - Database Schema Generator');
    console.log('');
    console.log('Usage:');
    console.log('  npx @bhushanpawar/sqldb --generate-schema [options]');
    console.log('');
    console.log('Commands:');
    console.log('  --generate-schema    Generate TypeScript schema from database');
    console.log('');
    console.log('Options:');
    console.log('  --output <path>           Output file path (default: ./db-schema.ts)');
    console.log('  --interface <name>        Interface name (default: DatabaseSchema)');
    console.log('  --no-comments             Disable JSDoc comments');
    console.log('  --with-example            Include usage example');
    console.log('  --help, -h                Show this help message');
    console.log('');
    console.log('Environment Variables (.env file required):');
    console.log('  DB_HOST          MariaDB host (required)');
    console.log('  DB_PORT          MariaDB port (default: 3306)');
    console.log('  DB_USER          MariaDB user (required)');
    console.log('  DB_PASSWORD      MariaDB password');
    console.log('  DB_DATABASE      Database name (required)');
    console.log('  REDIS_HOST       Redis host (optional)');
    console.log('  REDIS_PORT       Redis port (default: 6379)');
    console.log('');
    console.log('Examples:');
    console.log('  # Generate schema with defaults');
    console.log('  npx @bhushanpawar/sqldb --generate-schema');
    console.log('');
    console.log('  # Generate with custom output path');
    console.log('  npx @bhushanpawar/sqldb --generate-schema --output src/types/db.ts');
    console.log('');
    console.log('  # Generate with custom interface name and example');
    console.log('  npx @bhushanpawar/sqldb --generate-schema --interface MyDB --with-example');
    console.log('');
    process.exit(0);
  }

  if (command === '--generate-schema') {
    const options: CliOptions = {};

    // Parse options
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case '--output':
          options.output = args[++i];
          break;
        case '--interface':
          options.interfaceName = args[++i];
          break;
        case '--no-comments':
          options.includeComments = false;
          break;
        case '--with-example':
          options.withExample = true;
          break;
        default:
          console.error(`Unknown option: ${arg}`);
          console.error('Run with --help to see available options');
          process.exit(1);
      }
    }

    await generateSchema(options);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run with --help to see available commands');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
