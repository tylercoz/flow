import { ChangeSignal } from './ChangeSignal'
import { ComponentDefinition } from './ComponentDefinition'
import type { DataType } from './DataType'
import { Details, type NewPort } from './Details'
import { Diagram, type DiagramContext } from './Diagram'
import { reaches, type DiagramGraph } from './DiagramGraph'
import { DomainError } from './DomainError'
import type { EnvironmentVariable } from './EnvironmentVariable'
import type { ExceptionType } from './ExceptionType'
import type { IdGenerator } from './IdGenerator'
import { Link } from './Link'
import type { Position } from './NodeBounds'
import { Placement } from './Placement'
import { Resource } from './Resource'
import { RESOURCE_KINDS, type ResourceKind } from './ResourceKinds'
import { ResourceRegistry } from './ResourceRegistry'
import type { ObservableStore } from './ObservableStore'
import { DEFAULT_VIEWPORT, type Viewport } from './Viewport'
import type { DiagramDto, Fragment, LinkDto, PlacementDto, ResourceDto, WorkspaceSnapshot } from './WorkspaceSnapshot'

export type ResourceImpact = {
  placements: number
  links: number
  // Only for a component: what its child Diagram holds. Nested Resources are not counted as removed.
  contents?: { nodes: number; links: number }
}

export class Workspace implements ObservableStore {
  private readonly signal = new ChangeSignal()
  // One context for every Diagram, so restored and new content share the id source, signal and cycle rule.
  private readonly ctx: DiagramContext
  private readonly _resources = new ResourceRegistry()
  private _root: Diagram
  private _types: DataType[]
  private _exceptions: ExceptionType[]
  private _environmentVariables: EnvironmentVariable[]

  private constructor(
    ids: IdGenerator,
    types: readonly DataType[],
    exceptions: readonly ExceptionType[],
    environmentVariables: readonly EnvironmentVariable[],
    resources: readonly ResourceDto[],
    makeRoot: (ctx: DiagramContext) => Diagram,
  ) {
    this.ctx = {
      ids,
      onChange: () => this.signal.notify(),
      resources: this._resources,
      wouldCreateCycle: (target, resourceId) => this.wouldCreateCycle(target, resourceId),
    }
    this.loadResources(resources)
    this._root = makeRoot(this.ctx)
    this._types = types.map((t) => ({ ...t }))
    this._exceptions = exceptions.map((e) => ({ ...e }))
    this._environmentVariables = environmentVariables.map((v) => ({ ...v }))
  }

