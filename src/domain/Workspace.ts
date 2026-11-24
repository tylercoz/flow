import { Catalog } from './Catalog'
import { ChangeSignal } from './ChangeSignal'
import { ComponentDefinition } from './ComponentDefinition'
import type { DataType } from './DataType'
import { Diagram, type DiagramContext } from './Diagram'
import { reaches, type DiagramGraph } from './DiagramGraph'
import { DomainError } from './DomainError'
import type { EnvironmentVariable } from './EnvironmentVariable'
import type { ExceptionType } from './ExceptionType'
import type { IdGenerator } from './IdGenerator'
import type { Link } from './Link'
import type { Position } from './NodeBounds'
import { Placement } from './Placement'
import type { NewPort } from './Port'
import { Resource } from './Resource'
import { RESOURCE_KINDS, type ResourceKind } from './ResourceKinds'
import { ResourceRegistry } from './ResourceRegistry'
import type { ObservableStore } from './ObservableStore'
import type { Viewport } from './Viewport'
import type { Fragment, NamedDiagramDto, ProjectDto, ResourceDto, WorkspaceSnapshot } from './WorkspaceSnapshot'
import { buildDiagram, buildLink, buildResource, diagramToDto, resourceToDto, withFreshIds } from './WorkspaceSnapshotMapper'

export type ResourceImpact = {
  placements: number
  links: number
  // Only for a component: what its child Diagram holds. Nested Resources placed nowhere else are deleted too.
  contents?: { nodes: number; links: number }
}

// A top-level Diagram and its name. Component Levels are named by their component instead.
export type TopDiagram = { name: string; readonly diagram: Diagram }
export class Workspace implements ObservableStore {
  private readonly signal = new ChangeSignal()
  // One context for every Diagram, so restored and new content share the id source, signal and cycle rule.
  private readonly ctx: DiagramContext
  private readonly _resources = new ResourceRegistry()
  private _diagrams: TopDiagram[]
  private _project: ProjectDto
  private readonly _types: Catalog<DataType>
  private readonly _exceptions: Catalog<ExceptionType>
  private readonly _environmentVariables: Catalog<EnvironmentVariable>

  private constructor(
    ids: IdGenerator,
    project: ProjectDto,
    types: readonly DataType[],
    exceptions: readonly ExceptionType[],
    environmentVariables: readonly EnvironmentVariable[],
    resources: readonly ResourceDto[],
    makeDiagrams: (ctx: DiagramContext) => TopDiagram[],
  ) {
    this.ctx = {
      ids,
      onChange: () => this.signal.notify(),
      resources: this._resources,
      wouldCreateCycle: (target, resourceId) => this.wouldCreateCycle(target, resourceId),
      pruneOrphans: () => this.pruneOrphans(),
    }
    this.loadResources(resources)
    this._diagrams = makeDiagrams(this.ctx)
    this._project = { ...project }
    this._types = new Catalog(ids, types)
    this._exceptions = new Catalog(ids, exceptions)
    this._environmentVariables = new Catalog(ids, environmentVariables)
  }

