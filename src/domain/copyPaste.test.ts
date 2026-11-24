import { describe, expect, it } from 'vitest'
import type { IdGenerator } from './IdGenerator'
import { connect } from './testing/connect'
import { Workspace } from './Workspace'

function setup() {
  let n = 0
  const ids: IdGenerator = { next: () => `id${n++}` }
  const workspace = Workspace.empty(ids)
  const root = workspace.root
  const component = (x = 0, y = 0) => workspace.createPlacedResource(root, { kind: 'component', name: '' }, { x, y })
  return { workspace, root, component }
}

describe('Workspace moveIntoComponent', () => {
  const origin = { x: 160, y: 0 }

  it('moves Placements and the Links between them, keeping layout and Resources', () => {
    const { workspace, root, component } = setup()
    const target = component()
    const a = workspace.createPlacedResource(root, { kind: 'user', name: 'a' }, { x: 300, y: 200 })
    const b = workspace.createPlacedResource(root, { kind: 'user', name: 'b' }, { x: 400, y: 230 })
    root.addLink(a.id, b.id, 'right', 'left')
    const inner = workspace.resources.get(target.resourceId)!.definition!.diagram
    const resources = workspace.resources.all.length
    const moved = workspace.moveIntoComponent(root, new Set([a.id, b.id]), target.id, origin)
    expect(root.placements.map((p) => p.id)).toEqual([target.id])
    expect(inner.placements.map((p) => p.resourceId)).toEqual([a.resourceId, b.resourceId])
    expect(moved.map((p) => p.position)).toEqual([{ x: 160, y: 0 }, { x: 260, y: 30 }])
    expect(inner.links).toHaveLength(1)
    expect(root.links).toHaveLength(0)
    expect(workspace.resources.all).toHaveLength(resources)
  })

  it('drops Links to Placements that stay behind', () => {
    const { workspace, root, component } = setup()
    const target = component()
    const a = workspace.createPlacedResource(root, { kind: 'user', name: 'a' }, { x: 300, y: 0 })
    const b = workspace.createPlacedResource(root, { kind: 'user', name: 'b' }, { x: 400, y: 0 })
    root.addLink(a.id, b.id, 'right', 'left')
    const inner = workspace.resources.get(target.resourceId)!.definition!.diagram
    workspace.moveIntoComponent(root, new Set([a.id]), target.id, origin)
    expect(root.links).toHaveLength(0)
    expect(inner.links).toHaveLength(0)
  })

  it('ignores the component itself in the selection', () => {
    const { workspace, root, component } = setup()
    const target = component()
    expect(workspace.moveIntoComponent(root, new Set([target.id]), target.id, origin)).toEqual([])
    expect(root.placements).toHaveLength(1)
  })

  it('rejects a move that would make a component contain itself, changing nothing', () => {
    const { workspace, root, component } = setup()
    const outer = component()
    const inner = workspace.resources.get(outer.resourceId)!.definition!.diagram
    const nested = workspace.createPlacedResource(inner, { kind: 'component', name: '' }, { x: 0, y: 0 })
    // `nested` also sits on root, and `outer` already contains it, so moving `outer` into it closes a loop.
    const nestedOnRoot = workspace.paste(root, workspace.copy(inner, new Set([nested.id])), { x: 0, y: 0 }).placements[0]
    expect(() => workspace.moveIntoComponent(root, new Set([outer.id]), nestedOnRoot.id, origin)).toThrow(/contain itself/)
    expect(root.placements).toHaveLength(2)
  })

  it('refuses a target that is not a component', () => {
    const { workspace, root } = setup()
    const a = workspace.createPlacedResource(root, { kind: 'user', name: 'a' }, { x: 0, y: 0 })
    const b = workspace.createPlacedResource(root, { kind: 'user', name: 'b' }, { x: 0, y: 0 })
    expect(() => workspace.moveIntoComponent(root, new Set([a.id]), b.id, origin)).toThrow()
  })
})

