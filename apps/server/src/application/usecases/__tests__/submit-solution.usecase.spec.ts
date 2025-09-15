import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SubmitSolutionUseCase } from '../submit-solution.usecase'
import { GameSessionRepository } from '../../repositories/game-session.repository'
import { GameSession, LayerId, UserId, Challenge } from '@architecture-quest/shared-domain'
import { SubmitSolutionInputDTO } from '../../dtos/submit-solution.dto'

describe('SubmitSolutionUseCase', () => {
  let useCase: SubmitSolutionUseCase
  let mockRepository: GameSessionRepository

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      save: vi.fn()
    }
    useCase = new SubmitSolutionUseCase(mockRepository)
  })

  describe('正常系', () => {
    it('解答を提出できる', async () => {
      const sessionId = 'session-123'
      const playerId = 'player-123'
      const challenge = Challenge.create({
        id: 'challenge-1',
        title: 'チャレンジ1',
        description: '基本的なレイヤードアーキテクチャ',
        difficulty: 'beginner',
        timeLimit: 600,
        goals: [],
        hints: []
      })
      const session = GameSession.start(
        UserId.create(playerId),
        challenge
      )

      mockRepository.findById = vi.fn().mockResolvedValue(session)
      mockRepository.save = vi.fn().mockResolvedValue(undefined)

      const input: SubmitSolutionInputDTO = {
        sessionId,
        playerId,
        solution: {
          layers: [
            { id: LayerId.Presentation, name: 'プレゼンテーション層' },
            { id: LayerId.Application, name: 'アプリケーション層' },
            { id: LayerId.Domain, name: 'ドメイン層' },
            { id: LayerId.Infrastructure, name: 'インフラストラクチャ層' }
          ],
          connections: [
            { from: LayerId.Presentation, to: LayerId.Application },
            { from: LayerId.Application, to: LayerId.Domain },
            { from: LayerId.Application, to: LayerId.Infrastructure },
            { from: LayerId.Infrastructure, to: LayerId.Domain }
          ]
        }
      }

      const result = await useCase.execute(input)

      expect(result.isSuccess()).toBe(true)
      expect(result.value).toBeDefined()
      expect(result.value?.score).toBeGreaterThanOrEqual(0)
      expect(result.value?.violations).toBeInstanceOf(Array)
      expect(mockRepository.save).toHaveBeenCalledWith(session)
    })

    it('ヒントを使用した状態で解答を提出できる', async () => {
      const sessionId = 'session-123'
      const playerId = 'player-123'
      const challenge = Challenge.create({
        id: 'challenge-1',
        title: 'チャレンジ1',
        description: '基本的なレイヤードアーキテクチャ',
        difficulty: 'beginner',
        timeLimit: 600,
        goals: [],
        hints: []
      })
      const session = GameSession.start(
        UserId.create(playerId),
        challenge
      )

      session.useHint(0)

      mockRepository.findById = vi.fn().mockResolvedValue(session)
      mockRepository.save = vi.fn().mockResolvedValue(undefined)

      const input: SubmitSolutionInputDTO = {
        sessionId,
        playerId,
        solution: {
          layers: [
            { id: LayerId.Presentation, name: 'プレゼンテーション層' },
            { id: LayerId.Application, name: 'アプリケーション層' },
            { id: LayerId.Domain, name: 'ドメイン層' },
            { id: LayerId.Infrastructure, name: 'インフラストラクチャ層' }
          ],
          connections: [
            { from: LayerId.Presentation, to: LayerId.Application },
            { from: LayerId.Application, to: LayerId.Domain },
            { from: LayerId.Application, to: LayerId.Infrastructure },
            { from: LayerId.Infrastructure, to: LayerId.Domain }
          ]
        },
        withHintPenalty: true
      }

      const result = await useCase.execute(input)

      expect(result.isSuccess()).toBe(true)
      expect(result.value).toBeDefined()
      expect(mockRepository.save).toHaveBeenCalled()
    })
  })

  describe('異常系', () => {
    it('セッションが存在しない場合はエラーを返す', async () => {
      mockRepository.findById = vi.fn().mockResolvedValue(null)

      const input: SubmitSolutionInputDTO = {
        sessionId: 'non-existent',
        playerId: 'player-123',
        solution: {
          layers: [],
          connections: []
        }
      }

      const result = await useCase.execute(input)

      expect(result.isFailure()).toBe(true)
      expect(result.error).toBe('セッションが見つかりません')
    })

    it('プレイヤーIDが一致しない場合はエラーを返す', async () => {
      const challenge = Challenge.create({
        id: 'challenge-1',
        title: 'チャレンジ1',
        description: '基本的なレイヤードアーキテクチャ',
        difficulty: 'beginner',
        timeLimit: 600,
        goals: [],
        hints: ['ヒント1']
      })
      const session = GameSession.start(
        UserId.create('player-123'),
        challenge
      )

      mockRepository.findById = vi.fn().mockResolvedValue(session)

      const input: SubmitSolutionInputDTO = {
        sessionId: 'session-123',
        playerId: 'different-player',
        solution: {
          layers: [],
          connections: []
        }
      }

      const result = await useCase.execute(input)

      expect(result.isFailure()).toBe(true)
      expect(result.error).toBe('権限がありません')
    })

    it('無効な解答構造の場合はエラーを返す', async () => {
      const sessionId = 'session-123'
      const playerId = 'player-123'
      const challenge = Challenge.create({
        id: 'challenge-1',
        title: 'チャレンジ1',
        description: '基本的なレイヤードアーキテクチャ',
        difficulty: 'beginner',
        timeLimit: 600,
        goals: [],
        hints: []
      })
      const session = GameSession.start(
        UserId.create(playerId),
        challenge
      )

      mockRepository.findById = vi.fn().mockResolvedValue(session)

      const input: SubmitSolutionInputDTO = {
        sessionId,
        playerId,
        solution: {
          layers: [
            { id: LayerId.Presentation, name: 'プレゼンテーション層' }
          ],
          connections: [
            { from: LayerId.Presentation, to: 'invalid-layer' as LayerId }
          ]
        }
      }

      const result = await useCase.execute(input)

      expect(result.isFailure()).toBe(true)
      expect(result.error).toBe('無効な接続です')
    })

    it('セッションの保存に失敗した場合はリトライ後エラーを返す', async () => {
      const sessionId = 'session-123'
      const playerId = 'player-123'
      const challenge = Challenge.create({
        id: 'challenge-1',
        title: 'チャレンジ1',
        description: '基本的なレイヤードアーキテクチャ',
        difficulty: 'beginner',
        timeLimit: 600,
        goals: [],
        hints: []
      })
      const session = GameSession.start(
        UserId.create(playerId),
        challenge
      )

      mockRepository.findById = vi.fn().mockResolvedValue(session)
      mockRepository.save = vi.fn().mockRejectedValue(new Error('DB Error'))

      const input: SubmitSolutionInputDTO = {
        sessionId,
        playerId,
        solution: {
          layers: [
            { id: LayerId.Presentation, name: 'プレゼンテーション層' },
            { id: LayerId.Application, name: 'アプリケーション層' },
            { id: LayerId.Domain, name: 'ドメイン層' },
            { id: LayerId.Infrastructure, name: 'インフラストラクチャ層' }
          ],
          connections: []
        }
      }

      const result = await useCase.execute(input)

      expect(result.isFailure()).toBe(true)
      expect(result.error).toContain('セッションの保存に失敗しました')
      expect(mockRepository.save).toHaveBeenCalledTimes(3)
    })
  })

  describe('バリデーション', () => {
    it('セッションIDが空の場合はエラーを返す', async () => {
      const input: SubmitSolutionInputDTO = {
        sessionId: '',
        playerId: 'player-123',
        solution: {
          layers: [],
          connections: []
        }
      }

      const result = await useCase.execute(input)

      expect(result.isFailure()).toBe(true)
      expect(result.error).toContain('必要です')
    })

    it('プレイヤーIDが空の場合はエラーを返す', async () => {
      const input: SubmitSolutionInputDTO = {
        sessionId: 'session-123',
        playerId: '',
        solution: {
          layers: [],
          connections: []
        }
      }

      const result = await useCase.execute(input)

      expect(result.isFailure()).toBe(true)
      expect(result.error).toContain('必要です')
    })

    it('解答が未定義の場合はエラーを返す', async () => {
      const input = {
        sessionId: 'session-123',
        playerId: 'player-123',
        solution: undefined
      } as unknown as SubmitSolutionInputDTO

      const result = await useCase.execute(input)

      expect(result.isFailure()).toBe(true)
      expect(result.error).toContain('必要です')
    })
  })
})