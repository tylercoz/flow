// A null typeId means the port has no type yet. The id lets a Link keep its endpoint when ports are renamed or removed.
export type Port = { id: string; name: string; typeId: string | null }
// A port not yet in the model; Diagram.setPorts assigns its id.
export type NewPort = Omit<Port, 'id'> & { id?: string }
export type DetailsDto = { name: string; inputs: Port[]; outputs: Port[]; notes: string }
const copyPorts = (ports: readonly Port[]): Port[] => ports.map((p) => ({ ...p }))
export class Details {
  name: string
  inputs: Port[]
  outputs: Port[]
  notes: string
  // onChange is how the owning Workspace learns of edits; Details never notifies on its own.
  private readonly onChange: () => void
  constructor(onChange: () => void, initial: Partial<DetailsDto> = {}) {
    this.onChange = onChange
    this.name = initial.name ?? ''
    this.inputs = copyPorts(initial.inputs ?? [])
    this.outputs = copyPorts(initial.outputs ?? [])
    this.notes = initial.notes ?? ''
  }
  // Component ports must change through Diagram.setPorts, which also removes the Links of removed ports.
  // Skips undefined values so a partial update cannot blank a field by accident.
  patch(partial: Partial<DetailsDto>): void {
    if (partial.name !== undefined) this.name = partial.name
    if (partial.inputs !== undefined) this.inputs = copyPorts(partial.inputs)
    if (partial.outputs !== undefined) this.outputs = copyPorts(partial.outputs)
    if (partial.notes !== undefined) this.notes = partial.notes
    this.onChange()
  }
  toJSON(): DetailsDto {
    return { name: this.name, inputs: copyPorts(this.inputs), outputs: copyPorts(this.outputs), notes: this.notes }
  }
}
