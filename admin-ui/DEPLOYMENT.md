# SqlDB Admin UI - Deployment Guide

Complete guide for deploying the SqlDB Admin UI in production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Database Setup](#database-setup)
- [Security Hardening](#security-hardening)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Docker Deployment
- Docker 20.10+
- Docker Compose 2.0+
- 2GB+ RAM available
- 10GB+ disk space

### Manual Deployment
- Node.js 20+
- MySQL 8.0+
- Redis 7+
- PM2 or similar process manager

## Configuration

### 1. Environment Setup

Create `.env.local` file:

```bash
cp .env.example .env.local
```

### 2. Database Configuration

```env
# MySQL Connection
DB_HOST=localhost           # Use 'mysql' for Docker
DB_PORT=3306
DB_USER=sqldb_user
DB_PASSWORD=your_secure_password_here
DB_NAME=sqldb
```

**Security Tips:**
- Use strong passwords (16+ characters, mixed case, numbers, symbols)
- Never use 'root' user in production
- Create dedicated database user with minimal privileges

### 3. Redis Configuration

```env
# Redis Connection
REDIS_HOST=localhost        # Use 'redis' for Docker
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
```

**Security Tips:**
- Always set Redis password in production
- Use Redis ACL for fine-grained permissions (Redis 6+)
- Bind to localhost or private network only

### 4. Feature Flags

```env
ENABLE_CACHE=true
ENABLE_SEARCH=true
ENABLE_AUTO_WARMING=true
ENABLE_QUERY_STATS=true
```

## Docker Deployment

### Quick Start

```bash
# Clone and navigate
cd admin-ui

# Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f admin-ui
```

### Production Configuration

Edit `docker-compose.yml` for production:

```yaml
services:
  mysql:
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}  # Strong password
      MYSQL_PASSWORD: ${DB_PASSWORD}            # Strong password
    volumes:
      - /var/lib/sqldb/mysql:/var/lib/mysql    # Persistent storage
    restart: always                             # Auto-restart on failure

  redis:
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - /var/lib/sqldb/redis:/data
    restart: always

  admin-ui:
    restart: always
    environment:
      NODE_ENV: production
    labels:
      - "traefik.enable=true"  # If using Traefik
      - "traefik.http.routers.sqldb.rule=Host(`admin.yourdomain.com`)"
```

### SSL/TLS with Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Scaling with Docker Swarm

```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml sqldb

# Scale admin UI
docker service scale sqldb_admin-ui=3

# Update service
docker service update --image sqldb-admin-ui:latest sqldb_admin-ui
```

## Manual Deployment

### 1. Build Application

```bash
# Install dependencies
npm ci --production=false

# Build Next.js app
npm run build

# Test build
npm start
```

### 2. Configure MySQL

```sql
-- Create database and user
CREATE DATABASE sqldb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sqldb_user'@'%' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON sqldb.* TO 'sqldb_user'@'%';
FLUSH PRIVILEGES;

-- Run initialization script
SOURCE docker/mysql/init.sql;
```

### 3. Configure Redis

Edit `/etc/redis/redis.conf`:

```conf
# Bind to localhost
bind 127.0.0.1

# Set password
requirepass your_redis_password

# Memory limits
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
appendonly yes
```

Restart Redis:

```bash
sudo systemctl restart redis
```

### 4. Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'sqldb-admin',
    script: 'npm',
    args: 'start',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js

# Save configuration
pm2 save

# Setup startup script
pm2 startup
```

## Database Setup

### Required Tables

The admin UI requires the `__sqldb_query_stats` table. Run:

```sql
CREATE TABLE IF NOT EXISTS __sqldb_query_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  query_id VARCHAR(64) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  query_type VARCHAR(50) NOT NULL,
  filters TEXT,
  execution_time_ms DECIMAL(10, 2) NOT NULL,
  cache_hit BOOLEAN DEFAULT FALSE,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_name (table_name),
  INDEX idx_execution_time (execution_time_ms),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;
```

### Sample Data (Optional)

Load sample tables for testing:

```bash
mysql -u sqldb_user -p sqldb < docker/mysql/init.sql
```

## Security Hardening

### 1. Application Security

#### Add Authentication Middleware

Create `middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Add your authentication logic
  const token = request.cookies.get('auth-token');

  if (!token && request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

#### Rate Limiting

Install and configure rate limiting:

```bash
npm install express-rate-limit
```

```typescript
// In API routes
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

export async function GET(request: Request) {
  // Apply rate limiting
  await limiter(request);
  // ... rest of handler
}
```

### 2. Database Security

```sql
-- Restrict user privileges
REVOKE ALL PRIVILEGES ON sqldb.* FROM 'sqldb_user'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON sqldb.* TO 'sqldb_user'@'%';

-- No DROP, ALTER, CREATE privileges in production

-- Enable SSL
ALTER USER 'sqldb_user'@'%' REQUIRE SSL;
```

### 3. Redis Security

```conf
# redis.conf

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""

# Enable ACL (Redis 6+)
aclfile /etc/redis/users.acl
```

### 4. Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw deny 3000/tcp     # Block direct app access
sudo ufw deny 3306/tcp     # Block MySQL from external
sudo ufw deny 6379/tcp     # Block Redis from external
sudo ufw enable
```

### 5. CORS Configuration

Restrict CORS in production (if API used externally):

```typescript
// lib/cors.ts
export const allowedOrigins = [
  'https://yourdomain.com',
  'https://admin.yourdomain.com',
];

export function checkCors(origin: string) {
  return allowedOrigins.includes(origin);
}
```

## Monitoring

### 1. Health Checks

```bash
# Check application health
curl http://localhost:3000/api/health

# Expected response:
# {"status":"healthy","services":{"mysql":"connected","redis":"connected"}}
```

### 2. PM2 Monitoring

```bash
# Monitor processes
pm2 monit

# View logs
pm2 logs sqldb-admin

# CPU/Memory usage
pm2 status
```

### 3. Docker Monitoring

```bash
# Container stats
docker stats

# Health status
docker ps

# Logs
docker-compose logs -f --tail=100
```

### 4. Set Up Alerts

#### Uptime Monitoring
- Use [Uptime Robot](https://uptimerobot.com/)
- Monitor https://admin.yourdomain.com/api/health
- Alert on status != 200

#### Error Tracking
- Integrate Sentry:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

## Troubleshooting

### Application Won't Start

```bash
# Check Node version
node --version  # Should be 20+

# Clear cache
rm -rf .next node_modules
npm install
npm run build

# Check logs
pm2 logs sqldb-admin --lines 100
```

### Database Connection Errors

```bash
# Test MySQL connection
mysql -h DB_HOST -u DB_USER -p DB_NAME

# Check MySQL is running
sudo systemctl status mysql

# View MySQL logs
sudo tail -f /var/log/mysql/error.log
```

### Redis Connection Errors

```bash
# Test Redis connection
redis-cli -h REDIS_HOST -p REDIS_PORT -a REDIS_PASSWORD ping

# Check Redis is running
sudo systemctl status redis

# View Redis logs
sudo tail -f /var/log/redis/redis-server.log
```

### High Memory Usage

```bash
# Clear Redis cache
redis-cli FLUSHDB

# Set Redis memory limit
redis-cli CONFIG SET maxmemory 512mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Restart services
pm2 restart sqldb-admin
```

### Slow Query Performance

```bash
# Enable MySQL slow query log
mysql> SET GLOBAL slow_query_log = 'ON';
mysql> SET GLOBAL long_query_time = 1;

# Analyze slow queries
mysql> SELECT * FROM mysql.slow_log ORDER BY query_time DESC LIMIT 10;

# Check indexes
mysql> SHOW INDEX FROM tablename;
```

## Backup & Recovery

### Database Backup

```bash
# Automated daily backup
cat > /etc/cron.daily/sqldb-backup << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u sqldb_user -p$DB_PASSWORD sqldb | gzip > /backups/sqldb_$DATE.sql.gz
find /backups -name "sqldb_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/sqldb-backup
```

### Redis Backup

Redis automatically saves to `/data/dump.rdb` with AOF enabled.

```bash
# Manual backup
cp /var/lib/redis/dump.rdb /backups/redis_backup_$(date +%Y%m%d).rdb
```

### Application Backup

```bash
# Backup configuration
tar -czf admin-ui-config-$(date +%Y%m%d).tar.gz .env.local docker-compose.yml
```

## Updates & Maintenance

### Updating Application

```bash
# Docker
docker-compose pull
docker-compose up -d

# Manual
git pull
npm ci
npm run build
pm2 restart sqldb-admin
```

### Database Maintenance

```bash
# Optimize tables
mysqlcheck -u sqldb_user -p --optimize sqldb

# Repair tables
mysqlcheck -u sqldb_user -p --repair sqldb
```

---

For more information, see the main [README.md](README.md) or visit the [SqlDB documentation](../README.md).
