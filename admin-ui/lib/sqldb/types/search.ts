/**
 * Search Types and Interfaces
 *
 * Defines types for the search optimization features including
 * inverted indexes, faceted search, autocomplete, and geo-spatial search.
 */

export interface SearchConfig {
  enabled: boolean;
  invertedIndex?: InvertedIndexConfig;
  facets?: FacetConfig;
  autocomplete?: AutocompleteConfig;
  geo?: GeoConfig;
  indexManagement?: IndexManagementConfig;
}

export interface InvertedIndexConfig {
  enabled: boolean;
  tables: {
    [tableName: string]: {
      searchableFields: string[];                    // ['title', 'description']
      tokenizer: 'simple' | 'stemming' | 'ngram';   // Tokenization strategy
      minWordLength: number;                         // Minimum 3 chars
      stopWords?: string[];                          // ['the', 'a', 'an', ...]
      caseSensitive?: boolean;                       // Default: false
      rebuildOnWrite?: boolean;                      // Auto-rebuild on INSERT/UPDATE
      fieldBoosts?: Record<string, number>;          // { title: 2.0, description: 1.0 }
    };
  };
}

export interface FacetConfig {
  enabled: boolean;
  tables: {
    [tableName: string]: {
      filterableAttributes: string[];    // ['category_id', 'status', 'price']
      numericRanges?: {
        [field: string]: number[];       // price: [0, 50, 100, 200]
      };
      dateRanges?: {
        [field: string]: string[];       // created_at: ['1d', '7d', '30d', '1y']
      };
    };
  };
}

export interface AutocompleteConfig {
  enabled: boolean;
  tables: {
    [tableName: string]: {
      autocompleteFields: string[];      // ['title', 'name']
      minPrefixLength: number;           // Minimum 2 chars
      maxSuggestions: number;            // Top 10 results
      rankBy?: 'frequency' | 'alphabetical' | 'custom';
    };
  };
}

export interface GeoConfig {
  enabled: boolean;
  tables: {
    [tableName: string]: {
      latField: string;      // 'latitude'
      lngField: string;      // 'longitude'
      radiusUnit: 'km' | 'mi';
    };
  };
}

export interface IndexManagementConfig {
  autoRebuild?: boolean;              // Auto-rebuild on schedule
  rebuildIntervalMs?: number;         // 3600000 = 1 hour
  rebuildOnStartup?: boolean;         // Rebuild indexes on app startup
  backgroundRebuilds?: boolean;       // Use separate connection pool
}

/**
 * Search Options
 */
export interface SearchOptions {
  fields?: string[];                   // Limit to specific fields
  limit?: number;                      // Max results (default: 10)
  offset?: number;                     // Pagination offset
  filters?: Record<string, any>;       // Additional SQL WHERE filters
  ranking?: {
    fieldBoosts?: Record<string, number>;      // Override field boosts
    proximityWeight?: number;                  // Weight for word proximity
  };
  highlightFields?: string[];          // Return highlighted snippets
  fuzzy?: boolean;                     // Enable fuzzy matching (typo tolerance)
  minScore?: number;                   // Minimum relevance score (0-1)
}

/**
 * Search Result
 */
export interface SearchResult<T> {
  score: number;                       // Relevance score (0-1)
  data: T;                             // Full record
  highlights?: Record<string, string>; // Highlighted snippets
  matchedTerms?: string[];             // Which search terms matched
}

/**
 * Tokenization
 */
export interface TokenizerOptions {
  type: 'simple' | 'stemming' | 'ngram';
  minWordLength: number;
  stopWords: string[];
  caseSensitive: boolean;
  ngramSize?: number;                  // For n-gram tokenizer (default: 3)
}

export interface TokenMetadata {
  term: string;                        // The actual token
  positions: number[];                 // Positions in original text
  field: string;                       // Which field it came from
}

/**
 * Inverted Index Structure
 */
export interface InvertedIndexEntry {
  term: string;                        // The indexed word
  docFrequency: number;                // Number of documents containing this term
  documents: Map<number, DocTermData>; // Document ID → term data
}

export interface DocTermData {
  frequency: number;                   // Term frequency in this document
  positions: number[];                 // Positions where term appears
  fields: string[];                    // Which fields contain this term
}

