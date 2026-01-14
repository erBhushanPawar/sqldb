'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Search as SearchIcon, Database, Trash2, RefreshCw, MapPin, BarChart3, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface SchemaTable {
  name: string;
}

interface SearchResult {
  [key: string]: any;
  _score?: number;
  distance?: {
    value: number;
    unit: string;
  };
}

interface IndexStats {
  totalDocuments: number;
  totalTerms: number;
  totalTokens: number;
  lastBuildTime: string | null;
  buildDurationMs: number;
  memoryUsageMB: string;
  fields: string[];
  geo?: {
    totalDocuments: number;
    bucketCounts: Record<string, number>;
    normalizedLocations: number;
    indexSize: number;
  };
}

export function SearchInterface() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState('0.1');
  const [searchFields, setSearchFields] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Geo-search state
  const [geoEnabled, setGeoEnabled] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('25');
  const [radiusUnit, setRadiusUnit] = useState<'km' | 'mi' | 'm'>('km');
  const [maxRange, setMaxRange] = useState(''); // Cluster expansion max range
  const [minResults, setMinResults] = useState('5'); // Minimum results before expansion
  const [locationName, setLocationName] = useState('');
  const [geoPriority, setGeoPriority] = useState<'geo-first' | 'text-first' | 'balanced'>('balanced');
  const [bucketId, setBucketId] = useState('');
  const [availableBuckets, setAvailableBuckets] = useState<any[]>([]);

  // Index statistics state
  const [indexStats, setIndexStats] = useState<IndexStats | null>(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchIndexStats();
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

  const fetchIndexStats = async () => {
    if (!selectedTable) return;

    try {
      const response = await fetch(`/api/search/${selectedTable}/stats`);
      if (!response.ok) {
        setIndexStats(null);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setIndexStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch index stats:', err);
      setIndexStats(null);
    }
  };

  const fetchGeoBuckets = async () => {
    if (!selectedTable) return;

    try {
      const response = await fetch(`/api/search/${selectedTable}/geo-buckets`);
      if (!response.ok) {
        setAvailableBuckets([]);
        return;
      }
      const data = await response.json();
      if (data.success && data.buckets) {
        setAvailableBuckets(data.buckets);
      }
    } catch (err) {
      console.error('Failed to fetch geo-buckets:', err);
      setAvailableBuckets([]);
    }
  };

  const buildGeoBuckets = async (bucketSize: number = 5) => {
    if (!selectedTable) return;

    setIndexing(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/${selectedTable}/geo-buckets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucketSize,
          gridSizeKm: 10,
          minBucketSize: 3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to build geo-buckets');
      }

      const data = await response.json();
      alert(
        `Geo-buckets created successfully! ${data.buckets?.totalBuckets || 0} buckets created.`
      );

      // Refresh buckets
      await fetchGeoBuckets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build geo-buckets');
    } finally {
      setIndexing(false);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude.toString());
          setLongitude(position.coords.longitude.toString());
        },
        (error) => {
          console.error('Error getting location:', error);
          setError('Failed to get your location. Please enter manually.');
        }
      );
    } else {
      setError('Geolocation is not supported by your browser');
    }
  };

  const handleSearch = async () => {
    if (!selectedTable || !searchQuery) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        minScore: minScore,
      });

      if (searchFields) {
        params.append('fields', searchFields);
      }

      // Add geo-search parameters
      if (geoEnabled) {
        params.append('geoEnabled', 'true');
        params.append('geoPriority', geoPriority);

        if (bucketId && bucketId !== 'none') {
          params.append('bucketId', bucketId);
        } else if (locationName) {
          params.append('locationName', locationName);
          if (radius) params.append('radius', radius);
          params.append('radiusUnit', radiusUnit);
          // Add cluster expansion parameters
          if (maxRange) params.append('maxRange', maxRange);
          if (minResults) params.append('minResults', minResults);
        } else if (latitude && longitude) {
          params.append('lat', latitude);
          params.append('lng', longitude);
          params.append('radius', radius);
          params.append('radiusUnit', radiusUnit);
          // Add cluster expansion parameters
          if (maxRange) params.append('maxRange', maxRange);
          if (minResults) params.append('minResults', minResults);
        }
      }

      const response = await fetch(
        `/api/search/${selectedTable}?${params.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBuildIndex = async () => {
    if (!selectedTable) return;

    setIndexing(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/${selectedTable}/index`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to build index');
      }

      const data = await response.json();

      // Build success message
      let message = data.message || 'Index built successfully!';
      if (data.stats?.geoBuckets?.totalBuckets) {
        message += ` (${data.stats.geoBuckets.totalBuckets} geo-clusters created)`;
      }

      alert(message);

      // Refresh stats and geo-buckets after building
      await Promise.all([
        fetchIndexStats(),
        fetchGeoBuckets(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to build index');
    } finally {
      setIndexing(false);
    }
  };

  const handleClearIndex = async () => {
    if (!selectedTable) return;

    setIndexing(true);
    setError(null);

    try {
      const response = await fetch(`/api/search/${selectedTable}/index`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear index');
      }

      alert('Index cleared successfully!');
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear index');
    } finally {
      setIndexing(false);
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query || !text) return text;

    const parts = String(text).split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.5) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Testing Interface</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Table Selection */}
        <div className="space-y-2">
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

        {/* Index Management */}
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            onClick={handleBuildIndex}
            disabled={!selectedTable || indexing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${indexing ? 'animate-spin' : ''}`} />
            Build Index
          </Button>
          <Button
            variant="outline"
            onClick={handleClearIndex}
            disabled={!selectedTable || indexing}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Index
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowStats(!showStats)}
            disabled={!selectedTable}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showStats ? 'Hide' : 'Show'} Stats
          </Button>
        </div>

        {/* Index Statistics */}
        {showStats && indexStats && (
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Info className="h-4 w-4" />
                Index Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Documents</p>
                  <p className="text-2xl font-bold">{indexStats.totalDocuments.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Unique Terms</p>
                  <p className="text-2xl font-bold">{indexStats.totalTerms.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Tokens</p>
                  <p className="text-2xl font-bold">{indexStats.totalTokens.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Memory</p>
                  <p className="text-2xl font-bold">{indexStats.memoryUsageMB} MB</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Indexed Fields</p>
                <div className="flex flex-wrap gap-1">
                  {indexStats.fields.map((field) => (
                    <Badge key={field} variant="secondary" className="text-xs">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
              {indexStats.buildDurationMs > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Last Build</p>
                  <p className="text-sm">
                    {indexStats.buildDurationMs}ms
                    {indexStats.lastBuildTime && ` • ${new Date(indexStats.lastBuildTime).toLocaleString()}`}
                  </p>
                </div>
              )}
              {indexStats.geo && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs font-medium">Geo-Search Index</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Geo Documents</p>
                      <p className="text-lg font-semibold">{indexStats.geo.totalDocuments}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Normalized Locations</p>
                      <p className="text-lg font-semibold">{indexStats.geo.normalizedLocations}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Geo-Search Toggle */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <Label htmlFor="geo-toggle" className="font-medium">
                Geo-Location Search
              </Label>
              <p className="text-xs text-muted-foreground">
                Filter results by geographic location
              </p>
            </div>
          </div>
          <Switch
            id="geo-toggle"
            checked={geoEnabled}
            onCheckedChange={setGeoEnabled}
          />
        </div>

        {/* Geo-Search Configuration */}
        {geoEnabled && (
          <Card className="bg-muted/30">
            <CardContent className="pt-4 space-y-4">
              {/* Geo Priority Selection */}
              <div className="space-y-2">
                <Label htmlFor="geoPriority">Search Priority</Label>
                <Select value={geoPriority} onValueChange={(v) => setGeoPriority(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geo-first">
                      <div>
                        <div className="font-medium">Location First</div>
                        <div className="text-xs text-muted-foreground">Find nearest matches, then rank by relevance</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="balanced">
                      <div>
                        <div className="font-medium">Balanced</div>
                        <div className="text-xs text-muted-foreground">Consider both text relevance and distance</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="text-first">
                      <div>
                        <div className="font-medium">Relevance First</div>
                        <div className="text-xs text-muted-foreground">Best text matches within location radius</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Geo-Bucket Selection */}
              {availableBuckets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bucketId">Search by Pre-defined Cluster</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => buildGeoBuckets(5)}
                      disabled={indexing}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${indexing ? 'animate-spin' : ''}`} />
                      Rebuild
                    </Button>
                  </div>
                  <Select value={bucketId} onValueChange={setBucketId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a cluster..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None - Use location/coordinates</SelectItem>
                      {availableBuckets.map((bucket: any) => (
                        <SelectItem key={bucket.id} value={bucket.id}>
                          {bucket.locationName || `Cluster ${bucket.id}`} ({bucket.count} items)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {availableBuckets.length === 0 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    No geo-clusters found. Build clusters for faster geo-search.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => buildGeoBuckets(5)}
                    disabled={indexing}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${indexing ? 'animate-spin' : ''}`} />
                    Build Geo-Clusters (target: 5 items/cluster)
                  </Button>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or search by location
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationName">Location Name (e.g., NYC, San Francisco)</Label>
                <Input
                  id="locationName"
                  placeholder="Enter city or location name"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  disabled={bucketId !== '' && bucketId !== 'none'}
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or use coordinates
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <div className="flex gap-2">
                    <Input
                      id="latitude"
                      type="number"
                      step="0.000001"
                      placeholder="40.7128"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      disabled={(bucketId !== '' && bucketId !== 'none') || !!locationName}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={getUserLocation}
                      title="Get current location"
                      disabled={(bucketId !== '' && bucketId !== 'none') || !!locationName}
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="0.000001"
                    placeholder="-74.0060"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    disabled={(bucketId !== '' && bucketId !== 'none') || !!locationName}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radius">Radius</Label>
                  <div className="flex gap-2">
                    <Input
                      id="radius"
                      type="number"
                      step="0.1"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      className="flex-1"
                      disabled={bucketId !== '' && bucketId !== 'none'}
                    />
                    <Select
                      value={radiusUnit}
                      onValueChange={(v) => setRadiusUnit(v as 'km' | 'mi' | 'm')}
                      disabled={bucketId !== '' && bucketId !== 'none'}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="km">km</SelectItem>
                        <SelectItem value="mi">mi</SelectItem>
                        <SelectItem value="m">m</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Cluster Expansion Settings */}
              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Cluster Expansion</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically expand search range if results are insufficient
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxRange" className="text-sm">
                      Max Range
                      <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                    </Label>
                    <Input
                      id="maxRange"
                      type="number"
                      step="0.1"
                      placeholder="8"
                      value={maxRange}
                      onChange={(e) => setMaxRange(e.target.value)}
                      disabled={bucketId !== '' && bucketId !== 'none'}
                    />
                    <p className="text-xs text-muted-foreground">
                      Expand up to this distance if few results (in {radiusUnit})
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minResults" className="text-sm">
                      Min Results
                    </Label>
                    <Input
                      id="minResults"
                      type="number"
                      step="1"
                      value={minResults}
                      onChange={(e) => setMinResults(e.target.value)}
                      disabled={bucketId !== '' && bucketId !== 'none'}
                    />
                    <p className="text-xs text-muted-foreground">
                      Trigger expansion if results below this number
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="searchQuery">Search Query</Label>
            <Input
              id="searchQuery"
              placeholder="Enter search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="searchFields">Search Fields (comma-separated)</Label>
            <Input
              id="searchFields"
              placeholder="e.g., name, description"
              value={searchFields}
              onChange={(e) => setSearchFields(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="minScore">Minimum Score</Label>
          <Input
            id="minScore"
            type="number"
            step="0.1"
            min="0"
            max="1"
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
          />
        </div>

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          disabled={!selectedTable || !searchQuery || loading}
          className="w-full"
        >
          <SearchIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Searching...' : 'Search'}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Results ({results.length})
              </h3>
            </div>

            {/* Score Distribution Chart */}
            <Card className="bg-muted/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Relevance Score Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(() => {
                    const ranges = [
                      { label: 'Excellent (80-100%)', min: 0.8, max: 1, color: 'bg-green-500' },
                      { label: 'Good (50-79%)', min: 0.5, max: 0.8, color: 'bg-yellow-500' },
                      { label: 'Fair (0-49%)', min: 0, max: 0.5, color: 'bg-orange-500' },
                    ];

                    return ranges.map((range) => {
                      const count = results.filter(
                        (r) => r._score !== undefined && r._score >= range.min && r._score < range.max
                      ).length;
                      const percentage = results.length > 0 ? (count / results.length) * 100 : 0;

                      return (
                        <div key={range.label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{range.label}</span>
                            <span className="font-medium">
                              {count} ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                            <div
                              className={`${range.color} h-full transition-all duration-300`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {results.map((result, idx) => {
                // Handle both formats: direct fields or nested under 'data'
                const dataObj = (result as any).data || result;
                const score = (result as any).score || (result as any)._score;
                const distance = (result as any).distance;

                return (
                <Card key={idx} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      {Object.entries(dataObj).map(([key, value]) => {
                        // Skip internal fields
                        if (key === '_score' || key === 'distance' || key === 'score' || key === 'matchedTerms' || key === 'data') return null;

                        // Format value based on type
                        let displayValue: string;
                        if (value === null || value === undefined) {
                          displayValue = '';
                        } else if (typeof value === 'object') {
                          displayValue = JSON.stringify(value, null, 2);
                        } else {
                          displayValue = String(value);
                        }

                        return (
                          <div key={key} className="text-sm">
                            <span className="font-medium text-muted-foreground">
                              {key}:
                            </span>{' '}
                            <span className={typeof value === 'object' ? 'font-mono text-xs' : ''}>
                              {typeof value === 'object' ? (
                                <pre className="inline whitespace-pre-wrap">{displayValue}</pre>
                              ) : (
                                highlightText(displayValue, searchQuery)
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {score !== undefined && (
                        <Badge
                          className={`${getScoreColor(
                            score
                          )} text-white`}
                        >
                          {(score * 100).toFixed(0)}%
                        </Badge>
                      )}
                      {distance && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {distance.value.toFixed(2)} {distance.unit}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
                );
              })}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && searchQuery && selectedTable && (
          <div className="text-center p-8 text-muted-foreground">
            No results found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
