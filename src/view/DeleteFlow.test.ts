import { describe, expect, it } from 'vitest'
import { ResourceRegistry } from '../domain/ResourceRegistry'
import { Diagram } from '../domain/Diagram'
import { DomainError } from '../domain/DomainError'
import { Workspace } from '../domain/Workspace'
import { connect } from '../domain/testing/connect'
import { DeleteFlow } from './DeleteFlow'

function setup() {
  let n = 0
  const diagram = new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => {}, resources: new ResourceRegistry() })
  return { diagram, flow: new DeleteFlow(Workspace.empty({ next: () => `w${++n}` })) }
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
    expect(flow.pending).toMatchObject({ subject: 'component', counts: { contents: 1, links: 0 } })
  })

  it('deletes a Component with links but no contents immediately, along with its links', () => {
    const { diagram, flow } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    connect(diagram, a, b)
    flow.request(diagram, { kind: 'component', id: a.id })
    expect(diagram.components).toEqual([b])
    expect(diagram.links).toHaveLength(0)
    expect(flow.pending).toBeNull()
  })

  it('confirm deletes the Component with its links and clears pending', () => {
    const { diagram, flow } = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    a.diagram.addComponent({ x: 0, y: 0 })
    connect(diagram, a, b)
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
    const link = connect(diagram, a, b)
    flow.request(diagram, { kind: 'link', id: link.id })
    expect(diagram.links).toHaveLength(0)
    expect(flow.pending).toBeNull()
  })

  describe('placements and resources', () => {
    function resourceSetup() {
      const workspace = Workspace.empty({ next: () => crypto.randomUUID() })
      const nested = workspace.root.addComponent({ x: 0, y: 0 })
      const first = workspace.createPlacedResource(workspace.root, { kind: 'user', name: 'Ann' }, { x: 0, y: 0 })
      const second = workspace.createPlacedResource(workspace.root, { kind: 'user', name: 'Bob' }, { x: 5, y: 5 })
      const other = nested.diagram.addPlacement(first.resourceId, { x: 1, y: 1 })
      workspace.root.addLink(first.id, second.id, 'right', 'left')
      return { workspace, flow: new DeleteFlow(workspace), first, second, other, nested }
    }

    it('deletes a Placement at once, keeping the Resource', () => {
      const { workspace, flow, first } = resourceSetup()
      flow.request(workspace.root, { kind: 'placement', id: first.id })
      expect(workspace.root.placements.map((p) => p.id)).not.toContain(first.id)
      expect(workspace.root.links).toHaveLength(0)
      expect(workspace.resources.get(first.resourceId)).toBeDefined()
      expect(flow.pending).toBeNull()
    })

    it('holds a Resource delete as pending with Placement and Link counts, changing nothing', () => {
      const { workspace, flow, first } = resourceSetup()
      flow.request(workspace.root, { kind: 'resource', id: first.resourceId })
      expect(flow.pending).toMatchObject({ subject: 'resource', counts: { placements: 2, links: 1 } })
      expect(workspace.resources.get(first.resourceId)).toBeDefined()
      expect(workspace.root.placements).toHaveLength(2)
    })

    it('cancel clears a pending Resource delete and leaves the model untouched', () => {
      const { workspace, flow, first } = resourceSetup()
      flow.request(workspace.root, { kind: 'resource', id: first.resourceId })
      flow.cancel()
      expect(flow.pending).toBeNull()
      expect(workspace.resources.get(first.resourceId)).toBeDefined()
      expect(workspace.root.placements).toHaveLength(2)
    })

    it('confirm removes the Resource from every Diagram as one notification', () => {
      const { workspace, flow, first, other, nested } = resourceSetup()
      flow.request(workspace.root, { kind: 'resource', id: first.resourceId })
      const before = workspace.getVersion()
      flow.confirm()
      expect(workspace.getVersion()).toBe(before + 1)
      expect(workspace.resources.get(first.resourceId)).toBeUndefined()
      expect(workspace.root.placements.map((p) => p.id)).not.toContain(first.id)
      expect(nested.diagram.placements.map((p) => p.id)).not.toContain(other.id)
      expect(workspace.root.links).toHaveLength(0)
      expect(flow.pending).toBeNull()
    })
  })

  it('throws DomainError for an unknown id and stays idle', () => {
    const { diagram, flow } = setup()
    expect(() => flow.request(diagram, { kind: 'component', id: 'missing' })).toThrow(DomainError)
    expect(() => flow.request(diagram, { kind: 'link', id: 'missing' })).toThrow(DomainError)
    expect(flow.pending).toBeNull()
  })
})
