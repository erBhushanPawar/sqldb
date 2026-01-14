'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database, Search, BarChart3, Zap, Table2, Code, Map } from 'lucide-react';

// Import feature components
import { DashboardStats } from '@/components/dashboard/stats';
import { SearchInterface } from '@/components/features/search';
import { SearchConfigInterface } from '@/components/features/search-config';
import { GeoMapVisualization } from '@/components/features/geo-map';
import { PerformanceAnalytics } from '@/components/features/performance';
import { SlowQueriesMonitor } from '@/components/features/slow-queries';
import { CrudInterface } from '@/components/features/crud';
import { CacheManagement } from '@/components/features/cache';
import { SchemaDiscovery } from '@/components/features/schema';

export default function Home() {
  const [health, setHealth] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SqlDB Admin UI
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Production-grade database management
                </p>
              </div>
            </div>

            {/* Health Status */}
            <div className="flex items-center gap-2" suppressHydrationWarning>
              {!mounted ? (
                <Badge variant="outline">Checking...</Badge>
              ) : health?.status === 'healthy' ? (
                <Badge className="bg-green-500">
                  <span className="animate-pulse mr-1">●</span> Connected
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <span className="animate-pulse mr-1">●</span> {health?.status || 'Checking...'}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Dashboard Stats */}
        <DashboardStats />

        {/* Feature Tabs */}
        <Tabs defaultValue="crud" className="mt-8">
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-9 lg:w-auto">
            <TabsTrigger value="crud" className="gap-2">
              <Table2 className="h-4 w-4" />
              <span className="hidden sm:inline">CRUD</span>
            </TabsTrigger>
            <TabsTrigger value="search-config" className="gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </TabsTrigger>
            <TabsTrigger value="geo-map" className="gap-2">
              <Map className="h-4 w-4" />
              <span className="hidden sm:inline">Map</span>
            </TabsTrigger>
            <TabsTrigger value="cache" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Cache</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="slow-queries" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Slow Queries</span>
            </TabsTrigger>
            <TabsTrigger value="schema" className="gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Schema</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crud" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>CRUD Operations</CardTitle>
                <CardDescription>
                  Create, Read, Update, and Delete records with automatic schema discovery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CrudInterface />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="search-config" className="mt-6">
            <SearchConfigInterface />
          </TabsContent>

          <TabsContent value="search" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Full-Text Search</CardTitle>
                <CardDescription>
                  Redis-powered inverted index search with highlighting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SearchInterface />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geo-map" className="mt-6">
            <GeoMapVisualization />
          </TabsContent>

          <TabsContent value="cache" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Cache Management</CardTitle>
                <CardDescription>
                  Redis-backed intelligent caching with automatic invalidation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CacheManagement />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Performance Analytics</CardTitle>
                <CardDescription>
                  Query statistics, cache hit rates, and performance trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PerformanceAnalytics />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="slow-queries" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Slow Query Monitor</CardTitle>
                <CardDescription>
                  Identify and optimize slow-performing queries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SlowQueriesMonitor />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Schema Discovery</CardTitle>
                <CardDescription>
                  Automatic schema detection and relationship mapping
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SchemaDiscovery />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Feature Showcase Footer */}
        <Card className="mt-8 border-dashed">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <h3 className="font-semibold text-lg mb-2">Redis-Backed Caching</h3>
                <p className="text-sm text-slate-500">
                  Automatic cache invalidation with dependency tracking
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Full-Text Search</h3>
                <p className="text-sm text-slate-500">
                  Inverted index with tokenization and highlighting
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Query Analytics</h3>
                <p className="text-sm text-slate-500">
                  Track performance, identify bottlenecks, optimize queries
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
