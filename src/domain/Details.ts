// A null typeId means the port has no type yet.
export type Port = { name: string; typeId: string | null }
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
