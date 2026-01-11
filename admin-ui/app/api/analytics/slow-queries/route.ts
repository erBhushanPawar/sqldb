import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = await getDB();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const threshold = parseInt(searchParams.get('threshold') || '100', 10); // ms
    const table = searchParams.get('table');

    // Get stats table name from config
    const statsTableName = db.getStatsTableName();
    const tableOps = db(statsTableName);

    // Build SQL query to get slow queries
    const sql = table
      ? `SELECT * FROM ${statsTableName}
         WHERE execution_time_ms >= ? AND table_name = ?
         ORDER BY execution_time_ms DESC
         LIMIT ?`
      : `SELECT * FROM ${statsTableName}
         WHERE execution_time_ms >= ?
         ORDER BY execution_time_ms DESC
         LIMIT ?`;

    const params = table
      ? [threshold, table, limit]
      : [threshold, limit];

    let slowQueries: any[] = [];
    try {
      slowQueries = await tableOps.raw(sql, params);
    } catch (error: any) {
      // If table doesn't exist, return empty array
      if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) {
        console.log('Query stats table does not exist yet');
        slowQueries = [];
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      threshold: `${threshold}ms`,
      count: slowQueries.length,
      queries: slowQueries,
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
