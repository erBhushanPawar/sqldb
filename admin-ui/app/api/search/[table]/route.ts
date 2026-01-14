import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Perform search (with query parameters)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get('q') || '';
    const fields = searchParams.get('fields')?.split(',').map(f => f.trim()) || [];
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const minScore = parseFloat(searchParams.get('minScore') || '0');

    // Geo-search parameters
    const geoEnabled = searchParams.get('geoEnabled') === 'true';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radius = searchParams.get('radius');
    const radiusUnit = searchParams.get('radiusUnit') || 'km';
    const maxRange = searchParams.get('maxRange'); // Cluster expansion max range
    const minResults = searchParams.get('minResults'); // Minimum results before expansion
    const locationName = searchParams.get('locationName');
    const bucketId = searchParams.get('bucketId');
    const geoPriority = searchParams.get('geoPriority') || 'balanced'; // 'geo-first', 'text-first', 'balanced'

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Search query is required' },
        { status: 400 }
      );
    }

    // Build search options
    const searchOptions: any = {
      fields: fields.length > 0 ? fields : undefined,
      limit,
      offset,
      minScore,
    };

    // Add geo-search options if enabled
    if (geoEnabled) {
      // Only add geo options if we have valid geo parameters
      if ((lat && lng && radius) || locationName || bucketId) {
        searchOptions.geo = {};

        // Set priority mode
        searchOptions.geo.priority = geoPriority;

        // Search by coordinates + radius
        if (lat && lng && radius) {
          searchOptions.geo.center = {
            lat: parseFloat(lat),
            lng: parseFloat(lng),
          };
          searchOptions.geo.radius = {
            value: parseFloat(radius),
            unit: radiusUnit as 'km' | 'mi' | 'm',
          };

          // Add cluster expansion parameters if provided
          if (maxRange) {
            searchOptions.geo.maxRange = {
              value: parseFloat(maxRange),
              unit: radiusUnit as 'km' | 'mi' | 'm',
            };
          }
          if (minResults) {
            searchOptions.geo.minResults = parseInt(minResults, 10);
          }

          searchOptions.geo.includeDistance = true;
          searchOptions.geo.sortByDistance = geoPriority === 'geo-first';
        }
        // Search by location name
        else if (locationName) {
          searchOptions.geo.locationName = locationName;
          searchOptions.geo.radius = radius ? {
            value: parseFloat(radius),
            unit: radiusUnit as 'km' | 'mi' | 'm',
          } : undefined;
        }
        // Search by bucket
        else if (bucketId) {
          searchOptions.geo.bucketId = bucketId;
        }
      }
    }

    console.log('🔍 Search request:', { query, searchOptions });

    const results = await db(table).search(query, searchOptions);

    console.log(`✅ Search complete: ${results.length} results found`);

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
      geoEnabled,
      searchOptions, // Include for debugging
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST - Perform search
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;
    const body = await request.json();

    const {
      query,
      fields = [],
      limit = 10,
      offset = 0,
      minScore = 0,
      highlight = {},
    } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Search query is required' },
        { status: 400 }
      );
    }

    const results = await db(table).search(query, {
      fields,
      limit,
      offset,
      minScore,
      highlight,
    });

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
