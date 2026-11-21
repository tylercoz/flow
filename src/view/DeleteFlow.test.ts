import { describe, expect, it } from 'vitest'
import { Diagram } from '../domain/Diagram'
import { DomainError } from '../domain/DomainError'
import { DeleteFlow } from './DeleteFlow'

function setup() {
  let n = 0
  const diagram = new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => {} })
  return { diagram, flow: new DeleteFlow() }
}

describe('DeleteFlow', () => {
  it('deletes an empty Component immediately without a pending request', () => {
    const { diagram, flow } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    flow.request(diagram, { kind: 'component', id: a.id })
    expect(diagram.components).toHaveLength(0)
    expect(flow.pending).toBeNull()
  })

  it('holds a Component with contents as pending and leaves it in the model', () => {
    const { diagram, flow } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    a.diagram.addComponent({ x: 0, y: 0 })
    flow.request(diagram, { kind: 'component', id: a.id })
    expect(diagram.components).toEqual([a])
    expect(flow.pending).toMatchObject({ componentId: a.id, contents: 1, links: 0 })
  })

  it('holds a Component with links as pending and leaves it in the model', () => {
    const { diagram, flow } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    diagram.addLink(a.id, b.id)
    flow.request(diagram, { kind: 'component', id: a.id })
    expect(diagram.components).toHaveLength(2)
    expect(diagram.links).toHaveLength(1)
    expect(flow.pending).toMatchObject({ componentId: a.id, contents: 0, links: 1 })
  })

  it('confirm deletes the Component with its links and clears pending', () => {
    const { diagram, flow } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    diagram.addLink(a.id, b.id)
    flow.request(diagram, { kind: 'component', id: a.id })
    flow.confirm()
    expect(diagram.components).toEqual([b])
    expect(diagram.links).toHaveLength(0)
    expect(flow.pending).toBeNull()
  })

  it('cancel clears pending and leaves the model untouched', () => {
    const { diagram, flow } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    a.diagram.addComponent({ x: 0, y: 0 })
    flow.request(diagram, { kind: 'component', id: a.id })
    flow.cancel()
    expect(flow.pending).toBeNull()
    expect(diagram.components).toEqual([a])
    expect(a.diagram.components).toHaveLength(1)
  })

  it('deletes a Link directly without confirmation', () => {
    const { diagram, flow } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const link = diagram.addLink(a.id, b.id)
    flow.request(diagram, { kind: 'link', id: link.id })
    expect(diagram.links).toHaveLength(0)
    expect(flow.pending).toBeNull()
  })

  it('throws DomainError for an unknown id and stays idle', () => {
    const { diagram, flow } = setup()
    expect(() => flow.request(diagram, { kind: 'component', id: 'missing' })).toThrow(DomainError)
    expect(() => flow.request(diagram, { kind: 'link', id: 'missing' })).toThrow(DomainError)
    expect(flow.pending).toBeNull()
  })
})
