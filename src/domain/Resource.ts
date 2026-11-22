import { DomainError } from './DomainError'
import { RESOURCE_KINDS, type ResourceKind } from './ResourceKinds'

export class Resource {
  readonly id: string
  readonly kind: ResourceKind
  private _name: string
  private _typeId: string | null
  private readonly onChange: () => void

  constructor(id: string, kind: ResourceKind, name: string, typeId: string | null, onChange: () => void) {
    const typed = RESOURCE_KINDS[kind].typed
    if (typed && typeId === null) throw new DomainError('INVALID_RESOURCE', `A ${kind} resource needs a data type.`)
    if (!typed && typeId !== null) throw new DomainError('INVALID_RESOURCE', `A ${kind} resource cannot have a data type.`)
    this.id = id
    this.kind = kind
    this._name = name
    this._typeId = typeId
    this.onChange = onChange
  }
  get name(): string {
    return this._name
  }
  get typeId(): string | null {
    return this._typeId
  }
  setName(name: string): void {
    this._name = name
    this.onChange()
  }
  // Workspace.setResourceType checks the id against the catalog; this class only guards the kind.
  setType(typeId: string): void {
    if (!RESOURCE_KINDS[this.kind].typed) {
      throw new DomainError('INVALID_RESOURCE', `A ${this.kind} resource cannot have a data type.`)
    }
    this._typeId = typeId
    this.onChange()
  }
}
