import { describe, expect, it } from 'vitest'
import { Diagram } from '../domain/Diagram'
import { toEdges, toNodes } from './DiagramProjector'

function setup() {
  let n = 0
  return new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => {} })
}

describe('DiagramProjector', () => {
  it('projects an empty Diagram to no nodes or edges', () => {
    const diagram = setup()
    expect(toNodes(diagram)).toEqual([])
    expect(toEdges(diagram)).toEqual([])
  })

  it('projects width and height only for a resized Component', () => {
    const diagram = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 0, y: 0 })
    b.setBounds({ x: 5, y: 6 }, { width: 200, height: 80 })
    const [nodeA, nodeB] = toNodes(diagram)
    expect(nodeA.id).toBe(a.id)
    expect(nodeA).not.toHaveProperty('width')
    expect(nodeB).toMatchObject({ position: { x: 5, y: 6 }, width: 200, height: 80 })
  })
  it('projects one node per Component with matching id and position, and no label', () => {
    const diagram = setup()
    const a = diagram.addComponent({ x: 1, y: 2 })
    const b = diagram.addComponent({ x: 3, y: 4 })
    a.details.patch({ name: 'A' })
    a.diagram.addComponent({ x: 0, y: 0 })

    const nodes = toNodes(diagram)
    expect(nodes.map((x) => x.id)).toEqual([a.id, b.id])
    expect(nodes[0].position).toEqual({ x: 1, y: 2 })
    expect(nodes[0].data).toEqual({})
    expect(nodes.every((x) => x.type === 'component')).toBe(true)
    expect(nodes[0].parentId).toBeUndefined()
  })

  it('projects one edge per Link with matching id, endpoints and the link edge type, without a label', () => {
    const diagram = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const named = diagram.addLink(a.id, b.id, 'right', 'left')
    const unnamed = diagram.addLink(b.id, a.id, 'bottom', 'top')
    named.details.patch({ name: 'calls' })

    const edges = toEdges(diagram)
    expect(edges.map((e) => e.id)).toEqual([named.id, unnamed.id])
    expect(edges[0]).toMatchObject({ source: a.id, target: b.id, type: 'link' })
    expect(edges[1]).toMatchObject({ source: b.id, target: a.id })
    expect(edges.every((e) => e.label === undefined)).toBe(true)
    expect(edges.every((e) => e.markerEnd && typeof e.markerEnd === 'object' && e.markerEnd.type === 'arrowclosed')).toBe(true)
  })
})
