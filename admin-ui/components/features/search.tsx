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
import { Search as SearchIcon, Database, Trash2, RefreshCw } from 'lucide-react';

interface SchemaTable {
  name: string;
}

interface SearchResult {
  [key: string]: any;
  _score?: number;
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

  useEffect(() => {
    fetchTables();
  }, []);

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
      alert(
        `Index built successfully! Indexed ${data.indexed || 0} documents in ${
          data.time || 0
        }ms`
      );
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
        <div className="flex flex-wrap gap-2">
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
        </div>

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

            <div className="space-y-3">
              {results.map((result, idx) => (
                <Card key={idx} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      {Object.entries(result).map(([key, value]) => {
                        if (key === '_score') return null;
                        return (
                          <div key={key} className="text-sm">
                            <span className="font-medium text-muted-foreground">
                              {key}:
                            </span>{' '}
                            <span>
                              {highlightText(String(value || ''), searchQuery)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {result._score !== undefined && (
                      <Badge
                        className={`${getScoreColor(
                          result._score
                        )} text-white shrink-0`}
                      >
                        {(result._score * 100).toFixed(0)}%
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
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