  // A getter because replaceContent swaps the tree; readers must not hold the old root.
  get root(): Diagram {
    return this._root
  }
  toSnapshot(includeViewports = true): WorkspaceSnapshot {
    return {
      schemaVersion: 9,
      types: this._types.map((t) => ({ id: t.id, name: t.name })),
      exceptions: this._exceptions.map((e) => ({ id: e.id, name: e.name })),
      environmentVariables: this._environmentVariables.map((v) => ({ id: v.id, name: v.name })),
      // A component's name is read from its details, which is the single owner of it.
      resources: this._resources.all.map((r) => ({
        id: r.id,
        kind: r.kind,
        name: r.name,
        typeId: r.typeId,
        component: r.definition && {
          details: r.definition.details.toJSON(),
          exceptionIds: [...r.definition.exceptionIds],
          environmentVariableIds: [...r.definition.environmentVariableIds],
          diagram: diagramToDto(r.definition.diagram, includeViewports),
        },
      })),
      root: diagramToDto(this._root, includeViewports),
    }
  }
  // Viewport-free, deterministic string so equal content compares with ===.
  capture(): string {
    return JSON.stringify(this.toSnapshot(false))
  }
  // Keeps current viewports so undo does not move the canvas; only this class's own capture() output is accepted.
  replaceContent(snapshot: string): void {
    const parsed = JSON.parse(snapshot) as WorkspaceSnapshot
    const viewports = new Map<string, Viewport>(this.allDiagrams().map((d) => [d.id, { ...d.viewport }]))
    this.loadResources(parsed.resources, viewports)
    this._root = buildDiagram(parsed.root, this.ctx, viewports)
    this._types = parsed.types.map((t) => ({ ...t }))
    this._exceptions = parsed.exceptions.map((e) => ({ ...e }))
    this._environmentVariables = parsed.environmentVariables.map((v) => ({ ...v }))
    this.signal.notify()
  }
  // Copies the chosen Placements and the Links between them; Resources are never copied.
  copy(diagram: Diagram, nodeIds: ReadonlySet<string>): Fragment {
    const dto = diagramToDto(diagram, false)
    return {
      placements: dto.placements.filter((p) => nodeIds.has(p.id)),
      // A Link to a node outside the copy would dangle.
      links: dto.links.filter((l) => nodeIds.has(l.sourceId) && nodeIds.has(l.targetId)),
    }
  }
  // Placement and Link ids are regenerated so a fragment can be pasted any number of times, in any Diagram.
  // Placements keep their resourceId and port ids: a paste never creates a Resource.
  paste(diagram: Diagram, fragment: Fragment, offset: Position): { placements: Placement[]; links: Link[] } {
    // Checked before any change, so a rejected paste leaves no partial state.
    const resourceIds = new Set(fragment.placements.map((p) => p.resourceId))
    for (const id of resourceIds) {
      if (!this._resources.get(id)) throw new DomainError('MISSING_RESOURCE', 'A pasted item uses a resource that no longer exists.')
    }
    for (const id of resourceIds) {
      if (this.wouldCreateCycle(diagram, id)) throw new DomainError('REFERENCE_CYCLE', 'A pasted component would contain itself.')
    }
    const fresh = withFreshIds(fragment, this.ctx.ids)
    const shift = (p: Position): Position => ({ x: p.x + offset.x, y: p.y + offset.y })
    const placements = fresh.placements.map((p) => new Placement(p.id, p.resourceId, shift(p.position), this.ctx.onChange, p.size))
    const links = fresh.links.map((l) => buildLink(l, this.ctx))
    diagram.addAll(placements, links)
    return { placements, links }
  }
  get types(): readonly DataType[] {
    return this._types
  }
  addType(name: string): DataType {
    const type = { id: this.ctx.ids.next(), name }
    this._types = [...this._types, type]
    this.signal.notify()
    return type
  }
  renameType(id: string, name: string): void {
    this._types = this._types.map((t) => (t.id === id ? { ...t, name } : t))
    this.signal.notify()
  }
  // Refuses instead of untyping ports, so a stray click cannot silently discard type information.
  removeType(id: string): void {
    if (this.isTypeInUse(id)) throw new DomainError('TYPE_IN_USE', 'This type is used by a port or resource.')
    this._types = this._types.filter((t) => t.id !== id)
    this.signal.notify()
  }
  private isTypeInUse(id: string): boolean {
    const uses = ({ details }: { details: Details }) => [...details.inputs, ...details.outputs].some((p) => p.typeId === id)
    return (
      this._resources.all.some((r) => r.typeId === id) ||
      this.definitions().some(uses) ||
      this.allDiagrams().some((d) => d.links.some(uses))
    )
  }

