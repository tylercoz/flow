import { Component, type Position } from './Component'
import { Details, type NewPort } from './Details'
import { DomainError } from './DomainError'
import type { IdGenerator } from './IdGenerator'
import { Link } from './Link'
import { checkLink, type EndShape } from './LinkRules'
import type { Positioned } from './NodeBounds'
import { Placement } from './Placement'
import type { Resource } from './Resource'
import { DEFAULT_VIEWPORT, type Viewport } from './Viewport'

// Supplied by the Workspace so every Diagram in the tree shares one id source and one change signal.
export type ResourceLookup = { get(id: string): Resource | undefined }
export type DiagramContext = { ids: IdGenerator; onChange: () => void; resources: ResourceLookup }

export class Diagram {
  readonly id: string
  private readonly ctx: DiagramContext
  private _viewport: Viewport
  private _components: Component[]
  private _links: Link[]
  private _placements: Placement[]

  // Initial content lets Workspace.restore rebuild a stored tree without generating new ids.
  constructor(
    id: string,
    ctx: DiagramContext,
    viewport: Viewport = DEFAULT_VIEWPORT,
    components: readonly Component[] = [],
    links: readonly Link[] = [],
    placements: readonly Placement[] = [],
  ) {
    this.id = id
    this.ctx = ctx
    this._viewport = { ...viewport }
    this._components = [...components]
    this._links = [...links]
    this._placements = [...placements]
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
  get placements(): readonly Placement[] {
    return this._placements
  }

  component(id: string): Component | undefined {
    return this._components.find((c) => c.id === id)
  }

  placement(id: string): Placement | undefined {
    return this._placements.find((p) => p.id === id)
  }

  // Component or Placement, for drag and resize.
  positioned(id: string): Positioned | undefined {
    return this.component(id) ?? this.placement(id)
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

  addPlacement(resourceId: string, position: Position): Placement {
    if (!this.ctx.resources.get(resourceId)) throw new DomainError('MISSING_RESOURCE', 'The resource no longer exists.')
    const placement = new Placement(this.ctx.ids.next(), resourceId, position, this.ctx.onChange)
    this._placements.push(placement)
    this.ctx.onChange()
    return placement
  }

  removePlacement(id: string): void {
    if (!this.placement(id)) throw new DomainError('NOT_IN_DIAGRAM', 'Placement is not in this diagram.')
    this.dropNode(id)
    this.ctx.onChange()
  }

  // No notification: Workspace.removeResource visits every Diagram and notifies once.
  dropPlacementsOf(resourceId: string): void {
    for (const p of this._placements.filter((p) => p.resourceId === resourceId)) this.dropNode(p.id)
  }

  countPlacementsOf(resourceId: string): { placements: number; links: number } {
    const ids = this._placements.filter((p) => p.resourceId === resourceId).map((p) => p.id)
    return { placements: ids.length, links: this._links.filter((l) => ids.some((id) => touches(l, id))).length }
  }

  // One change for the whole batch, so a paste is a single undo step.
  addAll(components: readonly Component[], placements: readonly Placement[], links: readonly Link[]): void {
    this._components.push(...components)
    this._placements.push(...placements)
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
    const source = this.endShape(sourceId)
    const target = this.endShape(targetId)
    if (!source || !target) throw new DomainError('NOT_IN_DIAGRAM', 'Both nodes must be in the same diagram.')
    const failure = checkLink(source, sourcePortId, target, targetPortId)
    if (failure) throw new DomainError(failure.code, failure.message)
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

  private endShape(id: string): EndShape | undefined {
    const component = this.component(id)
    if (component) {
      return {
        kind: 'component',
        inputIds: component.details.inputs.map((p) => p.id),
        outputIds: component.details.outputs.map((p) => p.id),
      }
    }
    const placement = this.placement(id)
    // A Placement's Resource is guaranteed by addPlacement and the serializer.
    const resource = placement && this.ctx.resources.get(placement.resourceId)
    return resource && { kind: 'placement', resource: resource.kind }
  }

  private dropNode(id: string): void {
    this._placements = this._placements.filter((p) => p.id !== id)
    this._links = this._links.filter((l) => !touches(l, id))
  }

  private require(id: string): Component {
    const component = this.component(id)
    if (!component) throw new DomainError('NOT_IN_DIAGRAM', 'Component is not in this diagram.')
    return component
  }
}

function touches(link: Link, nodeId: string): boolean {
  return link.sourceId === nodeId || link.targetId === nodeId
}

function countDescendants(diagram: Diagram): number {
  return diagram.components.reduce((n, c) => n + countDescendants(c.diagram), diagram.components.length + diagram.placements.length + diagram.links.length)
}
