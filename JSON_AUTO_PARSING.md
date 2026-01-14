# Automatic JSON Parsing from TEXT Columns

## Feature

TEXT/VARCHAR columns that contain JSON strings are now **automatically parsed** into JavaScript objects or arrays.

## Problem Solved

Previously, JSON stored in TEXT columns was returned as strings:

```json
{
  "otherImageUrls": "[]",                                          // ❌ String
  "tags": "[\"Custom Shoes\",\"Leather Footwear\",\"Handmade\"]"  // ❌ String
}
```

You had to manually parse these:
```typescript
const record = await db('services').findById(1);
const tags = JSON.parse(record.tags);  // Manual parsing required
```

## Solution

Now JSON in TEXT columns is **automatically parsed**:

```json
{
  "otherImageUrls": [],                                           // ✅ Array
  "tags": ["Custom Shoes", "Leather Footwear", "Handmade"]       // ✅ Array
}
```

No manual parsing needed:
```typescript
const record = await db('services').findById(1);
const tags = record.tags;  // Already an array!
tags.forEach(tag => console.log(tag));  // Works directly
```

## How It Works

The `typeCast` function detects JSON by checking if the string:
1. Starts with `[` and ends with `]` (JSON array)
2. Or starts with `{` and ends with `}` (JSON object)

If detected, it attempts to parse. If parsing fails, returns the original string.

### Implementation

```typescript
typeCast: (field: any, next: any) => {
  // For TEXT/VARCHAR/BLOB fields
  if (field.type === 'VAR_STRING' || field.type === 'STRING' ||
      field.type === 'BLOB' || field.type === 'TINY_BLOB' ||
      field.type === 'MEDIUM_BLOB' || field.type === 'LONG_BLOB') {
    const value = field.string();

    if (value === null || value === '') return value;

    const trimmed = value.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;  // Return string if parsing fails
      }
    }

    return value;
  }

  return next();
}
```

## Supported Column Types

Automatic JSON parsing works for:
- `TEXT` columns
- `VARCHAR` columns
- `BLOB` columns (all sizes: TINYBLOB, BLOB, MEDIUMBLOB, LONGBLOB)
- `CHAR` columns

## Examples

### Example 1: JSON Array

**Database Schema**:
```sql
CREATE TABLE services (
  id VARCHAR(36),
  tags TEXT,  -- Stores: ["tag1", "tag2"]
  ...
);
```

**Before (Manual Parsing)**:
```typescript
const service = await db('services').findById('123');
console.log(typeof service.tags);  // "string"
const tags = JSON.parse(service.tags);  // Manual parse
console.log(tags[0]);  // "tag1"
```

**After (Auto Parsing)**:
```typescript
const service = await db('services').findById('123');
console.log(typeof service.tags);  // "object"
console.log(Array.isArray(service.tags));  // true
console.log(service.tags[0]);  // "tag1" - direct access!
```

### Example 2: JSON Object

**Database Schema**:
```sql
CREATE TABLE services (
  id VARCHAR(36),
  metadata TEXT,  -- Stores: {"key": "value"}
  ...
);
```

**Before (Manual Parsing)**:
```typescript
const service = await db('services').findById('123');
const metadata = JSON.parse(service.metadata);
console.log(metadata.key);
```

**After (Auto Parsing)**:
```typescript
const service = await db('services').findById('123');
console.log(service.metadata.key);  // Direct access!
```

### Example 3: Empty Arrays

**Database**:
```sql
-- Column: other_image_urls TEXT DEFAULT '[]'
```

**Result**:
```typescript
const service = await db('services').findById('123');
console.log(service.otherImageUrls);  // [] - Empty array, not "[]"
console.log(Array.isArray(service.otherImageUrls));  // true
```

## Safe Parsing

### Invalid JSON Returns Original String

If JSON parsing fails, the original string is returned:

```typescript
// Database value: "[invalid json"
const service = await db('services').findById('123');
console.log(service.tags);  // "[invalid json" - original string
console.log(typeof service.tags);  // "string"
```

### Non-JSON Strings Unchanged

