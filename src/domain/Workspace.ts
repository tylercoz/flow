import { ChangeSignal } from './ChangeSignal'
import { Component, type Position } from './Component'
import type { DataType } from './DataType'
import { Details } from './Details'
import { Diagram, type DiagramContext } from './Diagram'
import { DomainError } from './DomainError'
import type { ExceptionType } from './ExceptionType'
import type { IdGenerator } from './IdGenerator'
import { Link } from './Link'
import type { ObservableStore } from './ObservableStore'
import { DEFAULT_VIEWPORT, type Viewport } from './Viewport'
import type { ComponentDto, DiagramDto, Fragment, LinkDto, WorkspaceSnapshot } from './WorkspaceSnapshot'

export class Workspace implements ObservableStore {
  private readonly signal = new ChangeSignal()
  // One context for every Diagram in the tree, so restored and new content share the id source and signal.
  private readonly ctx: DiagramContext
  private _root: Diagram
  private _types: DataType[]
  private _exceptions: ExceptionType[]

  private constructor(
    ids: IdGenerator,
    types: readonly DataType[],
    exceptions: readonly ExceptionType[],
    makeRoot: (ctx: DiagramContext) => Diagram,
  ) {
    this.ctx = { ids, onChange: () => this.signal.notify() }
    this._root = makeRoot(this.ctx)
    this._types = types.map((t) => ({ ...t }))
    this._exceptions = exceptions.map((e) => ({ ...e }))
  }

  // A getter because replaceContent swaps the tree; readers must not hold the old root.
  get root(): Diagram {
    return this._root
  }
  toSnapshot(includeViewports = true): WorkspaceSnapshot {
    return {
      schemaVersion: 6,
      types: this._types.map((t) => ({ id: t.id, name: t.name })),
      exceptions: this._exceptions.map((e) => ({ id: e.id, name: e.name })),
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
    const viewports = new Map<string, Viewport>()
    const collect = (d: Diagram) => {
      viewports.set(d.id, { ...d.viewport })
      d.components.forEach((c) => collect(c.diagram))
    }
    collect(this._root)
    this._root = buildDiagram(parsed.root, this.ctx, viewports)
    this._types = parsed.types.map((t) => ({ ...t }))
    this._exceptions = parsed.exceptions.map((e) => ({ ...e }))
    this.signal.notify()
  }
  // Copies the chosen Components with everything nested in them, and the Links between them.
  copy(diagram: Diagram, componentIds: ReadonlySet<string>): Fragment {
    const dto = diagramToDto(diagram, false)
    return {
      components: dto.components.filter((c) => componentIds.has(c.id)),
      // A Link to a Component outside the copy would dangle.
      links: dto.links.filter((l) => componentIds.has(l.sourceId) && componentIds.has(l.targetId)),
    }
  }
  // Every id is regenerated so a fragment can be pasted any number of times, in any Diagram.
  paste(diagram: Diagram, fragment: Fragment, offset: Position): { components: Component[]; links: Link[] } {
    const fresh = withFreshIds(fragment, this.ctx.ids)
    const moved = fresh.components.map((c) => ({ ...c, position: { x: c.position.x + offset.x, y: c.position.y + offset.y } }))
    const components = moved.map((c) => buildComponent(c, this.ctx))
    const links = fresh.links.map((l) => buildLink(l, this.ctx))
    diagram.addAll(components, links)
    return { components, links }
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
    if (this.isTypeInUse(id)) throw new DomainError('TYPE_IN_USE', 'This type is used by a port. Change those ports first.')
    this._types = this._types.filter((t) => t.id !== id)
    this.signal.notify()
  }
  private isTypeInUse(id: string): boolean {
    const uses = ({ details }: { details: Details }) => [...details.inputs, ...details.outputs].some((p) => p.typeId === id)
    const visit = (d: Diagram): boolean =>
      d.components.some((c) => uses(c) || visit(c.diagram)) || d.links.some(uses)
    return visit(this.root)
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
    return this.allComponents().filter((c) => c.exceptionIds.includes(id)).length
  }
  // Removes the exception from every Component in one notification, so History records a single undo step.
  removeException(id: string): void {
    this.allComponents().forEach((c) => c.dropException(id))
    this._exceptions = this._exceptions.filter((e) => e.id !== id)
    this.signal.notify()
  }
  private allComponents(): Component[] {
    const visit = (d: Diagram): Component[] => d.components.flatMap((c) => [c, ...visit(c.diagram)])
    return visit(this._root)
  }

  subscribe = this.signal.subscribe
  getVersion = this.signal.getVersion

  static empty(ids: IdGenerator): Workspace {
    const defaults = ['number', 'string', 'boolean'].map((name) => ({ id: ids.next(), name }))
    return new Workspace(ids, defaults, [], (ctx) => new Diagram(ids.next(), ctx))
  }

  // Expects a snapshot already validated by WorkspaceSerializer.
  static restore(snapshot: WorkspaceSnapshot, ids: IdGenerator): Workspace {
    return new Workspace(ids, snapshot.types, snapshot.exceptions, (ctx) => buildDiagram(snapshot.root, ctx))
  }
}

function diagramToDto(d: Diagram, includeViewports: boolean): DiagramDto {
  const viewport = includeViewports ? { x: d.viewport.x, y: d.viewport.y, zoom: d.viewport.zoom } : { ...DEFAULT_VIEWPORT }
  return {
    id: d.id,
    viewport,
    components: d.components.map((c) => ({
      id: c.id,
      details: c.details.toJSON(),
      position: { x: c.position.x, y: c.position.y },
      size: c.size && { width: c.size.width, height: c.size.height },
      exceptionIds: [...c.exceptionIds],
      diagram: diagramToDto(c.diagram, includeViewports),
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
  const components = dto.components.map((c) => buildComponent(c, ctx, viewports))
  const links = dto.links.map((l) => buildLink(l, ctx))
  return new Diagram(dto.id, ctx, viewports?.get(dto.id) ?? dto.viewport, components, links)
}
function buildComponent(c: ComponentDto, ctx: DiagramContext, viewports?: ReadonlyMap<string, Viewport>): Component {
  return new Component(c.id, new Details(ctx.onChange, c.details), c.position, buildDiagram(c.diagram, ctx, viewports), ctx.onChange, c.size, c.exceptionIds)
}
function buildLink(l: LinkDto, ctx: DiagramContext): Link {
  return new Link(l.id, new Details(ctx.onChange, l.details), l.sourceId, l.targetId, l.sourcePortId, l.targetPortId)
}
// Ports keep their ids: they are only unique within one Component, and Links refer to them together with the Component id.
function withFreshIds(fragment: Fragment, ids: IdGenerator): Fragment {
  const renamed = new Map<string, string>()
  const fresh = (id: string) => {
    if (!renamed.has(id)) renamed.set(id, ids.next())
    return renamed.get(id)!
  }
  const diagram = (d: DiagramDto): DiagramDto => ({ ...d, id: ids.next(), components: d.components.map(component), links: d.links.map(link) })
  const component = (c: ComponentDto): ComponentDto => ({ ...c, id: fresh(c.id), diagram: diagram(c.diagram) })
  const link = (l: LinkDto): LinkDto => ({ ...l, id: ids.next(), sourceId: fresh(l.sourceId), targetId: fresh(l.targetId) })
  return { components: fragment.components.map(component), links: fragment.links.map(link) }
}
