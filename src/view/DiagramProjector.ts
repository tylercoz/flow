import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { Diagram } from '../domain/Diagram'

// Ids are shared with the domain so React Flow events map straight back to model objects.
// Nodes are flat (no parentId): a Component's contents live on its own Level.
export function toNodes(diagram: Diagram): Node[] {
  return diagram.components.map((c) => ({
    id: c.id,
    // Selects the custom ComponentNode registered in CanvasView's nodeTypes.
    type: 'component',
    position: { x: c.position.x, y: c.position.y },
    // Omitted when never resized, so React Flow measures the node from its content.
    ...(c.size && { width: c.size.width, height: c.size.height }),
    // ComponentNode reads the live name from Details, so no label is copied here.
    data: {},
  }))
}

export function toEdges(diagram: Diagram): Edge[] {
  return diagram.links.map((l) => ({
    id: l.id,
    source: l.sourceId,
    target: l.targetId,
    // Side names double as the Handle ids rendered by ComponentNode.
    sourceHandle: l.sourceSide,
    targetHandle: l.targetSide,
    // Selects LinkEdge, which reads the live name from Details so it can edit it in place.
    type: 'link',
    // Marker size scales with the 3px edge stroke (index.css), so the default 12.5 would be oversized.
    markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9 },
  }))
}
