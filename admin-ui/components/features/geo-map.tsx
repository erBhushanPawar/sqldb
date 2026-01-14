'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Database, MapPin, BarChart3, RefreshCw, Layers } from 'lucide-react';

// Dynamically import map components (Leaflet doesn't work with SSR)
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
);

interface SchemaTable {
  name: string;
}

interface GeoRecord {
  [key: string]: any;
  _latitude: number;
  _longitude: number;
  _location?: string;
}

interface GeoStats {
  totalRecords: number;
  totalUniqueLocations: number;
  locationBreakdown: Record<string, number>;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  } | null;
}

export function GeoMapVisualization() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [geoData, setGeoData] = useState<GeoRecord[]>([]);
  const [stats, setStats] = useState<GeoStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap' | 'buckets'>('buckets');
  const [isClient, setIsClient] = useState(false);

  // Geo-buckets state
  const [geoBuckets, setGeoBuckets] = useState<any[]>([]);
  const [bucketStats, setBucketStats] = useState<any>(null);

  useEffect(() => {
    setIsClient(true);
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchGeoData();
      fetchGeoBuckets();
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/schema');
      if (!response.ok) throw new Error('Failed to fetch tables');
      const data = await response.json();
      setTables(data.tables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tables');
    }
  };

  const fetchGeoData = async () => {
    if (!selectedTable) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/${selectedTable}/geo`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch geo data');
      }

      const data = await response.json();
      setGeoData(data.data || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch geo data');
      setGeoData([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchGeoBuckets = async () => {
    if (!selectedTable) return;

    try {
      console.log(`🔍 Fetching geo-buckets for table: ${selectedTable}`);
      const response = await fetch(`/api/search/${selectedTable}/geo-buckets`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log(`⚠️  Geo-buckets not available:`, errorData.error || response.statusText);
        setGeoBuckets([]);
        setBucketStats(null);
        return;
      }

      const data = await response.json();
      console.log(`✅ Loaded ${data.buckets?.length || 0} geo-buckets:`, data);

      setGeoBuckets(data.buckets || []);
      setBucketStats(data.stats || null);
    } catch (err) {
      console.error('❌ Geo-buckets fetch error:', err);
      setGeoBuckets([]);
      setBucketStats(null);
    }
  };

  // Calculate center and zoom based on data bounds
  const mapCenter: [number, number] = useMemo(() => {
    if (!stats?.bounds) return [20.5937, 78.9629]; // India center as default
    const { north, south, east, west } = stats.bounds;
    return [(north + south) / 2, (east + west) / 2];
  }, [stats]);

  const mapZoom = useMemo(() => {
    if (!stats?.bounds) return 5;
    const { north, south, east, west } = stats.bounds;
    const latDiff = north - south;
    const lngDiff = east - west;
    const maxDiff = Math.max(latDiff, lngDiff);

    // Simple zoom calculation
    if (maxDiff > 20) return 4;
    if (maxDiff > 10) return 5;
    if (maxDiff > 5) return 6;
    if (maxDiff > 2) return 7;
    if (maxDiff > 1) return 8;
    if (maxDiff > 0.5) return 9;
    return 10;
  }, [stats]);

  // Group by location for heatmap visualization
  const locationClusters = useMemo(() => {
    const clusters: Record<string, { lat: number; lng: number; count: number; records: GeoRecord[] }> = {};

    geoData.forEach((record) => {
      const key = `${record._latitude.toFixed(4)},${record._longitude.toFixed(4)}`;
      if (!clusters[key]) {
        clusters[key] = {
          lat: record._latitude,
          lng: record._longitude,
          count: 0,
          records: [],
        };
      }
      clusters[key].count++;
      clusters[key].records.push(record);
    });

    return Object.values(clusters);
  }, [geoData]);

  // Get color based on cluster size
  const getClusterColor = (count: number) => {
    if (count >= 100) return '#dc2626'; // red-600
    if (count >= 50) return '#ea580c'; // orange-600
    if (count >= 20) return '#f59e0b'; // amber-500
    if (count >= 10) return '#eab308'; // yellow-500
    if (count >= 5) return '#84cc16'; // lime-500
    return '#22c55e'; // green-500
  };

  const getClusterRadius = (count: number) => {
    return Math.min(Math.sqrt(count) * 2 + 5, 30);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geo-Location Map Visualization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Table Selection */}
        <div className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label>Select Table</Label>
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a table..." />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.name} value={table.name}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      {table.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              fetchGeoData();
              fetchGeoBuckets();
            }}
            disabled={!selectedTable || loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>

          <div className="space-y-2">
            <Label>
              View Mode
              {geoBuckets.length > 0 && viewMode === 'buckets' && (
                <Badge variant="outline" className="ml-2">
                  {geoBuckets.length} buckets
                </Badge>
              )}
            </Label>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'markers' | 'heatmap' | 'buckets')}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buckets">
                  Geo-Buckets ({geoBuckets.length})
                </SelectItem>
                <SelectItem value="heatmap">
                  Client Clusters ({locationClusters.length})
                </SelectItem>
                <SelectItem value="markers">
                  Individual Points ({geoData.length})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Statistics */}
        {(stats || bucketStats) && (
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                {viewMode === 'buckets' ? 'Geo-Bucket Statistics' : 'Geographic Distribution'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {viewMode === 'buckets' && bucketStats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Buckets</p>
                    <p className="text-2xl font-bold">{bucketStats.totalBuckets.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Items</p>
                    <p className="text-2xl font-bold">{bucketStats.totalItems.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Avg per Bucket</p>
                    <p className="text-2xl font-bold">{bucketStats.avgItemsPerBucket}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Bucket Range</p>
                    <p className="text-2xl font-bold">
                      {bucketStats.minBucketSize}-{bucketStats.maxBucketSize}
                    </p>
                  </div>
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total Locations</p>
                    <p className="text-2xl font-bold">{stats.totalUniqueLocations.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Unique Clusters</p>
                    <p className="text-2xl font-bold">{locationClusters.length.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cities/Areas</p>
                    <p className="text-2xl font-bold">
                      {Object.keys(stats.locationBreakdown).length.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Avg per Cluster</p>
                    <p className="text-2xl font-bold">
                      {locationClusters.length > 0
                        ? (stats.totalRecords / locationClusters.length).toFixed(1)
                        : '0'}
                    </p>
                  </div>
                </div>
              ) : null}

              {stats?.locationBreakdown && Object.keys(stats.locationBreakdown).length > 0 && (
                <div className="space-y-2 pt-3 border-t">
                  <p className="text-xs font-medium">Top Locations</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.locationBreakdown)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 10)
                      .map(([location, count]) => (
                        <Badge key={location} variant="secondary">
                          {location}: {count}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}

              {/* Legend for heatmap */}
              {viewMode === 'heatmap' && (
                <div className="space-y-2 pt-3 border-t">
                  <p className="text-xs font-medium">Cluster Size Legend</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge style={{ backgroundColor: getClusterColor(100) }} className="text-white">
                      100+ items
                    </Badge>
                    <Badge style={{ backgroundColor: getClusterColor(50) }} className="text-white">
                      50-99 items
                    </Badge>
                    <Badge style={{ backgroundColor: getClusterColor(20) }} className="text-white">
                      20-49 items
                    </Badge>
                    <Badge style={{ backgroundColor: getClusterColor(10) }} className="text-white">
                      10-19 items
                    </Badge>
                    <Badge style={{ backgroundColor: getClusterColor(5) }} className="text-white">
                      5-9 items
                    </Badge>
                    <Badge style={{ backgroundColor: getClusterColor(1) }} className="text-white">
                      1-4 items
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Map */}
        {isClient && (geoData.length > 0 || geoBuckets.length > 0) && (
          <div className="h-[600px] rounded-lg overflow-hidden border relative">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {viewMode === 'buckets' ? (
                // Geo-buckets mode (server-side k-means clusters)
                geoBuckets
                  .filter(bucket => bucket.center?.lat != null && bucket.center?.lng != null)
                  .map((bucket, idx) => (
                  <CircleMarker
                    key={idx}
                    center={[bucket.center.lat, bucket.center.lng]}
                    radius={Math.min(Math.max(bucket.count * 2, 8), 40)}
                    pathOptions={{
                      fillColor: getClusterColor(bucket.count),
                      color: '#fff',
                      weight: 2,
                      opacity: 1,
                      fillOpacity: 0.75,
                    }}
                  >
                    <Popup>
                      <div className="text-sm space-y-2 max-w-xs">
                        <div className="font-bold text-base">
                          Geo-Bucket: {bucket.id}
                        </div>
                        <div className="text-lg font-semibold text-blue-600">
                          {bucket.count} items
                        </div>
                        {bucket.locationName && (
                          <div className="text-muted-foreground">
                            📍 {bucket.locationName}
                          </div>
                        )}
                        <div className="pt-2 border-t space-y-1">
                          {bucket.center?.lat != null && bucket.center?.lng != null && (
                            <div className="text-xs">
                              <strong>Center:</strong> {bucket.center.lat.toFixed(4)}, {bucket.center.lng.toFixed(4)}
                            </div>
                          )}
                          {bucket.radius?.value != null && (
                            <div className="text-xs">
                              <strong>Radius:</strong> {bucket.radius.value.toFixed(2)} {bucket.radius.unit}
                            </div>
                          )}
                          {bucket.bounds?.northEast?.lat != null && bucket.bounds?.northEast?.lng != null &&
                           bucket.bounds?.southWest?.lat != null && bucket.bounds?.southWest?.lng != null && (
                            <div className="text-xs text-muted-foreground">
                              Bounds: {bucket.bounds.northEast.lat.toFixed(4)}, {bucket.bounds.northEast.lng.toFixed(4)} to {bucket.bounds.southWest.lat.toFixed(4)}, {bucket.bounds.southWest.lng.toFixed(4)}
                            </div>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              ) : viewMode === 'markers' ? (
                // Individual markers mode
                geoData.map((record, idx) => (
                  <CircleMarker
                    key={idx}
                    center={[record._latitude, record._longitude]}
                    radius={6}
                    pathOptions={{
                      fillColor: '#3b82f6',
                      color: '#1e40af',
                      weight: 1,
                      opacity: 1,
                      fillOpacity: 0.6,
                    }}
                  >
                    <Popup>
                      <div className="text-sm space-y-1 max-w-xs">
                        {Object.entries(record)
                          .filter(([key]) => !key.startsWith('_'))
                          .slice(0, 5)
                          .map(([key, value]) => (
                            <div key={key}>
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        <div className="pt-2 border-t text-xs text-gray-500">
                          {record._latitude.toFixed(6)}, {record._longitude.toFixed(6)}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              ) : (
                // Clustered heatmap mode (client-side clustering)
                locationClusters.map((cluster, idx) => (
                  <CircleMarker
                    key={idx}
                    center={[cluster.lat, cluster.lng]}
                    radius={getClusterRadius(cluster.count)}
                    pathOptions={{
                      fillColor: getClusterColor(cluster.count),
                      color: '#fff',
                      weight: 2,
                      opacity: 1,
                      fillOpacity: 0.7,
                    }}
                  >
                    <Popup>
                      <div className="text-sm space-y-2 max-w-xs">
                        <div className="font-bold text-base">
                          {cluster.count} item{cluster.count !== 1 ? 's' : ''} at this location
                        </div>
                        {cluster.records[0]._location && (
                          <div className="text-muted-foreground">
                            📍 {cluster.records[0]._location}
                          </div>
                        )}
                        <div className="pt-2 border-t">
                          <strong>Sample records:</strong>
                          <div className="space-y-1 mt-1 max-h-40 overflow-y-auto">
                            {cluster.records.slice(0, 5).map((record, i) => (
                              <div key={i} className="text-xs p-1 bg-gray-50 rounded">
                                {Object.entries(record)
                                  .filter(([key]) => !key.startsWith('_'))
                                  .slice(0, 2)
                                  .map(([key, value]) => (
                                    <div key={key}>
                                      {key}: {String(value).substring(0, 50)}
                                    </div>
                                  ))}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="pt-2 border-t text-xs text-gray-500">
                          {cluster.lat.toFixed(6)}, {cluster.lng.toFixed(6)}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              )}
            </MapContainer>
          </div>
        )}

        {!loading && geoData.length === 0 && geoBuckets.length === 0 && selectedTable && (
          <div className="text-center p-8 text-muted-foreground border rounded-lg">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No geo-location data found for this table</p>
            <p className="text-sm mt-2">
              Make sure geo-search is enabled in the Config tab and the search index is built
            </p>
          </div>
        )}

        {!selectedTable && (
          <div className="text-center p-8 text-muted-foreground border rounded-lg">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Select a table to visualize geographic data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
