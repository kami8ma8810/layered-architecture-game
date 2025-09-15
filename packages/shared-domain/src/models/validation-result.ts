export interface Violation {
  type: string
  message: string
  details?: unknown
}

export class ValidationResult {
  constructor(
    public readonly isValid: boolean,
    public readonly violations: Violation[] = [],
    public readonly score?: number
  ) {}

  static valid(score?: number): ValidationResult {
    return new ValidationResult(true, [], score)
  }

  static invalid(violations: Violation[]): ValidationResult {
    return new ValidationResult(false, violations)
  }

  addViolation(violation: Violation): ValidationResult {
    return new ValidationResult(
      false,
      [...this.violations, violation],
      this.score
    )
  }
}