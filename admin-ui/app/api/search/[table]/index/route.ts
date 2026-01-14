import { NextRequest, NextResponse } from 'next/server';
import { getDB, searchConfigs } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST - Build search index
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;

    // Check if configuration exists for this table
    const userConfig = searchConfigs.get(table);
    if (!userConfig) {
      return NextResponse.json(
        {
          success: false,
          error: `No search configuration found for table '${table}'. Please save configuration first in the Config tab.`
        },
        { status: 400 }
      );
    }

    const tableOps = db(table);

    if (!tableOps.buildSearchIndex) {
      return NextResponse.json(
        {
          success: false,
          error: `Search is not configured. Please ensure Redis is running and ENABLE_CACHE=true in .env file.`
        },
        { status: 400 }
      );
    }

    // Check if table has data before building
    const sampleData = await tableOps.findMany({}, { limit: 1 });
    console.log(`📊 Table '${table}' data check: ${sampleData.length} record(s) found`);

    if (sampleData.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Table '${table}' appears to be empty. Cannot build search index without data.`,
        hint: 'Make sure the table has records before building the search index.',
      }, { status: 400 });
    }

    // Build index (configuration is already registered in InvertedIndexManager during DB init)
    console.log(`🔨 Building search index for table '${table}'...`);
    const stats = await tableOps.buildSearchIndex();
    console.log(`✅ Index build complete:`, stats);

    // Prepare response message
    let message = `Search index built for table '${table}'`;
    if (stats.geoBuckets && stats.geoBuckets.totalBuckets > 0) {
      message += ` with ${stats.geoBuckets.totalBuckets} geo-location clusters`;
    }

    return NextResponse.json({
      success: true,
      message,
      stats,
    });
  } catch (error) {
    console.error('Build search index error:', error);

    let errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide helpful error messages
    if (errorMessage.includes('Search is not enabled')) {
      errorMessage = 'Search functionality is not available. Please ensure:\n' +
        '1. Redis is running (required for search)\n' +
        '2. ENABLE_CACHE=true in your .env file\n' +
        '3. Redis connection details are correct in .env';
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        hint: 'Check that Redis is running and ENABLE_CACHE=true in your .env file',
      },
      { status: 500 }
    );
  }
}

// DELETE - Clear search index
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;

    await db(table).clearSearchIndex();

    return NextResponse.json({
      success: true,
      message: `Search index cleared for table '${table}'`,
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
