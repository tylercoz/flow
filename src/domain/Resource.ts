import type { ComponentDefinition } from './ComponentDefinition'
import { DomainError } from './DomainError'
import { handleIds, kindInvariantError, RESOURCE_KINDS, type HandleRole, type ResourceKind } from './ResourceKinds'

export class Resource {
  readonly id: string
  readonly kind: ResourceKind
  readonly definition: ComponentDefinition | null
  private _name: string
  private _typeId: string | null
  private readonly onChange: () => void

  constructor(
    id: string,
    kind: ResourceKind,
    name: string,
    typeId: string | null,
    definition: ComponentDefinition | null,
    onChange: () => void,
  ) {
    const invalid = kindInvariantError(kind, typeId, definition !== null)
    if (invalid) throw new DomainError('INVALID_RESOURCE', invalid)
    this.id = id
    this.kind = kind
    this._name = name
    this._typeId = typeId
    this.definition = definition
    this.onChange = onChange
  }
  get name(): string {
    return this._name
  }
  get typeId(): string | null {
    return this._typeId
  }
  // Read live from the definition, so a port edit shows in every Diagram with no copying.
  handleIds(role: HandleRole): readonly string[] {
    return handleIds(this.kind, this.definition, role)
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
