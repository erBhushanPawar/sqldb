# SqlDB Admin UI Components

This directory contains all React components for the SqlDB Admin UI, organized by feature area.

## Directory Structure

```
components/
├── dashboard/          # Dashboard components
│   ├── stats.tsx      # Statistics cards
│   └── index.ts       # Exports
├── features/          # Feature-specific components
│   ├── cache.tsx      # Cache management
│   ├── crud.tsx       # CRUD operations
│   ├── performance.tsx # Performance analytics
│   ├── schema.tsx     # Schema discovery
│   ├── search.tsx     # Search testing
│   ├── slow-queries.tsx # Slow query monitor
│   └── index.ts       # Exports
└── ui/                # shadcn/ui components
```

## Components Overview

### Dashboard Components

#### DashboardStats (`dashboard/stats.tsx`)
Displays key database metrics in card format.

**Features:**
- Total queries count
- Average execution time
- Cache hit rate
- Active connections
- Auto-refresh every 30 seconds
- Loading and error states

**API Endpoint:** `GET /api/analytics/stats`

**Usage:**
```tsx
import { DashboardStats } from '@/components/dashboard';

function Dashboard() {
  return <DashboardStats />;
}
```

### Feature Components

#### CrudInterface (`features/crud.tsx`)
Full-featured CRUD interface for database tables.

**Features:**
- Table selection dropdown
- Paginated data table
- Create record modal with form
- Edit record modal with pre-filled data
- Delete confirmation dialog
- Mobile responsive
- Column-based form generation

**API Endpoints:**
- `GET /api/schema` - Fetch table list
- `GET /api/crud/[table]?page=1&limit=10` - Fetch records
- `POST /api/crud/[table]` - Create record
- `PUT /api/crud/[table]` - Update record
- `DELETE /api/crud/[table]` - Delete record

**Usage:**
```tsx
import { CrudInterface } from '@/components/features';

function CrudPage() {
  return <CrudInterface />;
}
```

#### SearchInterface (`features/search.tsx`)
Search testing interface with full-text search capabilities.

**Features:**
- Table selection
- Search query input
- Configurable minimum score threshold
- Field selection for targeted search
- Index management (build/clear)
- Results with highlighted matches
- Color-coded relevance scores
- Mobile responsive

**API Endpoints:**
- `GET /api/schema` - Fetch table list
- `GET /api/search/[table]?q=query&minScore=0.1&fields=name,desc` - Search
- `POST /api/search/[table]/index` - Build search index
- `DELETE /api/search/[table]/index` - Clear search index

**Usage:**
```tsx
import { SearchInterface } from '@/components/features';

function SearchPage() {
  return <SearchInterface />;
}
```

#### CacheManagement (`features/cache.tsx`)
Comprehensive cache management interface.

**Features:**
- Real-time cache statistics
- Memory usage display
- Cache hit/miss metrics
- Clear all cache
- Clear by table name
- Clear by custom pattern
- Eviction statistics
- Manual refresh

**API Endpoints:**
- `GET /api/cache` - Fetch cache stats
- `DELETE /api/cache` - Clear all cache
- `DELETE /api/cache` (body: `{table: "users"}`) - Clear by table
- `DELETE /api/cache` (body: `{pattern: "users:*"}`) - Clear by pattern

**Usage:**
```tsx
import { CacheManagement } from '@/components/features';

function CachePage() {
  return <CacheManagement />;
}
```

#### PerformanceAnalytics (`features/performance.tsx`)
Visual performance analytics with charts.

**Features:**
- Query performance over time (line chart)
- Query type distribution (pie chart)
- Average execution time by query type (bar chart)
- Performance by table (grouped bar chart)
- Summary statistics cards
- Auto-refresh every minute
- Responsive charts

**API Endpoint:** `GET /api/analytics/stats`

**Expected Data Structure:**
```typescript
{
  totalQueries: number;
  avgExecutionTime: number;
  cacheHitRate: number;
  activeConnections: number;
  performanceData?: Array<{
    timestamp: string;
    avgExecutionTime: number;
    queryCount: number;
  }>;
  queryTypes?: Array<{
    type: string;
    count: number;
    avgTime: number;
  }>;
  tableStats?: Array<{
    table: string;
    queries: number;
    avgTime: number;
  }>;
}
```

**Usage:**
```tsx
import { PerformanceAnalytics } from '@/components/features';

function PerformancePage() {
  return <PerformanceAnalytics />;
}
```

