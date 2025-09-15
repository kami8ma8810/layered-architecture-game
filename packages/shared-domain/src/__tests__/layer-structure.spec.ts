import { describe, it, expect, beforeEach } from 'vitest'
import { LayerStructure } from '../models/layer-structure'
import { CodeBlock, BlockType } from '../models/code-block'
import { LayerId } from '../value-objects/layer-id'

describe('LayerStructure', () => {
  let structure: LayerStructure

  beforeEach(() => {
    structure = LayerStructure.create()
  })

  describe('ブロック配置のルール', () => {
    it('UIコンポーネントはプレゼンテーション層にのみ配置可能', () => {
      const uiBlock = new CodeBlock('UserForm', BlockType.UIComponent)
      
      // プレゼンテーション層には配置可能
      const presentationResult = structure.addBlock(
        LayerId.Presentation, 
        uiBlock
      )
      expect(presentationResult.isSuccess()).toBe(true)
      
      // 新しいstructureでテスト
      const structure2 = LayerStructure.create()
      // ドメイン層には配置不可
      const domainResult = structure2.addBlock(
        LayerId.Domain,
        uiBlock
      )
      expect(domainResult.isFailure()).toBe(true)
      expect(domainResult.error).toContain('UIコンポーネントはプレゼンテーション層にのみ配置できます')
    })
    
    it('エンティティはドメイン層にのみ配置可能', () => {
      const entity = new CodeBlock('User', BlockType.Entity)
      
      const result = structure.addBlock(LayerId.Domain, entity)
      
      expect(result.isSuccess()).toBe(true)
      expect(structure.getLayer(LayerId.Domain).hasBlock(entity.id)).toBe(true)
    })

    it('DTOはアプリケーション層に配置可能', () => {
      const dto = new CodeBlock('UserDto', BlockType.DTO)
      
      const result = structure.addBlock(LayerId.Application, dto)
      
      expect(result.isSuccess()).toBe(true)
      expect(structure.getLayer(LayerId.Application).hasBlock(dto.id)).toBe(true)
    })

    it('リポジトリ実装はインフラストラクチャ層に配置可能', () => {
      const repository = new CodeBlock('UserRepositoryImpl', BlockType.RepositoryImpl)
      
      const result = structure.addBlock(LayerId.Infrastructure, repository)
      
      expect(result.isSuccess()).toBe(true)
      expect(structure.getLayer(LayerId.Infrastructure).hasBlock(repository.id)).toBe(true)
    })
  })
  
  describe('依存関係のルール', () => {
    it('プレゼンテーション層はアプリケーション層に依存できる', () => {
      const uiBlock = new CodeBlock('UserView', BlockType.UIComponent)
      const serviceBlock = new CodeBlock('UserService', BlockType.Service)
      
      structure.addBlock(LayerId.Presentation, uiBlock)
      structure.addBlock(LayerId.Application, serviceBlock)
      
      const result = structure.createConnection(uiBlock.id, serviceBlock.id)
      
      expect(result.isSuccess()).toBe(true)
    })

    it('アプリケーション層はドメイン層に依存できる', () => {
      const serviceBlock = new CodeBlock('UserService', BlockType.Service)
      const entityBlock = new CodeBlock('User', BlockType.Entity)
      
      structure.addBlock(LayerId.Application, serviceBlock)
      structure.addBlock(LayerId.Domain, entityBlock)
      
      const result = structure.createConnection(serviceBlock.id, entityBlock.id)
      
      expect(result.isSuccess()).toBe(true)
    })

    it('インフラストラクチャ層はドメイン層に依存できる', () => {
      const repoBlock = new CodeBlock('UserRepositoryImpl', BlockType.RepositoryImpl)
      const entityBlock = new CodeBlock('User', BlockType.Entity)
      
      structure.addBlock(LayerId.Infrastructure, repoBlock)
      structure.addBlock(LayerId.Domain, entityBlock)
      
      const result = structure.createConnection(repoBlock.id, entityBlock.id)
      
      expect(result.isSuccess()).toBe(true)
    })

    it('ドメイン層は他の層に依存できない', () => {
      const domainBlock = new CodeBlock('UserEntity', BlockType.Entity)
      const appBlock = new CodeBlock('UserService', BlockType.Service)
      
      structure.addBlock(LayerId.Domain, domainBlock)
      structure.addBlock(LayerId.Application, appBlock)
      
      const result = structure.createConnection(domainBlock.id, appBlock.id)
      
      expect(result.isFailure()).toBe(true)
      expect(result.error).toBe('ドメイン層は他の層に依存できません')
    })

    it('プレゼンテーション層はインフラストラクチャ層に直接依存できない', () => {
      const uiBlock = new CodeBlock('UserView', BlockType.UIComponent)
      const repoBlock = new CodeBlock('UserRepositoryImpl', BlockType.RepositoryImpl)
      
      structure.addBlock(LayerId.Presentation, uiBlock)
      structure.addBlock(LayerId.Infrastructure, repoBlock)
      
      const result = structure.createConnection(uiBlock.id, repoBlock.id)
      
      expect(result.isFailure()).toBe(true)
      expect(result.error).toBe('プレゼンテーション層はインフラストラクチャ層に直接依存できません')
    })
  })

  describe('バリデーション', () => {
    it('有効な構造はバリデーションを通過する', () => {
      const uiBlock = new CodeBlock('UserView', BlockType.UIComponent)
      const serviceBlock = new CodeBlock('UserService', BlockType.Service)
      const entityBlock = new CodeBlock('User', BlockType.Entity)
      
      structure.addBlock(LayerId.Presentation, uiBlock)
      structure.addBlock(LayerId.Application, serviceBlock)
      structure.addBlock(LayerId.Domain, entityBlock)
      
      structure.createConnection(uiBlock.id, serviceBlock.id)
      structure.createConnection(serviceBlock.id, entityBlock.id)
      
      const result = structure.validate()
      
      expect(result.isValid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('循環依存がある場合はバリデーションエラーになる', () => {
      const block1 = new CodeBlock('Service1', BlockType.Service)
      const block2 = new CodeBlock('Service2', BlockType.Service)
      
      structure.addBlock(LayerId.Application, block1)
      structure.addBlock(LayerId.Application, block2)
      
      structure.createConnection(block1.id, block2.id)
      structure.createConnection(block2.id, block1.id)
      
      const result = structure.validate()
      
      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'CYCLIC_DEPENDENCY',
          message: expect.stringContaining('循環依存')
        })
      )
    })
  })
})