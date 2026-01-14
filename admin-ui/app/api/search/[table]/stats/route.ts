import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

/**
 * GET /api/search/[table]/stats
 *
 * Get search index statistics including:
 * - Total documents indexed
 * - Total unique terms
 * - Total tokens (including duplicates)
 * - Last build time
 * - Build duration
 * - Memory usage estimate
 * - Indexed fields
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const db = await getDB();
    const tableOps = db(table);

    // Get search index statistics
    const stats = await tableOps.getSearchStats();

    if (!stats) {
      return NextResponse.json(
        {
          success: false,
          message: 'No search index found for this table',
          stats: null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      table,
      stats: {
        totalDocuments: stats.totalDocuments || 0,
        totalTerms: stats.totalTerms || 0,
        totalTokens: stats.totalTokens || 0,
        lastBuildTime: stats.lastBuildTime || null,
        buildDurationMs: stats.buildDurationMs || 0,
        memoryUsageBytes: stats.memoryUsageBytes || 0,
        memoryUsageMB: stats.memoryUsageBytes
          ? (stats.memoryUsageBytes / (1024 * 1024)).toFixed(2)
          : '0',
        fields: stats.fields || [],
        // Geo-search stats if available
        geo: stats.geo ? {
          totalDocuments: stats.geo.totalDocuments || 0,
          bucketCounts: stats.geo.bucketCounts || {},
          normalizedLocations: stats.geo.normalizedLocations || 0,
          indexSize: stats.geo.indexSize || 0,
        } : null,
      },
    });
  } catch (error) {
    console.error('Search stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
