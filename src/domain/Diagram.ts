import { Details } from './Details'
import { DomainError } from './DomainError'
import type { IdGenerator } from './IdGenerator'
import { Link } from './Link'
import { checkLink, type EndShape } from './LinkRules'
import type { Position } from './NodeBounds'
import { Placement } from './Placement'
import type { Resource } from './Resource'
import { DEFAULT_VIEWPORT, type Viewport } from './Viewport'

// Supplied by the Workspace so every Diagram shares one id source, one change signal and one cycle rule.
export type ResourceLookup = { get(id: string): Resource | undefined }
export type DiagramContext = {
  ids: IdGenerator
  onChange: () => void
  resources: ResourceLookup
  wouldCreateCycle: (target: Diagram, resourceId: string) => boolean
}

export class Diagram {
  readonly id: string
  private readonly ctx: DiagramContext
  private _viewport: Viewport
  private _links: Link[]
  private _placements: Placement[]

  // Initial content lets Workspace.restore rebuild a stored Diagram without generating new ids.
  constructor(
    id: string,
    ctx: DiagramContext,
    viewport: Viewport = DEFAULT_VIEWPORT,
    links: readonly Link[] = [],
    placements: readonly Placement[] = [],
  ) {
    this.id = id
    this.ctx = ctx
    this._viewport = { ...viewport }
    this._links = [...links]
    this._placements = [...placements]
  }

  get viewport(): Readonly<Viewport> {
    return this._viewport
  }
  get links(): readonly Link[] {
    return this._links
  }
  get placements(): readonly Placement[] {
    return this._placements
  }

  placement(id: string): Placement | undefined {
    return this._placements.find((p) => p.id === id)
  }

  resourceOf(placementId: string): Resource | undefined {
    const placement = this.placement(placementId)
    return placement && this.ctx.resources.get(placement.resourceId)
  }

  setViewport(v: Viewport): void {
    this._viewport = { x: v.x, y: v.y, zoom: v.zoom }
    this.ctx.onChange()
  }

  addPlacement(resourceId: string, position: Position): Placement {
    if (!this.ctx.resources.get(resourceId)) throw new DomainError('MISSING_RESOURCE', 'The resource no longer exists.')
    if (this.ctx.wouldCreateCycle(this, resourceId)) {
      throw new DomainError('REFERENCE_CYCLE', 'A component cannot contain itself, directly or through other components.')
    }
    const placement = new Placement(this.ctx.ids.next(), resourceId, position, this.ctx.onChange)
    this._placements.push(placement)
    this.ctx.onChange()
    return placement
  }

  // Keeps the Resource; only the Placement and the Links attached to it go.
  removePlacement(id: string): void {
    if (!this.placement(id)) throw new DomainError('NOT_IN_DIAGRAM', 'Placement is not in this diagram.')
    this.dropNode(id)
    this.ctx.onChange()
  }

  // No notification: Workspace.removeResource visits every Diagram and notifies once.
  dropPlacementsOf(resourceId: string): void {
    for (const p of this._placements.filter((p) => p.resourceId === resourceId)) this.dropNode(p.id)
  }

  // No notification, for the same reason as dropPlacementsOf. Removes Links on ports of the Resource
  // that are not in keptIds, so Workspace.setPorts can prune every Diagram in one undo step.
  dropLinksOnPorts(resourceId: string, field: 'inputs' | 'outputs', keptIds: ReadonlySet<string>): void {
    const ofResource = new Set(this._placements.filter((p) => p.resourceId === resourceId).map((p) => p.id))
    this._links = this._links.filter((l) =>
      field === 'outputs'
        ? !ofResource.has(l.sourceId) || keptIds.has(l.sourcePortId)
        : !ofResource.has(l.targetId) || keptIds.has(l.targetPortId),
    )
  }

  countPlacementsOf(resourceId: string): { placements: number; links: number } {
    const ids = this._placements.filter((p) => p.resourceId === resourceId).map((p) => p.id)
    return { placements: ids.length, links: this._links.filter((l) => ids.some((id) => touches(l, id))).length }
  }

  // One change for the whole batch, so a paste is a single undo step.
  addAll(placements: readonly Placement[], links: readonly Link[]): void {
    this._placements.push(...placements)
    this._links.push(...links)
    this.ctx.onChange()
  }

  addLink(sourceId: string, targetId: string, sourcePortId: string, targetPortId: string): Link {
    if (sourceId === targetId) throw new DomainError('SELF_LINK', 'A node cannot be linked to itself.')
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

  // Ports are read live from the Resource, so a port edit shows in every Diagram with no copying.
  private endShape(placementId: string): EndShape | undefined {
    const resource = this.resourceOf(placementId)
    if (!resource) return undefined
    if (resource.definition) {
      const { inputs, outputs } = resource.definition.details
      return { kind: 'component', inputIds: inputs.map((p) => p.id), outputIds: outputs.map((p) => p.id) }
    }
    return { kind: 'placement', resource: resource.kind }
  }

  private dropNode(id: string): void {
    this._placements = this._placements.filter((p) => p.id !== id)
    this._links = this._links.filter((l) => !touches(l, id))
  }
}

function touches(link: Link, nodeId: string): boolean {
  return link.sourceId === nodeId || link.targetId === nodeId
}
