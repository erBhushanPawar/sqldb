/**
 * Examples demonstrating SearchFilterModel integration with find/read methods
 *
 * This file shows how to use findMany(), findOne(), and count() methods
 * with SearchFilterModel for advanced filtering, pagination, and sorting.
 */

import { getDB } from '../db';
import { SearchFilterModel } from '../types'; // Adjust import path as needed

async function findExamples() {
  const db = await getDB();

  // ============================================================================
  // Example 1: Basic findMany with Exact Match Filters (andFilter)
  // ============================================================================
  const filter1 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      categoryId: 'cat-123',
      isActive: true
    }
  });

  const results1 = await db('services').findMany(filter1 as any);
  console.log('Example 1 - Basic findMany with exact filters:', results1);

  // ============================================================================
  // Example 2: findMany with LIKE Filters (likeFilter)
  // ============================================================================
  const filter2 = new SearchFilterModel({
    likeFilter: {
      title: 'plumb',      // Will match: plumber, plumbing, plumb, etc.
      description: 'repair'
    },
    andFilter: {
      status: 'PUBLISHED'
    }
  });

  const results2 = await db('services').findMany(filter2 as any);
  console.log('Example 2 - findMany with LIKE filters:', results2);

  // ============================================================================
  // Example 3: findMany with Range Filters (minimum/maximum)
  // ============================================================================
  const filter3 = new SearchFilterModel({
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

  const results3 = await db('services').findMany(filter3 as any);
  console.log('Example 3 - findMany with price range:', results3);

  // ============================================================================
  // Example 4: findMany with OR Conditions (orFilter)
  // ============================================================================
  const filter4 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED'
    },
    orFilter: [
      { categoryId: 'cat-plumbing' },
      { categoryId: 'cat-hvac' },
      { categoryId: 'cat-electrical' }
    ]
  });

  const results4 = await db('services').findMany(filter4 as any);
  console.log('Example 4 - findMany with OR conditions:', results4);

  // ============================================================================
  // Example 5: Complex Multi-Condition findMany
  // ============================================================================
  const filter5 = new SearchFilterModel({
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

  const results5 = await db('services').findMany(filter5 as any);
  console.log('Example 5 - Complex multi-condition findMany:', results5);

  // ============================================================================
  // Example 6: findMany with Pagination
  // ============================================================================
  const filter6 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED'
    },
    page: 2,
    limit: 20,
    orderBy: 'createdOn',
    order: 'DESC'
  });

  const results6 = await db('services').findMany(filter6 as any);
  console.log('Example 6 - Paginated findMany:', results6);

  // ============================================================================
  // Example 7: findMany with Field Selection
  // ============================================================================
  const filter7 = new SearchFilterModel({
    selectFields: ['id', 'title', 'price', 'rating', 'status'],
    andFilter: {
      status: 'PUBLISHED'
    },
    orderBy: 'price',
    order: 'ASC'
  });

  const results7 = await db('services').findMany(filter7 as any);
  console.log('Example 7 - findMany with field selection:', results7);

  // ============================================================================
  // Example 8: findOne with SearchFilterModel
  // ============================================================================
  const filter8 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      isActive: true
    },
    likeFilter: {
      title: 'emergency plumber'
    },
    orderBy: 'rating',
    order: 'DESC'
  });

  const result8 = await db('services').findOne(filter8 as any);
  console.log('Example 8 - findOne with filters:', result8);

  // ============================================================================
  // Example 9: count with SearchFilterModel
  // ============================================================================
  const filter9 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      isActive: true,
      price: {
        minimum: 50,
        maximum: 500
      }
    }
  });

  const count9 = await db('services').count(filter9 as any);
  console.log('Example 9 - count with filters:', count9);

  // ============================================================================
  // Example 10: Using Helper Methods for Dynamic Filters
  // ============================================================================
  const filter10 = new SearchFilterModel();

  // Build filters dynamically
  filter10.addToAndFilter({ status: 'PUBLISHED' });

  const userPriceRange = { min: 100, max: 500 };
  if (userPriceRange) {
    filter10.addToAndFilter({
      price: {
        minimum: userPriceRange.min,
        maximum: userPriceRange.max
      }
    });
  }

  filter10.addToLikeFilter({ title: 'repair' });

  const results10 = await db('services').findMany(filter10 as any);
  console.log('Example 10 - Dynamic filter building:', results10);

  // ============================================================================
  // Example 11: Date Range Queries
  // ============================================================================
  const filter11 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      createdOn: {
        minimum: new Date('2024-01-01'),
        maximum: new Date('2024-12-31')
      }
    },
    orderBy: 'createdOn',
    order: 'DESC',
    limit: 50
  });

  const results11 = await db('services').findMany(filter11 as any);
  console.log('Example 11 - Date range query:', results11);

  // ============================================================================
  // Example 12: IN Clause with Array Values
  // ============================================================================
  const filter12 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      categoryId: ['cat-plumbing', 'cat-electrical', 'cat-hvac'] // IN clause
    },
    limit: 100
  });

  const results12 = await db('services').findMany(filter12 as any);
  console.log('Example 12 - IN clause with array:', results12);

  // ============================================================================
  // Example 13: Combined with Standard FindOptions
  // ============================================================================
  const filter13 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED'
    }
  });

  // SearchFilterModel + FindOptions
  const results13 = await db('services').findMany(filter13 as any, {
    skipCache: true,
    withRelations: true,
    correlationId: 'req-123'
  });
  console.log('Example 13 - Combined with FindOptions:', results13);

  // ============================================================================
  // Example 14: Sorting with Multiple Fields (using orderBy from filter)
  // ============================================================================
  const filter14 = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED'
    },
    orderBy: 'rating',
    order: 'DESC',
    limit: 10
  });

  const results14 = await db('services').findMany(filter14 as any);
  console.log('Example 14 - Sorted results:', results14);
}

