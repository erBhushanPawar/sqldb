import { createSmartDB } from '../src/index';

async function basicUsageExample() {
  // Initialize the smart cache client
  const db = await createSmartDB({
    mariadb: {
      host: 'localhost',
      user: 'root',
      password: 'password',
      database: 'mydb',
      logging: true,
    },
    redis: {
      host: 'localhost',
      port: 6379,
    },
    cache: {
      enabled: true,
      defaultTTL: 60, // 60 seconds
      maxKeys: 1000,
      invalidateOnWrite: true,
      cascadeInvalidation: true,
    },
    discovery: {
      autoDiscover: true,
      refreshInterval: 0, // manual refresh only
    },
    logging: {
      level: 'info',
    },
  });

  try {
    // === READ OPERATIONS (Cache-first) ===

    // Find one user
    const user = await (db as any).users.findOne({ email: 'john@example.com' });
    console.log('User:', user);

    // Find many users with options
    const activeUsers = await (db as any).users.findMany(
      { status: 'active' },
      { limit: 10, orderBy: { column: 'created_at', direction: 'DESC' } }
    );
    console.log('Active users:', activeUsers.length);

    // Find by ID (optimized cache key)
    const userById = await (db as any).users.findById(1);
    console.log('User by ID:', userById);

    // Count records
    const userCount = await (db as any).users.count({ status: 'active' });
    console.log('Active user count:', userCount);

    // === WRITE OPERATIONS (Auto-invalidates cache) ===

    // Insert one record
    const newUser = await (db as any).users.insertOne({
      name: 'Jane Doe',
      email: 'jane@example.com',
      status: 'active',
    });
    console.log('New user created:', newUser);

    // Insert many records
    const newUsers = await (db as any).users.insertMany([
      { name: 'Alice', email: 'alice@example.com', status: 'active' },
      { name: 'Bob', email: 'bob@example.com', status: 'inactive' },
    ]);
    console.log('Created', newUsers.length, 'users');

    // Update one record
    const updated = await (db as any).users.updateOne(
      { email: 'jane@example.com' },
      { status: 'verified' }
    );
    console.log('Updated user:', updated);

    // Update by ID
    const updatedById = await (db as any).users.updateById(1, {
      last_login: new Date(),
    });
    console.log('Updated user by ID:', updatedById);

    // Update many records
    const updateCount = await (db as any).users.updateMany(
      { status: 'inactive' },
      { status: 'archived' }
    );
    console.log('Updated', updateCount, 'users');

    // Delete one record
    const deleted = await (db as any).users.deleteOne({ email: 'test@example.com' });
    console.log('Deleted:', deleted);

    // Delete by ID
    const deletedById = await (db as any).users.deleteById(999);
    console.log('Deleted by ID:', deletedById);

    // === RAW SQL (Bypass cache) ===
    const customQuery = await (db as any).users.raw(
      'SELECT COUNT(*) as total FROM users WHERE created_at > ?',
      [new Date('2024-01-01')]
    );
    console.log('Custom query result:', customQuery);

    // === CACHE MANAGEMENT ===

    // Get cache statistics
    const stats = db.getCacheManager().getStats();
    console.log('Cache stats:', stats);

    // Manually invalidate cache for a table
    await (db as any).users.invalidateCache();

    // Warm cache (pre-populate for common queries)
    await (db as any).users.warmCache({ status: 'active' });

    // === HEALTH CHECK ===
    const health = await db.healthCheck();
    console.log('Health:', health);

    // === DISCOVERED TABLES ===
    const tables = db.getDiscoveredTables();
    console.log('Discovered tables:', tables);

  } finally {
    // Close connections
    await db.close();
  }
}

// Run the example
if (require.main === module) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };
