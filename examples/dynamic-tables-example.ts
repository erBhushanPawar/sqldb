import { configDotenv } from "dotenv";
import { createSqlDB, SqlDBClient } from "../src";
import { TableOperations } from "../src/types/query";

// Extend SqlDBClient with dynamic table accessors
type SqlDBWithTables = SqlDBClient & {
    [tableName: string]: TableOperations<any>;
};

async function dynamicTablesExample() {
    configDotenv();
    const dbConfigStr = process.env.DB_CONFIG;
    if (!dbConfigStr) {
        throw new Error('DB_CONFIG not found in .env file');
    }

    const dbConfig = JSON.parse(dbConfigStr);

    console.log('=== Dynamic Table Access Example ===\n');

    const db = await createSqlDB({
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
            keyPrefix: 'dynamic_test:',
        },
        cache: {
            enabled: true,
            defaultTTL: 300,
        },
        discovery: {
            autoDiscover: true,
        },
        logging: {
            level: 'error',
        },
    }) as SqlDBWithTables;

    console.log('Database initialized with dynamic table access\n');

    // Example 1: Old way (still works)
    console.log('1. Old way: db.getTableOperations("provider")');
    const providerTable1 = db.getTableOperations('provider');
    const providers1 = await providerTable1.findMany({}, { limit: 3 });
    console.log(`   Found ${providers1.length} providers\n`);

    // Example 2: New way - Direct property access
    console.log('2. New way: db.provider (dynamic property)');
    const providers2 = await (db as any).provider.findMany({}, { limit: 3 });
    console.log(`   Found ${providers2.length} providers\n`);

    // Example 3: Multiple tables
    console.log('3. Accessing multiple tables dynamically');

    const orders = await (db as any).orders.findMany({}, { limit: 5 });
    console.log(`   - db.orders: Found ${orders.length} orders`);

    const services = await (db as any).services.findMany({}, { limit: 5 });
    console.log(`   - db.services: Found ${services.length} services`);

    const bankDetails = await (db as any).bank_details.findMany({}, { limit: 5 });
    console.log(`   - db.bank_details: Found ${bankDetails.length} bank details\n`);

    // Example 4: CRUD operations with dynamic access
    console.log('4. CRUD operations with dynamic access');

    // Find one
    const provider = await (db as any).provider.findOne({}, {});
    if (provider) {
        console.log(`   - findOne: ${(provider as any).provider_id}`);

        // Update
        const updated = await (db as any).provider.updateOne(
            { provider_id: (provider as any).provider_id },
            { updated_on: new Date() }
        );
        console.log(`   - updateOne: Updated provider`);

        // Find by ID
        const found = await (db as any).provider.findById((provider as any).provider_id);
        console.log(`   - findById: Found ${found ? 'yes' : 'no'}\n`);
    }

    // Example 5: Using with relations
    console.log('5. Using withRelations with dynamic access');
    const providerWithRelations = await (db as any).provider.findOne({}, {
        withRelations: {
            dependents: ['services', 'orders'],
            dependencies: false
        },
        limit: 1
    });

    if (providerWithRelations) {
        const relatedServices = (providerWithRelations as any).services || [];
        const relatedOrders = (providerWithRelations as any).orders || [];
        console.log(`   - Provider with ${relatedServices.length} services and ${relatedOrders.length} orders\n`);
    }

    // Example 6: Cache stats
    console.log('6. Cache statistics');
    const stats = db.getCacheManager().getStats();
    console.log(`   - Hits: ${stats.hits}`);
    console.log(`   - Misses: ${stats.misses}`);
    console.log(`   - Hit Rate: ${stats.hitRate}\n`);

    // Example 7: Discovered tables
    console.log('7. All discovered tables (accessible as properties):');
    const tables = db.getDiscoveredTables();
    console.log(`   ${tables.slice(0, 10).join(', ')}...`);
    console.log(`   (${tables.length} total tables)\n`);

    await db.close();

    console.log('=== Benefits of Dynamic Table Access ===');
    console.log('✓ Cleaner syntax: db.users instead of db.getTableOperations("users")');
    console.log('✓ More intuitive: Feels like working with objects');
    console.log('✓ Less verbose: Shorter code, easier to read');
    console.log('✓ Backwards compatible: Old method still works');
    console.log('✓ TypeScript friendly: Can be typed with custom interfaces');
}

dynamicTablesExample().catch(console.error);
