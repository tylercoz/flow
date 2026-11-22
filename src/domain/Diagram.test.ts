import { describe, expect, it } from 'vitest'
import { DomainError } from './DomainError'
import { Placement } from './Placement'
import type { ResourceKind } from './ResourceKinds'
import { connect } from './testing/connect'
import { Workspace } from './Workspace'

function setup() {
  let n = 0
  const workspace = Workspace.empty({ next: () => `id${++n}` })
  const diagram = workspace.root
  // Untyped kinds only, so no Data Type is needed.
  const place = (kind: ResourceKind, name: string = kind, at = { x: 0, y: 0 }) =>
    workspace.createPlacedResource(diagram, { kind, name }, at)
  const component = (at = { x: 0, y: 0 }) => place('component', '', at)
  const definitionOf = (p: Placement) => workspace.resources.get(p.resourceId)!.definition!
  const childOf = (p: Placement) => workspace.resources.get(p.resourceId)!.definition!.diagram
  return { workspace, diagram, place, component, definitionOf, childOf }
}

const code = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as DomainError).code
  }
  return 'none'
}

describe('Diagram', () => {
  it('places a component Resource with an empty child Diagram and notifies', () => {
    const { workspace, diagram, component, childOf } = setup()
    const before = workspace.getVersion()
    const p = component({ x: 1, y: 2 })
    expect(diagram.placements).toEqual([p])
    expect(p.position).toEqual({ x: 1, y: 2 })
    expect(childOf(p).placements).toHaveLength(0)
    expect(workspace.getVersion()).toBeGreaterThan(before)
  })

  it('rejects self links and links to unknown Placements', () => {
    const { diagram, component, workspace, definitionOf } = setup()
    const a = component()
    workspace.setPorts(a.resourceId, 'outputs', [{ name: 'o', typeId: null }])
    workspace.setPorts(a.resourceId, 'inputs', [{ name: 'i', typeId: null }])
    const [o] = definitionOf(a).outputs
    const [i] = definitionOf(a).inputs
    expect(code(() => diagram.addLink(a.id, a.id, o.id, i.id))).toBe('SELF_LINK')
    expect(code(() => diagram.addLink(a.id, 'missing', o.id, i.id))).toBe('NOT_IN_DIAGRAM')
    expect(diagram.links).toHaveLength(0)
  })

  it('removes a Placement with its attached Links and keeps its Resource', () => {
    const { workspace, diagram, component } = setup()
    const a = component()
    const b = component({ x: 1, y: 1 })
    connect(workspace, diagram, a, b)
    diagram.removePlacement(a.id)
    expect(diagram.placements).toEqual([b])
    expect(diagram.links).toHaveLength(0)
    expect(workspace.resources.get(a.resourceId)).toBeDefined()
    expect(code(() => diagram.removePlacement(a.id))).toBe('NOT_IN_DIAGRAM')
  })

  it('only links an output of the source to an input of the target', () => {
    const { workspace, diagram, component, definitionOf } = setup()
    const a = component()
    const b = component({ x: 1, y: 1 })
    for (const p of [a, b]) {
      workspace.setPorts(p.resourceId, 'outputs', [{ name: 'o', typeId: null }])
      workspace.setPorts(p.resourceId, 'inputs', [{ name: 'i', typeId: null }])
    }
    const [ao] = definitionOf(a).outputs
    const [ai] = definitionOf(a).inputs
    const [bo] = definitionOf(b).outputs
    const [bi] = definitionOf(b).inputs
    expect(code(() => diagram.addLink(a.id, b.id, ai.id, bi.id))).toBe('INVALID_PORT')
    expect(code(() => diagram.addLink(a.id, b.id, ao.id, bo.id))).toBe('INVALID_PORT')
    expect(code(() => diagram.addLink(a.id, b.id, ao.id, 'missing'))).toBe('INVALID_PORT')
    expect(diagram.links).toHaveLength(0)
    // Several Links may share one port.
    diagram.addLink(a.id, b.id, ao.id, bi.id)
    diagram.addLink(a.id, b.id, ao.id, bi.id)
    expect(diagram.links).toHaveLength(2)
  })

  it('keeps ids of kept ports and gives new ports an id', () => {
    const { workspace, component, definitionOf } = setup()
    const a = component()
    workspace.setPorts(a.resourceId, 'inputs', [{ name: 'x', typeId: null }])
    const [first] = definitionOf(a).inputs
    workspace.setPorts(a.resourceId, 'inputs', [{ ...first, name: 'renamed' }, { name: 'y', typeId: null }])
    const { inputs } = definitionOf(a)
    expect(inputs[0]).toEqual({ ...first, name: 'renamed' })
    expect(inputs[1].id).not.toBe(first.id)
  })

  it('adds a Placement of a known Resource and rejects an unknown one without a change', () => {
    const { workspace, diagram, place } = setup()
    const first = place('database', 'db', { x: 3, y: 4 })
    const p = diagram.addPlacement(first.resourceId, { x: 5, y: 6 })
    expect(diagram.placement(p.id)).toBe(p)
    expect(p.resourceId).toBe(first.resourceId)
    const before = workspace.getVersion()
    expect(code(() => diagram.addPlacement('missing', { x: 0, y: 0 }))).toBe('MISSING_RESOURCE')
    expect(diagram.placements).toHaveLength(2)
    expect(workspace.getVersion()).toBe(before)
  })

  it('allows several Placements of one Resource, in one Diagram or two', () => {
    const { diagram, place, component, childOf } = setup()
    const first = place('user')
    const inner = childOf(component())
    const b = diagram.addPlacement(first.resourceId, { x: 1, y: 1 })
    const c = inner.addPlacement(first.resourceId, { x: 2, y: 2 })
    expect(new Set([first.id, b.id, c.id]).size).toBe(3)
    expect(diagram.countPlacementsOf(first.resourceId)).toEqual({ placements: 2, links: 0 })
    expect(inner.countPlacementsOf(first.resourceId)).toEqual({ placements: 1, links: 0 })
  })

  it('counts the Links attached to the Placements of a Resource', () => {
    const { diagram, place, component, definitionOf, workspace } = setup()
    const a = component()
    workspace.setPorts(a.resourceId, 'outputs', [{ name: 'o', typeId: null }])
    const p = place('user')
    const q = diagram.addPlacement(p.resourceId, { x: 3, y: 3 })
    diagram.addLink(a.id, p.id, definitionOf(a).outputs[0].id, 'left')
    expect(diagram.countPlacementsOf(p.resourceId)).toEqual({ placements: 2, links: 1 })
    diagram.removePlacement(p.id)
    expect(diagram.placements).toContain(q)
    expect(diagram.links).toHaveLength(0)
  })

  it('dropPlacementsOf removes every Placement of the Resource and its Links without notifying', () => {
    const { workspace, diagram, place } = setup()
    const p = place('user', 'u1')
    const q = place('user', 'u2')
    diagram.addLink(p.id, q.id, 'top', 'top')
    const before = workspace.getVersion()
    diagram.dropPlacementsOf(p.resourceId)
    expect(diagram.placements).toEqual([q])
    expect(diagram.links).toHaveLength(0)
    expect(workspace.getVersion()).toBe(before)
  })

  it('links Placement to Placement with the handle ids of each kind', () => {
    const { diagram, place } = setup()
    const db = place('database')
    const user = place('user')
    const link = diagram.addLink(db.id, user.id, 'read', 'left')
    expect([link.sourcePortId, link.targetPortId]).toEqual(['read', 'left'])
    diagram.addLink(user.id, db.id, 'top', 'write')
    expect(diagram.links).toHaveLength(2)
  })

  it('links a component output to a database write handle and a database read handle to a component input', () => {
    const { workspace, diagram, place, component, definitionOf } = setup()
    const a = component()
    workspace.setPorts(a.resourceId, 'outputs', [{ name: 'o', typeId: null }])
    workspace.setPorts(a.resourceId, 'inputs', [{ name: 'i', typeId: null }])
    const db = place('database')
    diagram.addLink(a.id, db.id, definitionOf(a).outputs[0].id, 'write')
    diagram.addLink(db.id, a.id, 'read', definitionOf(a).inputs[0].id)
    expect(diagram.links).toHaveLength(2)
  })

  it('rejects Links with a wrong handle, a self link or a node from another Diagram, and changes nothing', () => {
    const { workspace, diagram, place, component, childOf } = setup()
    const db = place('database')
    const user = place('user')
    const foreign = childOf(component()).addPlacement(user.resourceId, { x: 0, y: 0 })
    const before = workspace.getVersion()
    expect(code(() => diagram.addLink(db.id, user.id, 'write', 'top'))).toBe('INVALID_PORT')
    expect(code(() => diagram.addLink(user.id, db.id, 'top', 'read'))).toBe('INVALID_PORT')
    expect(code(() => diagram.addLink(db.id, user.id, 'read', 'nope'))).toBe('INVALID_PORT')
    expect(code(() => diagram.addLink(user.id, user.id, 'top', 'top'))).toBe('SELF_LINK')
    expect(code(() => diagram.addLink(user.id, 'missing', 'top', 'top'))).toBe('NOT_IN_DIAGRAM')
    expect(code(() => diagram.addLink(user.id, foreign.id, 'top', 'top'))).toBe('NOT_IN_DIAGRAM')
    expect(diagram.links).toHaveLength(0)
    expect(workspace.getVersion()).toBe(before)
  })

  it('addAll adds placements in one change', () => {
    const { workspace, diagram, place } = setup()
    const { resourceId } = place('user')
    const before = workspace.getVersion()
    const added = [new Placement('p1', resourceId, { x: 0, y: 0 }, () => {}), new Placement('p2', resourceId, { x: 1, y: 1 }, () => {})]
    diagram.addAll(added, [])
    expect(diagram.placements).toEqual([expect.anything(), ...added])
    expect(workspace.getVersion()).toBe(before + 1)
  })

  it('rejects a Placement that would nest a component in itself and changes nothing', () => {
    const { workspace, diagram, component, childOf } = setup()
    const a = component()
    const b = childOf(a).addPlacement(component().resourceId, { x: 0, y: 0 })
    const before = workspace.capture()
    // Direct: A inside A. Indirect: A inside B, where B is inside A.
    expect(code(() => childOf(a).addPlacement(a.resourceId, { x: 0, y: 0 }))).toBe('REFERENCE_CYCLE')
    expect(code(() => childOf(b).addPlacement(a.resourceId, { x: 0, y: 0 }))).toBe('REFERENCE_CYCLE')
    expect(workspace.capture()).toBe(before)
    // The same Resource in a sibling Diagram is fine.
    expect(() => diagram.addPlacement(a.resourceId, { x: 9, y: 9 })).not.toThrow()
  })

  it('removes a Link and stores the viewport', () => {
    const { workspace, diagram, component } = setup()
    const link = connect(workspace, diagram, component(), component({ x: 1, y: 1 }))
    diagram.removeLink(link.id)
    expect(diagram.links).toHaveLength(0)
    diagram.setViewport({ x: 5, y: 6, zoom: 2 })
    expect(diagram.viewport).toEqual({ x: 5, y: 6, zoom: 2 })
  })
})
