export class Link {
  readonly id: string
  private _name: string
  private readonly onChange: () => void
  // Endpoints are fixed so a Link can never leave the Diagram that validated them.
  readonly sourceId: string
  readonly targetId: string
  // The output of the source and the input of the target that this Link joins.
  readonly sourcePortId: string
  readonly targetPortId: string

  constructor(id: string, name: string, onChange: () => void, sourceId: string, targetId: string, sourcePortId: string, targetPortId: string) {
    this.id = id
    this._name = name
    this.onChange = onChange
    this.sourceId = sourceId
    this.targetId = targetId
    this.sourcePortId = sourcePortId
    this.targetPortId = targetPortId
  }

  get name(): string {
    return this._name
  }

  setName(name: string): void {
    this._name = name
    this.onChange()
  }
}
