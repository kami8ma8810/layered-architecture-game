import { GameSession, UserId } from '@architecture-quest/shared-domain'
import { GameSessionRepository } from '../repositories/game-session.repository'
import { ChallengeRepository } from '../repositories/challenge.repository'
import { StartGameSessionDto } from '../dto/start-game-session.dto'
import { GameSessionDto } from '../dto/game-session.dto'
import { ApplicationError } from '../errors/application.error'
import { Result } from '../common/result'

export class StartGameSessionUseCase {
  private readonly MAX_RETRY_COUNT = 3

  constructor(
    private readonly gameSessionRepository: GameSessionRepository,
    private readonly challengeRepository: ChallengeRepository
  ) {}

  async execute(dto: StartGameSessionDto): Promise<Result<GameSessionDto>> {
    // 入力検証
    if (!dto.userId || dto.userId.trim().length === 0) {
      return Result.fail(
        new ApplicationError(
          'ユーザーIDが必要です',
          'INVALID_USER_ID',
          400
        )
      )
    }

    if (!dto.challengeId || dto.challengeId.trim().length === 0) {
      return Result.fail(
        new ApplicationError(
          'チャレンジIDが必要です',
          'INVALID_CHALLENGE_ID',
          400
        )
      )
    }

    try {
      // アクティブなセッションの確認
      const activeSession = await this.gameSessionRepository.findActiveByUserId(dto.userId)
      if (activeSession) {
        return Result.fail(
          new ApplicationError(
            '既にアクティブなセッションが存在します',
            'ACTIVE_SESSION_EXISTS',
            409
          )
        )
      }

      // チャレンジの取得
      const challenge = await this.challengeRepository.findById(dto.challengeId)
      if (!challenge) {
        return Result.fail(
          new ApplicationError(
            'チャレンジが見つかりません',
            'CHALLENGE_NOT_FOUND',
            404
          )
        )
      }

      // ゲームセッションの作成
      const userId = UserId.create(dto.userId)
      const session = GameSession.start(userId, challenge)

      // リトライ付き保存
      await this.saveWithRetry(session)

      // DTOに変換して返却
      const sessionDto = GameSessionDto.fromDomain(session)
      return Result.ok(sessionDto)

    } catch (error) {
      console.error('Failed to start game session:', error)
      
      if (error instanceof ApplicationError) {
        return Result.fail(error)
      }

      return Result.fail(
        new ApplicationError(
          'セッションの開始に失敗しました',
          'SESSION_START_FAILED',
          500
        )
      )
    }
  }

  private async saveWithRetry(session: GameSession): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= this.MAX_RETRY_COUNT; attempt++) {
      try {
        await this.gameSessionRepository.save(session)
        return // 成功したら終了
      } catch (error) {
        console.warn(`Save attempt ${attempt} failed:`, error)
        lastError = error as Error
        
        if (attempt < this.MAX_RETRY_COUNT) {
          // 次のリトライまで少し待つ（指数バックオフ）
          await this.sleep(Math.pow(2, attempt) * 100)
        }
      }
    }

    // 全てのリトライが失敗
    throw new ApplicationError(
      `セッションの保存に失敗しました: ${lastError?.message}`,
      'SESSION_SAVE_FAILED',
      500
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}