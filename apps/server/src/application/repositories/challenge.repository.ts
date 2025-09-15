import { Challenge, Difficulty } from '@architecture-quest/shared-domain'

export interface ChallengeRepository {
  findById(id: string): Promise<Challenge | null>
  findAll(): Promise<Challenge[]>
  findByDifficulty(difficulty: Difficulty): Promise<Challenge[]>
}