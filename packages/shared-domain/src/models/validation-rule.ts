export enum ValidationRule {
  NoDependencyViolation = 'NO_DEPENDENCY_VIOLATION',
  NoCyclicDependency = 'NO_CYCLIC_DEPENDENCY',
  NoPresentationToInfra = 'NO_PRESENTATION_TO_INFRA',
  NoUIInDTO = 'NO_UI_IN_DTO',
  NoFatService = 'NO_FAT_SERVICE',
  NoDomainLogicInController = 'NO_DOMAIN_LOGIC_IN_CONTROLLER',
  RequireInterfaceForRepository = 'REQUIRE_INTERFACE_FOR_REPOSITORY'
}

export interface RuleConfig {
  enabled: boolean
  severity: 'error' | 'warning'
  params?: Record<string, unknown>
}

export const DEFAULT_RULE_CONFIGS: Record<ValidationRule, RuleConfig> = {
  [ValidationRule.NoDependencyViolation]: {
    enabled: true,
    severity: 'error'
  },
  [ValidationRule.NoCyclicDependency]: {
    enabled: true,
    severity: 'error'
  },
  [ValidationRule.NoPresentationToInfra]: {
    enabled: true,
    severity: 'error'
  },
  [ValidationRule.NoUIInDTO]: {
    enabled: true,
    severity: 'error'
  },
  [ValidationRule.NoFatService]: {
    enabled: true,
    severity: 'warning',
    params: {
      maxMethods: 20,
      maxLines: 200
    }
  },
  [ValidationRule.NoDomainLogicInController]: {
    enabled: true,
    severity: 'warning'
  },
  [ValidationRule.RequireInterfaceForRepository]: {
    enabled: true,
    severity: 'warning'
  }
}