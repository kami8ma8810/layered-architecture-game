export class Connection {
  constructor(
    public readonly from: string,
    public readonly to: string
  ) {}

  equals(other: Connection): boolean {
    return this.from === other.from && this.to === other.to
  }
}