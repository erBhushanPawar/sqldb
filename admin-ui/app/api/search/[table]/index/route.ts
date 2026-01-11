import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST - Build search index
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;

    // buildSearchIndex() takes no parameters - search config comes from SqlDB initialization
    const tableOps = db(table);

    if (!tableOps.buildSearchIndex) {
      return NextResponse.json(
        {
          success: false,
          error: `Search is not configured for table '${table}'. Configure search in SqlDB initialization.`
        },
        { status: 400 }
      );
    }

    const stats = await tableOps.buildSearchIndex();

    return NextResponse.json({
      success: true,
      message: `Search index built for table '${table}'`,
      stats,
    });
  } catch (error) {
    console.error('Build search index error:', error);
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
