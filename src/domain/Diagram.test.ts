import { describe, expect, it } from 'vitest'
import { Diagram } from './Diagram'
import { DomainError } from './DomainError'
import { connect } from './testing/connect'

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
    diagram.setPorts(a.id, 'outputs', [{ name: 'o', typeId: null }])
    diagram.setPorts(a.id, 'inputs', [{ name: 'i', typeId: null }])
    const [o] = a.details.outputs
    const [i] = a.details.inputs
    expect(() => diagram.addLink(a.id, a.id, o.id, i.id)).toThrow(DomainError)
    expect(() => diagram.addLink(a.id, 'missing', o.id, i.id)).toThrow(DomainError)
    expect(diagram.links).toHaveLength(0)
  })

  it('removes a Component with its attached Links and reports the impact first', () => {
    const { diagram } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const inner = a.diagram.addComponent({ x: 0, y: 0 })
    a.diagram.addComponent({ x: 1, y: 1 })
    connect(a.diagram, inner, a.diagram.components[1])
    connect(diagram, a, b)
    expect(diagram.deletionImpact(a.id)).toEqual({ contents: 3, links: 1 })
    diagram.removeComponent(a.id)
    expect(diagram.components).toEqual([b])
    expect(diagram.links).toHaveLength(0)
  })

  it('only links an output of the source to an input of the target', () => {
    const { diagram } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    diagram.setPorts(a.id, 'outputs', [{ name: 'o', typeId: null }])
    diagram.setPorts(a.id, 'inputs', [{ name: 'i', typeId: null }])
    diagram.setPorts(b.id, 'outputs', [{ name: 'o', typeId: null }])
    diagram.setPorts(b.id, 'inputs', [{ name: 'i', typeId: null }])
    const [ao] = a.details.outputs
    const [ai] = a.details.inputs
    const [bo] = b.details.outputs
    const [bi] = b.details.inputs
    const reject = (...args: [string, string, string, string]) => {
      try {
        diagram.addLink(...args)
      } catch (e) {
        expect((e as DomainError).code).toBe('INVALID_PORT')
        return
      }
      throw new Error('expected INVALID_PORT')
    }
    reject(a.id, b.id, ai.id, bi.id)
    reject(a.id, b.id, ao.id, bo.id)
    reject(a.id, b.id, ao.id, 'missing')
    expect(diagram.links).toHaveLength(0)
    // Several Links may share one port.
    diagram.addLink(a.id, b.id, ao.id, bi.id)
    diagram.addLink(a.id, b.id, ao.id, bi.id)
    expect(diagram.links).toHaveLength(2)
  })
  it('keeps ids of kept ports and gives new ports an id', () => {
    const { diagram } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    diagram.setPorts(a.id, 'inputs', [{ name: 'x', typeId: null }])
    const [first] = a.details.inputs
    diagram.setPorts(a.id, 'inputs', [{ ...first, name: 'renamed' }, { name: 'y', typeId: null }])
    expect(a.details.inputs[0]).toEqual({ ...first, name: 'renamed' })
    expect(a.details.inputs[1].id).not.toBe(first.id)
  })
  it('removing a port removes its Links in one change and keeps the others', () => {
    const { diagram, changes } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const gone = connect(diagram, a, b)
    const kept = connect(diagram, a, b)
    const before = changes()
    diagram.setPorts(a.id, 'outputs', a.details.outputs.filter((p) => p.id !== gone.sourcePortId))
    expect(diagram.links).toEqual([kept])
    expect(changes()).toBe(before + 1)
    diagram.setPorts(b.id, 'inputs', [])
    expect(diagram.links).toHaveLength(0)
  })
  it('removes a Link and stores the viewport', () => {
    const { diagram } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const link = connect(diagram, a, b)
    diagram.removeLink(link.id)
    expect(diagram.links).toHaveLength(0)
    diagram.setViewport({ x: 5, y: 6, zoom: 2 })
    expect(diagram.viewport).toEqual({ x: 5, y: 6, zoom: 2 })
  })
})
