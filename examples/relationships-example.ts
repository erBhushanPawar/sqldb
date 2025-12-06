import { createSmartDB } from '../src/index';

async function relationshipsExample() {
  const db = await createSmartDB({
    mariadb: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'mydb',
    },
    redis: {
      host: 'localhost',
      port: 6379,
    },
    cache: {
      cascadeInvalidation: true, // Enable cascading invalidation
    },
    discovery: {
      autoDiscover: true,
    },
    logging: {
      level: 'debug',
    },
  });

  try {
    console.log('=== Cascading Invalidation Example ===\n');

    // Assume we have these tables with relationships:
    // users (id, name, email)
    // orders (id, user_id, total, status) -> FK to users.id
    // order_items (id, order_id, product, quantity) -> FK to orders.id

    // 1. Query orders (will be cached)
    console.log('1. Fetching orders...');
    const orders = await (db as any).orders.findMany({ status: 'pending' });
    console.log(`Found ${orders.length} pending orders\n`);

    // 2. Query order_items (will be cached)
    console.log('2. Fetching order items...');
    const items = await (db as any).order_items.findMany({ order_id: 1 });
    console.log(`Found ${items.length} items for order 1\n`);

    // 3. Update a user record
    console.log('3. Updating user...');
    await (db as any).users.updateById(1, { name: 'Updated Name' });

    // This will automatically invalidate:
    // - users:* cache entries
    // - orders:* cache entries (because orders.user_id -> users.id)
    // - order_items:* cache entries (because order_items.order_id -> orders.id)

    console.log('Cache invalidated for: users, orders, order_items\n');

    // 4. View dependency graph
    const graph = db.getDependencyGraph();
    const invalidationTargets = graph.getInvalidationTargets('users');
    console.log('Tables affected by users update:', invalidationTargets);

    const graphInfo = graph.getGraphInfo();
    console.log('Graph info:', graphInfo);
    console.log();

    // 5. Manual cascade control
    console.log('4. Update with custom invalidation...');

    // Update without cascading (only invalidate orders table)
    await db.getInvalidationManager().invalidateTable('orders', {
      cascade: false,
    });
    console.log('Invalidated only orders table (no cascade)\n');

    // 6. View all relationships
    const tables = db.getDiscoveredTables();
    console.log('All discovered tables:', tables);

    for (const table of tables) {
      const dependents = graph.getDependents(table);
      const dependencies = graph.getDependencies(table);

      if (dependents.length > 0 || dependencies.length > 0) {
        console.log(`\n${table}:`);
        if (dependencies.length > 0) {
          console.log(`  depends on: ${dependencies.join(', ')}`);
        }
        if (dependents.length > 0) {
          console.log(`  referenced by: ${dependents.join(', ')}`);
        }
      }
    }

  } finally {
    await db.close();
  }
}

// Run the example
if (require.main === module) {
  relationshipsExample().catch(console.error);
}

export { relationshipsExample };
