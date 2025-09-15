import { LayerStructure } from './layer-structure'

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export interface ChallengeData {
  id: string
  title: string
  description: string
  difficulty: Difficulty
  timeLimit: number // 秒
  initialStructure: LayerStructure
  goals: string[]
  hints: string[]
}

export class Challenge {
  private constructor(
    private readonly id: string,
    private readonly title: string,
    private readonly description: string,
    private readonly difficulty: Difficulty,
    private readonly timeLimit: number,
    private readonly initialStructure: LayerStructure,
    private readonly goals: string[],
    private readonly hints: string[]
  ) {}

  static create(data: ChallengeData): Challenge {
    if (data.timeLimit <= 0) {
      throw new Error('制限時間は正の数である必要があります')
    }
    
    if (data.goals.length === 0) {
      throw new Error('少なくとも1つの目標が必要です')
    }

    return new Challenge(
      data.id,
      data.title,
      data.description,
      data.difficulty,
      data.timeLimit,
      data.initialStructure,
      data.goals,
      data.hints
    )
  }

  getId(): string {
    return this.id
  }

  getTitle(): string {
    return this.title
  }

  getDescription(): string {
    return this.description
  }

  getDifficulty(): Difficulty {
    return this.difficulty
  }

  getTimeLimit(): number {
    return this.timeLimit
  }

  getInitialStructure(): LayerStructure {
    return this.initialStructure
  }

  getGoals(): string[] {
    return [...this.goals]
  }

  getHints(): string[] {
    return [...this.hints]
  }

  getHint(index: number): string | null {
    if (index < 0 || index >= this.hints.length) {
      return null
    }
    return this.hints[index] ?? null
  }

  getDifficultyMultiplier(): number {
    switch (this.difficulty) {
      case 'beginner':
        return 1.0
      case 'intermediate':
        return 1.2
      case 'advanced':
        return 1.5
      case 'expert':
        return 2.0
    }
  }
}