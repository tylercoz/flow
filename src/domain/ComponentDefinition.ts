import type { Diagram } from './Diagram'
import type { Position } from './NodeBounds'
import type { Port, PortRole } from './Port'
import type { ComponentDto } from './WorkspaceSnapshot'

const copyPorts = (ports: readonly Port[]): Port[] => ports.map((p) => ({ ...p }))

// The state only a component Resource has. Shared by every Placement of that Resource.
export class ComponentDefinition {
  readonly diagram: Diagram
  private _inputs: Port[]
  private _outputs: Port[]
  // Where each port's node sits on the child Diagram; a port with no entry gets a default slot in the view.
  private _portPositions: Map<string, Position>
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
    this._portPositions = new Map(Object.entries(initial.portPositions ?? {}).map(([id, p]) => [id, { x: p.x, y: p.y }]))
    this._notes = initial.notes ?? ''
    this._exceptionIds = [...(initial.exceptionIds ?? [])]
    this._environmentVariableIds = [...(initial.environmentVariableIds ?? [])]
    this.onChange = onChange
    diagram.attachPortOwner(this)
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
    for (const id of this._portPositions.keys()) if (!this.portRole(id)) this._portPositions.delete(id)
    this.onChange()
  }
  portRole(id: string): PortRole | undefined {
    if (this._inputs.some((p) => p.id === id)) return 'input'
    return this._outputs.some((p) => p.id === id) ? 'output' : undefined
  }
  portPosition(id: string): Readonly<Position> | undefined {
    return this._portPositions.get(id)
  }
  get portPositions(): ReadonlyMap<string, Readonly<Position>> {
    return this._portPositions
  }
  setPortPosition(id: string, p: Position): void {
    this._portPositions.set(id, { x: p.x, y: p.y })
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