  // Getters because replaceContent and load swap the tree; readers must not hold the old Diagrams.
  get diagrams(): readonly TopDiagram[] {
    return this._diagrams
  }
  // The Diagram shown on start and the fallback when the one being viewed is gone.
  get root(): Diagram {
    return this._diagrams[0].diagram
  }
  get project(): Readonly<ProjectDto> {
    return this._project
  }
  setProjectName(name: string): void {
    this._project.name = name
    this.signal.notify()
  }
  setProjectDescription(description: string): void {
    this._project.description = description
    this.signal.notify()
  }
  // Silent and outside History: a save is not an edit, so it must not become an undo step.
  stampSaved(at: string): void {
    this._project.updatedAt = at
  }
  addDiagram(name: string): Diagram {
    const diagram = new Diagram(this.ctx.ids.next(), this.ctx)
    this._diagrams.push({ name, diagram })
    this.signal.notify()
    return diagram
  }
  renameDiagram(id: string, name: string): void {
    this.topDiagram(id).name = name
    this.signal.notify()
  }
  // What removeDiagram will delete, so the UI can warn first.
  diagramImpact(id: string): { nodes: number; links: number } {
    const { diagram } = this.topDiagram(id)
    return { nodes: diagram.placements.length, links: diagram.links.length }
  }
  // Resources placed nowhere else are deleted with it, as when a component's contents go.
  removeDiagram(id: string): void {
    const target = this.topDiagram(id)
    if (this._diagrams.length === 1) throw new DomainError('LAST_DIAGRAM', 'A project needs at least one diagram.')
    this._diagrams = this._diagrams.filter((d) => d !== target)
    this.pruneOrphans()
    this.signal.notify()
  }
  private topDiagram(id: string): TopDiagram {
    const found = this._diagrams.find((d) => d.diagram.id === id)
    if (!found) throw new DomainError('MISSING_DIAGRAM', 'The diagram no longer exists.')
    return found
  }
  toSnapshot(includeViewports = true): WorkspaceSnapshot {
    const entries = (c: Catalog) => c.all.map((e) => ({ id: e.id, name: e.name }))
    return {
      schemaVersion: 16,
      project: { ...this._project },
      types: entries(this._types),
      exceptions: entries(this._exceptions),
      environmentVariables: entries(this._environmentVariables),
      resources: this._resources.all.map((r) => resourceToDto(r, includeViewports)),
      diagrams: this._diagrams.map((d): NamedDiagramDto => ({ name: d.name, diagram: diagramToDto(d.diagram, includeViewports) })),
    }
  }
  // Viewport-free, deterministic string so equal content compares with ===.
  // Timestamps are blanked: a save changes them, and that must be neither an edit nor an undo step.
  capture(): string {
    const snapshot = this.toSnapshot(false)
    return JSON.stringify({ ...snapshot, project: { ...snapshot.project, createdAt: '', updatedAt: '' } })
  }
  // Keeps current viewports so undo does not move the canvas; only this class's own capture() output is accepted.
  replaceContent(snapshot: string): void {
    const parsed = JSON.parse(snapshot) as WorkspaceSnapshot
    const viewports = new Map<string, Viewport>(this.allDiagrams().map((d) => [d.id, { ...d.viewport }]))
    this.apply(parsed, viewports)
    this._project.name = parsed.project.name
    this._project.description = parsed.project.description
    this.signal.notify()
  }
  // Replaces everything, including the stored viewports and timestamps; the caller resets History and Navigator.
  load(snapshot: WorkspaceSnapshot): void {
    this.apply(snapshot)
    this._project = { ...snapshot.project }
    this.signal.notify()
  }
  private apply(s: WorkspaceSnapshot, viewports?: ReadonlyMap<string, Viewport>): void {
    this.loadResources(s.resources, viewports)
    this._diagrams = s.diagrams.map((d) => ({ name: d.name, diagram: buildDiagram(d.diagram, this.ctx, viewports) }))
    this._types.replace(s.types)
    this._exceptions.replace(s.exceptions)
    this._environmentVariables.replace(s.environmentVariables)
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
    // Bend points are absolute, so they shift with the Placements or the pasted Link would stay anchored to the old spot.
    const links = fresh.links.map((l) => buildLink({ ...l, waypoints: l.waypoints?.map(shift) }, this.ctx))
    diagram.addAll(placements, links)
    return { placements, links }
  }
  // Moves Placements into a component's own Level, keeping their layout and the Links between them. Links to
  // Placements left behind are dropped, since a Link cannot cross Levels. The Resources are kept, not recreated.
  // A rejected move (the component contains itself) changes nothing, because paste validates before mutating.
  moveIntoComponent(from: Diagram, nodeIds: ReadonlySet<string>, componentPlacementId: string, origin: Position): Placement[] {
    const inner = from.resourceOf(componentPlacementId)?.definition?.diagram
    if (!inner) throw new DomainError('INVALID_RESOURCE', 'Placements can only be moved into a component.')
    // A component dropped on itself has nowhere to go, so it stays where it is.
    const moving = new Set([...nodeIds].filter((id) => id !== componentPlacementId && from.placement(id)))
    if (moving.size === 0) return []
    const fragment = this.copy(from, moving)
    const left = Math.min(...fragment.placements.map((p) => p.position.x))
    const top = Math.min(...fragment.placements.map((p) => p.position.y))
    const { placements } = this.paste(inner, fragment, { x: origin.x - left, y: origin.y - top })
    moving.forEach((id) => from.removePlacement(id))
    return placements
  }
  get types(): readonly DataType[] {
    return this._types.all
  }
  addType(name: string): DataType {
    return this.commit(this._types.add(name))
  }
  renameType(id: string, name: string): void {
    this.commit(this._types.rename(id, name))
  }
  // Refuses instead of untyping ports, so a stray click cannot silently discard type information.
  removeType(id: string): void {
    if (this.isTypeInUse(id)) throw new DomainError('TYPE_IN_USE', 'This type is used by a port or resource.')
    this.commit(this._types.remove(id))
  }
  // Catalogs are silent, so each public operation notifies exactly once here.
  private commit<T>(result: T): T {
    this.signal.notify()
    return result
  }
  private isTypeInUse(id: string): boolean {
    const uses = ({ inputs, outputs }: ComponentDefinition) => [...inputs, ...outputs].some((p) => p.typeId === id)
    return this._resources.all.some((r) => r.typeId === id) || this.definitions().some(uses)
  }

