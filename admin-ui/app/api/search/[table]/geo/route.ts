import { NextRequest, NextResponse } from 'next/server';
import { getDB, searchConfigs } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Fetch all geo-located documents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const db = await getDB();
    const { table } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Get configuration to know which fields are lat/lng
    const config = searchConfigs.get(table);
    if (!config?.geo?.enabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geo-search is not enabled for this table',
        },
        { status: 400 }
      );
    }

    const latField = config.geo.latitudeField;
    const lngField = config.geo.longitudeField;
    const locationField = config.geo.locationNameField;

    // Optional filtering
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const bounds = searchParams.get('bounds'); // Format: "lat1,lng1,lat2,lng2"

    // Build query to fetch all records with valid coordinates
    const tableOps = db(table);
    let whereConditions: any = {};

    // Filter by bounds if provided
    if (bounds) {
      const [lat1, lng1, lat2, lng2] = bounds.split(',').map(parseFloat);
      whereConditions = {
        [latField]: { $gte: Math.min(lat1, lat2), $lte: Math.max(lat1, lat2) },
        [lngField]: { $gte: Math.min(lng1, lng2), $lte: Math.max(lng1, lng2) },
      };
    }

    const records = await tableOps.findMany(whereConditions, { limit });

    // Filter out records without valid coordinates and transform to GeoJSON
    const geoData = records
      .filter((record: any) => {
        const lat = parseFloat(record[latField]);
        const lng = parseFloat(record[lngField]);
        return !isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
      })
      .map((record: any) => ({
        ...record,
        _latitude: parseFloat(record[latField]),
        _longitude: parseFloat(record[lngField]),
        _location: locationField ? record[locationField] : undefined,
      }));

    // Calculate statistics - group by unique coordinate pairs (rounded to ~11m precision)
    const uniqueCoordinates = new Map<string, number>();
    const locationBreakdown: Record<string, number> = {};

    geoData.forEach((record: any) => {
      // Group by coordinates rounded to 4 decimal places (~11m precision)
      const coordKey = `${record._latitude.toFixed(4)},${record._longitude.toFixed(4)}`;
      uniqueCoordinates.set(coordKey, (uniqueCoordinates.get(coordKey) || 0) + 1);

      // Also track location names if available
      if (locationField && record._location) {
        const loc = record._location;
        locationBreakdown[loc] = (locationBreakdown[loc] || 0) + 1;
      }
    });

    const totalUniqueLocations = uniqueCoordinates.size;

    // Calculate bounding box
    let bounds_calculated = null;
    if (geoData.length > 0) {
      const lats = geoData.map((r: any) => r._latitude);
      const lngs = geoData.map((r: any) => r._longitude);
      bounds_calculated = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      };
    }

    return NextResponse.json({
      success: true,
      data: geoData,
      total: geoData.length,
      config: {
        latField,
        lngField,
        locationField,
      },
      stats: {
        totalRecords: geoData.length,
        totalUniqueLocations,
        locationBreakdown,
        bounds: bounds_calculated,
      },
    });
  } catch (error) {
    console.error('Fetch geo data error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
