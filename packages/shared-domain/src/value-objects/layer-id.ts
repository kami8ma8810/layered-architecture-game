export enum LayerId {
  Presentation = 'presentation',
  Application = 'application',
  Domain = 'domain',
  Infrastructure = 'infrastructure'
}

export class Layer {
  private blocks: Set<string> = new Set()

  constructor(public readonly id: LayerId, public readonly name: string) {}

  addBlock(blockId: string): void {
    this.blocks.add(blockId)
  }

  removeBlock(blockId: string): void {
    this.blocks.delete(blockId)
  }

  hasBlock(blockId: string): boolean {
    return this.blocks.has(blockId)
  }

  getBlocks(): string[] {
    return Array.from(this.blocks)
  }
}