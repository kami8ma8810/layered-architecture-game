import { Result, LayerStructure, GameSession, CodeBlock, BlockType } from '@architecture-quest/shared-domain'
import { UseCase } from '../interfaces/usecase.interface'
import { GameSessionRepository } from '../repositories/game-session.repository'
import { ApplicationError } from '../errors/application.error'
import { SubmitSolutionInputDTO, SubmitSolutionOutputDTO } from '../dtos/submit-solution.dto'

export class SubmitSolutionUseCase implements UseCase<SubmitSolutionInputDTO, SubmitSolutionOutputDTO> {
  private readonly MAX_RETRY_COUNT = 3

  constructor(
    private readonly gameSessionRepository: GameSessionRepository
  ) {}

  async execute(input: SubmitSolutionInputDTO): Promise<Result<SubmitSolutionOutputDTO>> {
    try {
      const validation = this.validateInput(input)
      if (validation.isFailure()) {
        return Result.fail<SubmitSolutionOutputDTO>(
          validation.error
        )
      }

      const session = await this.gameSessionRepository.findById(input.sessionId)
      if (!session) {
        return Result.fail<SubmitSolutionOutputDTO>(
          'セッションが見つかりません'
        )
      }

      if (session.getUserId().getValue() !== input.playerId) {
        return Result.fail<SubmitSolutionOutputDTO>(
          '権限がありません'
        )
      }

      const structure = LayerStructure.create()
      
      // レイヤーごとにブロックを追加
      let blockIdMap = new Map<string, string>()
      for (const layer of input.solution.layers) {
        const block = new CodeBlock(
          layer.name,
          BlockType.Service
        )
        const result = structure.addBlock(layer.id, block)
        if (result.isFailure()) {
          return Result.fail<SubmitSolutionOutputDTO>(result.error)
        }
        blockIdMap.set(layer.id, block.id)
      }
      
      // 接続を追加
      for (const connection of input.solution.connections) {
        const fromBlockId = blockIdMap.get(connection.from)
        const toBlockId = blockIdMap.get(connection.to)
        if (!fromBlockId || !toBlockId) {
          return Result.fail<SubmitSolutionOutputDTO>('無効な接続です')
        }
        const result = structure.createConnection(fromBlockId, toBlockId)
        if (result.isFailure()) {
          return Result.fail<SubmitSolutionOutputDTO>(result.error)
        }
      }

      const submitResult = session.submitSolution(structure)

      if (submitResult.isFailure()) {
        return Result.fail<SubmitSolutionOutputDTO>(
          submitResult.error
        )
      }

      await this.saveWithRetry(session)

      const score = session.getScore() ?? 0
      const violations = session.getValidationResult()?.violations ?? []
      const isCompleted = session.isCompleted()

      return Result.ok<SubmitSolutionOutputDTO>({
        sessionId: session.getId(),
        score,
        violations,
        isCompleted,
        message: this.getCompletionMessage(score, isCompleted)
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : '予期しないエラーが発生しました'
      console.error('UseCase error:', error)
      if (error instanceof ApplicationError) {
        throw error
      }
      return Result.fail<SubmitSolutionOutputDTO>(message)
    }
  }

  private validateInput(input: SubmitSolutionInputDTO): Result<void> {
    if (!input.sessionId || input.sessionId.trim() === '') {
      return Result.fail('セッションIDが必要です')
    }

    if (!input.playerId || input.playerId.trim() === '') {
      return Result.fail('プレイヤーIDが必要です')
    }

    if (!input.solution) {
      return Result.fail('解答が必要です')
    }

    if (!Array.isArray(input.solution.layers)) {
      return Result.fail('レイヤー情報が不正です')
    }

    if (!Array.isArray(input.solution.connections)) {
      return Result.fail('接続情報が不正です')
    }

    return Result.ok()
  }

  private async saveWithRetry(session: GameSession): Promise<void> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= this.MAX_RETRY_COUNT; attempt++) {
      try {
        await this.gameSessionRepository.save(session)
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        console.error(`Save attempt ${attempt} failed:`, lastError)
        
        if (attempt < this.MAX_RETRY_COUNT) {
          await this.sleep(Math.pow(2, attempt) * 100)
        }
      }
    }

    throw new ApplicationError(
      `セッションの保存に失敗しました: ${lastError?.message}`,
      'SESSION_SAVE_FAILED',
      500
    )
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private getCompletionMessage(score: number, isCompleted: boolean): string {
    if (!isCompleted) {
      if (score >= 90) {
        return '素晴らしい！でもまだ改善の余地があります'
      } else if (score >= 70) {
        return '良い構造ですが、いくつか問題があります'
      } else if (score >= 50) {
        return 'アーキテクチャに重要な問題があります'
      } else {
        return '基本的な構造を見直してください'
      }
    }

    if (score === 100) {
      return '完璧！レイヤードアーキテクチャを完全に理解しています！'
    } else if (score >= 90) {
      return '素晴らしい！レイヤードアーキテクチャをよく理解しています'
    } else {
      return 'クリア！次のチャレンジに挑戦しましょう'
    }
  }
}