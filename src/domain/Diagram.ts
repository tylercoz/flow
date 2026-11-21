import { Component, type Position } from './Component'
import { Details } from './Details'
import { DomainError } from './DomainError'
import type { IdGenerator } from './IdGenerator'
import { Link, type Side } from './Link'
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

  addLink(sourceId: string, targetId: string, sourceSide: Side, targetSide: Side): Link {
    if (sourceId === targetId) throw new DomainError('SELF_LINK', 'A component cannot be linked to itself.')
    if (!this.component(sourceId) || !this.component(targetId)) {
      throw new DomainError('NOT_IN_DIAGRAM', 'Both components must be in the same diagram.')
    }
    const link = new Link(this.ctx.ids.next(), new Details(this.ctx.onChange), sourceId, targetId, sourceSide, targetSide)
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
