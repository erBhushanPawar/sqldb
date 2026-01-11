# Full-Text Search Guide

SqlDB includes a Meilisearch-inspired full-text search system powered by Redis inverted indexes. This provides blazing-fast text search with relevance ranking, highlighting, and advanced tokenization.

## Features

- **Inverted Index**: Redis-backed inverted indexes for instant lookups
- **Smart Tokenization**: Three strategies (simple, stemming, n-gram)
- **Relevance Ranking**: TF-IDF and BM25 algorithms
- **Highlighting**: Automatic highlighting of matched terms
- **Field Boosting**: Prioritize matches in specific fields (e.g., title > description)
- **Proximity Scoring**: Words closer together rank higher
- **Database Agnostic**: Works with any database via Redis

## Quick Start

### 1. Configure Search

```typescript
import { createSqlDB } from '@bhushanpawar/sqldb';

const db = await createSqlDB({
  mariadb: { /* ... */ },
  redis: { /* ... */ },

  // Enable search
  search: {
    enabled: true,
    invertedIndex: {
      enabled: true,
      tables: {
        services: {
          searchableFields: ['title', 'description', 'category'],
          tokenizer: 'stemming',  // 'simple' | 'stemming' | 'ngram'
          minWordLength: 3,
          stopWords: ['the', 'a', 'an', 'and', 'or'],
          fieldBoosts: {
            title: 3.0,        // Matches in title are 3x more important
            description: 1.0,
          },
        },
      },
    },
  },
});
```

### 2. Build Search Index

```typescript
// Build index for a single table
const stats = await db.services.buildSearchIndex();
console.log(`Indexed ${stats.totalDocuments} documents with ${stats.totalTerms} terms`);

// Or build indexes for all configured tables
await db.buildAllSearchIndexes();
```

### 3. Search

```typescript
const results = await db.services.search('plumbing repair emergency', {
  limit: 10,
  highlightFields: ['title', 'description'],
  minScore: 0.3,
});

results.forEach(result => {
  console.log(`Score: ${result.score}`);
  console.log(`Title: ${result.highlights?.title || result.data.title}`);
  console.log(`Matched: ${result.matchedTerms.join(', ')}`);
});
```

## Configuration Options

### Tokenizer Types

#### Simple Tokenizer
- Splits text by whitespace and punctuation
- Removes stop words
- Case-insensitive by default
- **Best for**: English text, performance-critical applications

```typescript
tokenizer: 'simple'
```

#### Stemming Tokenizer (Porter Stemmer)
- All features of simple tokenizer
- Reduces words to root form: "running" → "run", "services" → "servic"
- Improves recall for natural language queries
- **Best for**: Natural language search, handling plurals/tenses

```typescript
tokenizer: 'stemming'
```

#### N-gram Tokenizer
- Splits words into character sequences
- Example: "plumb" → ["plu", "lum", "umb"]
- Enables fuzzy matching and typo tolerance
- **Best for**: Autocomplete, typo tolerance, partial matching

```typescript
tokenizer: 'ngram',
ngramSize: 3  // Optional, defaults to 3
```

### Field Boosting

Prioritize matches in certain fields:

```typescript
fieldBoosts: {
  title: 3.0,         // Most important
  category: 2.0,      // Important
  description: 1.0,   // Least important
}
```

### Stop Words

Common words to exclude from indexing:

```typescript
stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at']
```

## Search Options

```typescript
await db.services.search('query', {
  fields: ['title', 'description'],  // Limit search to specific fields
  limit: 10,                          // Max results (default: 10)
  offset: 0,                          // Pagination offset
  filters: { is_active: true },       // Additional SQL filters
  ranking: {
    fieldBoosts: { title: 5.0 },      // Override default field boosts
    proximityWeight: 1.5,              // Weight for word proximity
  },
  highlightFields: ['title', 'description'],  // Fields to highlight
  minScore: 0.3,                              // Minimum relevance score (0-1)
});
```

## Search Results

```typescript
interface SearchResult<T> {
  score: number;                       // Relevance score (0-1)
  data: T;                             // Full record
  highlights?: Record<string, string>; // Highlighted snippets
  matchedTerms?: string[];             // Which terms matched
}
```

Example:
```typescript
{
  score: 0.95,
  data: {
    id: 1,
    title: 'Emergency Plumbing Repair',
    description: 'Expert plumbing services...',
  },
  highlights: {
    title: '<mark>Emergency</mark> <mark>Plumbing</mark> <mark>Repair</mark>',
    description: 'Expert <mark>plumbing</mark> services...'
  },
  matchedTerms: ['emergency', 'plumbing', 'repair']
}
```

## Index Management

### Build Index
```typescript
// Build index from scratch
const stats = await db.services.buildSearchIndex();
```

### Rebuild Index
```typescript
// Clear and rebuild (useful after bulk updates)
const stats = await db.services.rebuildSearchIndex();
```

### Get Statistics
```typescript
const stats = await db.services.getSearchStats();
console.log(stats);
// {
//   tableName: 'services',
//   totalDocuments: 1000,
//   totalTerms: 5420,
//   totalTokens: 18340,
//   lastBuildTime: 1704979200000,
//   buildDurationMs: 245,
//   fields: ['title', 'description']
// }
```

## Performance

### Expected Performance

