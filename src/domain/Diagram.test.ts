import { describe, expect, it } from 'vitest'
import { Diagram } from './Diagram'
import { DomainError } from './DomainError'

function setup() {
  let n = 0
  let changes = 0
  const diagram = new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => changes++ })
  return { diagram, changes: () => changes }
}

describe('Diagram', () => {
  it('adds a Component with an empty child Diagram and notifies', () => {
    const { diagram, changes } = setup()
    const c = diagram.addComponent({ x: 1, y: 2 })
    expect(diagram.components).toEqual([c])
    expect(c.position).toEqual({ x: 1, y: 2 })
    expect(c.diagram.components).toHaveLength(0)
    expect(changes()).toBeGreaterThan(0)
  })

  it('rejects self links and links to unknown Components', () => {
    const { diagram } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    expect(() => diagram.addLink(a.id, a.id, 'bottom', 'top')).toThrow(DomainError)
    expect(() => diagram.addLink(a.id, 'missing', 'bottom', 'top')).toThrow(DomainError)
    expect(diagram.links).toHaveLength(0)
  })

  it('removes a Component with its attached Links and reports the impact first', () => {
    const { diagram } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const inner = a.diagram.addComponent({ x: 0, y: 0 })
    a.diagram.addComponent({ x: 1, y: 1 })
    a.diagram.addLink(inner.id, a.diagram.components[1].id, 'bottom', 'top')
    diagram.addLink(a.id, b.id, 'bottom', 'top')
    expect(diagram.deletionImpact(a.id)).toEqual({ contents: 3, links: 1 })
    diagram.removeComponent(a.id)
    expect(diagram.components).toEqual([b])
    expect(diagram.links).toHaveLength(0)
  })

  it('removes a Link and stores the viewport', () => {
    const { diagram } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const link = diagram.addLink(a.id, b.id, 'bottom', 'top')
    diagram.removeLink(link.id)
    expect(diagram.links).toHaveLength(0)
    diagram.setViewport({ x: 5, y: 6, zoom: 2 })
    expect(diagram.viewport).toEqual({ x: 5, y: 6, zoom: 2 })
  })
})
