# SqlDB Query Operators Guide

This guide covers all available query operators in SqlDB, including Prisma-style operators introduced in v1.1.0.

## Table of Contents

- [Basic Equality](#basic-equality)
- [Comparison Operators](#comparison-operators)
- [String Operators](#string-operators)
- [Array Operators](#array-operators)
- [Null Operators](#null-operators)
- [Logical Operators](#logical-operators)
- [Date Operators](#date-operators)
- [Complex Queries](#complex-queries)
- [Backward Compatibility](#backward-compatibility)

---

## Basic Equality

Simple field equality is the most common query pattern:

```typescript
// Find users with exact email match
const users = await db.users.findMany({
  email: 'john@example.com',
  status: 'active'
});

// SQL: SELECT * FROM users WHERE email = ? AND status = ?
```

---

## Comparison Operators

### Numeric Comparisons

```typescript
// Greater than
await db.users.findMany({
  age: { gt: 18 }
});
// SQL: WHERE age > 18

// Greater than or equal
await db.users.findMany({
  age: { gte: 18 }
});
// SQL: WHERE age >= 18

// Less than
await db.users.findMany({
  age: { lt: 65 }
});
// SQL: WHERE age < 65

// Less than or equal
await db.users.findMany({
  age: { lte: 65 }
});
// SQL: WHERE age <= 65

// Range query (combining operators)
await db.users.findMany({
  age: { gte: 18, lte: 65 }
});
// SQL: WHERE (age >= 18 AND age <= 65)
```

### Equals and Not

```typescript
// Explicit equals (same as simple equality)
await db.users.findMany({
  status: { equals: 'active' }
});
// SQL: WHERE status = 'active'

// Not equal
await db.users.findMany({
  status: { not: 'banned' }
});
// SQL: WHERE status != 'banned'
```

---

## String Operators

### Basic String Matching

```typescript
// Contains substring (case-sensitive)
await db.users.findMany({
  email: { contains: '@example.com' }
});
// SQL: WHERE email LIKE '%@example.com%'

// Starts with prefix
await db.users.findMany({
  name: { startsWith: 'John' }
});
// SQL: WHERE name LIKE 'John%'

// Ends with suffix
await db.users.findMany({
  email: { endsWith: '.com' }
});
// SQL: WHERE email LIKE '%.com'
```

### Case-Insensitive String Matching

```typescript
// Case-insensitive contains
await db.users.findMany({
  email: { contains: 'EXAMPLE', mode: 'insensitive' }
});
// SQL: WHERE LOWER(email) LIKE '%example%'

// Case-insensitive starts with
await db.users.findMany({
  name: { startsWith: 'JOHN', mode: 'insensitive' }
});
// SQL: WHERE LOWER(name) LIKE 'john%'

// Case-insensitive ends with
await db.users.findMany({
  email: { endsWith: '.COM', mode: 'insensitive' }
});
// SQL: WHERE LOWER(email) LIKE '%.com'
```

---

## Array Operators

### IN and NOT IN

```typescript
// IN operator - matches any value in array
await db.users.findMany({
  status: { in: ['active', 'pending', 'verified'] }
});
// SQL: WHERE status IN ('active', 'pending', 'verified')

// NOT IN operator - excludes values in array
await db.users.findMany({
  status: { notIn: ['banned', 'suspended'] }
});
// SQL: WHERE status NOT IN ('banned', 'suspended')

// Empty array handling
await db.users.findMany({
  status: { in: [] }  // Returns no results (1 = 0)
});

await db.users.findMany({
  status: { notIn: [] }  // Returns all results (1 = 1)
});
```

### Legacy Array Syntax

```typescript
// Backward compatible: array = IN clause
await db.users.findMany({
  status: ['active', 'verified']
});
// SQL: WHERE status IN ('active', 'verified')
```

---

## Null Operators

```typescript
// Check if field is null
await db.users.findMany({
  deletedAt: { isNull: true }
});
// SQL: WHERE deletedAt IS NULL

// Check if field is not null
await db.users.findMany({
  deletedAt: { isNotNull: true }
});
// SQL: WHERE deletedAt IS NOT NULL

// Alternative: using equals/not with null
await db.users.findMany({
  deletedAt: { equals: null }  // Same as isNull: true
});

await db.users.findMany({
  deletedAt: { not: null }  // Same as isNotNull: true
});

// Direct null check (simplest)
await db.users.findMany({
  deletedAt: null
});
// SQL: WHERE deletedAt IS NULL
```

---

## Logical Operators

### OR Operator

```typescript
// At least one condition must be true
await db.users.findMany({
  OR: [
    { status: 'active' },
    { status: 'verified' }
  ]
});
// SQL: WHERE (status = 'active' OR status = 'verified')

// Complex OR with operators
await db.users.findMany({
  OR: [
    { age: { gte: 18 } },
    { isPremium: true }
  ]
});
// SQL: WHERE (age >= 18 OR isPremium = true)
```

### AND Operator

```typescript
// All conditions must be true (explicit)
await db.users.findMany({
  AND: [
    { status: 'active' },
    { age: { gte: 18 } }
  ]
});
// SQL: WHERE (status = 'active' AND age >= 18)

// Note: Regular fields are implicitly AND'd
await db.users.findMany({
  status: 'active',
  age: { gte: 18 }
});
// SQL: WHERE status = 'active' AND age >= 18
```

### NOT Operator

```typescript
// Negate conditions
await db.users.findMany({
  NOT: [
    { status: 'banned' }
  ]
});
// SQL: WHERE NOT status = 'banned'

// NOT with multiple conditions
await db.users.findMany({
  NOT: [
    { status: 'banned' },
    { status: 'suspended' }
  ]
});
// SQL: WHERE NOT (status = 'banned' AND status = 'suspended')
```

### Nested Logical Operators

```typescript
// Complex nested logic
await db.users.findMany({
  OR: [
    { status: 'active' },
    {
      AND: [
        { isPremium: true },
        { credits: { gt: 0 } }
      ]
    }
  ]
});
// SQL: WHERE (status = 'active' OR (isPremium = true AND credits > 0))

// Combining implicit AND with OR
await db.users.findMany({
  status: 'active',
  OR: [
    { age: { gte: 18 } },
    { verified: true }
  ]
});
// SQL: WHERE status = 'active' AND (age >= 18 OR verified = true)
```

---

## Date Operators

```typescript
// Date comparisons
const date = new Date('2024-01-01');

await db.users.findMany({
  createdAt: { gte: date }
});
// SQL: WHERE createdAt >= '2024-01-01'

// Date range
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');

await db.users.findMany({
  createdAt: {
    gte: startDate,
    lte: endDate
  }
});
// SQL: WHERE (createdAt >= '2024-01-01' AND createdAt <= '2024-12-31')

// Direct date equality
await db.users.findMany({
  createdAt: new Date('2024-01-01')
});
// SQL: WHERE createdAt = '2024-01-01'
```

---

## Complex Queries

### Real-World Examples

#### User Search with Multiple Filters

```typescript
await db.users.findMany({
  age: { gte: 18, lte: 65 },
  email: { contains: '@example.com' },
  status: { in: ['active', 'verified'] },
  deletedAt: null
});
// SQL: WHERE (age >= 18 AND age <= 65)
//      AND email LIKE '%@example.com%'
//      AND status IN ('active', 'verified')
//      AND deletedAt IS NULL
```

#### Premium Users or Active Users with Credits

```typescript
await db.users.findMany({
  OR: [
    {
      AND: [
        { age: { gte: 18 } },
        { status: 'active' }
      ]
    },
    {
      isPremium: true
    }
  ]
});
// SQL: WHERE ((age >= 18 AND status = 'active') OR isPremium = true)
```

#### Advanced Filtering with Exclusions

```typescript
await db.users.findMany({
  status: { in: ['active', 'verified'] },
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
// SQL: WHERE status IN ('active', 'verified')
//      AND deletedAt IS NULL
//      AND (email LIKE '%@example.com' OR (isPremium = true AND credits >= 100))
```

---

## Backward Compatibility

### Legacy $ Operators (Still Supported)

```typescript
// Old style with $ prefix
await db.users.findMany({
  age: { $gt: 18 },
  score: { $gte: 100 },
  status: { $ne: 'banned' },
  name: { $like: '%John%' }
});

// New and old style can be mixed
await db.users.findMany({
  age: { gte: 18 },      // New style
  score: { $gt: 100 }    // Old style
});
```

**Note:** Legacy $ operators are maintained for backward compatibility but new code should use Prisma-style operators without the $ prefix.

---

## Type Safety

All operators are fully type-safe with TypeScript:

```typescript
interface User {
  id: number;
  email: string;
  age: number;
  status: 'active' | 'inactive' | 'banned';
  createdAt: Date;
  deletedAt: Date | null;
}

// TypeScript will enforce correct types
await db.users.findMany({
  age: { gte: 18 },           // ✓ Valid: number operator on number field
  email: { contains: '@' },   // ✓ Valid: string operator on string field
  // age: { contains: 'test' } // ✗ Error: string operator on number field
});
```

---

## Performance Tips

1. **Use indexed fields**: Apply operators on indexed columns for better performance
2. **Limit case-insensitive operations**: `mode: 'insensitive'` uses `LOWER()` which may bypass indexes
3. **Prefer IN over OR for multiple values**: `{ status: { in: [...] } }` is faster than `OR: [{ status: ... }, ...]`
4. **Use specific operators**: `{ age: { gte: 18 } }` is clearer than `{ age: { not: { lt: 18 } } }`

---

## Comparison with Prisma

SqlDB operators are designed to match Prisma's query syntax:

| Prisma | SqlDB | Status |
|--------|-------|--------|
| `{ gt, gte, lt, lte }` | ✓ Supported | Same |
| `{ equals, not }` | ✓ Supported | Same |
| `{ in, notIn }` | ✓ Supported | Same |
| `{ contains, startsWith, endsWith }` | ✓ Supported | Same |
| `{ mode: 'insensitive' }` | ✓ Supported | Same |
| `{ AND, OR, NOT }` | ✓ Supported | Same |
| `{ isNull, isNotNull }` | ✓ Supported | Extended |
| `{ some, every, none }` | ⏳ Coming in v1.2 | Phase 2 |
| `{ is, isNot }` | ⏳ Coming in v1.2 | Phase 2 |

---

## What's Next?

### Phase 2: Relation Loading API (v1.2.0)

- Include pattern: `{ include: { posts: true } }`
- Select pattern: `{ select: { email: true, name: true } }`
- Relation filters: `{ posts: { some: { published: true } } }`
- Load strategies: JOIN vs batched queries

### Phase 3: Transaction Support (v1.3.0)

- Sequential transactions
- Interactive transactions
- Nested writes

See [/Users/bhushan/.claude/plans/robust-floating-toast.md](/Users/bhushan/.claude/plans/robust-floating-toast.md) for the full roadmap.

---

## Examples by Use Case

### E-commerce

```typescript
// Active products in price range
await db.products.findMany({
  status: 'active',
  price: { gte: 10, lte: 100 },
  stock: { gt: 0 }
});

// Search products by name or description
await db.products.findMany({
  OR: [
    { name: { contains: 'laptop', mode: 'insensitive' } },
    { description: { contains: 'laptop', mode: 'insensitive' } }
  ]
});
```

### User Management

```typescript
// Active adult users
await db.users.findMany({
  age: { gte: 18 },
  status: 'active',
  deletedAt: null
});

// Users from specific email domains
await db.users.findMany({
  OR: [
    { email: { endsWith: '@company.com' } },
    { email: { endsWith: '@partner.com' } }
  ]
});
```

### Analytics

```typescript
// Recent high-value transactions
await db.transactions.findMany({
  amount: { gte: 1000 },
  createdAt: { gte: new Date('2024-01-01') },
  status: { in: ['completed', 'pending'] }
});
```

---

## Migration Guide

### From v1.0 to v1.1

No breaking changes! All existing queries continue to work:

```typescript
// Old syntax (still works)
db.users.findMany({ age: { $gt: 18 } });
db.users.findMany({ status: ['active', 'verified'] });

// New syntax (recommended)
db.users.findMany({ age: { gt: 18 } });
db.users.findMany({ status: { in: ['active', 'verified'] } });
```

### Gradual Migration Strategy

1. **Keep using old syntax** - It works fine
2. **Use new syntax for new code** - Better alignment with Prisma
3. **Migrate gradually** - Update queries as you touch the code
4. **No rush** - Legacy operators won't be removed until v2.0 (planned in 3+ months)

---

## Questions?

- 📖 Full documentation: `README.md`
- 🚀 Implementation plan: [/Users/bhushan/.claude/plans/robust-floating-toast.md](/Users/bhushan/.claude/plans/robust-floating-toast.md)
- 🐛 Report issues: GitHub Issues
- 💬 Get help: GitHub Discussions
