import { UserId } from '../value-objects/user-id'
import { Challenge } from './challenge'
import { LayerStructure } from './layer-structure'
import { ValidationResult } from './validation-result'
import { Result } from './result'
import { ArchitectureValidator } from '../services/architecture-validator'
import { ValidationRule } from './validation-rule'

export enum GameState {
  InProgress = 'in_progress',
  Paused = 'paused',
  Completed = 'completed',
  Abandoned = 'abandoned'
}

export interface SessionStatistics {
  totalActions: number
  actionTypes: string[]
  validationCount: number
  timeSpent?: number
}

export interface SubmitOptions {
  timeSpent?: number
}

export class GameSession {
  private state: GameState
  private solution?: LayerStructure
  private score: number = 0
  private validationResult?: ValidationResult
  private completedAt?: Date
  private usedHints: number[] = []
  private statistics: SessionStatistics = {
    totalActions: 0,
    actionTypes: [],
    validationCount: 0
  }

  private constructor(
    private readonly id: string,
    private readonly userId: UserId,
    private readonly challenge: Challenge,
    private readonly startedAt: Date
  ) {
    this.state = GameState.InProgress
  }

  static start(userId: UserId, challenge: Challenge): GameSession {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    return new GameSession(id, userId, challenge, new Date())
  }

  submitSolution(solution: LayerStructure, options?: SubmitOptions): Result<void> {
    if (this.state === GameState.Completed) {
      return Result.fail('セッションは既に完了しています')
    }

    if (this.state === GameState.Abandoned) {
      return Result.fail('セッションは放棄されています')
    }

    // バリデーション実行
    const validator = new ArchitectureValidator([
      ValidationRule.NoDependencyViolation,
      ValidationRule.NoCyclicDependency,
      ValidationRule.NoPresentationToInfra,
      ValidationRule.NoUIInDTO,
      ValidationRule.NoFatService
    ])

    this.validationResult = validator.validate(solution)
    this.solution = solution
    this.state = GameState.Completed
    this.completedAt = new Date()

    // スコア計算
    this.calculateScore(options?.timeSpent)

    return Result.ok()
  }

  private calculateScore(timeSpent?: number): void {
    if (!this.validationResult) {
      this.score = 0
      return
    }

    let baseScore = this.validationResult.score || 0

    // 難易度ボーナス
    baseScore *= this.challenge.getDifficultyMultiplier()

    // 時間ボーナス/ペナルティ
    if (timeSpent !== undefined) {
      const timeLimit = this.challenge.getTimeLimit()
      if (timeSpent <= timeLimit) {
        // 時間内ボーナス（最大20%）
        const timeBonus = 1 + (0.2 * (1 - timeSpent / timeLimit))
        baseScore *= timeBonus
      } else {
        // 時間超過ペナルティ（最大30%減）
        const overTime = timeSpent - timeLimit
        const penalty = Math.max(0.7, 1 - (overTime / timeLimit) * 0.3)
        baseScore *= penalty
      }
      this.statistics.timeSpent = timeSpent
    }

    // ヒント使用ペナルティ（1ヒントにつき5%減）
    const hintPenalty = 1 - (this.usedHints.length * 0.05)
    baseScore *= Math.max(0.5, hintPenalty) // 最低50%は保証

    this.score = Math.round(baseScore)
  }

  useHint(index: number): string | null {
    if (this.state !== GameState.InProgress) {
      return null
    }

    if (this.usedHints.includes(index)) {
      return null
    }

    const hint = this.challenge.getHint(index)
    if (hint) {
      this.usedHints.push(index)
    }

    return hint
  }

  pause(): Result<void> {
    if (this.state === GameState.Completed) {
      return Result.fail('完了したセッションは一時停止できません')
    }

    if (this.state === GameState.Abandoned) {
      return Result.fail('放棄されたセッションは一時停止できません')
    }

    this.state = GameState.Paused
    return Result.ok()
  }

  resume(): Result<void> {
    if (this.state !== GameState.Paused) {
      return Result.fail('一時停止中のセッションのみ再開できます')
    }

    this.state = GameState.InProgress
    return Result.ok()
  }

  abandon(): void {
    if (this.state !== GameState.Completed) {
      this.state = GameState.Abandoned
      this.completedAt = new Date()
    }
  }

  recordAction(actionType: string): void {
    this.statistics.totalActions++
    if (!this.statistics.actionTypes.includes(actionType)) {
      this.statistics.actionTypes.push(actionType)
    }
  }

  validateCurrentStructure(structure: LayerStructure): ValidationResult {
    this.statistics.validationCount++
    
    const validator = new ArchitectureValidator([
      ValidationRule.NoDependencyViolation,
      ValidationRule.NoCyclicDependency,
      ValidationRule.NoPresentationToInfra,
      ValidationRule.NoUIInDTO,
      ValidationRule.NoFatService
    ])

    return validator.validate(structure)
  }

  // Getters
  getId(): string {
    return this.id
  }

  getUserId(): UserId {
    return this.userId
  }

  getChallenge(): Challenge {
    return this.challenge
  }

  getState(): GameState {
    return this.state
  }

  getStartedAt(): Date {
    return this.startedAt
  }

  getCompletedAt(): Date | undefined {
    return this.completedAt
  }

  getSolution(): LayerStructure | undefined {
    return this.solution
  }

  getScore(): number {
    return this.score
  }

  getValidationResult(): ValidationResult | undefined {
    return this.validationResult
  }

  getUsedHints(): number[] {
    return [...this.usedHints]
  }

  getStatistics(): SessionStatistics {
    return { ...this.statistics }
  }

  isCompleted(): boolean {
    return this.state === GameState.Completed
  }

  isPaused(): boolean {
    return this.state === GameState.Paused
  }

  isInProgress(): boolean {
    return this.state === GameState.InProgress
  }

  isAbandoned(): boolean {
    return this.state === GameState.Abandoned
  }
}