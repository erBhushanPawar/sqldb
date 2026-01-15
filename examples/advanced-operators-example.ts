/**
 * Advanced Query Operators Example
 *
 * This example demonstrates the new Prisma-style operators introduced in v1.1.0
 *
 * Run with: npx ts-node examples/advanced-operators-example.ts
 */

import { SqlDbClient } from '../src/client';

async function main() {
  const db = new SqlDbClient({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'test_db',
    redis: {
      host: 'localhost',
      port: 6379
    }
  });

  await db.connect();

  console.log('='.repeat(60));
  console.log('Advanced Query Operators Example');
  console.log('='.repeat(60));

  // ============================================================================
  // 1. Comparison Operators
  // ============================================================================
  console.log('\n1. Comparison Operators');
  console.log('-'.repeat(60));

  // Greater than / Less than
  console.log('\nAdult users (age >= 18 and age <= 65):');
  const adults = await db.users.findMany({
    age: { gte: 18, lte: 65 }
  });
  console.log(`Found ${adults.length} adult users`);

  // ============================================================================
  // 2. String Operators
  // ============================================================================
  console.log('\n2. String Operators');
  console.log('-'.repeat(60));

  // Contains
  console.log('\nUsers with @example.com email:');
  const exampleUsers = await db.users.findMany({
    email: { contains: '@example.com' }
  });
  console.log(`Found ${exampleUsers.length} users`);

  // Case-insensitive search
  console.log('\nUsers with names starting with "john" (case-insensitive):');
  const johns = await db.users.findMany({
    name: { startsWith: 'john', mode: 'insensitive' }
  });
  console.log(`Found ${johns.length} users`);

  // ============================================================================
  // 3. Array Operators
  // ============================================================================
  console.log('\n3. Array Operators (IN / NOT IN)');
  console.log('-'.repeat(60));

  // IN operator
  console.log('\nActive or verified users:');
  const activeUsers = await db.users.findMany({
    status: { in: ['active', 'verified'] }
  });
  console.log(`Found ${activeUsers.length} users`);

  // NOT IN operator
  console.log('\nUsers not banned or suspended:');
  const goodStandingUsers = await db.users.findMany({
    status: { notIn: ['banned', 'suspended'] }
  });
  console.log(`Found ${goodStandingUsers.length} users`);

  // ============================================================================
  // 4. Null Operators
  // ============================================================================
  console.log('\n4. Null Operators');
  console.log('-'.repeat(60));

  // Check for null
  console.log('\nUsers not deleted (deletedAt IS NULL):');
  const activeNonDeleted = await db.users.findMany({
    deletedAt: { isNull: true }
  });
  console.log(`Found ${activeNonDeleted.length} users`);

  // Check for not null
  console.log('\nUsers with profile picture:');
  const usersWithAvatar = await db.users.findMany({
    avatarUrl: { isNotNull: true }
  });
  console.log(`Found ${usersWithAvatar.length} users`);

  // ============================================================================
  // 5. Logical Operators (OR / AND / NOT)
  // ============================================================================
  console.log('\n5. Logical Operators');
  console.log('-'.repeat(60));

  // OR operator
  console.log('\nPremium users OR users with credits:');
  const eligibleUsers = await db.users.findMany({
    OR: [
      { isPremium: true },
      { credits: { gt: 0 } }
    ]
  });
  console.log(`Found ${eligibleUsers.length} eligible users`);

  // Complex nested logic
  console.log('\nActive adult users from specific domains:');
  const targetUsers = await db.users.findMany({
    age: { gte: 18 },
    status: 'active',
    OR: [
      { email: { endsWith: '@company.com' } },
      { email: { endsWith: '@partner.com' } }
    ]
  });
  console.log(`Found ${targetUsers.length} target users`);

  // NOT operator
  console.log('\nUsers NOT banned:');
  const nonBannedUsers = await db.users.findMany({
    NOT: [
      { status: 'banned' }
    ]
  });
  console.log(`Found ${nonBannedUsers.length} non-banned users`);

  // ============================================================================
  // 6. Complex Real-World Query
  // ============================================================================
  console.log('\n6. Complex Real-World Query');
  console.log('-'.repeat(60));

  console.log('\nFind users matching complex criteria:');
  console.log('- Status: active or verified');
  console.log('- Age: 18-65');
  console.log('- Not deleted');
  console.log('- Either: from @example.com OR premium with 100+ credits');

  const complexResults = await db.users.findMany({
    status: { in: ['active', 'verified'] },
    age: { gte: 18, lte: 65 },
    deletedAt: { isNull: true },
    OR: [
      { email: { endsWith: '@example.com' } },
      {
        AND: [
          { isPremium: true },
          { credits: { gte: 100 } }
        ]
      }
    ]
  });
  console.log(`Found ${complexResults.length} users matching all criteria`);

  // ============================================================================
  // 7. Date Operators
  // ============================================================================
  console.log('\n7. Date Operators');
  console.log('-'.repeat(60));

  // Users created this year
  const startOfYear = new Date('2024-01-01');
  console.log('\nUsers created in 2024:');
  const recentUsers = await db.users.findMany({
    createdAt: { gte: startOfYear }
  });
  console.log(`Found ${recentUsers.length} users`);

  // Date range
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');
  console.log('\nUsers created between Jan-Dec 2024:');
  const yearUsers = await db.users.findMany({
    createdAt: {
      gte: startDate,
      lte: endDate
    }
  });
  console.log(`Found ${yearUsers.length} users`);

  // ============================================================================
  // 8. Backward Compatibility
  // ============================================================================
  console.log('\n8. Backward Compatibility (Legacy Syntax)');
  console.log('-'.repeat(60));

  // Old $ operators still work
  console.log('\nUsing legacy $gt operator:');
  const legacyResults = await db.users.findMany({
    age: { $gt: 18 }
  });
  console.log(`Found ${legacyResults.length} users (legacy syntax)`);

  // Legacy array syntax
  console.log('\nUsing legacy array syntax for IN:');
  const legacyArrayResults = await db.users.findMany({
    status: ['active', 'verified']
  });
  console.log(`Found ${legacyArrayResults.length} users (legacy array syntax)`);

  // Mix old and new
  console.log('\nMixing old and new syntax:');
  const mixedResults = await db.users.findMany({
    age: { gte: 18 },      // New style
    score: { $gt: 100 }    // Old style
  });
  console.log(`Found ${mixedResults.length} users (mixed syntax)`);

  // ============================================================================
  // 9. Comparison with Simple Queries
  // ============================================================================
  console.log('\n9. Performance Comparison');
  console.log('-'.repeat(60));

  // Simple query
  console.time('Simple query');
  const simple = await db.users.findMany({
    status: 'active'
  });
  console.timeEnd('Simple query');
  console.log(`Results: ${simple.length} users`);

  // Complex query
  console.time('Complex query');
  const complex = await db.users.findMany({
    age: { gte: 18, lte: 65 },
    email: { contains: '@example.com' },
    status: { in: ['active', 'verified'] },
    deletedAt: null
  });
  console.timeEnd('Complex query');
  console.log(`Results: ${complex.length} users`);

  console.log('\n' + '='.repeat(60));
  console.log('Example completed successfully!');
  console.log('='.repeat(60));

  await db.disconnect();
}

// Run the example
main().catch(error => {
  console.error('Error running example:', error);
  process.exit(1);
});
