export enum BlockType {
  UIComponent = 'ui-component',
  Entity = 'entity',
  ValueObject = 'value-object',
  Service = 'service',
  UseCase = 'usecase',
  DTO = 'dto',
  Repository = 'repository',
  RepositoryImpl = 'repository-impl',
  Controller = 'controller',
  DomainService = 'domain-service'
}

export class CodeBlock {
  public readonly id: string

  constructor(
    public readonly name: string,
    public readonly type: BlockType
  ) {
    this.id = `${type}-${name}-${Date.now()}`
  }

  isUIComponent(): boolean {
    return this.type === BlockType.UIComponent
  }

  isEntity(): boolean {
    return this.type === BlockType.Entity
  }

  isValueObject(): boolean {
    return this.type === BlockType.ValueObject
  }

  isDomainModel(): boolean {
    return this.isEntity() || this.isValueObject() || this.type === BlockType.DomainService
  }

  isInfrastructure(): boolean {
    return this.type === BlockType.RepositoryImpl
  }
}