# バックエンド仕様書

## 1. 概要

### 1.1 アーキテクチャ方針
バックエンドは**クリーンアーキテクチャ**に基づき、ビジネスロジックを中心とした同心円状の設計を採用する。

### 1.2 開発方針
- **TDD（テスト駆動開発）**: APIエンドポイントからテストファーストで実装
- **RESTful API**: リソース指向の設計
- **イベント駆動**: ドメインイベントによる疎結合な設計

## 2. API設計

### 2.1 エンドポイント一覧

#### ゲームセッション関連

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | /api/v1/sessions | セッション開始 | 必要 |
| GET | /api/v1/sessions/:id | セッション取得 | 必要 |
| PUT | /api/v1/sessions/:id/solution | 解答提出 | 必要 |
| GET | /api/v1/sessions/:id/validation | 検証結果取得 | 必要 |

#### チャレンジ関連

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | /api/v1/challenges | チャレンジ一覧 | 不要 |
| GET | /api/v1/challenges/:id | チャレンジ詳細 | 不要 |
| GET | /api/v1/challenges/daily | デイリーチャレンジ | 不要 |

#### ユーザー関連

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | /api/v1/auth/register | ユーザー登録 | 不要 |
| POST | /api/v1/auth/login | ログイン | 不要 |
| POST | /api/v1/auth/refresh | トークン更新 | 必要 |
| GET | /api/v1/users/me | 自分の情報 | 必要 |
| GET | /api/v1/users/me/progress | 学習進捗 | 必要 |

### 2.2 リクエスト/レスポンス仕様

#### セッション開始
```typescript
// POST /api/v1/sessions
// Request
{
  "challengeId": "ch-001",
  "userId": "usr-123"
}

// Response (201 Created)
{
  "id": "ses-456",
  "challengeId": "ch-001",
  "userId": "usr-123",
  "state": "in_progress",
  "startedAt": "2025-01-15T10:00:00Z",
  "timeLimit": 180,
  "initialState": {
    "layers": [...],
    "blocks": [...],
    "connections": [...]
  }
}
```

#### 解答提出
```typescript
// PUT /api/v1/sessions/:id/solution
// Request
{
  "solution": {
    "layers": [
      {
        "id": "presentation",
        "blocks": ["ui-1", "ui-2"]
      },
      {
        "id": "application",
        "blocks": ["dto-1", "svc-1"]
      }
    ],
    "connections": [
      {"from": "ui-1", "to": "dto-1"},
      {"from": "dto-1", "to": "svc-1"}
    ]
  },
  "timeSpent": 120
}

// Response (200 OK)
{
  "validationResult": {
    "isValid": true,
    "score": 95,
    "violations": [],
    "metrics": {
      "accuracy": 100,
      "efficiency": 90,
      "maintainability": 95,
      "speed": 95
    }
  },
  "feedback": {
    "message": "素晴らしい！正しくレイヤーを分離できています。",
    "improvements": []
  }
}
```

### 2.3 エラーレスポンス

```typescript
// 4xx/5xx Error Response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "循環依存が検出されました",
    "details": {
      "cycle": ["ui-1", "dto-1", "ui-1"]
    }
  },
  "timestamp": "2025-01-15T10:00:00Z",
  "path": "/api/v1/sessions/ses-456/solution"
}
```

## 3. TDD実践仕様

### 3.1 APIテストファースト

```typescript
// tests/api/sessions.spec.ts
describe('POST /api/v1/sessions', () => {
  let app: Application
  let authToken: string

  beforeEach(async () => {
    app = await createTestApp()
    authToken = await getTestAuthToken()
  })

  it('認証済みユーザーはセッションを開始できる', async () => {
    // Arrange
    const challengeId = 'ch-001'
    
    // Act
    const response = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ challengeId })
    
    // Assert
    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      challengeId,
      state: 'in_progress'
    })
  })

  it('認証なしではセッションを開始できない', async () => {
    // Act
    const response = await request(app)
      .post('/api/v1/sessions')
      .send({ challengeId: 'ch-001' })
    
    // Assert
    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('存在しないチャレンジではセッションを開始できない', async () => {
    // Act
    const response = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ challengeId: 'invalid-id' })
    
    // Assert
    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('CHALLENGE_NOT_FOUND')
  })
})
```

