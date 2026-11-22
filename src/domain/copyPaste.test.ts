import { describe, expect, it } from 'vitest'
import type { IdGenerator } from './IdGenerator'
import { connect } from './testing/connect'
import { Workspace } from './Workspace'

function setup() {
  let n = 0
  const ids: IdGenerator = { next: () => `id${n++}` }
  const workspace = Workspace.empty(ids)
  return { workspace, root: workspace.root }
}

describe('Workspace copy and paste', () => {
  it('keeps only Links between copied Components', () => {
    const { workspace, root } = setup()
    const a = root.addComponent({ x: 0, y: 0 })
    const b = root.addComponent({ x: 10, y: 0 })
    const c = root.addComponent({ x: 20, y: 0 })
    connect(root, a, b)
    connect(root, b, c)
    const fragment = workspace.copy(root, new Set([a.id, b.id]))
    expect(fragment.components).toHaveLength(2)
    expect(fragment.links).toHaveLength(1)
  })

  it('pastes with new ids, an offset, and re-attached Links', () => {
    const { workspace, root } = setup()
    const a = root.addComponent({ x: 5, y: 6 })
    const b = root.addComponent({ x: 10, y: 0 })
    connect(root, a, b)
    const { components, links } = workspace.paste(root, workspace.copy(root, new Set([a.id, b.id])), { x: 24, y: 24 })
    expect(root.components).toHaveLength(4)
    expect(new Set(root.components.map((c) => c.id)).size).toBe(4)
    expect(components[0].position).toEqual({ x: 29, y: 30 })
    expect(links[0].sourceId).toBe(components[0].id)
    expect(links[0].targetId).toBe(components[1].id)
    expect(root.links).toHaveLength(2)
  })

  it('copies nested content with new ids', () => {
    const { workspace, root } = setup()
    const a = root.addComponent({ x: 0, y: 0 })
    a.diagram.addComponent({ x: 1, y: 1 })
    const { components } = workspace.paste(root, workspace.copy(root, new Set([a.id])), { x: 1, y: 1 })
    expect(components[0].diagram.components).toHaveLength(1)
    expect(components[0].diagram.id).not.toBe(a.diagram.id)
    expect(components[0].diagram.components[0].id).not.toBe(a.diagram.components[0].id)
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

  it('keeps Link port ids when a Placement and a Component are pasted together', () => {
    const { workspace, root } = setup()
    const a = root.addComponent({ x: 0, y: 0 })
    root.setPorts(a.id, 'inputs', [{ name: 'in', typeId: null }])
    const p = workspace.createPlacedResource(root, { kind: 'database', name: 'db' }, { x: 50, y: 0 })
    const link = root.addLink(p.id, a.id, 'read', a.details.inputs[0].id)
    const fragment = workspace.copy(root, new Set([a.id, p.id]))
    expect(fragment.links).toHaveLength(1)
    const pasted = workspace.paste(root, fragment, { x: 24, y: 24 })
    expect(pasted.links[0].id).not.toBe(link.id)
    expect(pasted.links[0].sourcePortId).toBe('read')
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

  it('does not change the copy when the original is edited afterwards', () => {
    const { workspace, root } = setup()
    const a = root.addComponent({ x: 0, y: 0 })
    a.details.patch({ name: 'before' })
    const fragment = workspace.copy(root, new Set([a.id]))
    a.details.patch({ name: 'after' })
    expect(workspace.paste(root, fragment, { x: 1, y: 1 }).components[0].details.name).toBe('before')
  })
})
