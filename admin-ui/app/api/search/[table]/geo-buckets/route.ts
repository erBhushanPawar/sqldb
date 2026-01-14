import { NextRequest, NextResponse } from 'next/server';
import { getDB, searchConfigs } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST - Build/Rebuild geo-buckets with specified parameters
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;
    const body = await request.json();

    const {
      bucketSize = 5,
      gridSizeKm = 10,
      minBucketSize = 3,
    } = body;

    // Check if configuration exists for this table
    const config = searchConfigs.get(table);
    if (!config?.geo?.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geo-search is not enabled for this table',
        },
        { status: 400 }
      );
    }

    const tableOps = db(table);

    if (!tableOps.buildGeoBuckets) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geo-bucket functionality is not available. Ensure you are using the latest SqlDB version.',
        },
        { status: 400 }
      );
    }

    console.log(`🗂️  Building geo-buckets for table '${table}' with parameters:`, {
      bucketSize,
      gridSizeKm,
      minBucketSize,
    });

    // First, build/update the geo index to ensure all data is indexed
    // This step is optional - if it fails, we'll still try to build buckets from existing geo data
    if (tableOps.buildGeoIndex) {
      try {
        console.log(`📍 Building geo index for table '${table}'...`);
        const indexResult = await tableOps.buildGeoIndex();
        console.log(`✅ Geo index built: ${indexResult.indexed} documents indexed`);
      } catch (buildError) {
        console.warn(`⚠️  Could not build geo index: ${buildError instanceof Error ? buildError.message : buildError}`);
        console.log(`Proceeding to build geo-buckets from existing geo data...`);
      }
    }

    // Build geo-buckets
    const result = await tableOps.buildGeoBuckets({
      targetBucketSize: bucketSize,
      gridSizeKm,
      minBucketSize,
    });

    console.log(`✅ Geo-buckets built:`, result);

    return NextResponse.json({
      success: true,
      message: `Geo-buckets created for table '${table}'`,
      buckets: result,
    });
  } catch (error) {
    console.error('Build geo-buckets error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - Get geo-bucket information and statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;

    // Check if configuration exists for this table
    const config = searchConfigs.get(table);
    if (!config?.geo?.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geo-search is not enabled for this table',
        },
        { status: 400 }
      );
    }

    const tableOps = db(table);

    if (!tableOps.getGeoBuckets) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geo-bucket functionality is not available',
        },
        { status: 400 }
      );
    }

    // Get bucket information
    const buckets = await tableOps.getGeoBuckets();

    console.log(`📦 Retrieved ${buckets.length} geo-buckets for table '${table}'`);
    if (buckets.length > 0) {
      console.log(`   Sample bucket:`, {
        id: buckets[0].id,
        center: buckets[0].center,
        count: buckets[0].count,
        locationName: buckets[0].locationName,
      });
    }

    // Calculate statistics
    const stats = {
      totalBuckets: buckets.length,
      totalItems: buckets.reduce((sum: number, b: any) => sum + b.count, 0),
      avgItemsPerBucket: buckets.length > 0
        ? (buckets.reduce((sum: number, b: any) => sum + b.count, 0) / buckets.length).toFixed(1)
        : 0,
      minBucketSize: buckets.length > 0 ? Math.min(...buckets.map((b: any) => b.count)) : 0,
      maxBucketSize: buckets.length > 0 ? Math.max(...buckets.map((b: any) => b.count)) : 0,
      locationBreakdown: buckets.reduce((acc: any, b: any) => {
        if (b.locationName) {
          acc[b.locationName] = (acc[b.locationName] || 0) + b.count;
        }
        return acc;
      }, {}),
    };

    const response = {
      success: true,
      buckets,
      stats,
    };

    console.log(`✅ Returning geo-buckets response:`, {
      success: response.success,
      bucketCount: response.buckets.length,
      stats: response.stats,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Get geo-buckets error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
