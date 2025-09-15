import { LayerId, Layer } from '../value-objects/layer-id'
import { CodeBlock, BlockType } from './code-block'
import { Connection } from './connection'
import { Result } from './result'
import { ValidationResult, Violation } from './validation-result'

export class LayerStructure {
  private layers: Map<LayerId, Layer>
  private blocks: Map<string, { block: CodeBlock; layerId: LayerId }>
  private connections: Connection[]

  private constructor() {
    this.layers = new Map([
      [LayerId.Presentation, new Layer(LayerId.Presentation, 'プレゼンテーション層')],
      [LayerId.Application, new Layer(LayerId.Application, 'アプリケーション層')],
      [LayerId.Domain, new Layer(LayerId.Domain, 'ドメイン層')],
      [LayerId.Infrastructure, new Layer(LayerId.Infrastructure, 'インフラストラクチャ層')]
    ])
    this.blocks = new Map()
    this.connections = []
  }

  static create(): LayerStructure {
    return new LayerStructure()
  }

  addBlock(layerId: LayerId, block: CodeBlock): Result<void> {
    // ブロックタイプとレイヤーの整合性チェック
    const validationResult = this.validateBlockPlacement(layerId, block)
    if (validationResult.isFailure()) {
      return validationResult
    }

    // ブロックを追加
    const layer = this.layers.get(layerId)
    if (!layer) {
      return Result.fail('指定されたレイヤーが存在しません')
    }

    layer.addBlock(block.id)
    this.blocks.set(block.id, { block, layerId })

    return Result.ok()
  }

  private validateBlockPlacement(layerId: LayerId, block: CodeBlock): Result<void> {
    // UIコンポーネントはプレゼンテーション層のみ
    if (block.isUIComponent() && layerId !== LayerId.Presentation) {
      return Result.fail('UIコンポーネントはプレゼンテーション層にのみ配置できます')
    }

    // エンティティ・値オブジェクトはドメイン層のみ
    if (block.isDomainModel() && layerId !== LayerId.Domain) {
      return Result.fail('ドメインモデルはドメイン層にのみ配置できます')
    }

    // リポジトリ実装はインフラストラクチャ層のみ
    if (block.isInfrastructure() && layerId !== LayerId.Infrastructure) {
      return Result.fail('リポジトリ実装はインフラストラクチャ層にのみ配置できます')
    }

    return Result.ok()
  }

  createConnection(fromBlockId: string, toBlockId: string): Result<Connection> {
    // ブロックの存在確認
    const fromBlock = this.blocks.get(fromBlockId)
    const toBlock = this.blocks.get(toBlockId)

    if (!fromBlock || !toBlock) {
      return Result.fail('指定されたブロックが存在しません')
    }

    // 依存関係のルールチェック
    const validationResult = this.validateDependency(fromBlock.layerId, toBlock.layerId)
    if (validationResult.isFailure()) {
      return validationResult
    }

    // 接続を作成
    const connection = new Connection(fromBlockId, toBlockId)
    this.connections.push(connection)

    return Result.ok(connection)
  }

  private validateDependency(fromLayer: LayerId, toLayer: LayerId): Result<void> {
    // ドメイン層は他の層に依存できない
    if (fromLayer === LayerId.Domain && toLayer !== LayerId.Domain) {
      return Result.fail('ドメイン層は他の層に依存できません')
    }

    // プレゼンテーション層はインフラストラクチャ層に直接依存できない
    if (fromLayer === LayerId.Presentation && toLayer === LayerId.Infrastructure) {
      return Result.fail('プレゼンテーション層はインフラストラクチャ層に直接依存できません')
    }

    // プレゼンテーション層はドメイン層に直接依存できない
    if (fromLayer === LayerId.Presentation && toLayer === LayerId.Domain) {
      return Result.fail('プレゼンテーション層はドメイン層に直接依存できません')
    }

    // アプリケーション層はプレゼンテーション層に依存できない
    if (fromLayer === LayerId.Application && toLayer === LayerId.Presentation) {
      return Result.fail('アプリケーション層はプレゼンテーション層に依存できません')
    }

    // インフラストラクチャ層はプレゼンテーション層とアプリケーション層に依存できない
    if (fromLayer === LayerId.Infrastructure && 
        (toLayer === LayerId.Presentation || toLayer === LayerId.Application)) {
      return Result.fail('インフラストラクチャ層は上位層に依存できません')
    }

    return Result.ok()
  }

  getLayer(layerId: LayerId): Layer {
    const layer = this.layers.get(layerId)
    if (!layer) {
      throw new Error(`Layer ${layerId} not found`)
    }
    return layer
  }

  validate(): ValidationResult {
    const violations: Violation[] = []

    // 循環依存のチェック
    const cyclicDependency = this.detectCyclicDependency()
    if (cyclicDependency) {
      violations.push({
        type: 'CYCLIC_DEPENDENCY',
        message: `循環依存が検出されました: ${cyclicDependency.join(' -> ')}`,
        details: { cycle: cyclicDependency }
      })
    }

    // その他のバリデーションルール...

    return violations.length === 0 
      ? ValidationResult.valid()
      : ValidationResult.invalid(violations)
  }

  private detectCyclicDependency(): string[] | null {
    const adjacencyList: Map<string, string[]> = new Map()

    // 隣接リストを構築
    for (const connection of this.connections) {
      if (!adjacencyList.has(connection.from)) {
        adjacencyList.set(connection.from, [])
      }
      adjacencyList.get(connection.from)!.push(connection.to)
    }

    // DFSで循環を検出
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const path: string[] = []

    for (const blockId of this.blocks.keys()) {
      if (!visited.has(blockId)) {
        const cycle = this.dfsDetectCycle(
          blockId,
          adjacencyList,
          visited,
          recursionStack,
          path
        )
        if (cycle) {
          return cycle
        }
      }
    }

    return null
  }

  private dfsDetectCycle(
    node: string,
    adjacencyList: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] | null {
    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const neighbors = adjacencyList.get(node) || []
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = this.dfsDetectCycle(
          neighbor,
          adjacencyList,
          visited,
          recursionStack,
          path
        )
        if (cycle) {
          return cycle
        }
      } else if (recursionStack.has(neighbor)) {
        // 循環を検出
        const cycleStartIndex = path.indexOf(neighbor)
        return [...path.slice(cycleStartIndex), neighbor]
      }
    }

    recursionStack.delete(node)
    path.pop()
    return null
  }
}