export class UserId {
  private constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('UserIdは空にできません')
    }
  }

  static create(value: string): UserId {
    return new UserId(value)
  }

  static generate(): UserId {
    return new UserId(`user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  }

  getValue(): string {
    return this.value
  }

  equals(other: UserId): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}