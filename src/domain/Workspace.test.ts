import { describe, expect, it } from 'vitest'
import { Workspace } from './Workspace'
import type { DiagramDto, WorkspaceSnapshot } from './WorkspaceSnapshot'

const details = (name: string) => ({ name, description: '', notes: '' })
const viewport = { x: 0, y: 0, zoom: 1 }
const emptyDiagram = (id: string): DiagramDto => ({ id, viewport, components: [], links: [] })

const snapshot: WorkspaceSnapshot = {
  schemaVersion: 1,
  root: {
    id: 'r',
    viewport,
    components: [
      { id: 'a', details: details('A'), position: { x: 1, y: 2 }, diagram: {
        id: 'ad',
        viewport,
        components: [{ id: 'b', details: details('B'), position: { x: 3, y: 4 }, diagram: emptyDiagram('bd') }],
        links: [],
      } },
    ],
    links: [],
  },
}

function restore() {
  let n = 0
  const workspace = Workspace.restore(snapshot, { next: () => `new${++n}` })
  return { workspace, nested: workspace.root.components[0].diagram.components[0] }
}

describe('Workspace.restore', () => {
  it('keeps stored ids and details', () => {
    const { workspace, nested } = restore()
    expect(workspace.root.id).toBe('r')
    expect(workspace.root.components[0].id).toBe('a')
    expect(nested.id).toBe('b')
    expect(nested.details.name).toBe('B')
  })

  it('notifies when a nested Component changes', () => {
    const { workspace, nested } = restore()
    const before = workspace.getVersion()
    nested.details.patch({ name: 'B2' })
    expect(workspace.getVersion()).toBeGreaterThan(before)
  })

  it('gives Components added after restore fresh ids', () => {
    const { workspace, nested } = restore()
    const added = nested.diagram.addComponent({ x: 0, y: 0 })
    const stored = ['r', 'a', 'ad', 'b', 'bd']
    expect(stored).not.toContain(added.id)
    expect(stored).not.toContain(added.diagram.id)
    expect(workspace.root.addComponent({ x: 0, y: 0 }).id).not.toBe(added.id)
  })
})
