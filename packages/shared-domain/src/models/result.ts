export class Result<T> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _error: string | null,
    private readonly _value?: T
  ) {}

  static ok<T>(value?: T): Result<T> {
    return new Result<T>(true, null, value)
  }

  static fail<T>(error: string): Result<T> {
    return new Result<T>(false, error)
  }

  isSuccess(): boolean {
    return this._isSuccess
  }

  isFailure(): boolean {
    return !this._isSuccess
  }

  get value(): T {
    if (!this._isSuccess) {
      throw new Error('Cannot get value from failed result')
    }
    return this._value as T
  }

  get error(): string {
    if (this._isSuccess) {
      throw new Error('Cannot get error from successful result')
    }
    return this._error as string
  }
}