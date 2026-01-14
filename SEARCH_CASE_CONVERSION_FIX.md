# Search Case Conversion Fix

## Problem

When case conversion was enabled, the `search()` method was still returning results with snake_case field names like `service_id`, `provider_id` instead of camelCase `serviceId`, `providerId`.

Example of the issue:
```json
{
  "score": 0.088,
  "data": {
    "service_id": "976223fa-...",
    "provider_id": "51bab3d4-...",
    "title": "Bespoke Product Tailoring & Customization"
  }
}
```

## Root Cause

The `search()` method in [operations.ts](admin-ui/lib/sqldb/query/operations.ts) was using the `raw()` method to fetch records, which bypasses the case conversion logic in `MariaDBConnectionManager.query()`. The case conversion was only applied to queries that go through the standard `query()` method, which detects SELECT queries and applies conversion.

Additionally, the `TableOperationsImpl` class didn't have access to the `caseConversionConfig` to manually apply conversion after fetching records.

## Solution

### 1. Added CaseConversionConfig to TableOperationsImpl

**File**: [operations.ts](admin-ui/lib/sqldb/query/operations.ts)

Added the `caseConversionConfig` property and constructor parameter:

```typescript
export class TableOperationsImpl<T = any> implements TableOperations<T> {
  private caseConversionConfig?: CaseConversionConfig;

  constructor(
    // ... other parameters
    caseConversionConfig?: CaseConversionConfig
  ) {
    // ... other assignments
    this.caseConversionConfig = caseConversionConfig;
  }
}
```

### 2. Applied Case Conversion in search() Method

**File**: [operations.ts:947-952](admin-ui/lib/sqldb/query/operations.ts#L947-L952)

After fetching records via `raw()`, now explicitly applies case conversion:

```typescript
let records = await this.raw<T[]>(sql, params);

// Apply case conversion if enabled (database -> application)
if (this.caseConversionConfig?.enabled) {
  records = CaseConverter.objectKeysToCamel(records);
}
```

### 3. Fixed ID Field Lookup Issue

**File**: [operations.ts:954-966](admin-ui/lib/sqldb/query/operations.ts#L954-L966)

The ID field name (e.g., `service_id`) needs to be converted to camelCase (`serviceId`) when looking up records in the converted result set:

```typescript
// Determine the field name to use for lookup (convert to camelCase if needed)
const lookupField = this.caseConversionConfig?.enabled
  ? CaseConverter.snakeToCamel(idField)
  : idField;

// Create a map for quick lookup (ID as string to support UUIDs)
const recordsMap = new Map<string, T>();
for (const record of records) {
  const id = (record as any)[lookupField];  // Use camelCase field name
  if (id !== undefined && id !== null) {
    recordsMap.set(String(id), record);
  }
}
```

### 4. Applied Case Conversion in searchWithGeo() Method

**File**: [operations.ts:789-794](admin-ui/lib/sqldb/query/operations.ts#L789-L794)

The geo-search method also needed conversion since it gets documents from the GeoSearchManager:

```typescript
for (const geoResult of geoResults) {
  let record = geoResult.document as T;

  // Apply case conversion if enabled (database -> application)
  if (this.caseConversionConfig?.enabled) {
    record = CaseConverter.objectKeysToCamel(record);
  }
  // ... rest of the logic
}
```

### 5. Updated Client to Pass CaseConversionConfig

**File**: [client.ts:242-254](admin-ui/lib/sqldb/client.ts#L242-L254)

Updated the instantiation to pass `caseConversionConfig`:

```typescript
return new TableOperationsImpl<T>(
  tableName,
  this.dbManager,
  this.cacheManager,
  this.invalidationManager,
  this.queryBuilder,
  this.config.cache as Required<typeof DEFAULT_CACHE_CONFIG>,
  this.statsTracker,
  this.indexManager,
  this.searchRanker,
  geoSearchManager,
  this.config.caseConversion  // Added this parameter
);
```

### 6. Updated All TableOperationsImpl Instantiations

**File**: [operations.ts](admin-ui/lib/sqldb/query/operations.ts)

Updated all internal instantiations in the `warmCache` methods to also pass the full parameter set including `caseConversionConfig`.

## Result

Now when case conversion is enabled, search results correctly return camelCase field names:

```json
{
  "score": 0.088,
  "data": {
    "serviceId": "976223fa-...",
    "providerId": "51bab3d4-...",
    "title": "Bespoke Product Tailoring & Customization"
  }
}
```

## Files Changed

1. [admin-ui/lib/sqldb/query/operations.ts](admin-ui/lib/sqldb/query/operations.ts)
   - Added `CaseConversionConfig` import
   - Added `CaseConverter` import
   - Added `caseConversionConfig` property to class
   - Updated constructor to accept `caseConversionConfig`
   - Applied case conversion in `search()` method after fetching records
   - Fixed ID field lookup to use camelCase field name
   - Applied case conversion in `searchWithGeo()` method
   - Updated all internal `TableOperationsImpl` instantiations

2. [admin-ui/lib/sqldb/client.ts](admin-ui/lib/sqldb/client.ts)
   - Updated `TableOperationsImpl` instantiation to pass `caseConversionConfig`

## Testing

To verify the fix:

1. Enable case conversion in your config:
```typescript
const db = await createSqlDB({
  // ... other config
  caseConversion: {
    enabled: true,
    database: 'snake_case',
    application: 'camelCase'
  }
});
```

2. Run a search query:
```typescript
const results = await db('services').search('plumbing', {
  limit: 10
});

console.log(results[0].data.serviceId);  // Should work!
console.log(results[0].data.providerId); // Should work!
```

3. Verify all field names in results are in camelCase format.

## Impact

- ✅ All search results now respect case conversion settings
- ✅ Both `search()` and `searchWithGeo()` methods fixed
- ✅ ID field lookups work correctly with converted field names
- ✅ No breaking changes to existing code
- ✅ Backward compatible (case conversion is optional)
