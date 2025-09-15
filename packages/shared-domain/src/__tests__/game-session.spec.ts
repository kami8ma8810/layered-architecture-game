import { describe, it, expect, beforeEach } from 'vitest'
import { GameSession, GameState } from '../models/game-session'
import { Challenge } from '../models/challenge'
import { UserId } from '../value-objects/user-id'
import { LayerStructure } from '../models/layer-structure'
import { CodeBlock, BlockType } from '../models/code-block'
import { LayerId } from '../value-objects/layer-id'

describe('GameSession', () => {
  let challenge: Challenge
  let userId: UserId

  beforeEach(() => {
    challenge = Challenge.create({
      id: 'ch-001',
      title: 'DTOの純粋性を保つ',
      description: 'DTOにUI関心を含めないように修正してください',
      difficulty: 'beginner',
      timeLimit: 180,
      initialStructure: LayerStructure.create(),
      goals: ['DTOからUI関心を除去', '依存方向の遵守'],
      hints: ['DTOは純粋なデータ転送用', 'UIイベントハンドラは含めない']
    })
    
    userId = UserId.create('user-123')
  })

  describe('セッション作成', () => {
    it('新しいゲームセッションを開始できる', () => {
      const session = GameSession.start(userId, challenge)

      expect(session.getUserId()).toEqual(userId)
      expect(session.getChallenge()).toEqual(challenge)
      expect(session.getState()).toBe(GameState.InProgress)
      expect(session.getStartedAt()).toBeInstanceOf(Date)
      expect(session.getCompletedAt()).toBeUndefined()
    })

    it('開始時のスコアは0である', () => {
      const session = GameSession.start(userId, challenge)

      expect(session.getScore()).toBe(0)
    })

    it('開始時は解答が未提出である', () => {
      const session = GameSession.start(userId, challenge)

      expect(session.getSolution()).toBeUndefined()
      expect(session.isCompleted()).toBe(false)
    })
  })

  describe('解答提出', () => {
    let session: GameSession
    let solution: LayerStructure

    beforeEach(() => {
      session = GameSession.start(userId, challenge)
      solution = LayerStructure.create()
      
      // 正しい解答を構築
      const dto = new CodeBlock('UserDto', BlockType.DTO)
      dto.properties = [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' }
      ]
      solution.addBlock(LayerId.Application, dto)
    })

    it('正しい解答を提出すると成功する', () => {
      const result = session.submitSolution(solution)

      expect(result.isSuccess()).toBe(true)
      expect(session.getState()).toBe(GameState.Completed)
      expect(session.getSolution()).toEqual(solution)
      expect(session.getCompletedAt()).toBeInstanceOf(Date)
    })

    it('解答提出後にスコアが計算される', () => {
      session.submitSolution(solution)

      expect(session.getScore()).toBeGreaterThan(0)
      expect(session.getValidationResult()).toBeDefined()
      expect(session.getValidationResult()?.isValid).toBe(true)
    })

    it('不正な解答を提出するとスコアが低くなる', () => {
      // UI関心を含むDTO
      const badDto = new CodeBlock('UserDto', BlockType.DTO)
      badDto.properties = [
        { name: 'id', type: 'string' },
        { name: 'onClick', type: '() => void' } // 違反
      ]
      
      const badSolution = LayerStructure.create()
      badSolution.addBlock(LayerId.Application, badDto)

      session.submitSolution(badSolution)

      expect(session.getScore()).toBeLessThan(100)
      expect(session.getValidationResult()?.isValid).toBe(false)
      expect(session.getValidationResult()?.violations).not.toHaveLength(0)
    })

    it('既に完了したセッションには解答を提出できない', () => {
      session.submitSolution(solution)
      
      const secondSolution = LayerStructure.create()
      const result = session.submitSolution(secondSolution)

      expect(result.isFailure()).toBe(true)
      expect(result.error).toContain('既に完了')
    })
  })

  describe('タイムボーナス', () => {
    it('時間内に解答するとボーナスが付く', () => {
      const session = GameSession.start(userId, challenge)
      const solution = LayerStructure.create()
      
      // 即座に提出（時間ボーナス最大）
      session.submitSolution(solution, { timeSpent: 10 })
      
      const scoreWithBonus = session.getScore()
      
      // 時間ギリギリで提出
      const session2 = GameSession.start(userId, challenge)
      session2.submitSolution(solution, { timeSpent: 179 })
      const scoreWithoutBonus = session2.getScore()

      expect(scoreWithBonus).toBeGreaterThan(scoreWithoutBonus)
    })

    it('制限時間を超えるとペナルティがある', () => {
      const session = GameSession.start(userId, challenge)
      const solution = LayerStructure.create()
      
      session.submitSolution(solution, { timeSpent: 200 }) // 制限時間180秒を超過
      
      expect(session.getScore()).toBeLessThan(100)
    })
  })

  describe('ヒント使用', () => {
    it('ヒントを使用できる', () => {
      const session = GameSession.start(userId, challenge)

      const hint = session.useHint(0)

      expect(hint).toBe('DTOは純粋なデータ転送用')
      expect(session.getUsedHints()).toEqual([0])
    })

    it('同じヒントは一度しか使用できない', () => {
      const session = GameSession.start(userId, challenge)

      session.useHint(0)
      const secondAttempt = session.useHint(0)

      expect(secondAttempt).toBeNull()
      expect(session.getUsedHints()).toEqual([0])
    })

    it('ヒントを使用するとスコアにペナルティがある', () => {
      const session1 = GameSession.start(userId, challenge)
      const session2 = GameSession.start(userId, challenge)
      const solution = LayerStructure.create()

      // ヒントなしで提出
      session1.submitSolution(solution)
      const scoreWithoutHint = session1.getScore()

      // ヒントありで提出
      session2.useHint(0)
      session2.submitSolution(solution)
      const scoreWithHint = session2.getScore()

      expect(scoreWithHint).toBeLessThan(scoreWithoutHint)
    })

    it('存在しないヒントインデックスはnullを返す', () => {
      const session = GameSession.start(userId, challenge)

      const hint = session.useHint(99)

      expect(hint).toBeNull()
      expect(session.getUsedHints()).toEqual([])
    })
  })

  describe('セッション中断と再開', () => {
    it('セッションを一時停止できる', () => {
      const session = GameSession.start(userId, challenge)

      session.pause()

      expect(session.getState()).toBe(GameState.Paused)
    })

    it('一時停止したセッションを再開できる', () => {
      const session = GameSession.start(userId, challenge)
      
      session.pause()
      session.resume()

      expect(session.getState()).toBe(GameState.InProgress)
    })

    it('完了したセッションは一時停止できない', () => {
      const session = GameSession.start(userId, challenge)
      const solution = LayerStructure.create()
      
      session.submitSolution(solution)
      const result = session.pause()

      expect(result.isFailure()).toBe(true)
      expect(result.error).toContain('完了したセッション')
    })
  })

  describe('統計情報', () => {
    it('試行回数を記録する', () => {
      const session = GameSession.start(userId, challenge)
      const structure = LayerStructure.create()

      // UI操作を記録
      session.recordAction('block_added')
      session.recordAction('connection_created')
      session.recordAction('block_removed')

      expect(session.getStatistics().totalActions).toBe(3)
      expect(session.getStatistics().actionTypes).toContain('block_added')
    })

    it('バリデーション実行回数を記録する', () => {
      const session = GameSession.start(userId, challenge)
      
      session.validateCurrentStructure(LayerStructure.create())
      session.validateCurrentStructure(LayerStructure.create())

      expect(session.getStatistics().validationCount).toBe(2)
    })
  })
})