import { LayerId, Violation } from '@architecture-quest/shared-domain'

export interface SubmitSolutionInputDTO {
  sessionId: string
  playerId: string
  solution: {
    layers: Array<{
      id: LayerId
      name: string
    }>
    connections: Array<{
      from: LayerId
      to: LayerId
    }>
  }
  withHintPenalty?: boolean
}

export interface SubmitSolutionOutputDTO {
  sessionId: string
  score: number
  violations: Violation[]
  isCompleted: boolean
  message: string
}