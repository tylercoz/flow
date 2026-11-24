import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { ComponentDefinition } from '../domain/ComponentDefinition'
import type { Diagram } from '../domain/Diagram'

// Ids are shared with the domain so React Flow events map straight back to model objects.
// Nodes are flat (no parentId): a component's contents live on its own Level.
export function toNodes(diagram: Diagram, owner: ComponentDefinition | null = null): Node[] {
  const placements: Node[] = diagram.placements.map((p) => ({
    id: p.id,
    // Selects the PlacementNode registered in CanvasView's nodeTypes.
    type: 'placement',
    position: { x: p.position.x, y: p.position.y },
    // No width or height: a fixed node size cannot grow when ports are added, so React Flow always measures the
    // node from its content and PlacementNode applies the stored size as a minimum.
    // PlacementNode resolves its Resource itself, so nothing is copied here.
    data: {},
  }))
  return [...placements, ...(owner ? toPortNodes(owner) : [])]
}
// Default slots for a port node the user has not moved: inputs and variables on the left, outputs on the right, one row per port.
const OUTPUT_COLUMN_X = 480
const PORT_ROW_HEIGHT = 72
function toPortNodes(owner: ComponentDefinition): Node[] {
  return owner.portPlacements.map((n) => {
    const role = owner.portRole(n.id)
    // Environment then local variables stack under the inputs, so no default slot overlaps.
    const envRows = owner.inputs.length
    const row =
      role === 'environment'
        ? envRows + owner.environmentVariableIds.indexOf(n.portId)
        : role === 'local'
          ? envRows + owner.environmentVariableIds.length + owner.localVariables.findIndex((v) => v.id === n.portId)
          : (role === 'input' ? owner.inputs : owner.outputs).findIndex((p) => p.id === n.portId)
    return {
      // The node id is the Link end, so Links and React Flow events map straight back to the domain.
      id: n.id,
      type: 'port',
      // Every node of an unmoved port shares the slot of the port's order, so a copy is placed explicitly when it is made.
      position: n.position ? { ...n.position } : { x: role === 'output' ? OUTPUT_COLUMN_X : 0, y: row * PORT_ROW_HEIGHT },
      data: {},
    }
  })
}

export function toEdges(diagram: Diagram): Edge[] {
  return diagram.links.map((l) => ({
    id: l.id,
    source: l.sourceId,
    target: l.targetId,
    // Port ids double as the Handle ids rendered by PortList and PlacementNode (including side ids like 'top').
    sourceHandle: l.sourcePortId,
    targetHandle: l.targetPortId,
    // Selects LinkEdge, which reads the live name from the Link so it can edit it in place.
    type: 'link',
    // Marker size scales with the 3px edge stroke (index.css), so the default 12.5 would be oversized.
    markerEnd: { type: MarkerType.ArrowClosed, width: 9, height: 9 },
  }))
}
