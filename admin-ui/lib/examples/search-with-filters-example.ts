/**
 * Examples demonstrating enhanced search with SearchFilterModel integration
 *
 * This file shows how to use the search() method with various filter combinations
 * including andFilter, orFilter, likeFilter, range queries, and geo-search.
 */

import { getDB } from '../db';
import { SearchFilterModel } from '../types'; // Adjust import path as needed

async function searchExamples() {
  const db = await getDB();

  // ============================================================================
  // Example 1: Basic Text Search with Exact Match Filters (andFilter)
  // ============================================================================
  const example1 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      categoryId: 'cat-123',
      isActive: true
    }
  });

  const results1 = await db('services').search('plumbing repair', {
    filters: example1,
    limit: 20,
    highlightFields: ['title', 'description']
  });

  console.log('Example 1 - Basic search with exact filters:', results1);

  // ============================================================================
  // Example 2: Text Search with LIKE Filters (likeFilter)
  // ============================================================================
  const example2 = new SearchFilterModel({
    likeFilter: {
      title: 'plumb',      // Will match: plumber, plumbing, plumb, etc.
      location: 'New York' // Will match: New York City, New York, etc.
    },
    andFilter: {
      status: 'PUBLISHED'
    }
  });

  const results2 = await db('services').search('emergency', {
    filters: example2,
    limit: 10
  });

  console.log('Example 2 - Search with LIKE filters:', results2);

  // ============================================================================
  // Example 3: Text Search with Range Filters (minimum/maximum)
  // ============================================================================
  const example3 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      price: {
        minimum: 50,
        maximum: 500
      },
      rating: {
        minimum: 4.0
      }
    }
  });

  const results3 = await db('services').search('cleaning', {
    filters: example3,
    limit: 15
  });

  console.log('Example 3 - Search with price range:', results3);

  // ============================================================================
  // Example 4: Text Search with OR Conditions (orFilter)
  // ============================================================================
  const example4 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED'
    },
    orFilter: [
      { categoryId: 'cat-plumbing' },
      { categoryId: 'cat-hvac' },
      { categoryId: 'cat-electrical' }
    ]
  });

  const results4 = await db('services').search('repair', {
    filters: example4,
    limit: 20
  });

  console.log('Example 4 - Search with OR conditions:', results4);

  // ============================================================================
  // Example 5: Complex Multi-Condition Search
  // ============================================================================
  const example5 = new SearchFilterModel({
    // Exact matches
    andFilter: {
      status: 'PUBLISHED',
      isVerified: true,
      price: {
        minimum: 100,
        maximum: 1000
      }
    },
    // Partial matches
    likeFilter: {
      providerName: 'Pro Services'
    },
    // Multiple OR conditions
    orFilter: [
      { urgency: 'emergency' },
      { priority: 'high' }
    ]
  });

  const results5 = await db('services').search('installation', {
    filters: example5,
    limit: 25,
    minScore: 0.5,
    highlightFields: ['title', 'description']
  });

  console.log('Example 5 - Complex multi-condition search:', results5);

  // ============================================================================
  // Example 6: Search with Wildcard Query (Alternative to main query)
  // ============================================================================
  const example6 = new SearchFilterModel({
    wildcardQueryString: 'house',
    wildCardMatchWithFields: ['title', 'description', 'tags'],
    andFilter: {
      status: 'PUBLISHED'
    }
  });

  const results6 = await db('services').search('', {
    filters: example6,
    limit: 10
  });

  console.log('Example 6 - Wildcard search across fields:', results6);

  // ============================================================================
  // Example 7: Geo-Search with Filters (Manual geo options)
  // ============================================================================
  const example7 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      serviceType: 'plumbing'
    }
  });

  const results7 = await db('services').search('emergency plumber', {
    filters: example7,
    geo: {
      center: { lat: 40.7128, lng: -74.0060 }, // New York coordinates
      radius: 10, // 10 km radius
      sortByDistance: true,
      priority: 'geo-first' // Prioritize location over text match
    },
    limit: 15
  });

  console.log('Example 7 - Geo-search with filters:', results7);

  // ============================================================================
  // Example 7b: Geo-Search using setGeoLocation (Automatic)
  // ============================================================================
  const example7b = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      serviceType: 'plumbing'
    }
  });

  // This automatically adds latitude and longitude to andFilter
  example7b.setGeoLocation(40.7128, -74.0060); // New York coordinates

  // The search method will auto-detect geo coordinates and create geo options
  const results7b = await db('services').search('emergency plumber', {
    filters: example7b,
    limit: 15
  });

  console.log('Example 7b - Auto geo-search:', results7b);

  // ============================================================================
  // Example 7c: Geo-Search with Custom Radius
  // ============================================================================
  const example7c = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      latitude: 40.7128,  // Coordinates in andFilter
      longitude: -74.0060
    }
  });

  // Override auto-detected geo options with custom radius
  const results7c = await db('services').search('plumber', {
    filters: example7c,
    geo: {
      radius: 50, // 50 km radius (overrides default 25km)
      maxRange: 100, // Expand up to 100km if needed
      minResults: 10, // Try to get at least 10 results
      sortByDistance: true
    },
    limit: 20
  });

  console.log('Example 7c - Custom geo radius:', results7c);

  // ============================================================================
  // Example 8: Search with Pagination
  // ============================================================================
  const example8 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED'
    },
    page: 2,
    limit: 20,
    orderBy: 'createdOn',
    order: 'DESC'
  });

  const results8 = await db('services').search('repair service', {
    filters: example8,
    limit: example8.limit,
    offset: example8.skip
  });

  console.log('Example 8 - Paginated search:', results8);

  // ============================================================================
  // Example 9: Using Helper Methods
  // ============================================================================
  const example9 = new SearchFilterModel();

  // Use helper methods to build filters dynamically
  example9.addToAndFilter({ status: 'PUBLISHED', isActive: true });
  example9.addToLikeFilter({ title: 'repair' });
  example9.addToAndFilter({
    price: { minimum: 50, maximum: 500 }
  });

  const results9 = await db('services').search('emergency', {
    filters: example9,
    limit: 10
  });

  console.log('Example 9 - Dynamic filter building:', results9);

  // ============================================================================
  // Example 10: Search with Selected Fields
  // ============================================================================
  const example10 = new SearchFilterModel({
    selectFields: ['id', 'title', 'price', 'rating', 'status'],
    andFilter: {
      status: 'PUBLISHED'
    }
  });

  const results10 = await db('services').search('installation', {
    filters: example10,
    fields: example10.selectFields,
    limit: 20
  });

  console.log('Example 10 - Search with field selection:', results10);

  // ============================================================================
  // Example 11: Using transferAllToAndFilter for Complex Queries
  // ============================================================================
  const example11 = new SearchFilterModel({
    likeFilter: {
      title: 'plumbing',
      description: 'emergency'
    },
    andFilter: {
      status: 'PUBLISHED'
    }
  });

  // Transfer all LIKE filters to AND filter (converts to exact Like() operators)
  example11.transferAllToAndFilter();

  const results11 = await db('services').search('repair', {
    filters: example11,
    limit: 15
  });

  console.log('Example 11 - Transferred filters:', results11);

  // ============================================================================
  // Example 12: Date Range Search
  // ============================================================================
  const example12 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      createdOn: {
        minimum: new Date('2024-01-01'),
        maximum: new Date('2024-12-31')
      }
    }
  });

  const results12 = await db('services').search('maintenance', {
    filters: example12,
    limit: 20
  });

  console.log('Example 12 - Date range search:', results12);
}

