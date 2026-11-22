import { describe, expect, it } from 'vitest'
import { DomainError } from '../domain/DomainError'
import { Workspace } from '../domain/Workspace'
import { connect } from '../domain/testing/connect'
import { DeleteFlow } from './DeleteFlow'

function setup() {
  const workspace = Workspace.empty({ next: () => crypto.randomUUID() })
  const diagram = workspace.root
  const place = (kind: 'component' | 'user', name: string, x = 0) =>
    workspace.createPlacedResource(diagram, { kind, name }, { x, y: 0 })
  return { workspace, diagram, place, flow: new DeleteFlow(workspace) }
}

describe('DeleteFlow', () => {
  it('deletes a Placement at once, deleting its last-instance Resource and removing attached Links', () => {
    const { workspace, diagram, place, flow } = setup()
    const a = place('component', 'A')
    const b = place('component', 'B', 1)
    connect(workspace, diagram, a, b)
    flow.request(diagram, { kind: 'placement', id: a.id })
    expect(diagram.placements.map((p) => p.id)).toEqual([b.id])
    expect(diagram.links).toHaveLength(0)
    expect(workspace.resources.get(a.resourceId)).toBeUndefined()
    expect(flow.pending).toBeNull()
  })

  it('deletes a Link directly without confirmation', () => {
    const { workspace, diagram, place, flow } = setup()
    const a = place('component', 'A')
    const b = place('component', 'B', 1)
    const link = connect(workspace, diagram, a, b)
    flow.request(diagram, { kind: 'link', id: link.id })
    expect(diagram.links).toHaveLength(0)
    expect(flow.pending).toBeNull()
  })

  describe('Resource deletion', () => {
    function resourceSetup() {
      const s = setup()
      const a = s.place('component', 'A')
      const b = s.place('component', 'B', 1)
      const inner = s.workspace.createPlacedResource(
        s.workspace.resources.get(a.resourceId)!.definition!.diagram,
        { kind: 'user', name: 'Ann' },
        { x: 0, y: 0 },
      )
      connect(s.workspace, s.diagram, a, b)
      return { ...s, a, b, inner }
    }

    it('holds the request as pending with counts and changes nothing', () => {
      const { workspace, diagram, flow, a, inner } = resourceSetup()
      flow.request(diagram, { kind: 'resource', id: a.resourceId })
      expect(flow.pending?.counts).toEqual({ placements: 1, links: 1, contents: { nodes: 1, links: 0 } })
      expect(workspace.resources.get(a.resourceId)).toBeDefined()
      expect(workspace.resources.get(inner.resourceId)).toBeDefined()
      expect(diagram.placements).toHaveLength(2)
    })

    it('cancel clears pending and leaves the Workspace unchanged', () => {
      const { workspace, diagram, flow, a } = resourceSetup()
      const before = JSON.stringify(workspace.toSnapshot())
      flow.request(diagram, { kind: 'resource', id: a.resourceId })
      flow.cancel()
      expect(flow.pending).toBeNull()
      expect(JSON.stringify(workspace.toSnapshot())).toBe(before)
    })

    it('confirm removes the Resource and its Placements and Resources placed only inside it', () => {
      const { workspace, diagram, flow, a, b, inner } = resourceSetup()
      flow.request(diagram, { kind: 'resource', id: a.resourceId })
      flow.confirm()
      expect(workspace.resources.get(a.resourceId)).toBeUndefined()
      expect(workspace.resources.get(inner.resourceId)).toBeUndefined()
      expect(diagram.placements.map((p) => p.id)).not.toContain(a.id)
      expect(diagram.placements.map((p) => p.id)).toContain(b.id)
      expect(diagram.links).toHaveLength(0)
      expect(flow.pending).toBeNull()
    })
  })

  it('throws DomainError for an unknown Link or Resource id and stays idle', () => {
    const { diagram, flow } = setup()
    expect(() => flow.request(diagram, { kind: 'resource', id: 'missing' })).toThrow(DomainError)
    expect(() => flow.request(diagram, { kind: 'link', id: 'missing' })).toThrow(DomainError)
    expect(flow.pending).toBeNull()
  })
})