  get resources(): ResourceRegistry {
    return this._resources
  }
  // Validates before mutating; the Resource and its Placement share one notification, so creation is one undo step.
  createPlacedResource(diagram: Diagram, spec: { kind: ResourceKind; name: string; typeId?: string }, position: Position): Placement {
    let typeId: string | null = null
    if (RESOURCE_KINDS[spec.kind].typed) {
      if (this._types.length === 0) throw new DomainError('NO_TYPES', 'Add a Data Type first.')
      if (spec.typeId === undefined) throw new DomainError('TYPE_REQUIRED', 'Choose a Data Type.')
      this.requireType(spec.typeId)
      typeId = spec.typeId
    }
    const definition =
      spec.kind === 'component'
        ? new ComponentDefinition(new Details(this.ctx.onChange, { name: spec.name }), new Diagram(this.ctx.ids.next(), this.ctx), this.ctx.onChange)
        : null
    const resource = new Resource(this.ctx.ids.next(), spec.kind, spec.name, typeId, definition, this.ctx.onChange)
    this._resources.add(resource)
    // A new Resource's Diagram is unreachable, so this cannot throw REFERENCE_CYCLE.
    return diagram.addPlacement(resource.id, position)
  }
  // Prunes Links on removed ports in every Diagram holding a Placement of the Resource; one notification via patch.
  setPorts(resourceId: string, field: 'inputs' | 'outputs', ports: readonly NewPort[]): void {
    const resource = this._resources.get(resourceId)
    if (!resource) throw new DomainError('MISSING_RESOURCE', 'The resource no longer exists.')
    if (!resource.definition) throw new DomainError('INVALID_RESOURCE', 'Only a component has ports.')
    const next = ports.map((p) => ({ ...p, id: p.id ?? this.ctx.ids.next() }))
    const kept = new Set(next.map((p) => p.id))
    this.allDiagrams().forEach((d) => d.dropLinksOnPorts(resourceId, field, kept))
    resource.definition.details.patch({ [field]: next })
  }
  // Every Diagram: the root plus the child Diagram of each component Resource, placed or not.
  allDiagrams(): Diagram[] {
    return [this._root, ...this.definitions().map((d) => d.diagram)]
  }
  componentResources(): readonly Resource[] {
    return this._resources.byKind('component')
  }
  diagramGraph(): DiagramGraph {
    const graph = new Map<string, string[]>()
    for (const d of this.allDiagrams()) {
      const children = d.placements.flatMap((p) => {
        const child = this._resources.get(p.resourceId)?.definition?.diagram
        return child ? [child.id] : []
      })
      graph.set(d.id, children)
    }
    return graph
  }
  // Placing R in `target` adds the edge target -> R.diagram; it closes a cycle when R.diagram already reaches target.
  wouldCreateCycle(target: Diagram, resourceId: string): boolean {
    const child = this._resources.get(resourceId)?.definition?.diagram
    return !!child && reaches(this.diagramGraph(), child.id, target.id)
  }
  private definitions(): ComponentDefinition[] {
    return this.componentResources().flatMap((r) => (r.definition ? [r.definition] : []))
  }
  setResourceType(id: string, typeId: string): void {
    const resource = this._resources.get(id)
    if (!resource) throw new DomainError('MISSING_RESOURCE', 'The resource no longer exists.')
    this.requireType(typeId)
    resource.setType(typeId)
  }
  // What removeResource will delete, across every Diagram, so the UI can warn first.
  resourceImpact(id: string): ResourceImpact {
    const resource = this._resources.get(id)
    if (!resource) throw new DomainError('MISSING_RESOURCE', 'The resource no longer exists.')
    const impact: ResourceImpact = this.allDiagrams().reduce(
      (sum, d) => {
        const n = d.countPlacementsOf(id)
        return { placements: sum.placements + n.placements, links: sum.links + n.links }
      },
      { placements: 0, links: 0 },
    )
    const inner = resource.definition?.diagram
    return inner ? { ...impact, contents: { nodes: inner.placements.length, links: inner.links.length } } : impact
  }
  // Cascade Delete in one notification, so History records a single undo step.
  removeResource(id: string): void {
    if (!this._resources.get(id)) throw new DomainError('MISSING_RESOURCE', 'The resource no longer exists.')
    this.allDiagrams().forEach((d) => d.dropPlacementsOf(id))
    this._resources.remove(id)
    this.signal.notify()
  }
  private requireType(typeId: string): void {
    if (!this._types.some((t) => t.id === typeId)) throw new DomainError('UNKNOWN_TYPE', 'The data type does not exist.')
  }
  // The registry instance is shared with the DiagramContext, so it is refilled in place.
  private loadResources(dtos: readonly ResourceDto[], viewports?: ReadonlyMap<string, Viewport>): void {
    this._resources.all.slice().forEach((r) => this._resources.remove(r.id))
    const { ctx } = this
    dtos.forEach((r) => {
      const c = r.component
      const definition =
        c &&
        new ComponentDefinition(new Details(ctx.onChange, c.details), buildDiagram(c.diagram, ctx, viewports), ctx.onChange, c.exceptionIds, c.environmentVariableIds)
      this._resources.add(new Resource(r.id, r.kind, r.name, r.typeId, definition, ctx.onChange))
    })
  }

