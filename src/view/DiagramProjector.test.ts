import { describe, expect, it } from 'vitest'
import { handleIds } from '../domain/ResourceKinds'
import { Workspace } from '../domain/Workspace'
import { connect } from '../domain/testing/connect'
import { toEdges, toNodes } from './DiagramProjector'

function setup() {
  const workspace = Workspace.empty({ next: () => crypto.randomUUID() })
  return { workspace, diagram: workspace.root }
}

describe('DiagramProjector', () => {
  it('projects an empty Diagram to no nodes or edges', () => {
    const { diagram } = setup()
    expect(toNodes(diagram)).toEqual([])
    expect(toEdges(diagram)).toEqual([])
  })

  it('never fixes a node size, so a resized Placement can still grow with its content', () => {
    const { workspace, diagram } = setup()
    const p = workspace.createPlacedResource(diagram, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
    p.setBounds({ x: 5, y: 6 }, { width: 200, height: 80 })
    const [node] = toNodes(diagram)
    expect(node.position).toEqual({ x: 5, y: 6 })
    expect(node).not.toHaveProperty('width')
    expect(node).not.toHaveProperty('height')
  })

  describe('port nodes', () => {
    function component() {
      const { workspace, diagram } = setup()
      const p = workspace.createPlacedResource(diagram, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
      workspace.setPorts(p.resourceId, 'inputs', [{ name: 'a', typeId: null }, { name: 'b', typeId: null }])
      workspace.setPorts(p.resourceId, 'outputs', [{ name: 'c', typeId: null }])
      const def = workspace.resources.get(p.resourceId)!.definition!
      return { def }
    }
    it('adds one node per port node, in default columns, after the Placements', () => {
      const { def } = component()
      const nodes = toNodes(def.diagram, def)
      expect(nodes.map((n) => [n.id, n.type, n.position])).toEqual([
        [def.portPlacements[0].id, 'port', { x: 0, y: 0 }],
        [def.portPlacements[1].id, 'port', { x: 0, y: 72 }],
        [def.portPlacements[2].id, 'port', { x: 480, y: 0 }],
      ])
    })
    it('uses a stored position over the default slot, and shows a copy of a port as its own node', () => {
      const { def } = component()
      def.setPortPlacementPosition(def.portPlacements[1].id, { x: 9, y: 8 })
      const [copy] = def.addPortPlacements([{ portId: def.inputs[0].id, position: { x: 5, y: 6 } }])
      const nodes = toNodes(def.diagram, def)
      expect(nodes.find((n) => n.id === def.portPlacements[1].id)?.position).toEqual({ x: 9, y: 8 })
      expect(nodes.find((n) => n.id === copy.id)?.position).toEqual({ x: 5, y: 6 })
      expect(nodes).toHaveLength(4)
    })
    it('adds none at the root', () => {
      const { def } = component()
      expect(toNodes(def.diagram, null)).toEqual([])
    })
  })
  it('projects every Placement, whatever its Resource kind, as one placement node with empty data', () => {
    const { workspace, diagram } = setup()
    const a = workspace.createPlacedResource(diagram, { kind: 'component', name: 'A' }, { x: 1, y: 2 })
    const b = workspace.createPlacedResource(diagram, { kind: 'user', name: 'Ann' }, { x: 3, y: 4 })
    const nodes = toNodes(diagram)
    expect(nodes.map((n) => n.id)).toEqual([a.id, b.id])
    expect(nodes[0].position).toEqual({ x: 1, y: 2 })
    expect(nodes[1].position).toEqual({ x: 3, y: 4 })
    expect(nodes.every((n) => n.type === 'placement' && Object.keys(n.data).length === 0)).toBe(true)
    expect(nodes.every((n) => n.parentId === undefined)).toBe(true)
  })

  it('projects a Placement of a shared Resource as a separate node at its own position', () => {
    const { workspace, diagram } = setup()
    const a = workspace.createPlacedResource(diagram, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
    const again = diagram.addPlacement(a.resourceId, { x: 50, y: 60 })
    expect(toNodes(diagram).map((n) => [n.id, n.position])).toEqual([
      [a.id, { x: 0, y: 0 }],
      [again.id, { x: 50, y: 60 }],
    ])
  })

  it('projects one edge per Link with matching id, endpoints, port handles and the link edge type', () => {
    const { workspace, diagram } = setup()
    const a = workspace.createPlacedResource(diagram, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
    const b = workspace.createPlacedResource(diagram, { kind: 'component', name: 'B' }, { x: 1, y: 1 })
    const first = connect(workspace, diagram, a, b)
    const second = connect(workspace, diagram, b, a)
    const edges = toEdges(diagram)
    expect(edges.map((e) => e.id)).toEqual([first.id, second.id])
    expect(edges[0]).toMatchObject({
      source: a.id,
      target: b.id,
      sourceHandle: first.sourcePortId,
      targetHandle: first.targetPortId,
      type: 'link',
    })
    expect(edges[1]).toMatchObject({ source: b.id, target: a.id })
    expect(edges.every((e) => e.label === undefined)).toBe(true)
    expect(edges.every((e) => e.markerEnd && typeof e.markerEnd === 'object' && e.markerEnd.type === 'arrowclosed')).toBe(true)
  })

  it('passes side and database handle ids through as edge handle ids', () => {
    const { workspace, diagram } = setup()
    const db = workspace.createPlacedResource(diagram, { kind: 'database', name: 'D' }, { x: 0, y: 0 })
    const user = workspace.createPlacedResource(diagram, { kind: 'user', name: 'U' }, { x: 0, y: 0 })
    const link = diagram.addLink(db.id, user.id, 'right', 'left')
    expect(toEdges(diagram)[0]).toMatchObject({ id: link.id, sourceHandle: 'right', targetHandle: 'left' })
  })

  // PlacementNode renders its Handles from these same constants, so this pins the ids it exposes per kind.
  it.each([
    ['database', ['top', 'right', 'bottom', 'left'], ['top', 'right', 'bottom', 'left']],
    ['user', ['top', 'right', 'bottom', 'left'], ['top', 'right', 'bottom', 'left']],
    ['artifact', ['top', 'right', 'bottom', 'left'], ['top', 'right', 'bottom', 'left']],
    ['input-object', ['top', 'right', 'bottom', 'left'], ['top', 'right', 'bottom', 'left']],
  ] as const)('%s exposes the expected source and target handle ids', (kind, sources, targets) => {
    expect([...handleIds(kind, null, 'source')]).toEqual(sources)
    expect([...handleIds(kind, null, 'target')]).toEqual(targets)
  })
})
