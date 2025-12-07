import { configDotenv } from "dotenv";
import { createSmartDB } from "../src";
import * as fs from "fs";
import * as path from "path";

async function generateSchema() {
    configDotenv();
    const dbConfigStr = process.env.DB_CONFIG;
    if (!dbConfigStr) {
        throw new Error('DB_CONFIG not found in .env file');
    }

    const dbConfig = JSON.parse(dbConfigStr);

    console.log('🔍 Connecting to database and discovering schema...\n');

    const db = await createSmartDB({
        mariadb: {
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
            connectionLimit: 10,
        },
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            keyPrefix: 'schema_gen:',
        },
        cache: {
            enabled: true,
        },
        discovery: {
            autoDiscover: true,
        },
        logging: {
            level: 'error',
        },
    });

    console.log(`✅ Discovered ${db.getDiscoveredTables().length} tables\n`);

    // Generate schema with different options
    console.log('📝 Generating TypeScript schema...\n');

    // Option 1: Basic schema
    console.log('1️⃣  Basic schema (no comments)');
    const basicSchema = db.generateSchema({
        interfaceName: 'DatabaseSchema',
        includeComments: false,
        nullableFields: true,
    });
    console.log(`   Generated ${basicSchema.split('\n').length} lines\n`);

    // Option 2: Schema with comments
    console.log('2️⃣  Schema with comments');
    const commentedSchema = db.generateSchema({
        interfaceName: 'DatabaseSchema',
        includeComments: true,
        nullableFields: true,
    });
    console.log(`   Generated ${commentedSchema.split('\n').length} lines\n`);

    // Option 3: Schema with example
    console.log('3️⃣  Schema with usage example');
    const schemaWithExample = db.generateSchema({
        interfaceName: 'MyDatabaseSchema',
        includeComments: true,
        nullableFields: true,
        withExample: true,
    });
    console.log(`   Generated ${schemaWithExample.split('\n').length} lines\n`);

    // Save to file
    const outputPath = path.join(__dirname, 'generated-schema.ts');
    fs.writeFileSync(outputPath, schemaWithExample);

    console.log(`💾 Saved schema to: ${outputPath}\n`);

    // Show preview
    console.log('📄 Preview (first 50 lines):');
    console.log('─'.repeat(80));
    const lines = schemaWithExample.split('\n');
    console.log(lines.slice(0, 50).join('\n'));
    if (lines.length > 50) {
        console.log(`\n... (${lines.length - 50} more lines)`);
    }
    console.log('─'.repeat(80));
    console.log('');

    // Show usage instructions
    console.log('🚀 Next steps:');
    console.log('');
    console.log('1. Copy the generated file to your project:');
    console.log(`   cp ${outputPath} src/db-schema.ts`);
    console.log('');
    console.log('2. Import and use in your code:');
    console.log('');
    console.log('   import { createSmartDB } from "@bhushanpawar/sqldb";');
    console.log('   import { DB } from "./db-schema";');
    console.log('');
    console.log('   const db = await createSmartDB(config) as DB;');
    console.log('');
    console.log('   // Full type safety!');
    const sampleTables = db.getDiscoveredTables().slice(0, 3);
    for (const table of sampleTables) {
        console.log(`   const ${table} = await db.${table}.findMany();`);
    }
    console.log('');

    await db.close();
}

generateSchema().catch(console.error);
