/**
 * Geographic Search Example - Demonstrates location-based search capabilities
 *
 * This example shows how to:
 * 1. Configure geo-search for tables with latitude/longitude data
 * 2. Search for services/items within a radius
 * 3. Use geographic buckets for regional results
 * 4. Normalize location names (handle city name variations)
 * 5. Combine text search with geo-search
 */

import { createSqlDB } from '../src/index';
import { MAJOR_CITY_BUCKETS } from '../src/types/geo-search';

async function main() {
  // Initialize SqlDB with geo-search enabled
  const db = await createSqlDB({
    mariadb: {
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'password',
      database: 'myapp',
    },
    redis: {
      host: 'localhost',
      port: 6379,
    },
    search: {
      enabled: true,
      invertedIndex: {
        enabled: true,
        tables: {
          // Configure geo-search for 'services' table
          services: {
            // Text search fields
            searchableFields: ['title', 'description', 'category'],
            tokenizer: 'stemming',
            minWordLength: 3,
            fieldBoosts: {
              title: 3.0,
              category: 2.0,
              description: 1.0,
            },

            // Geo-search configuration
            geo: {
              enabled: true,
              latitudeField: 'latitude',    // Column name for latitude
              longitudeField: 'longitude',   // Column name for longitude
              locationNameField: 'city',     // Optional: column for city/location name

              // Use pre-defined major city buckets
              buckets: MAJOR_CITY_BUCKETS,

              // Enable automatic location name normalization
              // This handles variations like "NYC" -> "New York City"
              autoNormalize: true,

              // Default search radius when not specified
              defaultRadius: { value: 25, unit: 'km' },

              // Maximum allowed search radius (prevents very broad searches)
              maxRadius: { value: 500, unit: 'km' },

              // Combine with text search for powerful "pizza near me" queries
              combineWithTextSearch: true,

              // Custom location mappings for your specific use case
              locationMappings: [
                {
                  original: 'Bay Area',
                  canonical: 'San Francisco',
                  coordinates: { lat: 37.7749, lng: -122.4194 },
                  aliases: ['SF Bay Area', 'Silicon Valley', 'SFO'],
                },
                {
                  original: 'Tri-State Area',
                  canonical: 'New York City',
                  coordinates: { lat: 40.7128, lng: -74.006 },
                  aliases: ['NYC Metro', 'Greater NYC'],
                },
              ],

              // Common location aliases
              commonAliases: {
                'NYC': 'New York City',
                'LA': 'Los Angeles',
                'SF': 'San Francisco',
                'Chi-town': 'Chicago',
                'H-Town': 'Houston',
              },
            },
          },

          // Configure geo-search for 'restaurants' table
          restaurants: {
            searchableFields: ['name', 'cuisine', 'description'],
            tokenizer: 'stemming',

            geo: {
              enabled: true,
              latitudeField: 'lat',
              longitudeField: 'lon',
              locationNameField: 'location',
              buckets: MAJOR_CITY_BUCKETS,
              autoNormalize: true,
              defaultRadius: { value: 10, unit: 'km' }, // Smaller radius for restaurants
              combineWithTextSearch: true,

              // Distance-based boosting - prefer closer results
              distanceBoost: [
                {
                  distance: { value: 2, unit: 'km' },  // Within 2km
                  boost: 2.0,                           // 2x relevance boost
                },
                {
                  distance: { value: 5, unit: 'km' },  // Within 5km
                  boost: 1.5,                           // 1.5x relevance boost
                },
              ],
            },
          },

          // Configure geo-search for 'events' table
          events: {
            searchableFields: ['title', 'description', 'tags'],
            tokenizer: 'stemming',

            geo: {
              enabled: true,
              latitudeField: 'venue_lat',
              longitudeField: 'venue_lng',
              locationNameField: 'venue_city',
              buckets: MAJOR_CITY_BUCKETS,
              autoNormalize: true,
              defaultRadius: { value: 50, unit: 'km' },
              combineWithTextSearch: true,
            },
          },
        },
      },
    },
  });

  console.log('SqlDB initialized with geo-search capabilities!\n');

  // ======================
  // Example 1: Search by radius
  // ======================
  console.log('=== Example 1: Search services within 25km of Times Square ===');
  const servicesNearby = await db('services').search('', {
    geo: {
      center: { lat: 40.7580, lng: -73.9855 }, // Times Square coordinates
      radius: { value: 25, unit: 'km' },
      includeDistance: true,
      sortByDistance: true,
      limit: 10,
    },
  });

  console.log(`Found ${servicesNearby.length} services:`);
  servicesNearby.forEach((result) => {
    console.log(
      `- ${result.document.title} (${result.distance?.value.toFixed(2)} ${result.distance?.unit} away)`
    );
  });

  // ======================
  // Example 2: Search by city name (with auto-normalization)
  // ======================
  console.log('\n=== Example 2: Search for "pizza" in NYC (handles variations) ===');

  // These all work the same due to location normalization:
  const locations = ['New York City', 'NYC', 'Manhattan', 'The Big Apple'];

  for (const location of locations) {
    const results = await db('restaurants').search('pizza', {
      geo: {
        locationName: location,  // Automatically normalized to canonical form
        radius: { value: 5, unit: 'km' },
        limit: 5,
      },
    });

    console.log(`\nSearching "${location}" -> ${results.length} results`);
  }

  // ======================
  // Example 3: Search within a bucket (regional search)
  // ======================
  console.log('\n=== Example 3: All tech services in SF Bay Area bucket ===');
  const bayAreaServices = await db('services').search('technology', {
    geo: {
      bucketId: 'sf',  // San Francisco bucket from MAJOR_CITY_BUCKETS
      limit: 20,
    },
  });

  console.log(`Found ${bayAreaServices.length} tech services in SF area`);
  bayAreaServices.forEach((result) => {
    console.log(`- ${result.document.title} in ${result.bucket?.name}`);
  });

  // ======================
  // Example 4: Combined text + geo search
  // ======================
  console.log('\n=== Example 4: Find "yoga studios" near current location ===');
  const userLocation = { lat: 40.7489, lng: -73.9680 }; // User's current location

  const nearbyYoga = await db('services').search('yoga studio', {
    geo: {
      center: userLocation,
      radius: { value: 3, unit: 'km' }, // Very local search
      includeDistance: true,
      sortByDistance: true,
    },
  });

  console.log(`Found ${nearbyYoga.length} yoga studios nearby:`);
  nearbyYoga.forEach((result) => {
    console.log(
      `- ${result.document.title}`,
      `\n  Distance: ${result.distance?.value.toFixed(2)} ${result.distance?.unit}`,
      `\n  Text relevance: ${result.textScore?.toFixed(2)}`,
      `\n  Combined score: ${result.relevanceScore.toFixed(2)}\n`
    );
  });

  // ======================
  // Example 5: Distance-based boosting
  // ======================
  console.log('\n=== Example 5: Restaurants with distance boosting ===');
  const restaurants = await db('restaurants').search('italian', {
    geo: {
      center: { lat: 40.7128, lng: -74.006 },
      radius: { value: 10, unit: 'km' },
      includeDistance: true,

      // Boost nearby restaurants in rankings
      distanceBoost: [
        { distance: { value: 1, unit: 'km' }, boost: 3.0 },  // 3x boost within 1km
        { distance: { value: 3, unit: 'km' }, boost: 1.5 },  // 1.5x boost within 3km
      ],
    },
  });

  console.log('Top Italian restaurants (boosted by proximity):');
  restaurants.slice(0, 5).forEach((result, i) => {
    console.log(
      `${i + 1}. ${result.document.name}`,
      `(${result.distance?.value.toFixed(2)} ${result.distance?.unit}, score: ${result.relevanceScore.toFixed(2)})`
    );
  });

  // ======================
  // Example 6: Multi-city search
  // ======================
  console.log('\n=== Example 6: Find events across multiple cities ===');
  const cities = ['nyc', 'la', 'chicago']; // Bucket IDs

  for (const cityId of cities) {
    const events = await db('events').search('conference', {
      geo: {
        bucketId: cityId,
        limit: 5,
      },
    });

    const bucket = MAJOR_CITY_BUCKETS.find((b) => b.id === cityId);
    console.log(`\n${bucket?.name}: ${events.length} conferences`);
  }

  // ======================
  // Example 7: Get geo-search statistics
  // ======================
  console.log('\n=== Example 7: Geo-search index statistics ===');
  const stats = await db('services').getSearchStats();

  if (stats?.geo) {
    console.log(`Total geo-indexed documents: ${stats.geo.totalDocuments}`);
    console.log(`Normalized locations: ${stats.geo.normalizedLocations}`);
    console.log('Documents per bucket:');
    Object.entries(stats.geo.bucketCounts).forEach(([bucketId, count]) => {
      const bucket = MAJOR_CITY_BUCKETS.find((b) => b.id === bucketId);
      console.log(`  ${bucket?.name || bucketId}: ${count}`);
    });
  }

  await db.close();
}

main().catch(console.error);
