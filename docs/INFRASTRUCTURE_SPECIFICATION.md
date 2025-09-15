# インフラストラクチャ仕様書

## 1. 概要

### 1.1 インフラ方針
- **Infrastructure as Code（IaC）**: すべてのインフラをコードで管理
- **コンテナベース**: Dockerによる環境の統一
- **CI/CD**: GitHub Actionsによる自動化
- **環境分離**: 開発・ステージング・本番の明確な分離

### 1.2 環境構成

| 環境 | 用途 | URL |
|------|------|-----|
| Development | ローカル開発 | http://localhost:3000 |
| Staging | 受入テスト | https://staging.architecture-quest.com |
| Production | 本番環境 | https://architecture-quest.com |

## 2. 開発環境構築

### 2.1 必要なツール

```yaml
必須:
  - Node.js: 22.x LTS
  - pnpm: 9.x
  - Docker: 24.x
  - Docker Compose: 2.x
  - Git: 2.x

推奨:
  - VSCode
  - GitHub CLI
  - PostgreSQL Client
  - Redis CLI
```

### 2.2 プロジェクトセットアップ

```bash
# 1. リポジトリのクローン
git clone https://github.com/your-org/layered-architecture-game.git
cd layered-architecture-game

# 2. 依存関係のインストール
pnpm install

# 3. 環境変数の設定
cp .env.example .env.local

# 4. Dockerコンテナの起動
docker-compose up -d

# 5. データベースのマイグレーション
pnpm db:migrate

# 6. 開発サーバーの起動
pnpm dev
```

### 2.3 Docker Compose設定

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:17-alpine
    container_name: lag-postgres
    environment:
      POSTGRES_USER: ${DB_USER:-developer}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-password}
      POSTGRES_DB: ${DB_NAME:-architecture_quest}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U developer"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7.4-alpine
    container_name: lag-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: lag-app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
    ports:
      - "3000:3000"
      - "8080:8080"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.pnpm-store
    command: pnpm dev

volumes:
  postgres_data:
  redis_data:
```

### 2.4 Dockerfile（開発環境）

```dockerfile
# Dockerfile.dev
FROM node:22-alpine

# pnpmのインストール
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# 依存関係のインストール（キャッシュ効率化）
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# アプリケーションコードのコピー
COPY . .

# 開発サーバーの起動
EXPOSE 3000 8080
CMD ["pnpm", "dev"]
```

## 3. CI/CD設定

### 3.1 GitHub Actions - CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '22'
  PNPM_VERSION: '9'

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - run: pnpm install --frozen-lockfile
      
      - name: Run ESLint
        run: pnpm lint
        
      - name: Run Prettier Check
        run: pnpm format:check
        
      - name: TypeScript Type Check
        run: pnpm typecheck

  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7.4-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
          
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - run: pnpm install --frozen-lockfile
      
      - name: Run Unit Tests
        run: pnpm test:unit
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          
      - name: Run Integration Tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          
      - name: Upload Coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - run: pnpm install --frozen-lockfile
      
      - name: Build Frontend
        run: pnpm build:client
        
      - name: Build Backend
        run: pnpm build:server
        
      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            apps/client/dist
            apps/server/dist

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [lint, test, build]
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
          
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
          
      - run: pnpm install --frozen-lockfile
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps chromium
        
      - name: Run E2E Tests
        run: pnpm test:e2e
        
      - name: Upload Test Results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

### 3.2 GitHub Actions - CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker Image
        run: |
          docker build -t architecture-quest:${{ github.sha }} .
          docker tag architecture-quest:${{ github.sha }} architecture-quest:staging
          
      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push architecture-quest:staging
          
      - name: Deploy to Staging
        run: |
          ssh ${{ secrets.STAGING_HOST }} << 'EOF'
            docker pull architecture-quest:staging
            docker stop architecture-quest || true
            docker rm architecture-quest || true
            docker run -d \
              --name architecture-quest \
              --restart unless-stopped \
              -p 80:3000 \
              -e NODE_ENV=staging \
              -e DATABASE_URL=${{ secrets.STAGING_DATABASE_URL }} \
              architecture-quest:staging
          EOF
          
      - name: Health Check
        run: |
          sleep 30
          curl -f https://staging.architecture-quest.com/health || exit 1

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    environment: production
    needs: deploy-staging
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Production Image
        run: |
          docker build -t architecture-quest:${{ github.sha }} -f Dockerfile.prod .
          docker tag architecture-quest:${{ github.sha }} architecture-quest:latest
          
      - name: Push to Registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push architecture-quest:latest
          
      - name: Deploy to Production
        run: |
          # Blue-Green Deployment
          ssh ${{ secrets.PRODUCTION_HOST }} << 'EOF'
            # Pull new image
            docker pull architecture-quest:latest
            
            # Start new container (green)
            docker run -d \
              --name architecture-quest-green \
              --restart unless-stopped \
              -p 8080:3000 \
              -e NODE_ENV=production \
              -e DATABASE_URL=${{ secrets.PRODUCTION_DATABASE_URL }} \
              architecture-quest:latest
            
            # Health check
            sleep 30
            curl -f http://localhost:8080/health || exit 1
            
            # Switch traffic
            docker stop architecture-quest-blue || true
            docker rm architecture-quest-blue || true
            docker rename architecture-quest-green architecture-quest-blue
            
            # Update nginx
            nginx -s reload
          EOF
```

