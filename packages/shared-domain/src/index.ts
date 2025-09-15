// Models
export { LayerStructure } from './models/layer-structure'
export { CodeBlock, BlockType, type BlockProperty, type BlockMethod } from './models/code-block'
export { Connection } from './models/connection'
export { Result } from './models/result'
export { ValidationResult, type Violation } from './models/validation-result'
export { Challenge, type ChallengeData, type Difficulty } from './models/challenge'
export { GameSession, GameState, type SessionStatistics, type SubmitOptions } from './models/game-session'
export { ValidationRule, type RuleConfig, DEFAULT_RULE_CONFIGS } from './models/validation-rule'

// Value Objects
export { Score, type Metrics, type Bonus } from './value-objects/score'
export { LayerId, Layer } from './value-objects/layer-id'
export { UserId } from './value-objects/user-id'

// Services
export { ArchitectureValidator } from './services/architecture-validator'