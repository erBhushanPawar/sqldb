'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, Database, HardDrive, Percent, RefreshCw } from 'lucide-react';

interface CacheStats {
  keys: number;
  memoryUsage: number;
  hitRate: number;
  hits: number;
  misses: number;
  evictions?: number;
}

export function CacheManagement() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tablePattern, setTablePattern] = useState('');
  const [customPattern, setCustomPattern] = useState('');

  useEffect(() => {
    fetchCacheStats();
  }, []);

  const fetchCacheStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cache');
      if (!response.ok) throw new Error('Failed to fetch cache stats');
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cache stats');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to clear all cache? This cannot be undone.')) {
      return;
    }

    setClearing(true);
    setError(null);

    try {
      const response = await fetch('/api/cache', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear cache');
      }

      alert('All cache cleared successfully!');
      await fetchCacheStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const handleClearByTable = async () => {
    if (!tablePattern) {
      alert('Please enter a table name');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to clear cache for table "${tablePattern}"?`
      )
    ) {
      return;
    }

    setClearing(true);
    setError(null);

    try {
      const response = await fetch('/api/cache', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tablePattern }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear cache');
      }

      const data = await response.json();
      alert(`Cleared ${data.deletedKeys || 0} cache entries for table "${tablePattern}"`);
      setTablePattern('');
      await fetchCacheStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const handleClearByPattern = async () => {
    if (!customPattern) {
      alert('Please enter a pattern');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to clear cache matching pattern "${customPattern}"?`
      )
    ) {
      return;
    }

    setClearing(true);
    setError(null);

    try {
      const response = await fetch('/api/cache', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: customPattern }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clear cache');
      }

      const data = await response.json();
      alert(`Cleared ${data.deletedKeys || 0} cache entries matching "${customPattern}"`);
      setCustomPattern('');
      await fetchCacheStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cache Statistics</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCacheStats}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {loading && !stats ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <Database className="h-8 w-8 text-primary mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Total Keys</p>
                  <p className="text-2xl font-bold">{stats.keys.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <HardDrive className="h-8 w-8 text-primary mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Memory Usage</p>
                  <p className="text-2xl font-bold">
                    {formatBytes(stats.memoryUsage)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <Percent className="h-8 w-8 text-primary mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Hit Rate</p>
                  <p className="text-2xl font-bold">
                    {(stats.hitRate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Cache Hits</p>
                <p className="text-xl font-semibold">{stats.hits.toLocaleString()}</p>
              </div>

              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Cache Misses</p>
                <p className="text-xl font-semibold">{stats.misses.toLocaleString()}</p>
              </div>

              {stats.evictions !== undefined && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Evictions</p>
                  <p className="text-xl font-semibold">
                    {stats.evictions.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cache Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Clear All */}
          <div className="space-y-2">
            <Label>Clear All Cache</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Remove all cached entries from the system
            </p>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={clearing}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Cache
            </Button>
          </div>

          <div className="border-t pt-6" />

          {/* Clear by Table */}
          <div className="space-y-2">
            <Label htmlFor="tablePattern">Clear Cache by Table</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Remove all cached entries for a specific table
            </p>
            <div className="flex gap-2">
              <Input
                id="tablePattern"
                placeholder="Enter table name..."
                value={tablePattern}
                onChange={(e) => setTablePattern(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleClearByTable}
                disabled={clearing || !tablePattern}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          <div className="border-t pt-6" />

          {/* Clear by Pattern */}
          <div className="space-y-2">
            <Label htmlFor="customPattern">Clear Cache by Pattern</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Remove cached entries matching a custom pattern (e.g., users:*)
            </p>
            <div className="flex gap-2">
              <Input
                id="customPattern"
                placeholder="Enter pattern (e.g., users:*)"
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleClearByPattern}
                disabled={clearing || !customPattern}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