### 3.2 ユースケーステスト

```typescript
// src/application/usecases/__tests__/submit-solution.usecase.spec.ts
describe('SubmitSolutionUseCase', () => {
  let useCase: SubmitSolutionUseCase
  let mockSessionRepo: jest.Mocked<SessionRepository>
  let mockValidator: jest.Mocked<SolutionValidator>

  beforeEach(() => {
    mockSessionRepo = createMockSessionRepository()
    mockValidator = createMockSolutionValidator()
    useCase = new SubmitSolutionUseCase(mockSessionRepo, mockValidator)
  })

  it('正しい解答を提出すると高スコアを獲得する', async () => {
    // Arrange
    const session = TestDataBuilder.session()
      .withChallenge('ch-001')
      .build()
    
    mockSessionRepo.findById.mockResolvedValue(session)
    mockValidator.validate.mockReturnValue({
      isValid: true,
      violations: [],
      score: 95
    })

    // Act
    const result = await useCase.execute({
      sessionId: 'ses-123',
      solution: TestDataBuilder.solution().build()
    })

    // Assert
    expect(result.isSuccess()).toBe(true)
    expect(result.value.score).toBeGreaterThanOrEqual(90)
    expect(mockSessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'completed'
      })
    )
  })
})
```

## 4. ドメイン層設計

### 4.1 集約ルート

```typescript
// src/domain/aggregates/game-session.aggregate.ts
export class GameSessionAggregate extends AggregateRoot {
  private constructor(
    id: SessionId,
    private userId: UserId,
    private challenge: Challenge,
    private state: SessionState,
    private solution?: Solution,
    private score?: Score
  ) {
    super(id)
  }

  static start(userId: UserId, challenge: Challenge): GameSessionAggregate {
    const session = new GameSessionAggregate(
      SessionId.generate(),
      userId,
      challenge,
      SessionState.InProgress
    )
    
    session.addDomainEvent(
      new SessionStartedEvent(session.id, userId, challenge.id)
    )
    
    return session
  }

  submitSolution(solution: Solution): Result<ValidationResult> {
    if (this.state !== SessionState.InProgress) {
      return Result.fail('セッションは既に終了しています')
    }

    const validator = new ArchitectureValidator(this.challenge.rules)
    const result = validator.validate(solution)

    if (result.isValid) {
      this.solution = solution
      this.score = result.score
      this.state = SessionState.Completed
      
      this.addDomainEvent(
        new SolutionSubmittedEvent(this.id, solution, result)
      )
    }

    return Result.ok(result)
  }
}
```

### 4.2 ドメインサービス

```typescript
// src/domain/services/architecture-validator.service.ts
export class ArchitectureValidator implements DomainService {
  constructor(private readonly rules: ValidationRule[]) {}

  validate(solution: Solution): ValidationResult {
    const violations: Violation[] = []
    
    // 依存方向の検証
    const dependencyViolations = this.validateDependencies(solution)
    violations.push(...dependencyViolations)
    
    // 循環依存の検証
    if (this.hasCyclicDependency(solution)) {
      violations.push(new Violation('CYCLIC_DEPENDENCY', '循環依存が検出されました'))
    }
    
    // DTOの純粋性検証
    const dtoViolations = this.validateDtoPurity(solution)
    violations.push(...dtoViolations)
    
    // スコア計算
    const score = this.calculateScore(solution, violations)
    
    return new ValidationResult(
      violations.length === 0,
      violations,
      score
    )
  }

  private validateDependencies(solution: Solution): Violation[] {
    const violations: Violation[] = []
    
    for (const connection of solution.connections) {
      const fromLayer = this.getLayerOfBlock(connection.from, solution)
      const toLayer = this.getLayerOfBlock(connection.to, solution)
      
      if (!this.isValidDependency(fromLayer, toLayer)) {
        violations.push(new Violation(
          'INVALID_DEPENDENCY',
          `不正な依存: ${fromLayer} -> ${toLayer}`
        ))
      }
    }
    
    return violations
  }

  private hasCyclicDependency(solution: Solution): boolean {
    // Tarjanのアルゴリズムで循環検出
    const graph = this.buildDependencyGraph(solution)
    return new CycleDetector().hasCycle(graph)
  }
}
```