/**
 * Index Statistics
 */
export interface IndexStats {
  tableName: string;
  totalDocuments: number;              // Total documents indexed
  totalTerms: number;                  // Total unique terms
  totalTokens: number;                 // Total tokens (including duplicates)
  lastBuildTime: number;               // Timestamp of last build
  buildDurationMs: number;             // How long the build took
  memoryUsageBytes?: number;           // Estimated memory usage
  fields: string[];                    // Indexed fields
}

/**
 * Search Ranking
 */
export interface ScoringContext {
  term: string;                        // Search term
  docId: number;                       // Document ID
  termFrequency: number;               // TF: term frequency in document
  docFrequency: number;                // DF: documents containing term
  totalDocs: number;                   // Total documents in index
  fieldBoost: number;                  // Boost for the field
  proximityScore?: number;             // Score based on term proximity
}

export interface RankingWeights {
  tfIdfWeight: number;                 // Weight for TF-IDF score (default: 1.0)
  fieldBoostWeight: number;            // Weight for field boost (default: 1.0)
  proximityWeight: number;             // Weight for proximity (default: 0.5)
  freshnessWeight?: number;            // Weight for document age (optional)
}

/**
 * Faceted Search
 */
export interface FacetCounts {
  [attributeName: string]: {
    [value: string]: number;           // value → count
  };
}

export interface FacetOptions {
  facets?: string[];                   // Which facets to compute
  getFacetCounts?: boolean;            // Include facet counts in response
  maxFacetValues?: number;             // Max values per facet (default: 100)
}

export interface FacetedSearchResult<T> {
  data: T[];                           // Search results
  facets?: FacetCounts;                // Facet counts
  total: number;                       // Total matching documents
}

/**
 * Autocomplete
 */
export interface Suggestion {
  text: string;                        // Suggestion text
  score: number;                       // Relevance score
  count: number;                       // Frequency (how often it appears)
  highlight?: string;                  // Highlighted version
}

export interface AutocompleteOptions {
  field?: string;                      // Specific field to search
  limit?: number;                      // Max suggestions (default: 10)
  filters?: Record<string, any>;       // Additional filters
}

/**
 * Geo-Spatial Search
 */
export interface GeoPoint {
  lat: number;                         // Latitude
  lng: number;                         // Longitude
}

export interface GeoSearchOptions {
  lat: number;                         // Center latitude
  lng: number;                         // Center longitude
  radius: number;                      // Radius in km or miles
  unit?: 'km' | 'mi';                  // Distance unit
  filters?: Record<string, any>;       // Additional filters
  limit?: number;                      // Max results
  orderBy?: 'distance' | string;       // Sort by distance or other field
}

export interface GeoResult<T> {
  data: T;                             // Full record
  distance: number;                    // Distance from center (in specified unit)
  bearing?: number;                    // Direction (0-360 degrees)
}

/**
 * Highlighting
 */
export interface HighlightOptions {
  preTag?: string;                     // Opening tag (default: '<mark>')
  postTag?: string;                    // Closing tag (default: '</mark>')
  fragmentSize?: number;               // Max fragment length (default: 150)
  numberOfFragments?: number;          // Max fragments per field (default: 1)
}

/**
 * Default Configurations
 */
export const DEFAULT_SEARCH_CONFIG: Required<SearchConfig> = {
  enabled: false,
  invertedIndex: {
    enabled: false,
    tables: {},
  },
  facets: {
    enabled: false,
    tables: {},
  },
  autocomplete: {
    enabled: false,
    tables: {},
  },
  geo: {
    enabled: false,
    tables: {},
  },
  indexManagement: {
    autoRebuild: false,
    rebuildIntervalMs: 3600000,        // 1 hour
    rebuildOnStartup: false,
    backgroundRebuilds: true,
  },
};

export const DEFAULT_STOP_WORDS = [
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'will', 'with', 'the', 'this', 'but', 'they', 'have',
];

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  tfIdfWeight: 1.0,
  fieldBoostWeight: 1.0,
  proximityWeight: 0.5,
};

export const DEFAULT_HIGHLIGHT_OPTIONS: Required<HighlightOptions> = {
  preTag: '<mark>',
  postTag: '</mark>',
  fragmentSize: 150,
  numberOfFragments: 1,
};
