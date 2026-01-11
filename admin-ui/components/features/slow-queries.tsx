'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface SlowQuery {
  query: string;
  executionTime: number;
  timestamp: string;
  table?: string;
  params?: any[];
}

export function SlowQueriesMonitor() {
  const [queries, setQueries] = useState<SlowQuery[]>([]);
  const [filteredQueries, setFilteredQueries] = useState<SlowQuery[]>([]);
  const [threshold, setThreshold] = useState('100');
  const [tableFilter, setTableFilter] = useState('all');
  const [tables, setTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSlowQueries();
    const interval = setInterval(fetchSlowQueries, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [threshold]);

  useEffect(() => {
    filterQueries();
  }, [queries, tableFilter]);

  const fetchSlowQueries = async () => {
    try {
      const response = await fetch(
        `/api/analytics/slow-queries?threshold=${threshold}`
      );
      if (!response.ok) throw new Error('Failed to fetch slow queries');
      const data = await response.json();

      setQueries(data.queries || []);

      // Extract unique tables
      const uniqueTables = Array.from(
        new Set(
          (data.queries || [])
            .map((q: SlowQuery) => q.table)
            .filter((t: string | undefined) => t !== undefined)
        )
      ) as string[];
      setTables(uniqueTables);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch slow queries');
    } finally {
      setLoading(false);
    }
  };

  const filterQueries = () => {
    let filtered = queries;

    if (tableFilter !== 'all') {
      filtered = filtered.filter((q) => q.table === tableFilter);
    }

    setFilteredQueries(filtered);
  };

  const getTimeColor = (time: number) => {
    if (time < 100) return 'bg-green-500';
    if (time < 500) return 'bg-yellow-500';
    if (time < 1000) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getTimeBadgeVariant = (time: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (time < 100) return 'default';
    if (time < 500) return 'secondary';
    return 'destructive';
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const truncateQuery = (query: string, maxLength: number = 100) => {
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <CardTitle>Slow Query Monitor</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSlowQueries}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="threshold">Threshold (ms)</Label>
            <Input
              id="threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Enter threshold in ms"
              min="0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tableFilter">Filter by Table</Label>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger id="tableFilter">
                <SelectValue placeholder="All tables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tables</SelectItem>
                {tables.map((table) => (
                  <SelectItem key={table} value={table}>
                    {table}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Total Slow Queries</p>
            <p className="text-2xl font-bold">{filteredQueries.length}</p>
          </div>
          {filteredQueries.length > 0 && (
            <>
              <div className="border-l pl-4">
                <p className="text-sm text-muted-foreground">Avg Execution Time</p>
                <p className="text-2xl font-bold">
                  {(
                    filteredQueries.reduce((sum, q) => sum + q.executionTime, 0) /
                    filteredQueries.length
                  ).toFixed(2)}
                  ms
                </p>
              </div>
              <div className="border-l pl-4">
                <p className="text-sm text-muted-foreground">Max Execution Time</p>
                <p className="text-2xl font-bold">
                  {Math.max(...filteredQueries.map((q) => q.executionTime)).toFixed(
                    2
                  )}
                  ms
                </p>
              </div>
            </>
          )}
        </div>

        {/* Queries Table */}
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredQueries.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Execution Time</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueries.map((query, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs max-w-md">
                      <div className="truncate" title={query.query}>
                        {truncateQuery(query.query, 80)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {query.table ? (
                        <Badge variant="outline">{query.table}</Badge>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${getTimeColor(
                            query.executionTime
                          )}`}
                        />
                        <Badge variant={getTimeBadgeVariant(query.executionTime)}>
                          {query.executionTime.toFixed(2)}ms
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatTimestamp(query.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No slow queries found</p>
            <p className="text-sm">
              Queries slower than {threshold}ms will appear here
            </p>
          </div>
        )}

        {/* Legend */}
        {filteredQueries.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t">
            <span>Performance:</span>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>&lt;100ms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>100-500ms</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span>500ms-1s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>&gt;1s</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
