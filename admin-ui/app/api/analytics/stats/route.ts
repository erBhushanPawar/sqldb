import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = await getDB();
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table');
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    // Calculate timestamp threshold
    const threshold = new Date();
    threshold.setHours(threshold.getHours() - hours);

    // Get stats table name from config
    const statsTableName = db.getStatsTableName();
    const tableOps = db(statsTableName);

    let allStats: any[] = [];
    try {
      const sql = table
        ? `SELECT * FROM ${statsTableName} WHERE created_at >= ? AND table_name = ?`
        : `SELECT * FROM ${statsTableName} WHERE created_at >= ?`;
      const params = table ? [threshold.toISOString(), table] : [threshold.toISOString()];

      allStats = await tableOps.raw(sql, params);
    } catch (error: any) {
      // If table doesn't exist, return empty stats
      if (error.code === 'ER_NO_SUCH_TABLE' || error.errno === 1146) {
        console.log('Query stats table does not exist yet');
        allStats = [];
      } else {
        throw error;
      }
    }

    // Calculate statistics manually
    const totalQueries = allStats.length;
    const cacheHits = allStats.filter((s: any) => s.cache_hit === 1 || s.cache_hit === true).length;
    const cacheMisses = totalQueries - cacheHits;

    const executionTimes = allStats.map((s: any) => parseFloat(s.execution_time_ms || 0));
    const avgExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0;
    const minExecutionTime = executionTimes.length > 0 ? Math.min(...executionTimes) : 0;
    const maxExecutionTime = executionTimes.length > 0 ? Math.max(...executionTimes) : 0;

    const stats = {
      total_queries: totalQueries,
      avg_execution_time: avgExecutionTime,
      min_execution_time: minExecutionTime,
      max_execution_time: maxExecutionTime,
      cache_hits: cacheHits,
      cache_misses: cacheMisses,
    };

    // Calculate cache hit rate
    const cacheHitRate = totalQueries > 0
      ? ((cacheHits / totalQueries) * 100).toFixed(2)
      : '0.00';

    // Get query type breakdown
    const queryTypeMap = new Map<string, { count: number; totalTime: number }>();
    allStats.forEach((stat: any) => {
      const type = stat.query_type || 'unknown';
      const existing = queryTypeMap.get(type) || { count: 0, totalTime: 0 };
      existing.count++;
      existing.totalTime += parseFloat(stat.execution_time_ms || 0);
      queryTypeMap.set(type, existing);
    });

    const queryTypeStats = Array.from(queryTypeMap.entries()).map(([type, data]) => ({
      query_type: type,
      count: data.count,
      avg_time: data.count > 0 ? data.totalTime / data.count : 0,
    })).sort((a, b) => b.count - a.count);

    // Get table breakdown (if not filtered by specific table)
    let tableStats: any[] = [];
    if (!table) {
      const tableMap = new Map<string, { count: number; totalTime: number }>();
      allStats.forEach((stat: any) => {
        const tableName = stat.table_name || 'unknown';
        const existing = tableMap.get(tableName) || { count: 0, totalTime: 0 };
        existing.count++;
        existing.totalTime += parseFloat(stat.execution_time_ms || 0);
        tableMap.set(tableName, existing);
      });

      tableStats = Array.from(tableMap.entries())
        .map(([name, data]) => ({
          table_name: name,
          count: data.count,
          avg_time: data.count > 0 ? data.totalTime / data.count : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    // Get performance over time (hourly breakdown)
    const timelineMap = new Map<string, { count: number; totalTime: number; cacheHits: number }>();
    allStats.forEach((stat: any) => {
      const date = new Date(stat.created_at);
      const hour = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00:00`;
      const existing = timelineMap.get(hour) || { count: 0, totalTime: 0, cacheHits: 0 };
      existing.count++;
      existing.totalTime += parseFloat(stat.execution_time_ms || 0);
      if (stat.cache_hit === 1 || stat.cache_hit === true) existing.cacheHits++;
      timelineMap.set(hour, existing);
    });

    const performanceTimeline = Array.from(timelineMap.entries())
      .map(([hour, data]) => ({
        hour,
        query_count: data.count,
        avg_time: data.count > 0 ? data.totalTime / data.count : 0,
        cache_hits: data.cacheHits,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return NextResponse.json({
      success: true,
      timeRange: `Last ${hours} hours`,
      summary: {
        totalQueries: stats.total_queries || 0,
        avgExecutionTime: parseFloat(stats.avg_execution_time || 0).toFixed(2),
        minExecutionTime: parseFloat(stats.min_execution_time || 0).toFixed(2),
        maxExecutionTime: parseFloat(stats.max_execution_time || 0).toFixed(2),
        cacheHits: stats.cache_hits || 0,
        cacheMisses: stats.cache_misses || 0,
        cacheHitRate: `${cacheHitRate}%`,
      },
      queryTypes: queryTypeStats,
      tables: tableStats,
      timeline: performanceTimeline,
    });
  } catch (error) {
    console.error('Analytics stats error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
