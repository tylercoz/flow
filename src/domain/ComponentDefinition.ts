import type { Diagram } from './Diagram'
import type { Port } from './Port'
import type { ComponentDto } from './WorkspaceSnapshot'

const copyPorts = (ports: readonly Port[]): Port[] => ports.map((p) => ({ ...p }))

// The state only a component Resource has. Shared by every Placement of that Resource.
export class ComponentDefinition {
  readonly diagram: Diagram
  private _inputs: Port[]
  private _outputs: Port[]
  private _notes: string
  // Ids into Workspace.exceptions.
  private _exceptionIds: string[]
  // Ids into Workspace.environmentVariables.
  private _environmentVariableIds: string[]
  private readonly onChange: () => void

  constructor(diagram: Diagram, onChange: () => void, initial: Partial<Omit<ComponentDto, 'diagram'>> = {}) {
    this.diagram = diagram
    this._inputs = copyPorts(initial.inputs ?? [])
    this._outputs = copyPorts(initial.outputs ?? [])
    this._notes = initial.notes ?? ''
    this._exceptionIds = [...(initial.exceptionIds ?? [])]
    this._environmentVariableIds = [...(initial.environmentVariableIds ?? [])]
    this.onChange = onChange
  }

  get inputs(): readonly Port[] {
    return this._inputs
  }

  get outputs(): readonly Port[] {
    return this._outputs
  }

  // Ports must change through Workspace.setPorts, which also removes the Links of removed ports.
  setPorts(field: 'inputs' | 'outputs', ports: readonly Port[]): void {
    if (field === 'inputs') this._inputs = copyPorts(ports)
    else this._outputs = copyPorts(ports)
    this.onChange()
  }

  get notes(): string {
    return this._notes
  }

  setNotes(notes: string): void {
    this._notes = notes
    this.onChange()
  }

  get environmentVariableIds(): readonly string[] {
    return this._environmentVariableIds
  }

  setEnvironmentVariables(ids: readonly string[]): void {
    this._environmentVariableIds = [...new Set(ids)]
    this.onChange()
  }

  // Does not notify, for the same reason as dropException.
  dropEnvironmentVariable(id: string): void {
    this._environmentVariableIds = this._environmentVariableIds.filter((v) => v !== id)
  }

  get exceptionIds(): readonly string[] {
    return this._exceptionIds
  }

  setExceptions(ids: readonly string[]): void {
    this._exceptionIds = [...new Set(ids)]
    this.onChange()
  }

  // Does not notify: Workspace.removeException touches many definitions and must notify once,
  // because History records one undo step per notification.
  dropException(id: string): void {
    this._exceptionIds = this._exceptionIds.filter((e) => e !== id)
  }
}
