import { ChangeSignal } from './ChangeSignal'
import { Component } from './Component'
import { Details } from './Details'
import { Diagram, type DiagramContext } from './Diagram'
import type { IdGenerator } from './IdGenerator'
import { Link } from './Link'
import type { ObservableStore } from './ObservableStore'
import type { DiagramDto, WorkspaceSnapshot } from './WorkspaceSnapshot'

export class Workspace implements ObservableStore {
  readonly root: Diagram
  private readonly signal: ChangeSignal

  private constructor(signal: ChangeSignal, root: Diagram) {
    this.signal = signal
    this.root = root
  }

  // Arrow wrapper: field initializers run before the constructor assigns `signal`, so it can't be bound directly.
  subscribe = (listener: () => void): (() => void) => this.signal.subscribe(listener)

  // Arrow wrapper: same reason as `subscribe`; `signal` is assigned after field initializers run.
  getVersion = (): number => this.signal.getVersion()

  static empty(ids: IdGenerator): Workspace {
    return Workspace.build(ids, (ctx) => new Diagram(ids.next(), ctx))
  }

  // Expects a snapshot already validated by WorkspaceSerializer.
  static restore(snapshot: WorkspaceSnapshot, ids: IdGenerator): Workspace {
    return Workspace.build(ids, (ctx) => buildDiagram(snapshot.root, ctx))
  }

  // The single place that wires the shared signal and id source, so restored and new content behave alike.
  private static build(ids: IdGenerator, makeRoot: (ctx: DiagramContext) => Diagram): Workspace {
    const signal = new ChangeSignal()
    const root = makeRoot({ ids, onChange: () => signal.notify() })
    return new Workspace(signal, root)
  }
}

function buildDiagram(dto: DiagramDto, ctx: DiagramContext): Diagram {
  const components = dto.components.map(
    (c) => new Component(c.id, new Details(ctx.onChange, c.details), c.position, buildDiagram(c.diagram, ctx), ctx.onChange),
  )
  const links = dto.links.map((l) => new Link(l.id, new Details(ctx.onChange, l.details), l.sourceId, l.targetId))
  return new Diagram(dto.id, ctx, dto.viewport, components, links)
}
