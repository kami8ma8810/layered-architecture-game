import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StartGameSessionUseCase } from '../start-game-session.usecase'
import { GameSessionRepository } from '../../repositories/game-session.repository'
import { ChallengeRepository } from '../../repositories/challenge.repository'
import { StartGameSessionDto } from '../../dto/start-game-session.dto'
import { GameSessionDto } from '../../dto/game-session.dto'
import { UserId, Challenge, GameSession } from '@architecture-quest/shared-domain'

// モックの型定義
type MockRepository<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any 
    ? ReturnType<typeof vi.fn> 
    : T[K]
}

describe('StartGameSessionUseCase', () => {
  let useCase: StartGameSessionUseCase
  let mockSessionRepo: MockRepository<GameSessionRepository>
  let mockChallengeRepo: MockRepository<ChallengeRepository>

  beforeEach(() => {
    // モックリポジトリを作成
    mockSessionRepo = {
      save: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      findActiveByUserId: vi.fn()
    }

    mockChallengeRepo = {
      findById: vi.fn(),
      findAll: vi.fn(),
      findByDifficulty: vi.fn()
    }

    useCase = new StartGameSessionUseCase(
      mockSessionRepo as GameSessionRepository,
      mockChallengeRepo as ChallengeRepository
    )
  })

  describe('正常系', () => {
    it('有効なチャレンジIDでセッションを開始できる', async () => {
      // Arrange
      const dto: StartGameSessionDto = {
        userId: 'user-123',
        challengeId: 'ch-001'
      }

      const challenge = createTestChallenge('ch-001')
      mockChallengeRepo.findById.mockResolvedValue(challenge)
      mockSessionRepo.save.mockResolvedValue(undefined)
      mockSessionRepo.findActiveByUserId.mockResolvedValue(null)

      // Act
      const result = await useCase.execute(dto)

      // Assert
      expect(result.isSuccess()).toBe(true)
      const sessionDto = result.getValue()
      expect(sessionDto).toBeInstanceOf(GameSessionDto)
      expect(sessionDto.userId).toBe('user-123')
      expect(sessionDto.challengeId).toBe('ch-001')
      expect(sessionDto.state).toBe('in_progress')
      
      // リポジトリが正しく呼ばれたか確認
      expect(mockChallengeRepo.findById).toHaveBeenCalledWith('ch-001')
      expect(mockSessionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          getUserId: expect.any(Function),
          getChallenge: expect.any(Function),
          getState: expect.any(Function)
        })
      )
    })

    it('セッションIDが生成される', async () => {
      // Arrange
      const dto: StartGameSessionDto = {
        userId: 'user-123',
        challengeId: 'ch-001'
      }

      const challenge = createTestChallenge('ch-001')
      mockChallengeRepo.findById.mockResolvedValue(challenge)
      mockSessionRepo.save.mockResolvedValue(undefined)
      mockSessionRepo.findActiveByUserId.mockResolvedValue(null)

      // Act
      const result = await useCase.execute(dto)

      // Assert
      const sessionDto = result.getValue()
      expect(sessionDto.id).toBeDefined()
      expect(sessionDto.id).toMatch(/^session-/)
    })
  })

  describe('異常系', () => {
    it('存在しないチャレンジIDではセッションを開始できない', async () => {
      // Arrange
      const dto: StartGameSessionDto = {
        userId: 'user-123',
        challengeId: 'invalid-id'
      }

      mockChallengeRepo.findById.mockResolvedValue(null)

      // Act
      const result = await useCase.execute(dto)

      // Assert
      expect(result.isFailure()).toBe(true)
      expect(result.getError().message).toContain('チャレンジが見つかりません')
      expect(result.getError().code).toBe('CHALLENGE_NOT_FOUND')
      expect(mockSessionRepo.save).not.toHaveBeenCalled()
    })

    it('既にアクティブなセッションがある場合はエラーになる', async () => {
      // Arrange
      const dto: StartGameSessionDto = {
        userId: 'user-123',
        challengeId: 'ch-001'
      }

      const existingSession = createTestSession('user-123', 'ch-002')
      mockSessionRepo.findActiveByUserId.mockResolvedValue(existingSession)

      const challenge = createTestChallenge('ch-001')
      mockChallengeRepo.findById.mockResolvedValue(challenge)

      // Act
      const result = await useCase.execute(dto)

      // Assert
      expect(result.isFailure()).toBe(true)
      expect(result.getError().message).toContain('既にアクティブなセッション')
      expect(result.getError().code).toBe('ACTIVE_SESSION_EXISTS')
      expect(mockSessionRepo.save).not.toHaveBeenCalled()
    })

    it('ユーザーIDが空の場合はエラーになる', async () => {
      // Arrange
      const dto: StartGameSessionDto = {
        userId: '',
        challengeId: 'ch-001'
      }

      // Act
      const result = await useCase.execute(dto)

      // Assert
      expect(result.isFailure()).toBe(true)
      expect(result.getError().message).toContain('ユーザーID')
      expect(result.getError().code).toBe('INVALID_USER_ID')
    })

    it('チャレンジIDが空の場合はエラーになる', async () => {
      // Arrange
      const dto: StartGameSessionDto = {
        userId: 'user-123',
        challengeId: ''
      }

      // Act
      const result = await useCase.execute(dto)

      // Assert
      expect(result.isFailure()).toBe(true)
      expect(result.getError().message).toContain('チャレンジID')
      expect(result.getError().code).toBe('INVALID_CHALLENGE_ID')
    })
  })

  describe('リトライ処理', () => {
    it('保存失敗時は3回までリトライする', async () => {
      // Arrange
      const dto: StartGameSessionDto = {
        userId: 'user-123',
        challengeId: 'ch-001'
      }

      const challenge = createTestChallenge('ch-001')
      mockChallengeRepo.findById.mockResolvedValue(challenge)
      mockSessionRepo.findActiveByUserId.mockResolvedValue(null)
      
      // 2回失敗して3回目で成功
      mockSessionRepo.save
        .mockRejectedValueOnce(new Error('DB Error'))
        .mockRejectedValueOnce(new Error('DB Error'))
        .mockResolvedValueOnce(undefined)

      // Act
      const result = await useCase.execute(dto)

      // Assert
      expect(result.isSuccess()).toBe(true)
      expect(mockSessionRepo.save).toHaveBeenCalledTimes(3)
    })

    it('3回リトライしても失敗したらエラーを返す', async () => {
      // Arrange
      const dto: StartGameSessionDto = {
        userId: 'user-123',
        challengeId: 'ch-001'
      }

      const challenge = createTestChallenge('ch-001')
      mockChallengeRepo.findById.mockResolvedValue(challenge)
      mockSessionRepo.findActiveByUserId.mockResolvedValue(null)
      
      // 全て失敗
      mockSessionRepo.save.mockRejectedValue(new Error('DB Error'))

      // Act
      const result = await useCase.execute(dto)

      // Assert
      expect(result.isFailure()).toBe(true)
      expect(result.getError().message).toContain('セッションの保存に失敗')
      expect(result.getError().code).toBe('SESSION_SAVE_FAILED')
      expect(mockSessionRepo.save).toHaveBeenCalledTimes(3)
    })
  })
})

// テスト用のヘルパー関数
function createTestChallenge(id: string): Challenge {
  return Challenge.create({
    id,
    title: 'Test Challenge',
    description: 'Test Description',
    difficulty: 'beginner',
    timeLimit: 180,
    initialStructure: {} as any, // 簡略化
    goals: ['Goal 1'],
    hints: ['Hint 1']
  })
}

function createTestSession(userId: string, challengeId: string): GameSession {
  const userIdObj = UserId.create(userId)
  const challenge = createTestChallenge(challengeId)
  return GameSession.start(userIdObj, challenge)
}