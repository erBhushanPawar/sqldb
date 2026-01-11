import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Get schema for a specific table
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;

    // Use getTableSchema from the client, not from table operations
    const schema = db.getTableSchema(table);

    if (!schema) {
      return NextResponse.json(
        {
          success: false,
          error: `Schema not found for table '${table}'. Table may not exist or schema discovery may not be complete.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      table,
      schema,
    });
  } catch (error) {
    console.error('Schema discovery error:', error);
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