// ============================================================================
// Advanced Usage Patterns
// ============================================================================

/**
 * Pattern 1: Request Handler Integration (NestJS/Express)
 */
async function searchFromRequest(req: any) {
  const db = await getDB();

  // Create SearchFilterModel from request body
  const searchFilter = SearchFilterModel.fromJson(req.body.filters || {});

  // Extract search query from request
  const query = req.body.query || req.query.q || '';

  // Perform search
  const results = await db('services').search(query, {
    filters: searchFilter,
    limit: searchFilter.limit || 20,
    offset: searchFilter.skip || 0,
    highlightFields: ['title', 'description'],
    minScore: 0.3
  });

  return {
    results: results.map(r => ({
      ...r.data,
      _score: r.score,
      _highlights: r.highlights
    })),
    metadata: {
      total: results.length,
      page: searchFilter.page,
      limit: searchFilter.limit
    }
  };
}

/**
 * Pattern 2: Combining Multiple Filter Types
 */
async function advancedFilterCombination() {
  const db = await getDB();

  const filter = new SearchFilterModel({
    // Exact matches for core criteria
    andFilter: {
      status: 'PUBLISHED',
      isVerified: true,
      availableNow: true
    },
    // Fuzzy matches for text fields
    likeFilter: {
      providerName: 'Pro',
      tags: 'certified'
    },
    // Multiple category options
    orFilter: [
      { category: 'plumbing' },
      { category: 'electrical' },
      { category: 'hvac' }
    ]
  });

  // Add dynamic filters based on user preferences
  if (Math.random() > 0.5) {
    filter.addToAndFilter({
      price: { minimum: 0, maximum: 500 }
    });
  }

  return await db('services').search('emergency repair', {
    filters: filter,
    limit: 30,
    highlightFields: ['title', 'description'],
    minScore: 0.4
  });
}

/**
 * Pattern 3: Geo-Spatial Search with Business Logic
 */
async function geoSpatialSearch(userLat: number, userLng: number, searchQuery: string) {
  const db = await getDB();

  const filter = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      isActive: true,
      rating: { minimum: 4.0 }
    }
  });

  filter.setGeoLocation(userLat, userLng);

  return await db('services').search(searchQuery, {
    filters: filter,
    geo: {
      center: { lat: userLat, lng: userLng },
      radius: 25, // 25km radius
      sortByDistance: true,
      priority: 'geo-first' // Prioritize location over text match
    },
    limit: 20,
    highlightFields: ['title', 'description']
  });
}

export {
  searchExamples,
  searchFromRequest,
  advancedFilterCombination,
  geoSpatialSearch
};
