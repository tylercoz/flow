import { ComponentDefinition } from './ComponentDefinition'
import { Diagram, type DiagramContext } from './Diagram'
import type { IdGenerator } from './IdGenerator'
import { Link } from './Link'
import { Placement } from './Placement'
import { Resource } from './Resource'
import { DEFAULT_VIEWPORT, type Viewport } from './Viewport'
import type { DiagramDto, Fragment, LinkDto, PlacementDto, ResourceDto } from './WorkspaceSnapshot'

export function diagramToDto(d: Diagram, includeViewports: boolean): DiagramDto {
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
      name: l.name,
      sourceId: l.sourceId,
      targetId: l.targetId,
      sourcePortId: l.sourcePortId,
      targetPortId: l.targetPortId,
      ...(l.waypoints.length > 0 && { waypoints: l.waypoints.map((p) => ({ x: p.x, y: p.y })) }),
    })),
  }
}

// `viewports` overrides the stored viewport per Diagram id; others fall back to the snapshot's.
export function buildDiagram(dto: DiagramDto, ctx: DiagramContext, viewports?: ReadonlyMap<string, Viewport>): Diagram {
  const links = dto.links.map((l) => buildLink(l, ctx))
  const placements = dto.placements.map((p: PlacementDto) => new Placement(p.id, p.resourceId, p.position, ctx.onChange, p.size))
  return new Diagram(dto.id, ctx, viewports?.get(dto.id) ?? dto.viewport, links, placements)
}

export function buildLink(l: LinkDto, ctx: DiagramContext): Link {
  return new Link(l.id, l.name, ctx.onChange, l.sourceId, l.targetId, l.sourcePortId, l.targetPortId, l.waypoints)
}

export function resourceToDto(r: Resource, includeViewports: boolean): ResourceDto {
  const d = r.definition
  return {
    id: r.id,
    kind: r.kind,
    name: r.name,
    typeId: r.typeId,
    component: d && {
      inputs: d.inputs.map((p) => ({ ...p })),
      outputs: d.outputs.map((p) => ({ ...p })),
      notes: d.notes,
      exceptionIds: [...d.exceptionIds],
      environmentVariableIds: [...d.environmentVariableIds],
      diagram: diagramToDto(d.diagram, includeViewports),
    },
  }
}

export function buildResource(dto: ResourceDto, ctx: DiagramContext, viewports?: ReadonlyMap<string, Viewport>): Resource {
  const c = dto.component
  const definition = c && new ComponentDefinition(buildDiagram(c.diagram, ctx, viewports), ctx.onChange, c)
  return new Resource(dto.id, dto.kind, dto.name, dto.typeId, definition, ctx.onChange)
}

// Port ids are kept: they belong to the Resource and stay valid in any Diagram holding a Placement of it.
export function withFreshIds(fragment: Fragment, ids: IdGenerator): Fragment {
  const renamed = new Map(fragment.placements.map((p) => [p.id, ids.next()]))
  return {
    placements: fragment.placements.map((p) => ({ ...p, id: renamed.get(p.id)! })),
    links: fragment.links.map((l) => ({ ...l, id: ids.next(), sourceId: renamed.get(l.sourceId)!, targetId: renamed.get(l.targetId)! })),
  }
}
