import { NextRequest, NextResponse } from 'next/server';
import { searchConfigs, getDB, saveConfigsToDisk } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST - Save search configuration for a table
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const config = await request.json();

    // Validate configuration
    if (!config.searchableFields || config.searchableFields.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'At least one searchable field is required',
        },
        { status: 400 }
      );
    }

    // Store configuration in memory
    searchConfigs.set(table, {
      ...config,
      updatedAt: new Date().toISOString(),
    });

    // Persist to disk
    saveConfigsToDisk();

    // Force DB reinitialization to pick up new search config
    await getDB(true);

    return NextResponse.json({
      success: true,
      message: `Search configuration saved for table '${table}' and persisted to disk.`,
      config: searchConfigs.get(table),
    });
  } catch (error) {
    console.error('Save search config error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET - Get search configuration for a table
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table } = await params;
    const config = searchConfigs.get(table);

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          message: `No configuration found for table '${table}'`,
          config: null,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      config,
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
