import { NextResponse } from 'next/server';
import { getMySQLPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - List all tables in the database
export async function GET() {
  try {
    const pool = getMySQLPool();

    // MariaDB returns the result directly, not in a tuple like mysql2
    const tables = await pool.query<any[]>(`
      SELECT
        TABLE_NAME as name,
        TABLE_ROWS as estimated_rows,
        DATA_LENGTH as data_size,
        INDEX_LENGTH as index_size,
        CREATE_TIME as created_at,
        UPDATE_TIME as updated_at
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    // Convert BigInt values to strings for JSON serialization
    const serializedTables = (Array.isArray(tables) ? tables : []).map((table: any) => ({
      ...table,
      estimated_rows: table.estimated_rows ? Number(table.estimated_rows) : 0,
      data_size: table.data_size ? Number(table.data_size) : 0,
      index_size: table.index_size ? Number(table.index_size) : 0,
    }));

    return NextResponse.json({
      success: true,
      count: serializedTables.length,
      tables: serializedTables,
    });
  } catch (error) {
    console.error('Schema list error:', error);
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
