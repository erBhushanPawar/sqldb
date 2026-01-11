# SqlDB Admin UI

Production-grade admin interface for SqlDB - showcasing all features including CRUD operations, full-text search, caching, performance analytics, and schema discovery.

## Features

- **CRUD Operations**: Full create, read, update, delete with automatic schema discovery
- **Full-Text Search**: Redis-powered inverted index with highlighting
- **Cache Management**: Real-time cache statistics and control
- **Performance Analytics**: Query performance tracking with charts
- **Slow Query Monitor**: Identify and optimize slow queries
- **Schema Discovery**: Automatic table and relationship detection
- **Real-time Updates**: Live statistics and auto-refresh
- **Docker Deployment**: Complete containerized stack

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: shadcn/ui, Tailwind CSS, Lucide Icons
- **Charts**: Recharts
- **Database**: MySQL 8.0
- **Cache**: Redis 7
- **Deployment**: Docker + Docker Compose

## Prerequisites

- Docker and Docker Compose (for containerized deployment)
- OR Node.js 20+ and MySQL/Redis (for local development)

## Quick Start (Docker)

### 1. Configure Environment

Copy the environment example:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your settings (defaults work for Docker):

```env
DB_HOST=mysql
DB_PORT=3306
DB_USER=sqldb_user
DB_PASSWORD=userpassword
DB_NAME=sqldb

REDIS_HOST=redis
REDIS_PORT=6379
ENABLE_CACHE=true
ENABLE_SEARCH=true
```

### 2. Start Services

```bash
# Start all services (MySQL, Redis, Admin UI)
docker-compose up -d

# View logs
docker-compose logs -f admin-ui

# Stop services
docker-compose down
```

### 3. Access Admin UI

Open your browser to: **http://localhost:3000**

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | MySQL host | localhost |
| `DB_PORT` | MySQL port | 3306 |
| `DB_USER` | MySQL username | root |
| `DB_PASSWORD` | MySQL password | - |
| `DB_NAME` | Database name | test |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `ENABLE_CACHE` | Enable caching | true |
| `ENABLE_SEARCH` | Enable search | true |

## Features Overview

### CRUD Operations
Automatic schema discovery, dynamic forms, pagination

### Full-Text Search
Build inverted indexes, relevance scoring, highlighting

### Cache Management
View stats, clear cache by table or pattern

### Performance Analytics
Query charts, execution time trends, cache hit rates

### Slow Query Monitor
Configurable threshold, color-coded alerts

### Schema Discovery
Table structure, primary/foreign keys, indexes

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/crud/[table]` - CRUD operations
- `POST /api/search/[table]` - Full-text search
- `GET /api/cache` - Cache statistics
- `GET /api/analytics/stats` - Performance analytics
- `GET /api/analytics/slow-queries` - Slow queries
- `GET /api/schema` - Schema discovery

See full API documentation in the main README.

## Production Deployment

### Docker (Recommended)

```bash
docker-compose up -d
```

### Manual

```bash
npm run build
npm start
```

## Security

- Change default passwords
- Set Redis password
- Add authentication layer
- Enable SSL/TLS
- Use firewall rules

## License

MIT - See parent SqlDB project

---

Built with ❤️ using [SqlDB](../README.md)