describe('Workspace copy and paste', () => {
  it('keeps only Links between copied Placements', () => {
    const { workspace, root, component } = setup()
    const a = component()
    const b = component(10)
    const c = component(20)
    connect(workspace, root, a, b)
    connect(workspace, root, b, c)
    const fragment = workspace.copy(root, new Set([a.id, b.id]))
    expect(fragment.placements).toHaveLength(2)
    expect(fragment.links).toHaveLength(1)
  })

  it('pastes with new ids, an offset, and re-attached Links', () => {
    const { workspace, root, component } = setup()
    const a = component(5, 6)
    const b = component(10)
    connect(workspace, root, a, b)
    const { placements, links } = workspace.paste(root, workspace.copy(root, new Set([a.id, b.id])), { x: 24, y: 24 })
    expect(root.placements).toHaveLength(4)
    expect(new Set(root.placements.map((p) => p.id)).size).toBe(4)
    expect(placements[0].position).toEqual({ x: 29, y: 30 })
    expect(links[0].sourceId).toBe(placements[0].id)
    expect(links[0].targetId).toBe(placements[1].id)
    expect(root.links).toHaveLength(2)
  })

  it('shifts the bend points of a pasted Link with its Placements', () => {
    const { workspace, root, component } = setup()
    const a = component()
    const b = component(10)
    connect(workspace, root, a, b).setWaypoints([{ x: 3, y: 4 }])
    const { links } = workspace.paste(root, workspace.copy(root, new Set([a.id, b.id])), { x: 24, y: 24 })
    expect(links[0].waypoints).toEqual([{ x: 27, y: 28 }])
    expect(root.links[0].waypoints).toEqual([{ x: 3, y: 4 }])
  })

  it('pastes a component Placement as another Placement of the same Resource, copying no Diagram', () => {
    const { workspace, root, component } = setup()
    const a = component()
    const inner = workspace.resources.get(a.resourceId)!.definition!.diagram
    workspace.createPlacedResource(inner, { kind: 'component', name: '' }, { x: 1, y: 1 })
    const resources = workspace.resources.all.length
    const diagrams = workspace.allDiagrams().length
    const [pasted] = workspace.paste(root, workspace.copy(root, new Set([a.id])), { x: 1, y: 1 }).placements
    expect(pasted.id).not.toBe(a.id)
    expect(pasted.resourceId).toBe(a.resourceId)
    expect(workspace.resources.all).toHaveLength(resources)
    expect(workspace.allDiagrams()).toHaveLength(diagrams)
    expect(inner.placements).toHaveLength(1)
  })

  it('pastes Placements with new ids and the same resourceId', () => {
    const { workspace, root } = setup()
    const p = workspace.createPlacedResource(root, { kind: 'user', name: 'Ann' }, { x: 0, y: 0 })
    const fragment = workspace.copy(root, new Set([p.id]))
    expect(fragment.placements).toHaveLength(1)
    const pasted = workspace.paste(root, fragment, { x: 24, y: 24 }).placements[0]
    expect(pasted.id).not.toBe(p.id)
    expect(pasted.resourceId).toBe(p.resourceId)
    expect(root.placements).toHaveLength(2)
    expect(workspace.resources.all).toHaveLength(1)
  })

  it('keeps Link port ids when a Placement of a database and a component are pasted together', () => {
    const { workspace, root, component } = setup()
    const a = component()
    workspace.setPorts(a.resourceId, 'inputs', [{ name: 'in', typeId: null }])
    const p = workspace.createPlacedResource(root, { kind: 'database', name: 'db' }, { x: 50, y: 0 })
    const input = workspace.resources.get(a.resourceId)!.definition!.inputs[0]
    const link = root.addLink(p.id, a.id, 'right', input.id)
    const fragment = workspace.copy(root, new Set([a.id, p.id]))
    expect(fragment.links).toHaveLength(1)
    const pasted = workspace.paste(root, fragment, { x: 24, y: 24 })
    expect(pasted.links[0].id).not.toBe(link.id)
    expect(pasted.links[0].sourcePortId).toBe('right')
    expect(pasted.links[0].targetPortId).toBe(link.targetPortId)
  })

  it('rejects a paste after the Resource was deleted and changes nothing', () => {
    const { workspace, root } = setup()
    const p = workspace.createPlacedResource(root, { kind: 'user', name: 'Ann' }, { x: 0, y: 0 })
    const fragment = workspace.copy(root, new Set([p.id]))
    workspace.removeResource(p.resourceId)
    expect(() => workspace.paste(root, fragment, { x: 1, y: 1 })).toThrowError(
      expect.objectContaining({ code: 'MISSING_RESOURCE' }),
    )
    expect(root.placements).toHaveLength(0)
  })

  it('rejects pasting a component into its own Diagram, directly or through a nested component, and changes nothing', () => {
    const { workspace, root, component } = setup()
    const a = component()
    const inner = workspace.resources.get(a.resourceId)!.definition!.diagram
    const nested = workspace.createPlacedResource(inner, { kind: 'component', name: '' }, { x: 0, y: 0 })
    const nestedDiagram = workspace.resources.get(nested.resourceId)!.definition!.diagram
    const fragment = workspace.copy(root, new Set([a.id]))
    const before = workspace.capture()
    const version = workspace.getVersion()
    const reject = (target: typeof inner) =>
      expect(() => workspace.paste(target, fragment, { x: 1, y: 1 })).toThrowError(expect.objectContaining({ code: 'REFERENCE_CYCLE' }))
    reject(inner)
    reject(nestedDiagram)
    expect(workspace.capture()).toBe(before)
    expect(workspace.getVersion()).toBe(version)
  })

  it('rejects the whole paste when only one of several Placements closes a cycle', () => {
    const { workspace, root, component } = setup()
    const a = component()
    const user = workspace.createPlacedResource(root, { kind: 'user', name: 'U' }, { x: 5, y: 5 })
    const inner = workspace.resources.get(a.resourceId)!.definition!.diagram
    const fragment = workspace.copy(root, new Set([a.id, user.id]))
    expect(() => workspace.paste(inner, fragment, { x: 1, y: 1 })).toThrowError(expect.objectContaining({ code: 'REFERENCE_CYCLE' }))
    expect(inner.placements).toHaveLength(0)
  })

  it('does not change the copy when the original is edited afterwards', () => {
    const { workspace, root } = setup()
    const p = workspace.createPlacedResource(root, { kind: 'user', name: 'Ann' }, { x: 0, y: 0 })
    const fragment = workspace.copy(root, new Set([p.id]))
    p.setPosition({ x: 99, y: 99 })
    expect(workspace.paste(root, fragment, { x: 1, y: 1 }).placements[0].position).toEqual({ x: 1, y: 1 })
  })
})
