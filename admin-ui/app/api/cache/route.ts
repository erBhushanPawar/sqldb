import { NextRequest, NextResponse } from 'next/server';
import { getDB, getRedisClient } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Get cache statistics
export async function GET() {
  try {
    const redis = getRedisClient();

    if (!redis) {
      return NextResponse.json({
        success: false,
        error: 'Cache is not enabled',
      });
    }

    // Get Redis info
    const info = await redis.info('stats');
    const dbSize = await redis.dbsize();
    const memory = await redis.info('memory');

    // Parse info strings
    const parseInfo = (infoStr: string) => {
      const lines = infoStr.split('\r\n');
      const result: Record<string, string> = {};
      lines.forEach((line) => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            result[key] = value;
          }
        }
      });
      return result;
    };

    const stats = parseInfo(info);
    const memoryInfo = parseInfo(memory);

    return NextResponse.json({
      success: true,
      data: {
        totalKeys: dbSize,
        usedMemory: memoryInfo.used_memory_human,
        usedMemoryPeak: memoryInfo.used_memory_peak_human,
        hitRate: stats.keyspace_hits
          ? (
              (parseInt(stats.keyspace_hits) /
                (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses || '0'))) *
              100
            ).toFixed(2) + '%'
          : 'N/A',
        totalConnections: stats.total_connections_received,
        totalCommands: stats.total_commands_processed,
      },
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

// DELETE - Clear cache
export async function DELETE(request: NextRequest) {
  try {
    const db = await getDB();
    const searchParams = request.nextUrl.searchParams;
    const table = searchParams.get('table');
    const pattern = searchParams.get('pattern');

    if (table) {
      // Clear cache for specific table
      await db.clearTableCache(table);
      return NextResponse.json({
        success: true,
        message: `Cache cleared for table '${table}'`,
      });
    } else if (pattern) {
      // Clear cache by pattern
      const redis = getRedisClient();
      if (!redis) {
        return NextResponse.json(
          { success: false, error: 'Cache is not enabled' },
          { status: 400 }
        );
      }

      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }

      return NextResponse.json({
        success: true,
        message: `Cleared ${keys.length} cache keys matching pattern '${pattern}'`,
        clearedCount: keys.length,
      });
    } else {
      // Clear all cache
      await db.clearCache();
      return NextResponse.json({
        success: true,
        message: 'All cache cleared',
      });
    }
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