## 5. インフラストラクチャ層

### 5.1 リポジトリ実装

```typescript
// src/infrastructure/repositories/game-session.repository.ts
export class GameSessionRepositoryImpl implements GameSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: SessionId): Promise<GameSessionAggregate | null> {
    const data = await this.prisma.gameSession.findUnique({
      where: { id: id.value },
      include: {
        challenge: {
          include: {
            rules: true
          }
        },
        solution: true
      }
    })

    if (!data) return null

    return GameSessionMapper.toDomain(data)
  }

  async save(session: GameSessionAggregate): Promise<void> {
    const data = GameSessionMapper.toPersistence(session)
    
    await this.prisma.gameSession.upsert({
      where: { id: data.id },
      create: data,
      update: data
    })

    // ドメインイベントの発行
    await this.publishDomainEvents(session)
  }

  private async publishDomainEvents(session: GameSessionAggregate): Promise<void> {
    const events = session.getUncommittedEvents()
    
    for (const event of events) {
      await this.eventBus.publish(event)
    }
    
    session.markEventsAsCommitted()
  }
}
```

### 5.2 Prismaスキーマ

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  username  String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  sessions GameSession[]
  progress LearningProgress[]
}

model Challenge {
  id          String   @id
  title       String
  description String
  difficulty  String
  timeLimit   Int
  chapter     Int
  
  rules       ValidationRule[]
  sessions    GameSession[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model GameSession {
  id          String   @id @default(cuid())
  userId      String
  challengeId String
  state       String
  startedAt   DateTime @default(now())
  completedAt DateTime?
  score       Int?
  
  user        User     @relation(fields: [userId], references: [id])
  challenge   Challenge @relation(fields: [challengeId], references: [id])
  solution    Solution?
  
  @@index([userId])
  @@index([challengeId])
}

model Solution {
  id        String      @id @default(cuid())
  sessionId String      @unique
  data      Json
  createdAt DateTime    @default(now())
  
  session   GameSession @relation(fields: [sessionId], references: [id])
}

model ValidationRule {
  id          String    @id @default(cuid())
  challengeId String
  type        String
  parameters  Json
  
  challenge   Challenge @relation(fields: [challengeId], references: [id])
}

model LearningProgress {
  id              String   @id @default(cuid())
  userId          String
  challengeId     String
  attempts        Int      @default(0)
  bestScore       Int?
  completedAt     DateTime?
  lastAttemptAt   DateTime?
  
  user            User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, challengeId])
}
```

## 6. 認証・認可

### 6.1 JWT実装

```typescript
// src/infrastructure/auth/jwt.service.ts
export class JWTService implements AuthService {
  constructor(
    private readonly config: AuthConfig,
    private readonly userRepository: UserRepository
  ) {}

  async generateTokens(userId: string): Promise<TokenPair> {
    const user = await this.userRepository.findById(userId)
    if (!user) throw new UnauthorizedError()

    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username
    }

    const accessToken = jwt.sign(payload, this.config.accessSecret, {
      expiresIn: '15m'
    })

    const refreshToken = jwt.sign(payload, this.config.refreshSecret, {
      expiresIn: '7d'
    })