| Operation | Traditional (LIKE %) | Inverted Index | Improvement |
|-----------|---------------------|----------------|-------------|
| Single word search | 50-100ms | <5ms | **10-20x faster** |
| Multi-word search | 100-200ms | <10ms | **10-20x faster** |
| Index build (10k docs) | N/A | <2s | - |
| Index update (1 doc) | N/A | <5ms | - |
| Highlighting | N/A | <1ms | - |

### Performance Tips

1. **Use Stemming for Natural Language**
   ```typescript
   tokenizer: 'stemming'  // Better recall, slightly slower indexing
   ```

2. **Optimize Field Boosts**
   ```typescript
   fieldBoosts: {
     title: 3.0,  // Focus on most relevant fields
   }
   ```

3. **Set Minimum Score**
   ```typescript
   minScore: 0.3  // Filter out low-quality matches
   ```

4. **Rebuild Indexes Periodically**
   ```typescript
   // After bulk updates
   await db.services.rebuildSearchIndex();
   ```

5. **Use Filters for Faceting**
   ```typescript
   // Combine search with SQL filters
   await db.services.search('query', {
     filters: { category: 'Plumbing', is_active: true }
   });
   ```

## Redis Storage Structure

SqlDB uses Redis Sorted Sets for efficient inverted indexes:

```
sqldb:index:services:word:plumb        → Sorted Set [(docId1, score1), (docId2, score2), ...]
sqldb:index:services:doc:123           → Set [word1, word2, ...]
sqldb:index:services:meta              → Hash {lastBuild, docCount, termCount}
```

### Storage Example
```
Key: sqldb:index:services:word:plumb
Value: [(1, 3.0), (5, 2.0), (12, 1.5)]  // docId, TF * field_boost
```

## Examples

### Example 1: E-commerce Product Search
```typescript
search: {
  enabled: true,
  invertedIndex: {
    enabled: true,
    tables: {
      products: {
        searchableFields: ['name', 'description', 'brand', 'category'],
        tokenizer: 'stemming',
        fieldBoosts: {
          name: 3.0,
          brand: 2.0,
          category: 1.5,
          description: 1.0,
        },
      },
    },
  },
}

// Search
const results = await db.products.search('wireless headphones', {
  filters: { price: { $lt: 100 }, in_stock: true },
  highlightFields: ['name', 'description'],
  limit: 20,
});
```

### Example 2: Blog Article Search
```typescript
search: {
  enabled: true,
  invertedIndex: {
    enabled: true,
    tables: {
      articles: {
        searchableFields: ['title', 'content', 'tags'],
        tokenizer: 'stemming',
        minWordLength: 4,
        stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on'],
        fieldBoosts: {
          title: 5.0,
          tags: 3.0,
          content: 1.0,
        },
      },
    },
  },
}

// Search
const results = await db.articles.search('javascript async patterns', {
  highlightFields: ['title'],
  minScore: 0.4,
});
```

### Example 3: Autocomplete with N-gram
```typescript
search: {
  enabled: true,
  invertedIndex: {
    enabled: true,
    tables: {
      cities: {
        searchableFields: ['name'],
        tokenizer: 'ngram',
        ngramSize: 3,
        minWordLength: 2,
      },
    },
  },
}

// Autocomplete search
const results = await db.cities.search('san fr', { limit: 5 });
// Matches: "San Francisco", "Santa Fe", etc.
```

## Advanced Topics

### Ranking Algorithm (TF-IDF)

SqlDB uses TF-IDF (Term Frequency - Inverse Document Frequency):

```
TF-IDF = TF * IDF
where:
  TF = (term frequency in document) / (total terms in document)
  IDF = log((total documents) / (documents containing term))
```

### BM25 (Advanced)

For more sophisticated ranking, BM25 is available:

```typescript
BM25 = IDF * (TF * (k1 + 1)) / (TF + k1 * (1 - b + b * (docLen / avgDocLen)))
```

### Proximity Scoring

Terms appearing closer together receive higher scores:

```typescript
// "emergency plumbing" ranks higher than "plumbing ... emergency"
proximityScore = 1.0   // adjacent words
proximityScore = 0.8   // within 3 words
proximityScore = 0.5   // within 10 words
```

## Troubleshooting

### Search Not Working
1. Check if search is enabled:
   ```typescript
   search: { enabled: true }
   ```

2. Verify table is configured:
   ```typescript
   invertedIndex: {
     tables: { your_table: { /* config */ } }
   }
   ```

3. Build the index:
   ```typescript
   await db.your_table.buildSearchIndex();
   ```

### Slow Search Performance
1. Reduce searchable fields
2. Increase `minWordLength`
3. Add more stop words
4. Use `minScore` to filter results

### Poor Search Quality
1. Use `stemming` tokenizer for natural language
2. Adjust `fieldBoosts` to prioritize relevant fields
3. Lower `minScore` threshold
4. Review stop words list

## Roadmap

Future enhancements planned:
- Faceted search (filtering by attributes)
- Autocomplete with prefix trees
- Geo-spatial search
- Fuzzy matching (typo tolerance)
- Synonym expansion
- Phrase search ("exact phrase")

## See Also

- [Search Example](../examples/search-example.ts)
- [Configuration Guide](./CONFIGURATION.md)
- [Performance Tuning](./PERFORMANCE.md)