// ============================================================================
// Advanced Usage Patterns
// ============================================================================

/**
 * Pattern 1: Pagination Helper Function
 */
async function paginatedFind(page: number, limit: number, filters?: any) {
  const db = await getDB();

  const searchFilter = new SearchFilterModel({
    ...filters,
    page,
    limit,
    orderBy: filters?.orderBy || 'createdOn',
    order: filters?.order || 'DESC'
  });

  const results = await db('services').findMany(searchFilter as any);
  const total = await db('services').count(searchFilter as any);

  return {
    data: results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: (page + 1) * limit < total
    }
  };
}

/**
 * Pattern 2: Request Handler Integration (NestJS/Express)
 */
async function findFromRequest(req: any) {
  const db = await getDB();

  // Create SearchFilterModel from request
  const filter = SearchFilterModel.fromJson(req.body.filters || {});

  // Perform query
  const results = await db('services').findMany(filter as any, {
    skipCache: req.query.noCache === 'true'
  });

  const total = await db('services').count(filter as any);

  return {
    results,
    metadata: {
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / (filter.limit || 50))
    }
  };
}

/**
 * Pattern 3: Advanced Filtering with Business Logic
 */
async function findServicesWithBusinessLogic(userPreferences: any) {
  const db = await getDB();

  const filter = new SearchFilterModel({
    andFilter: {
      status: 'PUBLISHED',
      isActive: true
    }
  });

  // Apply user preferences
  if (userPreferences.priceRange) {
    filter.addToAndFilter({
      price: {
        minimum: userPreferences.priceRange.min,
        maximum: userPreferences.priceRange.max
      }
    });
  }

  if (userPreferences.minRating) {
    filter.addToAndFilter({
      rating: { minimum: userPreferences.minRating }
    });
  }

  if (userPreferences.categories && userPreferences.categories.length > 0) {
    filter.andFilter.categoryId = userPreferences.categories; // IN clause
  }

  if (userPreferences.searchTerm) {
    filter.addToLikeFilter({
      title: userPreferences.searchTerm,
      description: userPreferences.searchTerm
    });
  }

  // Set pagination and sorting
  filter.page = userPreferences.page || 0;
  filter.limit = userPreferences.limit || 20;
  filter.orderBy = userPreferences.sortBy || 'rating';
  filter.order = userPreferences.sortOrder || 'DESC';

  return await db('services').findMany(filter as any);
}

/**
 * Pattern 4: Combining Multiple Filters for Complex Queries
 */
async function complexQueryPattern() {
  const db = await getDB();

  const filter = new SearchFilterModel({
    // Base filters
    andFilter: {
      status: 'PUBLISHED',
      isVerified: true,
      availableNow: true
    },
    // Text search filters
    likeFilter: {
      tags: 'certified',
      providerName: 'Pro'
    },
    // Category options
    orFilter: [
      { category: 'plumbing' },
      { category: 'electrical' }
    ],
    // Pagination & sorting
    page: 0,
    limit: 50,
    orderBy: 'rating',
    order: 'DESC',
    // Field selection for performance
    selectFields: ['id', 'title', 'price', 'rating', 'status', 'categoryId']
  });

  // Add dynamic price filter
  const dynamicPriceRange = await getDynamicPriceRange(); // Some business logic
  if (dynamicPriceRange) {
    filter.addToAndFilter({
      price: {
        minimum: dynamicPriceRange.min,
        maximum: dynamicPriceRange.max
      }
    });
  }

  return await db('services').findMany(filter as any);
}

// Helper function
async function getDynamicPriceRange() {
  return { min: 50, max: 500 };
}

/**
 * Pattern 5: Batch Operations with Filters
 */
async function batchUpdateWithFilters() {
  const db = await getDB();

  // Find all records matching criteria
  const filter = new SearchFilterModel({
    andFilter: {
      status: 'DRAFT',
      isActive: false,
      createdOn: {
        maximum: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      }
    }
  });

  const records = await db('services').findMany(filter as any);

  // Perform batch operations
  for (const record of records) {
    await db('services').updateById((record as any).id, {
      status: 'ARCHIVED'
    });
  }

  return { updated: records.length };
}

export {
  findExamples,
  paginatedFind,
  findFromRequest,
  findServicesWithBusinessLogic,
  complexQueryPattern,
  batchUpdateWithFilters
};
