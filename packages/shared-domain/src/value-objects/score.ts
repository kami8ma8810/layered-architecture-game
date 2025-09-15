export interface Metrics {
  accuracy: number
  efficiency: number
  maintainability: number
  speed: number
}

export interface Bonus {
  type: 'NO_HINTS' | 'NO_ANTIPATTERNS'
  multiplier: number
}

export class Score {
  private static readonly WEIGHTS = {
    accuracy: 0.35,
    efficiency: 0.25,
    maintainability: 0.25,
    speed: 0.15
  } as const

  constructor(public readonly value: number) {
    if (value < 0 || value > 100) {
      throw new Error('スコアは0以上100以下である必要があります')
    }
  }

  static calculate(metrics: Metrics): Score {
    // バリデーション
    Object.values(metrics).forEach(value => {
      if (value < 0 || value > 100) {
        throw new Error('メトリクスの値は0以上100以下である必要があります')
      }
    })

    // 重み付け計算
    const weightedSum = 
      metrics.accuracy * this.WEIGHTS.accuracy +
      metrics.efficiency * this.WEIGHTS.efficiency +
      metrics.maintainability * this.WEIGHTS.maintainability +
      metrics.speed * this.WEIGHTS.speed

    return new Score(Math.round(weightedSum))
  }

  addBonus(bonus: Bonus): Score {
    const newValue = this.value * bonus.multiplier
    return new Score(Math.round(newValue))
  }

  equals(other: Score): boolean {
    return this.value === other.value
  }
}