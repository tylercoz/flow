import type { Edge, Node } from '@xyflow/react'
import type { Diagram } from '../domain/Diagram'

// Ids are shared with the domain so React Flow events map straight back to model objects.
// Nodes are flat (no parentId): a Component's contents live on its own Level.
export function toNodes(diagram: Diagram): Node[] {
  return diagram.components.map((c) => ({
    id: c.id,
    // Selects the custom ComponentNode registered in CanvasView's nodeTypes.
    type: 'component',
    position: { x: c.position.x, y: c.position.y },
    data: { label: c.details.name },
  }))
}

export function toEdges(diagram: Diagram): Edge[] {
  return diagram.links.map((l) => ({
    id: l.id,
    source: l.sourceId,
    target: l.targetId,
    label: l.details.name || undefined,
  }))
}
