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

  it('projects one node per Component with matching id, position and name', () => {
    const diagram = setup()
    const a = diagram.addComponent({ x: 1, y: 2 })
    const b = diagram.addComponent({ x: 3, y: 4 })
    a.details.patch({ name: 'A' })
    a.diagram.addComponent({ x: 0, y: 0 })

    const nodes = toNodes(diagram)
    expect(nodes.map((x) => x.id)).toEqual([a.id, b.id])
    expect(nodes[0].position).toEqual({ x: 1, y: 2 })
    expect(nodes[0].data).toEqual({ label: 'A' })
    expect(nodes.every((x) => x.type === 'component')).toBe(true)
    expect(nodes[0].parentId).toBeUndefined()
  })

  it('projects one edge per Link with matching id, endpoints and label', () => {
    const diagram = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const named = diagram.addLink(a.id, b.id)
    const unnamed = diagram.addLink(b.id, a.id)
    named.details.patch({ name: 'calls' })

    const edges = toEdges(diagram)
    expect(edges.map((e) => e.id)).toEqual([named.id, unnamed.id])
    expect(edges[0]).toMatchObject({ source: a.id, target: b.id, label: 'calls' })
    expect(edges[1]).toMatchObject({ source: b.id, target: a.id })
    expect(edges[1].label).toBeUndefined()
  })
})
