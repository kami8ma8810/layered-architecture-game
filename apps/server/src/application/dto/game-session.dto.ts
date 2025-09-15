import { GameSession } from '@architecture-quest/shared-domain'

export class GameSessionDto {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly challengeId: string,
    public readonly state: string,
    public readonly startedAt: string,
    public readonly timeLimit: number,
    public readonly completedAt?: string,
    public readonly score?: number
  ) {}

  static fromDomain(session: GameSession): GameSessionDto {
    return new GameSessionDto(
      session.getId(),
      session.getUserId().getValue(),
      session.getChallenge().getId(),
      session.getState(),
      session.getStartedAt().toISOString(),
      session.getChallenge().getTimeLimit(),
      session.getCompletedAt()?.toISOString(),
      session.getScore()
    )
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      challengeId: this.challengeId,
      state: this.state,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      score: this.score,
      timeLimit: this.timeLimit
    }
  }
}