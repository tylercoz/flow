export type DomainErrorCode = 'SELF_LINK' | 'NOT_IN_DIAGRAM' | 'TYPE_IN_USE'

export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}
