import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Read records with optional filters
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const sortBy = searchParams.get('sortBy') || undefined;
    const sortOrder = (searchParams.get('sortOrder') || 'ASC') as 'ASC' | 'DESC';

    // Parse filters (JSON format: {"column": "value"})
    const filtersParam = searchParams.get('filters');
    const filters = filtersParam ? JSON.parse(filtersParam) : undefined;

    // Get table operations
    const tableOps = db(table);

    // Use findMany with options
    const results = await tableOps.findMany(filters, {
      limit,
      offset,
      orderBy: sortBy ? { column: sortBy, direction: sortOrder } : undefined,
    });

    // Get total count
    const total = await tableOps.count(filters);

    return NextResponse.json({
      success: true,
      data: results,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('CRUD error:', error);
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

// POST - Create new record
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;
    const data = await request.json();

    const tableOps = db(table);
    const result = await tableOps.insertOne(data);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Record created successfully',
    });
  } catch (error) {
    console.error('CRUD error:', error);
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

// PUT - Update record
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;
    const body = await request.json();
    const { id, data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required for update' },
        { status: 400 }
      );
    }

    const tableOps = db(table);
    const result = await tableOps.updateById(id, data);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Record updated successfully',
    });
  } catch (error) {
    console.error('CRUD error:', error);
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

// DELETE - Delete record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID is required for delete' },
        { status: 400 }
      );
    }

    const tableOps = db(table);
    const result = await tableOps.deleteById(id);

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Record deleted successfully',
    });
  } catch (error) {
    console.error('CRUD error:', error);
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
