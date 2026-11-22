import { describe, expect, it } from 'vitest'
import { Placement } from './Placement'
import { Resource } from './Resource'
import { RESOURCE_KINDS, type ResourceKind } from './ResourceKinds'
import { ResourceRegistry } from './ResourceRegistry'
import { Diagram } from './Diagram'
import { DomainError } from './DomainError'
import { connect } from './testing/connect'

function setup() {
  let n = 0
  let changes = 0
  const resources = new ResourceRegistry()
  const diagram = new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => changes++, resources })
  const addResource = (id: string, kind: ResourceKind) => {
    resources.add(new Resource(id, kind, id, RESOURCE_KINDS[kind].typed ? 't1' : null, () => {}))
    return id
  }
  return { diagram, changes: () => changes, addResource }
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
  it('adds a Placement of a known Resource and rejects an unknown one', () => {
    const { diagram, changes, addResource } = setup()
    const r = addResource('r1', 'database')
    const p = diagram.addPlacement(r, { x: 3, y: 4 })
    expect(diagram.placements).toEqual([p])
    expect(diagram.placement(p.id)).toBe(p)
    expect(diagram.positioned(p.id)).toBe(p)
    expect(p.resourceId).toBe(r)
    const before = changes()
    expect(() => diagram.addPlacement('missing', { x: 0, y: 0 })).toThrow(DomainError)
    expect(diagram.placements).toHaveLength(1)
    expect(changes()).toBe(before)
  })

  it('allows several Placements of one Resource, in one Diagram or two', () => {
    const { diagram, addResource } = setup()
    const r = addResource('r1', 'user')
    const inner = diagram.addComponent({ x: 0, y: 0 }).diagram
    const a = diagram.addPlacement(r, { x: 0, y: 0 })
    const b = diagram.addPlacement(r, { x: 1, y: 1 })
    const c = inner.addPlacement(r, { x: 2, y: 2 })
    expect(new Set([a.id, b.id, c.id]).size).toBe(3)
    expect(diagram.countPlacementsOf(r)).toEqual({ placements: 2, links: 0 })
    expect(inner.countPlacementsOf(r)).toEqual({ placements: 1, links: 0 })
  })

  it('removes a Placement with its Links and keeps the Resource, other nodes and other Links', () => {
    const { diagram, addResource } = setup()
    const r = addResource('r1', 'user')
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const p = diagram.addPlacement(r, { x: 2, y: 2 })
    const q = diagram.addPlacement(r, { x: 3, y: 3 })
    diagram.setPorts(a.id, 'outputs', [{ name: 'o', typeId: null }])
    diagram.addLink(a.id, p.id, a.details.outputs[0].id, 'left')
    const kept = connect(diagram, a, b)
    expect(diagram.countPlacementsOf(r)).toEqual({ placements: 2, links: 1 })
    diagram.removePlacement(p.id)
    expect(diagram.placements).toEqual([q])
    expect(diagram.links).toEqual([kept])
    expect(diagram.components).toEqual([a, b])
    expect(() => diagram.removePlacement(p.id)).toThrow(DomainError)
  })

  it('dropPlacementsOf removes every Placement of the Resource and its Links without notifying', () => {
    const { diagram, changes, addResource } = setup()
    const r1 = addResource('r1', 'user')
    const r2 = addResource('r2', 'user')
    const p = diagram.addPlacement(r1, { x: 0, y: 0 })
    const q = diagram.addPlacement(r2, { x: 1, y: 1 })
    diagram.addLink(p.id, q.id, 'top', 'top')
    const before = changes()
    diagram.dropPlacementsOf(r1)
    expect(diagram.placements).toEqual([q])
    expect(diagram.links).toHaveLength(0)
    expect(changes()).toBe(before)
  })

  it('links Placement to Placement with the handle ids of each kind', () => {
    const { diagram, addResource } = setup()
    const db = diagram.addPlacement(addResource('db', 'database'), { x: 0, y: 0 })
    const user = diagram.addPlacement(addResource('u', 'user'), { x: 1, y: 1 })
    const art = diagram.addPlacement(addResource('a', 'artifact'), { x: 2, y: 2 })
    const link = diagram.addLink(db.id, user.id, 'read', 'left')
    expect([link.sourcePortId, link.targetPortId]).toEqual(['read', 'left'])
    diagram.addLink(user.id, db.id, 'top', 'write')
    diagram.addLink(user.id, art.id, 'right', 'bottom')
    expect(diagram.links).toHaveLength(3)
  })

  it('links a Component output to a database write handle and a database read handle to a Component input', () => {
    const { diagram, addResource } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    diagram.setPorts(a.id, 'outputs', [{ name: 'o', typeId: null }])
    diagram.setPorts(a.id, 'inputs', [{ name: 'i', typeId: null }])
    const db = diagram.addPlacement(addResource('db', 'database'), { x: 1, y: 1 })
    diagram.addLink(a.id, db.id, a.details.outputs[0].id, 'write')
    diagram.addLink(db.id, a.id, 'read', a.details.inputs[0].id)
    expect(diagram.links).toHaveLength(2)
  })

  it('rejects Links with a wrong handle, a self link or a node from another Diagram, and changes nothing', () => {
    const { diagram, changes, addResource } = setup()
    const db = diagram.addPlacement(addResource('db', 'database'), { x: 0, y: 0 })
    const user = diagram.addPlacement(addResource('u', 'user'), { x: 1, y: 1 })
    const inner = diagram.addComponent({ x: 2, y: 2 }).diagram
    const foreign = inner.addPlacement('u', { x: 0, y: 0 })
    const code = (fn: () => unknown) => {
      try {
        fn()
      } catch (e) {
        return (e as DomainError).code
      }
      return 'none'
    }
    const before = changes()
    expect(code(() => diagram.addLink(db.id, user.id, 'write', 'top'))).toBe('INVALID_PORT')
    expect(code(() => diagram.addLink(user.id, db.id, 'top', 'read'))).toBe('INVALID_PORT')
    expect(code(() => diagram.addLink(db.id, user.id, 'read', 'nope'))).toBe('INVALID_PORT')
    expect(code(() => diagram.addLink(user.id, user.id, 'top', 'top'))).toBe('SELF_LINK')
    expect(code(() => diagram.addLink(user.id, 'missing', 'top', 'top'))).toBe('NOT_IN_DIAGRAM')
    expect(code(() => diagram.addLink(user.id, foreign.id, 'top', 'top'))).toBe('NOT_IN_DIAGRAM')
    expect(diagram.links).toHaveLength(0)
    expect(changes()).toBe(before)
  })

  it('addAll adds placements in one change', () => {
    const { diagram, changes, addResource } = setup()
    addResource('u', 'user')
    const before = changes()
    const placements = [new Placement('p1', 'u', { x: 0, y: 0 }, () => {}), new Placement('p2', 'u', { x: 1, y: 1 }, () => {})]
    diagram.addAll([], placements, [])
    expect(diagram.placements).toEqual(placements)
    expect(changes()).toBe(before + 1)
  })

  it('counts Placements among the contents of a Component to delete', () => {
    const { diagram, addResource } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    a.diagram.addPlacement(addResource('u', 'user'), { x: 0, y: 0 })
    expect(diagram.deletionImpact(a.id)).toEqual({ contents: 1, links: 0 })
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
