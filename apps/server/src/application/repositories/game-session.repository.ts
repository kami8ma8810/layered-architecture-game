import { GameSession } from '@architecture-quest/shared-domain'

export interface GameSessionRepository {
  save(session: GameSession): Promise<void>
  findById(id: string): Promise<GameSession | null>
  findByUserId(userId: string): Promise<GameSession[]>
  findActiveByUserId(userId: string): Promise<GameSession | null>
}