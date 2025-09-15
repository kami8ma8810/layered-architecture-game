import { Result } from '@architecture-quest/shared-domain'

export interface UseCase<Input, Output> {
  execute(input: Input): Promise<Result<Output>>
}