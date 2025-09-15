import { describe, it, expect } from 'vitest'
import { Score } from '../value-objects/score'

describe('Score', () => {
  describe('calculate', () => {
    it('正確性35%、効率性25%、保守性25%、速度15%の重み付けで計算される', () => {
      const score = Score.calculate({
        accuracy: 100,
        efficiency: 80,
        maintainability: 90,
        speed: 70
      })
      
      // 100*0.35 + 80*0.25 + 90*0.25 + 70*0.15 = 35 + 20 + 22.5 + 10.5 = 88
      expect(score.value).toBe(88)
    })

    it('全て0点の場合は0点になる', () => {
      const score = Score.calculate({
        accuracy: 0,
        efficiency: 0,
        maintainability: 0,
        speed: 0
      })
      
      expect(score.value).toBe(0)
    })

    it('全て100点の場合は100点になる', () => {
      const score = Score.calculate({
        accuracy: 100,
        efficiency: 100,
        maintainability: 100,
        speed: 100
      })
      
      expect(score.value).toBe(100)
    })

    it('小数点は四捨五入される', () => {
      const score = Score.calculate({
        accuracy: 85, // 85 * 0.35 = 29.75
        efficiency: 75, // 75 * 0.25 = 18.75
        maintainability: 82, // 82 * 0.25 = 20.5
        speed: 90 // 90 * 0.15 = 13.5
      })
      
      // 29.75 + 18.75 + 20.5 + 13.5 = 82.5 → 83
      expect(score.value).toBe(83)
    })
  })

  describe('addBonus', () => {
    it('ボーナスを適用できる', () => {
      const score = Score.calculate({
        accuracy: 80,
        efficiency: 80,
        maintainability: 80,
        speed: 80
      })
      
      // 80点にボーナス5%追加
      const bonusScore = score.addBonus({ type: 'NO_HINTS', multiplier: 1.05 })
      
      expect(bonusScore.value).toBe(84) // 80 * 1.05 = 84
    })

    it('複数のボーナスを連続して適用できる', () => {
      const score = Score.calculate({
        accuracy: 80,
        efficiency: 80,
        maintainability: 80,
        speed: 80
      })
      
      const bonusScore = score
        .addBonus({ type: 'NO_HINTS', multiplier: 1.05 })
        .addBonus({ type: 'NO_ANTIPATTERNS', multiplier: 1.05 })
      
      expect(bonusScore.value).toBe(88) // 80 * 1.05 * 1.05 = 88.2 → 88
    })
  })

  describe('バリデーション', () => {
    it('負の値は受け付けない', () => {
      expect(() => Score.calculate({
        accuracy: -10,
        efficiency: 80,
        maintainability: 80,
        speed: 80
      })).toThrow('メトリクスの値は0以上100以下である必要があります')
    })

    it('100を超える値は受け付けない', () => {
      expect(() => Score.calculate({
        accuracy: 110,
        efficiency: 80,
        maintainability: 80,
        speed: 80
      })).toThrow('メトリクスの値は0以上100以下である必要があります')
    })
  })

  describe('等価性', () => {
    it('同じ値のScoreは等しい', () => {
      const score1 = Score.calculate({
        accuracy: 80,
        efficiency: 80,
        maintainability: 80,
        speed: 80
      })
      
      const score2 = Score.calculate({
        accuracy: 80,
        efficiency: 80,
        maintainability: 80,
        speed: 80
      })
      
      expect(score1.equals(score2)).toBe(true)
    })

    it('異なる値のScoreは等しくない', () => {
      const score1 = Score.calculate({
        accuracy: 80,
        efficiency: 80,
        maintainability: 80,
        speed: 80
      })
      
      const score2 = Score.calculate({
        accuracy: 90,
        efficiency: 80,
        maintainability: 80,
        speed: 80
      })
      
      expect(score1.equals(score2)).toBe(false)
    })
  })
})