  get resources(): ResourceRegistry {
    return this._resources
  }
  // Validates before mutating; the Resource and its Placement share one notification, so creation is one undo step.
  createPlacedResource(diagram: Diagram, spec: { kind: ResourceKind; name: string; typeId?: string }, position: Position): Placement {
    let typeId: string | null = null
    if (RESOURCE_KINDS[spec.kind].typed) {
      if (this._types.all.length === 0) throw new DomainError('NO_TYPES', 'Add a Data Type first.')
      if (spec.typeId === undefined) throw new DomainError('TYPE_REQUIRED', 'Choose a Data Type.')
      this.requireType(spec.typeId)
      typeId = spec.typeId
    }
    const definition =
      spec.kind === 'component'
        ? new ComponentDefinition(new Diagram(this.ctx.ids.next(), this.ctx), this.ctx.onChange, this.ctx.ids)
        : null
    const resource = new Resource(this.ctx.ids.next(), spec.kind, spec.name, typeId, definition, this.ctx.onChange)
    this._resources.add(resource)
    // A new Resource's Diagram is unreachable, so this cannot throw REFERENCE_CYCLE.
    return diagram.addPlacement(resource.id, position)
  }
  // Prunes Links on removed ports in every Diagram holding a Placement of the Resource; one notification via the definition.
  setPorts(resourceId: string, field: 'inputs' | 'outputs', ports: readonly NewPort[]): void {
    const resource = this._resources.get(resourceId)
    if (!resource) throw new DomainError('MISSING_RESOURCE', 'The resource no longer exists.')
    if (!resource.definition) throw new DomainError('INVALID_RESOURCE', 'Only a component has ports.')
    const next = ports.map((p) => ({ ...p, id: p.id ?? this.ctx.ids.next() }))
    const kept = new Set(next.map((p) => p.id))
    this.allDiagrams().forEach((d) => d.dropLinksOnPorts(resourceId, field, kept))
    resource.definition.setPorts(field, next)
  }
  // Every Diagram: the root plus the child Diagram of each component Resource, placed or not.
  allDiagrams(): Diagram[] {
    return [...this._diagrams.map((d) => d.diagram), ...this.definitions().map((d) => d.diagram)]
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
    this.pruneOrphans()
    this.signal.notify()
  }
  // Repeats because removing a component also removes its child Diagram, which can orphan the Resources placed in it.
  private pruneOrphans(): void {
    for (;;) {
      const placed = new Set(this.allDiagrams().flatMap((d) => d.placements.map((p) => p.resourceId)))
      const orphans = this._resources.all.filter((r) => !placed.has(r.id))
      if (orphans.length === 0) return
      orphans.forEach((r) => this._resources.remove(r.id))
    }
  }
  private requireType(typeId: string): void {
    if (!this._types.has(typeId)) throw new DomainError('UNKNOWN_TYPE', 'The data type does not exist.')
  }
  // The registry instance is shared with the DiagramContext, so it is refilled in place.
  private loadResources(dtos: readonly ResourceDto[], viewports?: ReadonlyMap<string, Viewport>): void {
    this._resources.all.slice().forEach((r) => this._resources.remove(r.id))
    dtos.forEach((r) => this._resources.add(buildResource(r, this.ctx, viewports)))
  }

  get exceptions(): readonly ExceptionType[] {
    return this._exceptions.all
  }
  addException(name: string): ExceptionType {
    return this.commit(this._exceptions.add(name))
  }
  renameException(id: string, name: string): void {
    this.commit(this._exceptions.rename(id, name))
  }
  // How many Components can return this exception, so the UI can warn before removal.
  exceptionUsage(id: string): number {
    return this.definitions().filter((c) => c.exceptionIds.includes(id)).length
  }
  // Removes the exception from every component in one notification, so History records a single undo step.
  removeException(id: string): void {
    this.definitions().forEach((c) => c.dropException(id))
    this.commit(this._exceptions.remove(id))
  }
  get environmentVariables(): readonly EnvironmentVariable[] {
    return this._environmentVariables.all
  }
  addEnvironmentVariable(name: string): EnvironmentVariable {
    return this.commit(this._environmentVariables.add(name))
  }
  renameEnvironmentVariable(id: string, name: string): void {
    this.commit(this._environmentVariables.rename(id, name))
  }
  // How many Components rely on this variable, so the UI can warn before removal.
  environmentVariableUsage(id: string): number {
    return this.definitions().filter((c) => c.environmentVariableIds.includes(id)).length
  }
  // Removes the variable from every component in one notification, so History records a single undo step.
  removeEnvironmentVariable(id: string): void {
    this.definitions().forEach((c) => c.dropEnvironmentVariable(id))
    this.commit(this._environmentVariables.remove(id))
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  static empty(ids: IdGenerator, now: () => string = () => new Date().toISOString()): Workspace {
    const defaults = ['number', 'string', 'boolean'].map((name) => ({ id: ids.next(), name }))
    const created = now()
    const project = { name: 'Untitled project', description: '', createdAt: created, updatedAt: created }
    return new Workspace(ids, project, defaults, [], [], [], (ctx) => [{ name: 'Diagram 1', diagram: new Diagram(ids.next(), ctx) }])
  }

  // Expects a snapshot already validated by WorkspaceSerializer.
  static restore(snapshot: WorkspaceSnapshot, ids: IdGenerator): Workspace {
    return new Workspace(ids, snapshot.project, snapshot.types, snapshot.exceptions, snapshot.environmentVariables, snapshot.resources, (ctx) =>
      snapshot.diagrams.map((d) => ({ name: d.name, diagram: buildDiagram(d.diagram, ctx) })),
    )
  }
}
