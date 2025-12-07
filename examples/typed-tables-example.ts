import { configDotenv } from "dotenv";
import { createSqlDB, SqlDBWithTables } from "../src";

// Define your database schema with proper types
interface DatabaseSchema {
    provider: {
        provider_id: string;
        business_name: string;
        email: string;
        mobile_number: string;
        created_on: Date;
        updated_on: Date;
    };
    orders: {
        id: number;
        provider_id: string;
        order_date: Date;
        total_amount: number;
        status: string;
    };
    services: {
        id: number;
        provider_id: string;
        service_name: string;
        price: number;
        duration_minutes: number;
    };
    bank_details: {
        id: number;
        provider_id: string;
        account_number: string;
        bank_name: string;
        ifsc_code: string;
    };
}

// Type your database client with your schema
type MyDatabase = SqlDBWithTables<DatabaseSchema>;

async function typedTablesExample() {
    configDotenv();
    const dbConfigStr = process.env.DB_CONFIG;
    if (!dbConfigStr) {
        throw new Error('DB_CONFIG not found in .env file');
    }

    const dbConfig = JSON.parse(dbConfigStr);

    console.log('=== Typed Dynamic Table Access Example ===\n');

    // Create database with proper typing
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
            keyPrefix: 'typed_test:',
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
    }) as MyDatabase;

    console.log('Database initialized with typed table access\n');

    // Example 1: Type-safe provider access
    console.log('1. Type-safe provider operations');
    const providers = await db.provider.findMany({}, { limit: 3 });
    // TypeScript knows providers is: DatabaseSchema['provider'][]

    if (providers.length > 0) {
        console.log(`   - Found ${providers.length} providers`);
        console.log(`   - First provider: ${providers[0].business_name}`);
        console.log(`   - Email: ${providers[0].email}\n`);
    }

    // Example 2: Type-safe orders
    console.log('2. Type-safe orders');
    const orders = await db.orders.findMany({}, { limit: 5 });
    // TypeScript knows orders is: DatabaseSchema['orders'][]

    console.log(`   - Found ${orders.length} orders`);
    if (orders.length > 0) {
        console.log(`   - First order total: $${orders[0].total_amount}`);
        console.log(`   - Status: ${orders[0].status}\n`);
    }

    // Example 3: Type-safe services
    console.log('3. Type-safe services');
    const services = await db.services.findMany({}, { limit: 5 });
    // TypeScript knows services is: DatabaseSchema['services'][]

    console.log(`   - Found ${services.length} services`);
    if (services.length > 0) {
        console.log(`   - Service: ${services[0].service_name}`);
        console.log(`   - Price: $${services[0].price}`);
        console.log(`   - Duration: ${services[0].duration_minutes} minutes\n`);
    }

    // Example 4: Type-safe updates
    console.log('4. Type-safe updates');
    if (providers.length > 0) {
        const updated = await db.provider.updateOne(
            { provider_id: providers[0].provider_id },
            { updated_on: new Date() } // TypeScript validates this matches DatabaseSchema['provider']
        );
        console.log(`   - Updated provider: ${updated ? 'success' : 'failed'}\n`);
    }

    // Example 5: Type-safe findOne with relations
    console.log('5. Type-safe findOne with relations');
    const providerWithRelations = await db.provider.findOne({}, {
        withRelations: {
            dependents: ['services', 'orders', 'bank_details'],
            dependencies: false
        },
        limit: 1
    });

    if (providerWithRelations) {
        console.log(`   - Provider: ${providerWithRelations.business_name}`);

        // Access related data (TypeScript knows the structure)
        const relatedServices = (providerWithRelations as any).services as DatabaseSchema['services'][];
        const relatedOrders = (providerWithRelations as any).orders as DatabaseSchema['orders'][];
        const relatedBankDetails = (providerWithRelations as any).bank_details as DatabaseSchema['bank_details'][];

        console.log(`   - Services: ${relatedServices?.length || 0}`);
        console.log(`   - Orders: ${relatedOrders?.length || 0}`);
        console.log(`   - Bank details: ${relatedBankDetails?.length || 0}\n`);
    }

    // Example 6: Type-safe count
    console.log('6. Type-safe count operations');
    const providerCount = await db.provider.count({});
    const serviceCount = await db.services.count({});
    const orderCount = await db.orders.count({});

    console.log(`   - Total providers: ${providerCount}`);
    console.log(`   - Total services: ${serviceCount}`);
    console.log(`   - Total orders: ${orderCount}\n`);

    // Example 7: Still have access to original methods
    console.log('7. Original methods still work');
    const providerTable = db.getTableOperations<DatabaseSchema['provider']>('provider');
    const provider = await providerTable.findOne({}, {});
    console.log(`   - Using getTableOperations: ${provider ? 'success' : 'failed'}\n`);

    await db.close();

    console.log('=== Benefits of Typed Dynamic Access ===');
    console.log('✓ Full TypeScript autocomplete for table names');
    console.log('✓ Type-safe field access on returned data');
    console.log('✓ Compile-time errors for invalid table names');
    console.log('✓ Better IDE support with IntelliSense');
    console.log('✓ No need for `as any` casts');
    console.log('✓ Schema serves as documentation');
}

typedTablesExample().catch(console.error);
