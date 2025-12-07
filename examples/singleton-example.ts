import { configDotenv } from "dotenv";
import { createSmartDB, getSmartDB, clearSmartDBSingleton } from "../src";

async function singletonExample() {
    configDotenv();
    const dbConfigStr = process.env.DB_CONFIG;
    if (!dbConfigStr) {
        throw new Error('DB_CONFIG not found in .env file');
    }

    const dbConfig = JSON.parse(dbConfigStr);

    console.log('=== Singleton Pattern Example ===\n');

    // Example 1: Initialize singleton
    console.log('1. Creating singleton instance...');
    const db1 = await createSmartDB({
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
            keyPrefix: 'singleton_test:',
        },
        cache: {
            enabled: true,
            defaultTTL: 300,
        },
        discovery: {
            autoDiscover: false, // Skip for faster demo
        },
        logging: {
            level: 'error',
        },
    }, { singleton: true }); // Enable singleton mode

    console.log('✓ Singleton instance created\n');

    // Example 2: Try to create another instance (should return same instance)
    console.log('2. Attempting to create another instance...');
    const db2 = await createSmartDB({
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
            keyPrefix: 'singleton_test:',
        },
        cache: {
            enabled: true,
            defaultTTL: 300,
        },
        discovery: {
            autoDiscover: false,
        },
        logging: {
            level: 'error',
        },
    }, { singleton: true });

    console.log(`✓ Same instance returned: ${db1 === db2}`);
    console.log(`  db1 instance ID: ${(db1 as any).constructor.name}`);
    console.log(`  db2 instance ID: ${(db2 as any).constructor.name}\n`);

    // Example 3: Get singleton instance anywhere in your app
    console.log('3. Getting singleton instance using getSmartDB()...');
    const db3 = getSmartDB();
    console.log(`✓ Same instance retrieved: ${db1 === db3}\n`);

    // Example 4: Use the singleton
    console.log('4. Using singleton to query database...');
    const providerTable = db3.getTableOperations('provider');
    const providers = await providerTable.findMany({}, { limit: 5 });
    console.log(`✓ Found ${providers.length} providers\n`);

    // Example 5: Non-singleton mode (for comparison)
    console.log('5. Creating non-singleton instance...');
    const db4 = await createSmartDB({
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
            keyPrefix: 'non_singleton:',
        },
        cache: {
            enabled: true,
            defaultTTL: 300,
        },
        discovery: {
            autoDiscover: false,
        },
        logging: {
            level: 'error',
        },
    }); // No singleton option = new instance

    console.log(`✓ Different instance created: ${db1 !== db4}\n`);

    // Example 6: Clear singleton (useful for testing)
    console.log('6. Clearing singleton instance...');
    clearSmartDBSingleton();
    console.log('✓ Singleton cleared');

    try {
        getSmartDB();
        console.log('❌ Should have thrown an error');
    } catch (error) {
        console.log(`✓ Correct error thrown: ${(error as Error).message}\n`);
    }

    // Cleanup
    await db1.close();
    await db4.close();

    console.log('=== Benefits of Singleton Pattern ===');
    console.log('✓ Single database connection pool (prevents connection exhaustion)');
    console.log('✓ Shared cache across application');
    console.log('✓ Lower memory footprint');
    console.log('✓ Easy access from anywhere with getSmartDB()');
    console.log('✓ Prevents duplicate schema discovery');
}

singletonExample().catch(console.error);
