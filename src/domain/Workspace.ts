import { ChangeSignal } from './ChangeSignal'
import { Component } from './Component'
import type { DataType } from './DataType'
import { Details } from './Details'
import { Diagram, type DiagramContext } from './Diagram'
import { DomainError } from './DomainError'
import type { IdGenerator } from './IdGenerator'
import { Link } from './Link'
import type { ObservableStore } from './ObservableStore'
import { DEFAULT_VIEWPORT, type Viewport } from './Viewport'
import type { DiagramDto, WorkspaceSnapshot } from './WorkspaceSnapshot'

export class Workspace implements ObservableStore {
  private _root: Diagram
  private readonly signal: ChangeSignal
  private readonly ids: IdGenerator

  private _types: DataType[]
  private constructor(signal: ChangeSignal, ids: IdGenerator, root: Diagram, types: DataType[]) {
    this.signal = signal
    this.ids = ids
    this._root = root
    this._types = types
  }
  // A getter because replaceContent swaps the tree; readers must not hold the old root.
  get root(): Diagram {
    return this._root
  }
  toSnapshot(includeViewports = true): WorkspaceSnapshot {
    return {
      schemaVersion: 4,
      types: this._types.map((t) => ({ id: t.id, name: t.name })),
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
    const ctx = { ids: this.ids, onChange: () => this.signal.notify() }
    this._root = buildDiagram(parsed.root, ctx, viewports)
    this._types = parsed.types.map((t) => ({ ...t }))
    this.signal.notify()
  }
  get types(): readonly DataType[] {
    return this._types
  }
  addType(name: string): DataType {
    const type = { id: this.ids.next(), name }
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

  // Arrow wrapper: field initializers run before the constructor assigns `signal`, so it can't be bound directly.
  subscribe = (listener: () => void): (() => void) => this.signal.subscribe(listener)

  // Arrow wrapper: same reason as `subscribe`; `signal` is assigned after field initializers run.
  getVersion = (): number => this.signal.getVersion()

  static empty(ids: IdGenerator): Workspace {
    const defaults = ['number', 'string', 'boolean'].map((name) => ({ id: ids.next(), name }))
    return Workspace.build(ids, defaults, (ctx) => new Diagram(ids.next(), ctx))
  }

  // Expects a snapshot already validated by WorkspaceSerializer.
  static restore(snapshot: WorkspaceSnapshot, ids: IdGenerator): Workspace {
    return Workspace.build(ids, snapshot.types, (ctx) => buildDiagram(snapshot.root, ctx))
  }

  // The single place that wires the shared signal and id source, so restored and new content behave alike.
  private static build(ids: IdGenerator, types: readonly DataType[], makeRoot: (ctx: DiagramContext) => Diagram): Workspace {
    const signal = new ChangeSignal()
    const root = makeRoot({ ids, onChange: () => signal.notify() })
    return new Workspace(signal, ids, root, types.map((t) => ({ ...t })))
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
      diagram: diagramToDto(c.diagram, includeViewports),
    })),
    links: d.links.map((l) => ({
      id: l.id,
      details: l.details.toJSON(),
      sourceId: l.sourceId,
      targetId: l.targetId,
      sourceSide: l.sourceSide,
      targetSide: l.targetSide,
    })),
  }
}

// `viewports` overrides the stored viewport per Diagram id; others fall back to the snapshot's.
function buildDiagram(dto: DiagramDto, ctx: DiagramContext, viewports?: ReadonlyMap<string, Viewport>): Diagram {
  const components = dto.components.map(
    (c) => new Component(c.id, new Details(ctx.onChange, c.details), c.position, buildDiagram(c.diagram, ctx, viewports), ctx.onChange, c.size),
  )
  const links = dto.links.map((l) => new Link(l.id, new Details(ctx.onChange, l.details), l.sourceId, l.targetId, l.sourceSide, l.targetSide))
  return new Diagram(dto.id, ctx, viewports?.get(dto.id) ?? dto.viewport, components, links)
}