    return { accessToken, refreshToken }
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      return jwt.verify(token, this.config.accessSecret) as TokenPayload
    } catch (error) {
      throw new UnauthorizedError('Invalid token')
    }
  }
}
```

### 6.2 認証ミドルウェア

```typescript
// src/presentation/middleware/auth.middleware.ts
export const authMiddleware = (authService: AuthService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: '認証が必要です'
        }
      })
    }

    try {
      const payload = await authService.verifyToken(token)
      req.user = payload
      next()
    } catch (error) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'トークンが無効です'
        }
      })
    }
  }
}
```

## 7. バリデーション

### 7.1 リクエストバリデーション

```typescript
// src/presentation/validators/session.validator.ts
import { z } from 'zod'

export const startSessionSchema = z.object({
  challengeId: z.string().min(1).max(50)
})

export const submitSolutionSchema = z.object({
  solution: z.object({
    layers: z.array(z.object({
      id: z.string(),
      blocks: z.array(z.string())
    })),
    connections: z.array(z.object({
      from: z.string(),
      to: z.string()
    }))
  }),
  timeSpent: z.number().min(0).max(3600)
})

// ミドルウェア
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '入力データが不正です',
          details: result.error.flatten()
        }
      })
    }
    
    req.body = result.data
    next()
  }
}
```

## 8. エラーハンドリング

### 8.1 グローバルエラーハンドラー

```typescript
// src/presentation/middleware/error.middleware.ts
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(`Error: ${error.message}`, {
    path: req.path,
    method: req.method,
    stack: error.stack
  })

  if (error instanceof DomainError) {
    return res.status(400).json({
      error: {
        code: error.code,
        message: error.message
      }
    })
  }

  if (error instanceof ApplicationError) {
    return res.status(error.statusCode || 400).json({
      error: {
        code: error.code,
        message: error.message
      }
    })
  }

  if (error instanceof ValidationError) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details
      }
    })
  }

  // 予期しないエラー
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'サーバーエラーが発生しました'
    }
  })
}
```

## 9. テスト戦略

### 9.1 テストピラミッド

```
         E2E Tests (10%)
        /            \
    Integration Tests (30%)
   /                      \
  Unit Tests (60%)
```

### 9.2 テストカバレッジ目標

- ユニットテスト: 90%以上
- 統合テスト: 80%以上
- E2Eテスト: 主要フロー100%

### 9.3 テストデータビルダー

```typescript
// tests/builders/session.builder.ts
export class SessionBuilder {
  private data = {
    id: 'ses-test',
    userId: 'usr-test',
    challengeId: 'ch-001',
    state: 'in_progress',
    startedAt: new Date()
  }

  withId(id: string): this {
    this.data.id = id
    return this
  }

  withCompleted(): this {
    this.data.state = 'completed'
    return this
  }

  build(): GameSessionAggregate {
    return GameSessionAggregate.restore(this.data)
  }
}
```

## 10. パフォーマンス最適化

### 10.1 データベースクエリ最適化

```typescript
// インデックスの設定
@@index([userId, createdAt])
@@index([challengeId, state])

// N+1問題の回避
const sessions = await prisma.gameSession.findMany({
  include: {
    challenge: true,
    user: true
  }
})
```

### 10.2 キャッシュ戦略

```typescript
// src/infrastructure/cache/redis.cache.ts
export class RedisCache implements CacheService {
  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(key)
    return data ? JSON.parse(data) : null
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttl || 3600)
  }

  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern)
    if (keys.length) {
      await this.redis.del(...keys)
    }
  }
}
```

## 11. モニタリング

### 11.1 ロギング

```typescript
// src/infrastructure/logging/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})
```

### 11.2 APM統合

```typescript
// src/infrastructure/monitoring/sentry.ts
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0
})

export const captureException = (error: Error, context?: any) => {
  Sentry.captureException(error, {
    extra: context
  })
}
```

---

最終更新: 2025年1月15日