Regular text that doesn't look like JSON is returned as-is:

```typescript
// Database value: "Just a regular string"
const service = await db('services').findById('123');
console.log(service.description);  // "Just a regular string"
```

### NULL Values Preserved

```typescript
// Database value: NULL
const service = await db('services').findById('123');
console.log(service.tags);  // null
```

### Empty Strings Preserved

```typescript
// Database value: ""
const service = await db('services').findById('123');
console.log(service.tags);  // ""
```

## TypeScript Support

Define your interfaces with proper types:

```typescript
interface Service {
  serviceId: string;
  title: string;
  tags: string[];              // Array, not string!
  otherImageUrls: string[];    // Array, not string!
  metadata: {                  // Object, not string!
    category: string;
    featured: boolean;
  };
}

const service = await db<Service>('services').findById('123');
service.tags.forEach(tag => {  // TypeScript knows it's an array
  console.log(tag.toUpperCase());
});
```

## Performance

- ✅ **Fast**: Simple string inspection (starts/ends check)
- ✅ **Safe**: Try-catch prevents parse errors from breaking queries
- ✅ **Minimal overhead**: Only attempts parsing if string looks like JSON
- ✅ **No database impact**: Parsing happens in application code after fetch

## Combined with Other Features

Works seamlessly with:

### 1. Case Conversion
```typescript
// Database: other_image_urls TEXT = '["url1", "url2"]'
const service = await db('services').findById('123');
console.log(service.otherImageUrls);  // ["url1", "url2"]
// ✅ Parsed to array + camelCase field name
```

### 2. Search Results
```typescript
const results = await db('services').search('custom shoes');
results[0].data.tags.forEach(tag => console.log(tag));
// ✅ Already parsed, ready to use
```

### 3. FindMany/FindOne
```typescript
const services = await db('services').findMany({ status: 'PUBLISHED' });
services.forEach(service => {
  console.log(service.tags.length);  // Works directly
});
```

## Migration Guide

### If You Were Manually Parsing

**Before**:
```typescript
const service = await db('services').findById('123');
const tags = JSON.parse(service.tags);
const images = JSON.parse(service.otherImageUrls);
```

**After** (Remove manual parsing):
```typescript
const service = await db('services').findById('123');
// tags and images are already parsed!
const tags = service.tags;
const images = service.otherImageUrls;
```

### Update TypeScript Interfaces

Change string types to actual types:

**Before**:
```typescript
interface Service {
  tags: string;              // ❌ Wrong
  otherImageUrls: string;    // ❌ Wrong
}
```

**After**:
```typescript
interface Service {
  tags: string[];            // ✅ Correct
  otherImageUrls: string[];  // ✅ Correct
}
```

## Disabling Auto-Parsing

If you need the raw JSON strings (not recommended), you can:

1. **Option 1**: Cast the column to a different type in SQL
```typescript
const result = await db.raw('SELECT CAST(tags AS CHAR) as tags FROM services WHERE id = ?', [id]);
```

2. **Option 2**: Store in a different column type
```sql
-- Use JSON type instead of TEXT
ALTER TABLE services MODIFY tags JSON;
```

## Testing

After restarting your app:

```typescript
// Test array parsing
const service = await db('services').findById('123');
console.log('Tags type:', typeof service.tags);          // "object"
console.log('Is array:', Array.isArray(service.tags));   // true
console.log('First tag:', service.tags[0]);              // "Custom Shoes"

// Test object parsing
console.log('Metadata type:', typeof service.metadata);  // "object"
console.log('Metadata key:', service.metadata.category); // Direct access

// Test empty arrays
console.log('Empty images:', service.otherImageUrls);    // []
console.log('Is array:', Array.isArray(service.otherImageUrls)); // true
```

## Summary

✅ **Automatic**: No manual `JSON.parse()` needed
✅ **Safe**: Invalid JSON returns original string
✅ **Fast**: Minimal performance overhead
✅ **Smart**: Only parses strings that look like JSON
✅ **Compatible**: Works with all other features

---

**Action Required**: Restart your application to use automatic JSON parsing!