#### SlowQueriesMonitor (`features/slow-queries.tsx`)
Monitor and analyze slow database queries.

**Features:**
- Configurable threshold (ms)
- Table filtering
- Color-coded execution times
- Summary statistics
- Auto-refresh every 30 seconds
- Visual indicators for performance levels
- Timestamp formatting

**API Endpoint:** `GET /api/analytics/slow-queries?threshold=100`

**Expected Data Structure:**
```typescript
{
  queries: Array<{
    query: string;
    executionTime: number;
    timestamp: string;
    table?: string;
    params?: any[];
  }>;
}
```

**Usage:**
```tsx
import { SlowQueriesMonitor } from '@/components/features';

function SlowQueriesPage() {
  return <SlowQueriesMonitor />;
}
```

#### SchemaDiscovery (`features/schema.tsx`)
Explore database schema and table structures.

**Features:**
- Table list with row counts
- Column details (name, type, nullable, default, extra)
- Primary key indicators
- Foreign key relationships
- Index information
- Type-based color coding
- Two-panel layout (tables + details)

**API Endpoints:**
- `GET /api/schema` - Fetch all tables
- `GET /api/schema/[table]` - Fetch table details

**Expected Data Structure:**
```typescript
// GET /api/schema
{
  tables: Array<{
    name: string;
    rowCount?: number;
  }>;
}

// GET /api/schema/[table]
{
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: any;
    extra?: string;
  }>;
  primaryKey?: string[];
  foreignKeys?: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
  indexes?: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}
```

**Usage:**
```tsx
import { SchemaDiscovery } from '@/components/features';

function SchemaPage() {
  return <SchemaDiscovery />;
}
```

## Common Features

All components include:

### Error Handling
- Try-catch blocks for all API calls
- User-friendly error messages
- Error state display

### Loading States
- Skeleton loaders or spinners
- Disabled buttons during operations
- Loading indicators for async operations

### Mobile Responsiveness
- Responsive grid layouts
- Stacked layouts on small screens
- Touch-friendly controls
- Horizontal scrolling for tables

### TypeScript
- Full type safety
- Proper interface definitions
- Type-safe props and state

### Best Practices
- Client components with `'use client'`
- Proper cleanup (intervals, subscriptions)
- Optimistic UI updates where appropriate
- Accessibility considerations

## Dependencies

These components rely on:

- **shadcn/ui**: Card, Table, Dialog, Button, Input, Label, Select, Badge, Tabs
- **lucide-react**: Icons
- **recharts**: Charts (PerformanceAnalytics only)
- **React**: Hooks (useState, useEffect)
- **TypeScript**: Type definitions

## API Integration

Components expect the following API routes to be implemented:

```
GET  /api/analytics/stats
GET  /api/analytics/slow-queries?threshold=100
GET  /api/schema
GET  /api/schema/[table]
GET  /api/crud/[table]?page=1&limit=10
POST /api/crud/[table]
PUT  /api/crud/[table]
DELETE /api/crud/[table]
GET  /api/search/[table]?q=query&minScore=0.1&fields=name
POST /api/search/[table]/index
DELETE /api/search/[table]/index
GET  /api/cache
DELETE /api/cache
```

## Styling

All components use:
- Tailwind CSS utility classes
- shadcn/ui theming
- CSS variables for colors
- Dark mode support (inherited from shadcn/ui)

## Example Usage in a Page

```tsx
'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardStats } from '@/components/dashboard';
import {
  CrudInterface,
  SearchInterface,
  CacheManagement,
  PerformanceAnalytics,
  SlowQueriesMonitor,
  SchemaDiscovery,
} from '@/components/features';

export default function AdminPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">SqlDB Admin UI</h1>

      <DashboardStats />

      <Tabs defaultValue="crud">
        <TabsList>
          <TabsTrigger value="crud">CRUD</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="slow-queries">Slow Queries</TabsTrigger>
          <TabsTrigger value="schema">Schema</TabsTrigger>
        </TabsList>

        <TabsContent value="crud">
          <CrudInterface />
        </TabsContent>

        <TabsContent value="search">
          <SearchInterface />
        </TabsContent>

        <TabsContent value="cache">
          <CacheManagement />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceAnalytics />
        </TabsContent>

        <TabsContent value="slow-queries">
          <SlowQueriesMonitor />
        </TabsContent>

        <TabsContent value="schema">
          <SchemaDiscovery />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

## License

Part of the SqlDB project.
