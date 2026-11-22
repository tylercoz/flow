import { Component, type Position } from './Component'
import { Details, type NewPort } from './Details'
import { DomainError } from './DomainError'
import type { IdGenerator } from './IdGenerator'
import { Link } from './Link'
import { DEFAULT_VIEWPORT, type Viewport } from './Viewport'

// Supplied by the Workspace so every Diagram in the tree shares one id source and one change signal.
export type DiagramContext = { ids: IdGenerator; onChange: () => void }

export class Diagram {
  readonly id: string
  private readonly ctx: DiagramContext
  private _viewport: Viewport
  private _components: Component[]
  private _links: Link[]

  // Initial content lets Workspace.restore rebuild a stored tree without generating new ids.
  constructor(
    id: string,
    ctx: DiagramContext,
    viewport: Viewport = DEFAULT_VIEWPORT,
    components: readonly Component[] = [],
    links: readonly Link[] = [],
  ) {
    this.id = id
    this.ctx = ctx
    this._viewport = { ...viewport }
    this._components = [...components]
    this._links = [...links]
  }

  get viewport(): Readonly<Viewport> {
    return this._viewport
  }
  get components(): readonly Component[] {
    return this._components
  }
  get links(): readonly Link[] {
    return this._links
  }

  component(id: string): Component | undefined {
    return this._components.find((c) => c.id === id)
  }

  setViewport(v: Viewport): void {
    this._viewport = { x: v.x, y: v.y, zoom: v.zoom }
    this.ctx.onChange()
  }

  addComponent(position: Position): Component {
    const { ids, onChange } = this.ctx
    const component = new Component(ids.next(), new Details(onChange), position, new Diagram(ids.next(), this.ctx), onChange)
    this._components.push(component)
    onChange()
    return component
  }

  // One change for the whole batch, so a paste is a single undo step.
  addAll(components: readonly Component[], links: readonly Link[]): void {
    this._components.push(...components)
    this._links.push(...links)
    this.ctx.onChange()
  }
  removeComponent(id: string): void {
    this.require(id)
    this._components = this._components.filter((c) => c.id !== id)
    this._links = this._links.filter((l) => !touches(l, id))
    this.ctx.onChange()
  }

  deletionImpact(id: string): { contents: number; links: number } {
    const component = this.require(id)
    return {
      contents: countDescendants(component.diagram),
      links: this._links.filter((l) => touches(l, id)).length,
    }
  }

  // Replaces one port list. Links on a removed port go in the same change, so undo restores both in one step.
  setPorts(componentId: string, field: 'inputs' | 'outputs', ports: readonly NewPort[]): void {
    const component = this.require(componentId)
    const next = ports.map((p) => ({ ...p, id: p.id ?? this.ctx.ids.next() }))
    const kept = new Set(next.map((p) => p.id))
    this._links = this._links.filter((l) =>
      field === 'outputs'
        ? l.sourceId !== componentId || kept.has(l.sourcePortId)
        : l.targetId !== componentId || kept.has(l.targetPortId),
    )
    component.details.patch({ [field]: next })
  }

  addLink(sourceId: string, targetId: string, sourcePortId: string, targetPortId: string): Link {
    if (sourceId === targetId) throw new DomainError('SELF_LINK', 'A component cannot be linked to itself.')
    const source = this.component(sourceId)
    const target = this.component(targetId)
    if (!source || !target) throw new DomainError('NOT_IN_DIAGRAM', 'Both components must be in the same diagram.')
    if (!source.details.outputs.some((p) => p.id === sourcePortId) || !target.details.inputs.some((p) => p.id === targetPortId)) {
      throw new DomainError('INVALID_PORT', 'A link must go from an output to an input.')
    }
    const link = new Link(this.ctx.ids.next(), new Details(this.ctx.onChange), sourceId, targetId, sourcePortId, targetPortId)
    this._links.push(link)
    this.ctx.onChange()
    return link
  }

  removeLink(id: string): void {
    if (!this._links.some((l) => l.id === id)) throw new DomainError('NOT_IN_DIAGRAM', 'Link is not in this diagram.')
    this._links = this._links.filter((l) => l.id !== id)
    this.ctx.onChange()
  }

  private require(id: string): Component {
    const component = this.component(id)
    if (!component) throw new DomainError('NOT_IN_DIAGRAM', 'Component is not in this diagram.')
    return component
  }
}

function touches(link: Link, componentId: string): boolean {
  return link.sourceId === componentId || link.targetId === componentId
}

function countDescendants(diagram: Diagram): number {
  return diagram.components.reduce((n, c) => n + countDescendants(c.diagram), diagram.components.length + diagram.links.length)
}
