import { describe, it, expect, beforeEach } from 'vitest'
import { ArchitectureValidator } from '../services/architecture-validator'
import { LayerStructure } from '../models/layer-structure'
import { CodeBlock, BlockType } from '../models/code-block'
import { LayerId } from '../value-objects/layer-id'
import { ValidationRule } from '../models/validation-rule'

describe('ArchitectureValidator', () => {
  let validator: ArchitectureValidator
  let structure: LayerStructure

  beforeEach(() => {
    const rules: ValidationRule[] = [
      ValidationRule.NoDependencyViolation,
      ValidationRule.NoCyclicDependency,
      ValidationRule.NoPresentationToInfra,
      ValidationRule.NoUIInDTO,
      ValidationRule.NoFatService
    ]
    validator = new ArchitectureValidator(rules)
    structure = LayerStructure.create()
  })

  describe('依存方向の検証', () => {
    it('正しい依存方向は検証を通過する', () => {
      const uiBlock = new CodeBlock('UserView', BlockType.UIComponent)
      const serviceBlock = new CodeBlock('UserService', BlockType.Service)
      const entityBlock = new CodeBlock('User', BlockType.Entity)

      structure.addBlock(LayerId.Presentation, uiBlock)
      structure.addBlock(LayerId.Application, serviceBlock)
      structure.addBlock(LayerId.Domain, entityBlock)

      structure.createConnection(uiBlock.id, serviceBlock.id)
      structure.createConnection(serviceBlock.id, entityBlock.id)

      const result = validator.validate(structure)

      expect(result.isValid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('逆方向の依存は違反として検出される', () => {
      const entityBlock = new CodeBlock('User', BlockType.Entity)
      const serviceBlock = new CodeBlock('UserService', BlockType.Service)

      structure.addBlock(LayerId.Domain, entityBlock)
      structure.addBlock(LayerId.Application, serviceBlock)

      // createConnectionは既に検証するので、エラーになる
      const connectionResult = structure.createConnection(entityBlock.id, serviceBlock.id)
      
      expect(connectionResult.isFailure()).toBe(true)
      expect(connectionResult.error).toContain('ドメイン層は他の層に依存できません')
      
      // Validatorでも検証（構造自体は有効）
      const result = validator.validate(structure)
      expect(result.isValid).toBe(true) // 接続が作られていないので有効
    })
  })

  describe('循環依存の検証', () => {
    it('循環依存を検出する', () => {
      const service1 = new CodeBlock('Service1', BlockType.Service)
      const service2 = new CodeBlock('Service2', BlockType.Service)
      const service3 = new CodeBlock('Service3', BlockType.Service)

      structure.addBlock(LayerId.Application, service1)
      structure.addBlock(LayerId.Application, service2)
      structure.addBlock(LayerId.Application, service3)

      structure.createConnection(service1.id, service2.id)
      structure.createConnection(service2.id, service3.id)
      structure.createConnection(service3.id, service1.id)

      const result = validator.validate(structure)

      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'CYCLIC_DEPENDENCY',
          message: expect.stringContaining('循環依存')
        })
      )
    })

    it('自己参照も循環依存として検出する', () => {
      const service = new CodeBlock('Service', BlockType.Service)

      structure.addBlock(LayerId.Application, service)
      structure.createConnection(service.id, service.id)

      const result = validator.validate(structure)

      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'CYCLIC_DEPENDENCY'
        })
      )
    })
  })

  describe('DTOの純粋性検証', () => {
    it('DTOにUI関心が含まれていると違反になる', () => {
      const dto = new CodeBlock('UserDto', BlockType.DTO)
      dto.properties = [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'onClick', type: '() => void' } // UI関心
      ]

      structure.addBlock(LayerId.Application, dto)

      const result = validator.validate(structure)

      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'DTO_PURITY_VIOLATION',
          message: expect.stringContaining('DTOにUI関心')
        })
      )
    })

    it('純粋なDTOは検証を通過する', () => {
      const dto = new CodeBlock('UserDto', BlockType.DTO)
      dto.properties = [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' }
      ]

      structure.addBlock(LayerId.Application, dto)

      const result = validator.validate(structure)

      expect(result.isValid).toBe(true)
    })
  })

  describe('Fat Service/God Classの検出', () => {
    it('メソッド数が多すぎるサービスを検出する', () => {
      const service = new CodeBlock('UserService', BlockType.Service)
      // 21個のメソッド（閾値20を超える）
      service.methods = Array.from({ length: 21 }, (_, i) => ({
        name: `method${i}`,
        lines: 10
      }))

      structure.addBlock(LayerId.Application, service)

      const result = validator.validate(structure)

      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'FAT_SERVICE',
          message: expect.stringContaining('メソッド数が多すぎます')
        })
      )
    })

    it('行数が多すぎるサービスを検出する', () => {
      const service = new CodeBlock('UserService', BlockType.Service)
      service.methods = [
        { name: 'hugeMethod', lines: 250 } // 200行を超える
      ]

      structure.addBlock(LayerId.Application, service)

      const result = validator.validate(structure)

      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual(
        expect.objectContaining({
          type: 'FAT_SERVICE',
          message: expect.stringContaining('行数が多すぎます')
        })
      )
    })
  })

  describe('スコア計算', () => {
    it('違反がない場合は高スコアになる', () => {
      const uiBlock = new CodeBlock('UserView', BlockType.UIComponent)
      const serviceBlock = new CodeBlock('UserService', BlockType.Service)
      
      structure.addBlock(LayerId.Presentation, uiBlock)
      structure.addBlock(LayerId.Application, serviceBlock)
      structure.createConnection(uiBlock.id, serviceBlock.id)

      const result = validator.validate(structure)

      expect(result.score).toBeGreaterThanOrEqual(90)
    })

    it('違反があるとスコアが減点される', () => {
      const dto = new CodeBlock('UserDto', BlockType.DTO)
      dto.properties = [
        { name: 'id', type: 'string' },
        { name: 'onClick', type: '() => void' } // UI関心の違反
      ]

      structure.addBlock(LayerId.Application, dto)

      const result = validator.validate(structure)

      expect(result.score).toBeLessThan(90) // DTOの違反で減点
    })

    it('重大な違反（循環依存）はより大きく減点される', () => {
      const service1 = new CodeBlock('Service1', BlockType.Service)
      const service2 = new CodeBlock('Service2', BlockType.Service)

      structure.addBlock(LayerId.Application, service1)
      structure.addBlock(LayerId.Application, service2)
      
      // 循環依存を作る
      structure.createConnection(service1.id, service2.id)
      structure.createConnection(service2.id, service1.id)

      const result = validator.validate(structure)

      expect(result.score).toBe(70) // 100 - 30 (循環依存)
    })
  })
})