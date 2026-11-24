type DomainErrorCode =
  | 'SELF_LINK'
  | 'NOT_IN_DIAGRAM'
  | 'INVALID_PORT'
  | 'TYPE_IN_USE'
  | 'MISSING_RESOURCE'
  | 'INVALID_RESOURCE'
  | 'TYPE_REQUIRED'
  | 'NO_TYPES'
  | 'UNKNOWN_TYPE'
  | 'REFERENCE_CYCLE'
  | 'NOT_A_COMPONENT'
  | 'LAST_PORT_NODE'

export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}