## 4. 本番環境構成

### 4.1 Dockerfile（本番環境）

```dockerfile
# Dockerfile.prod
# ---- Build Stage ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# 依存関係のインストール
COPY package.json pnpm-lock.yaml ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
COPY packages/*/package.json ./packages/*/

RUN pnpm install --frozen-lockfile

# ビルド
COPY . .
RUN pnpm build

# ---- Production Stage ----
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# 本番用依存関係のみインストール
COPY package.json pnpm-lock.yaml ./
COPY apps/client/package.json ./apps/client/
COPY apps/server/package.json ./apps/server/
COPY packages/*/package.json ./packages/*/

RUN pnpm install --frozen-lockfile --prod

# ビルド成果物のコピー
COPY --from=builder /app/apps/client/dist ./apps/client/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# 非rootユーザーで実行
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
```

### 4.2 Nginx設定

```nginx
# /etc/nginx/sites-available/architecture-quest
upstream app {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 80;
    server_name architecture-quest.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name architecture-quest.com;

    ssl_certificate /etc/letsencrypt/live/architecture-quest.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/architecture-quest.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;

    # Static files
    location /assets {
        alias /var/www/architecture-quest/assets;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API
    location /api {
        proxy_pass http://app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA
    location / {
        root /var/www/architecture-quest/client;
        try_files $uri $uri/ /index.html;
    }
}
```

## 5. データベース管理

### 5.1 マイグレーション

```bash
# マイグレーションの作成
pnpm db:migrate:create add_user_table

# マイグレーションの実行
pnpm db:migrate

# ロールバック
pnpm db:migrate:rollback

# シード実行
pnpm db:seed
```

### 5.2 バックアップ戦略

```bash
#!/bin/bash
# scripts/backup.sh

# 日次バックアップ
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgres"
DB_NAME="architecture_quest"

# バックアップ実行
pg_dump -h localhost -U postgres -d $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# 古いバックアップの削除（30日以上）
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete

# S3へのアップロード
aws s3 cp $BACKUP_DIR/backup_$DATE.sql.gz s3://backups-bucket/postgres/
```

## 6. モニタリング

### 6.1 ヘルスチェック

```typescript
// apps/server/src/health.ts
export const healthCheck = async (req: Request, res: Response) => {
  const checks = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      memory: process.memoryUsage()
    }
  }

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`
    checks.services.database = 'healthy'
  } catch {
    checks.services.database = 'unhealthy'
  }

  try {
    // Redis check
    await redis.ping()
    checks.services.redis = 'healthy'
  } catch {
    checks.services.redis = 'unhealthy'
  }

  const isHealthy = 
    checks.services.database === 'healthy' &&
    checks.services.redis === 'healthy'

  res.status(isHealthy ? 200 : 503).json(checks)
}
```

### 6.2 Prometheus メトリクス

```yaml
# docker-compose.monitoring.yml
version: '3.9'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3001:3000"

  node_exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"

volumes:
  prometheus_data:
  grafana_data:
```

## 7. セキュリティ

### 7.1 環境変数管理

```bash
# .env.example
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# External Services
SENTRY_DSN=https://xxx@sentry.io/xxx
POSTHOG_API_KEY=xxx

# NEVER commit real values!
```

### 7.2 Secrets管理

```yaml
# GitHub Secrets設定
DOCKER_USERNAME
DOCKER_PASSWORD
STAGING_HOST
STAGING_DATABASE_URL
PRODUCTION_HOST
PRODUCTION_DATABASE_URL
SENTRY_DSN
CODECOV_TOKEN
```

## 8. トラブルシューティング

### 8.1 よくある問題と解決策

| 問題 | 原因 | 解決策 |
|------|------|--------|
| Docker起動失敗 | ポート競合 | `lsof -i :5432`でプロセス確認し停止 |
| DB接続エラー | 環境変数未設定 | `.env.local`を確認 |
| ビルドエラー | キャッシュ問題 | `pnpm clean && pnpm install` |
| テスト失敗 | DB未マイグレーション | `pnpm db:migrate:test` |

### 8.2 ログ確認

```bash
# Dockerログ
docker-compose logs -f app

# PM2ログ（本番）
pm2 logs

# システムログ
journalctl -u architecture-quest -f
```

## 9. スケーリング戦略

### 9.1 水平スケーリング

```yaml
# docker-compose.scale.yml
services:
  app:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### 9.2 キャッシュ戦略

- **CDN**: 静的アセット
- **Redis**: セッション、APIレスポンス
- **ブラウザキャッシュ**: 適切なCache-Control

## 10. 災害復旧計画

### 10.1 RTO/RPO目標

- **RTO（Recovery Time Objective）**: 4時間
- **RPO（Recovery Point Objective）**: 1時間

### 10.2 復旧手順

1. バックアップからのDB復元
2. アプリケーションの再デプロイ
3. DNSの切り替え
4. ヘルスチェック確認

---

最終更新: 2025年1月15日