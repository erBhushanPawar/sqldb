'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Database, Gauge, Zap } from 'lucide-react';

interface Stats {
  totalQueries: number;
  avgExecutionTime: number;
  cacheHitRate: number;
  activeConnections: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/analytics/stats');
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }
      const data = await response.json();

      // Extract stats from the response
      if (data.success && data.summary) {
        // Parse cacheHitRate - it comes as "XX.XX%" string
        const cacheHitRateStr = data.summary.cacheHitRate || '0%';
        const cacheHitRate = parseFloat(cacheHitRateStr.replace('%', '')) / 100;

        setStats({
          totalQueries: parseInt(data.summary.totalQueries) || 0,
          avgExecutionTime: parseFloat(data.summary.avgExecutionTime) || 0,
          cacheHitRate: cacheHitRate,
          activeConnections: 0, // Not available from current API
        });
      } else {
        // Set default empty stats if no data
        setStats({
          totalQueries: 0,
          avgExecutionTime: 0,
          cacheHitRate: 0,
          activeConnections: 0,
        });
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      console.error('Error fetching stats:', err);
      // Set default empty stats on error
      setStats({
        totalQueries: 0,
        avgExecutionTime: 0,
        cacheHitRate: 0,
        activeConnections: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error Loading Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    {
      title: 'Total Queries',
      value: stats.totalQueries.toLocaleString(),
      icon: Database,
      description: 'Queries executed',
    },
    {
      title: 'Avg Execution Time',
      value: `${stats.avgExecutionTime.toFixed(2)}ms`,
      icon: Zap,
      description: 'Average query time',
    },
    {
      title: 'Cache Hit Rate',
      value: `${(stats.cacheHitRate * 100).toFixed(1)}%`,
      icon: Gauge,
      description: 'Cache effectiveness',
    },
    {
      title: 'Active Connections',
      value: stats.activeConnections.toString(),
      icon: Activity,
      description: 'Current connections',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
