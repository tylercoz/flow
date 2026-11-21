export type DetailsDto = { name: string; description: string; notes: string }

export class Details {
  name: string
  description: string
  notes: string

  // onChange is how the owning Workspace learns of edits; Details never notifies on its own.
  private readonly onChange: () => void

  constructor(onChange: () => void, initial: Partial<DetailsDto> = {}) {
    this.onChange = onChange
    this.name = initial.name ?? ''
    this.description = initial.description ?? ''
    this.notes = initial.notes ?? ''
  }

  // Skips undefined values so a partial update cannot blank a field by accident.
  patch(partial: Partial<DetailsDto>): void {
    if (partial.name !== undefined) this.name = partial.name
    if (partial.description !== undefined) this.description = partial.description
    if (partial.notes !== undefined) this.notes = partial.notes
    this.onChange()
  }

  toJSON(): DetailsDto {
    return { name: this.name, description: this.description, notes: this.notes }
  }
}
