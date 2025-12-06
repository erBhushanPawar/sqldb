import { createSmartDB } from '../src/index';

async function hooksExample() {
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
    logging: {
      level: 'info',
    },
  });

  try {
    console.log('=== Hooks Example ===\n');

    // === BEFORE HOOKS (Transform data before operation) ===

    // 1. Auto-add timestamps on insert
    db.hooks.registerBefore('users', 'insertOne', (data) => {
      console.log('[Before Hook] Adding timestamp to new user');
      return {
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
      };
    });

    // 2. Hash password before inserting
    db.hooks.registerBefore('users', 'insertOne', (data) => {
      if (data.password) {
        console.log('[Before Hook] Hashing password');
        // In real app, use bcrypt
        data.password = `hashed_${data.password}`;
      }
      return data;
    });

    // 3. Validate email format
    db.hooks.registerBefore('users', 'insertOne', (data) => {
      if (data.email && !data.email.includes('@')) {
        throw new Error('Invalid email format');
      }
      return data;
    });

    // 4. Auto-update timestamp on update
    db.hooks.registerBefore('users', 'updateOne', (data) => {
      console.log('[Before Hook] Updating timestamp');
      return {
        ...data,
        updated_at: new Date(),
      };
    });

    db.hooks.registerBefore('users', 'updateById', (data) => {
      return {
        ...data,
        updated_at: new Date(),
      };
    });

    // === AFTER HOOKS (Side effects after operation) ===

    // 1. Audit logging
    db.hooks.registerAfter('users', 'insertOne', (result) => {
      console.log('[After Hook] User created - Logging to audit table', {
        userId: result.id,
        action: 'create',
        timestamp: new Date(),
      });
    });

    db.hooks.registerAfter('users', 'updateOne', (result, where, data) => {
      console.log('[After Hook] User updated - Logging to audit table', {
        userId: result?.id,
        action: 'update',
        changes: data,
        timestamp: new Date(),
      });
    });

    db.hooks.registerAfter('users', 'deleteOne', (result, where) => {
      console.log('[After Hook] User deleted - Logging to audit table', {
        where,
        action: 'delete',
        timestamp: new Date(),
      });
    });

    // 2. Send notification email
    db.hooks.registerAfter('users', 'insertOne', async (result) => {
      console.log('[After Hook] Sending welcome email to', result.email);
      // In real app: await sendEmail(result.email, 'Welcome!');
    });

    // 3. Trigger external webhook
    db.hooks.registerAfter('orders', 'insertOne', async (result) => {
      console.log('[After Hook] Notifying external system of new order', result.id);
      // In real app: await fetch('https://webhook.site/...', { method: 'POST', body: JSON.stringify(result) });
    });

    // === TEST THE HOOKS ===

    console.log('\n--- Testing Hooks ---\n');

    // This will trigger:
    // - 3 before hooks (timestamp, password hash, email validation)
    // - 2 after hooks (audit log, welcome email)
    const newUser = await (db as any).users.insertOne({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123',
    });

    console.log('\nCreated user:', newUser);
    console.log();

    // This will trigger:
    // - 1 before hook (timestamp)
    // - 1 after hook (audit log)
    const updated = await (db as any).users.updateById(newUser.id, {
      name: 'John Smith',
    });

    console.log('Updated user:', updated);
    console.log();

    // === VIEW REGISTERED HOOKS ===
    const registeredHooks = db.hooks.getRegisteredHooks();
    console.log('Registered hooks:', registeredHooks);

    // === CLEAR HOOKS ===
    // db.hooks.clearHooks('users', 'before', 'insertOne'); // Clear specific hook
    // db.hooks.clearHooks('users'); // Clear all hooks for users table
    // db.hooks.clearHooks(); // Clear all hooks

  } finally {
    await db.close();
  }
}

// Run the example
if (require.main === module) {
  hooksExample().catch(console.error);
}

export { hooksExample };
