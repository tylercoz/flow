import type { Diagram } from './Diagram'
import { DomainError } from './DomainError'
import type { IdGenerator } from './IdGenerator'
import type { Position } from './NodeBounds'
import type { Port, PortPlacement, PortRole } from './Port'
import type { ComponentDto } from './WorkspaceSnapshot'

const copyPorts = (ports: readonly Port[]): Port[] => ports.map((p) => ({ ...p }))
const copyPlacement = (n: PortPlacement): PortPlacement => ({ id: n.id, portId: n.portId, position: n.position && { x: n.position.x, y: n.position.y } })

// The state only a component Resource has. Shared by every Placement of that Resource.
export class ComponentDefinition {
  readonly diagram: Diagram
  private _inputs: Port[]
  private _outputs: Port[]
  // Every port has at least one entry, which setPorts and removePortPlacements keep true.
  private _portPlacements: PortPlacement[]
  private readonly ids: IdGenerator
  private _notes: string
  // Ids into Workspace.exceptions.
  private _exceptionIds: string[]
  // Ids into Workspace.environmentVariables.
  private _environmentVariableIds: string[]
  private readonly onChange: () => void

  constructor(diagram: Diagram, onChange: () => void, ids: IdGenerator, initial: Partial<Omit<ComponentDto, 'diagram'>> = {}) {
    this.diagram = diagram
    this.ids = ids
    this._inputs = copyPorts(initial.inputs ?? [])
    this._outputs = copyPorts(initial.outputs ?? [])
    this._portPlacements = (initial.portNodes ?? []).map(copyPlacement)
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

  // Ports must change through Workspace.setPorts, which also removes the Links of removed ports on other Diagrams.
  // The nodes of this component's own Level are handled here so the port, its nodes and their Links change in one notification.
  setPorts(field: 'inputs' | 'outputs', ports: readonly Port[]): void {
    if (field === 'inputs') this._inputs = copyPorts(ports)
    else this._outputs = copyPorts(ports)
    this.syncPortPlacements()
    this.onChange()
  }
  // Every input, output and environment variable keeps at least one node; the nodes of a removed one go with its Links.
  // Does not notify, so callers that change several things can notify once.
  private syncPortPlacements(): void {
    const live = this.livePortIds()
    const gone = new Set(this._portPlacements.filter((n) => !live.has(n.portId)).map((n) => n.id))
    this._portPlacements = this._portPlacements.filter((n) => !gone.has(n.id))
    for (const id of live) {
      if (!this._portPlacements.some((n) => n.portId === id)) this._portPlacements.push({ id: this.ids.next(), portId: id, position: null })
    }
    this.diagram.dropLinksOfNodes(gone)
  }
  private livePortIds(): Set<string> {
    return new Set([...this._inputs, ...this._outputs].map((p) => p.id).concat(this._environmentVariableIds))
  }

  get portPlacements(): readonly PortPlacement[] {
    return this._portPlacements
  }

  portPlacement(id: string): PortPlacement | undefined {
    return this._portPlacements.find((n) => n.id === id)
  }

  // The port a node shows, so a name or type change reaches every node of that port.
  portOf(nodeId: string): Port | undefined {
    const portId = this.portPlacement(nodeId)?.portId
    return [...this._inputs, ...this._outputs].find((p) => p.id === portId)
  }

  portRole(nodeId: string): PortRole | undefined {
    const portId = this.portPlacement(nodeId)?.portId
    if (this._inputs.some((p) => p.id === portId)) return 'input'
    if (this._outputs.some((p) => p.id === portId)) return 'output'
    return this._environmentVariableIds.some((id) => id === portId) ? 'environment' : undefined
  }

  setPortPlacementPosition(id: string, p: Position): void {
    const node = this.portPlacement(id)
    if (!node) throw new DomainError('NOT_IN_DIAGRAM', 'Port node is not in this diagram.')
    node.position = { x: p.x, y: p.y }
    this.onChange()
  }

  // One notification for the batch, so a paste is a single undo step.
  addPortPlacements(items: readonly { portId: string; position: Position }[]): PortPlacement[] {
    const known = this.livePortIds()
    if (items.some((i) => !known.has(i.portId))) throw new DomainError('INVALID_PORT', 'The port no longer exists.')
    const added = items.map((i) => ({ id: this.ids.next(), portId: i.portId, position: { x: i.position.x, y: i.position.y } }))
    this._portPlacements.push(...added)
    if (added.length > 0) this.onChange()
    return added
  }

  // All or nothing: a port left with no node would have nothing to link, so the whole removal is refused.
  removePortPlacements(ids: readonly string[]): void {
    const gone = new Set(ids)
    if (gone.size === 0) return
    for (const id of gone) {
      if (!this.portPlacement(id)) throw new DomainError('NOT_IN_DIAGRAM', 'Port node is not in this diagram.')
    }
    const kept = new Set(this._portPlacements.filter((n) => !gone.has(n.id)).map((n) => n.portId))
    if (this._portPlacements.some((n) => gone.has(n.id) && !kept.has(n.portId))) {
      throw new DomainError('LAST_PORT_NODE', 'A port needs at least one node. Remove the port on the component instead.')
    }
    this._portPlacements = this._portPlacements.filter((n) => !gone.has(n.id))
    this.diagram.dropLinksOfNodes(gone)
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
    this.syncPortPlacements()
    this.onChange()
  }

  // Does not notify, for the same reason as dropException.
  dropEnvironmentVariable(id: string): void {
    this._environmentVariableIds = this._environmentVariableIds.filter((v) => v !== id)
    this.syncPortPlacements()
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