  get exceptions(): readonly ExceptionType[] {
    return this._exceptions
  }
  addException(name: string): ExceptionType {
    const exception = { id: this.ctx.ids.next(), name }
    this._exceptions = [...this._exceptions, exception]
    this.signal.notify()
    return exception
  }
  renameException(id: string, name: string): void {
    this._exceptions = this._exceptions.map((e) => (e.id === id ? { ...e, name } : e))
    this.signal.notify()
  }
  // How many Components can return this exception, so the UI can warn before removal.
  exceptionUsage(id: string): number {
    return this.definitions().filter((c) => c.exceptionIds.includes(id)).length
  }
  // Removes the exception from every component in one notification, so History records a single undo step.
  removeException(id: string): void {
    this.definitions().forEach((c) => c.dropException(id))
    this._exceptions = this._exceptions.filter((e) => e.id !== id)
    this.signal.notify()
  }
  get environmentVariables(): readonly EnvironmentVariable[] {
    return this._environmentVariables
  }
  addEnvironmentVariable(name: string): EnvironmentVariable {
    const variable = { id: this.ctx.ids.next(), name }
    this._environmentVariables = [...this._environmentVariables, variable]
    this.signal.notify()
    return variable
  }
  renameEnvironmentVariable(id: string, name: string): void {
    this._environmentVariables = this._environmentVariables.map((v) => (v.id === id ? { ...v, name } : v))
    this.signal.notify()
  }
  // How many Components rely on this variable, so the UI can warn before removal.
  environmentVariableUsage(id: string): number {
    return this.definitions().filter((c) => c.environmentVariableIds.includes(id)).length
  }
  // Removes the variable from every component in one notification, so History records a single undo step.
  removeEnvironmentVariable(id: string): void {
    this.definitions().forEach((c) => c.dropEnvironmentVariable(id))
    this._environmentVariables = this._environmentVariables.filter((v) => v.id !== id)
    this.signal.notify()
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  static empty(ids: IdGenerator): Workspace {
    const defaults = ['number', 'string', 'boolean'].map((name) => ({ id: ids.next(), name }))
    return new Workspace(ids, defaults, [], [], [], (ctx) => new Diagram(ids.next(), ctx))
  }

  // Expects a snapshot already validated by WorkspaceSerializer.
  static restore(snapshot: WorkspaceSnapshot, ids: IdGenerator): Workspace {
    return new Workspace(ids, snapshot.types, snapshot.exceptions, snapshot.environmentVariables, snapshot.resources, (ctx) => buildDiagram(snapshot.root, ctx))
  }
}

function diagramToDto(d: Diagram, includeViewports: boolean): DiagramDto {
  const viewport = includeViewports ? { x: d.viewport.x, y: d.viewport.y, zoom: d.viewport.zoom } : { ...DEFAULT_VIEWPORT }
  return {
    id: d.id,
    viewport,
    placements: d.placements.map((p) => ({
      id: p.id,
      resourceId: p.resourceId,
      position: { x: p.position.x, y: p.position.y },
      size: p.size && { width: p.size.width, height: p.size.height },
    })),
    links: d.links.map((l) => ({
      id: l.id,
      details: l.details.toJSON(),
      sourceId: l.sourceId,
      targetId: l.targetId,
      sourcePortId: l.sourcePortId,
      targetPortId: l.targetPortId,
    })),
  }
}

// `viewports` overrides the stored viewport per Diagram id; others fall back to the snapshot's.
function buildDiagram(dto: DiagramDto, ctx: DiagramContext, viewports?: ReadonlyMap<string, Viewport>): Diagram {
  const links = dto.links.map((l) => buildLink(l, ctx))
  const placements = dto.placements.map((p: PlacementDto) => new Placement(p.id, p.resourceId, p.position, ctx.onChange, p.size))
  return new Diagram(dto.id, ctx, viewports?.get(dto.id) ?? dto.viewport, links, placements)
}
function buildLink(l: LinkDto, ctx: DiagramContext): Link {
  return new Link(l.id, new Details(ctx.onChange, l.details), l.sourceId, l.targetId, l.sourcePortId, l.targetPortId)
}
// Port ids are kept: they belong to the Resource and stay valid in any Diagram holding a Placement of it.
function withFreshIds(fragment: Fragment, ids: IdGenerator): Fragment {
  const renamed = new Map(fragment.placements.map((p) => [p.id, ids.next()]))
  return {
    placements: fragment.placements.map((p) => ({ ...p, id: renamed.get(p.id)! })),
    links: fragment.links.map((l) => ({ ...l, id: ids.next(), sourceId: renamed.get(l.sourceId)!, targetId: renamed.get(l.targetId)! })),
  }
}
