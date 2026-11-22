import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { Diagram } from '../domain/Diagram'

// Ids are shared with the domain so React Flow events map straight back to model objects.
// Nodes are flat (no parentId): a component's contents live on its own Level.
export function toNodes(diagram: Diagram): Node[] {
  return diagram.placements.map((p) => ({
    id: p.id,
    // Selects the PlacementNode registered in CanvasView's nodeTypes.
    type: 'placement',
    position: { x: p.position.x, y: p.position.y },
    // No width or height: a fixed node size cannot grow when ports are added, so React Flow always measures the
    // node from its content and PlacementNode applies the stored size as a minimum.
    // PlacementNode resolves its Resource itself, so nothing is copied here.
    data: {},
  }))
}

export function toEdges(diagram: Diagram): Edge[] {
  return diagram.links.map((l) => ({
    id: l.id,
    source: l.sourceId,
    target: l.targetId,
    // Port ids double as the Handle ids rendered by PortList and PlacementNode (including side ids like 'top').
    sourceHandle: l.sourcePortId,
    targetHandle: l.targetPortId,
    // Selects LinkEdge, which reads the live name from Details so it can edit it in place.
    type: 'link',
    // Marker size scales with the 3px edge stroke (index.css), so the default 12.5 would be oversized.
    markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9 },
  }))
}
