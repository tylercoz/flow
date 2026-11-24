import type { ComponentDefinition } from './ComponentDefinition'
import { DomainError } from './DomainError'
import { handleIds, kindInvariantError, RESOURCE_KINDS, type HandleRole, type ResourceKind } from './ResourceKinds'

export class Resource {
  readonly id: string
  readonly kind: ResourceKind
  readonly definition: ComponentDefinition | null
  private _name: string
  private _typeId: string | null
  private _remote: string | null
  private _format: string | null
  private readonly onChange: () => void

  constructor(
    id: string,
    kind: ResourceKind,
    name: string,
    typeId: string | null,
    definition: ComponentDefinition | null,
    onChange: () => void,
    remote: string | null = null,
    format: string | null = null,
  ) {
    const invalid = kindInvariantError(kind, typeId, definition !== null)
    if (invalid) throw new DomainError('INVALID_RESOURCE', invalid)
    this.id = id
    this.kind = kind
    this._name = name
    this._typeId = typeId
    this.definition = definition
    // Only a repository has a remote; a new one starts empty rather than null so the field shows in the Inspector.
    this._remote = kind === 'repository' ? (remote ?? '') : null
    // Only an artifact has a format; like the remote, it starts empty so the field shows in the Inspector.
    this._format = kind === 'artifact' ? (format ?? '') : null
    this.onChange = onChange
  }
  get name(): string {
    return this._name
  }
  get typeId(): string | null {
    return this._typeId
  }
  get remote(): string | null {
    return this._remote
  }
  get format(): string | null {
    return this._format
  }
  // Read live from the definition, so a port edit shows in every Diagram with no copying.
  handleIds(role: HandleRole): readonly string[] {
    return handleIds(this.kind, this.definition, role)
  }
  setName(name: string): void {
    this._name = name
    this.onChange()
  }
  // Stored as typed, like the name: the Inspector edits it per keystroke, so a half-typed URL must be accepted.
  setRemote(remote: string): void {
    if (this.kind !== 'repository') {
      throw new DomainError('INVALID_RESOURCE', `A ${this.kind} resource cannot have a remote.`)
    }
    this._remote = remote
    this.onChange()
  }
  // Free text stored as typed, like the name.
  setFormat(format: string): void {
    if (this.kind !== 'artifact') {
      throw new DomainError('INVALID_RESOURCE', `A ${this.kind} resource cannot have a format.`)
    }
    this._format = format
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
