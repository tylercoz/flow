import { describe, expect, it } from 'vitest'
import { ResourceRegistry } from '../domain/ResourceRegistry'
import { Resource } from '../domain/Resource'
import { RESOURCE_KINDS, type ResourceKind } from '../domain/ResourceKinds'
import { Diagram } from '../domain/Diagram'
import { connect } from '../domain/testing/connect'
import { toEdges, toNodes } from './DiagramProjector'

function setup() {
  let n = 0
  return new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => {}, resources: new ResourceRegistry() })
}

function setupWithResources() {
  const resources = new ResourceRegistry()
  let n = 0
  const diagram = new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => {}, resources })
  return { diagram, resources }
}

function addResource(resources: ResourceRegistry, id: string, kind: ResourceKind, typeId: string | null) {
  const resource = new Resource(id, kind, id, typeId, () => {})
  resources.add(resource)
  return resource
}

describe('DiagramProjector', () => {
  it('projects an empty Diagram to no nodes or edges', () => {
    const diagram = setup()
    expect(toNodes(diagram)).toEqual([])
    expect(toEdges(diagram)).toEqual([])
  })

  it('never fixes a node size, so a resized Component can still grow with its content', () => {
    const diagram = setup()
    diagram.addComponent({ x: 0, y: 0 }).setBounds({ x: 5, y: 6 }, { width: 200, height: 80 })
    const [node] = toNodes(diagram)
    expect(node.position).toEqual({ x: 5, y: 6 })
    expect(node).not.toHaveProperty('width')
    expect(node).not.toHaveProperty('height')
  })
  it('projects one node per Component with matching id and position, and no label', () => {
    const diagram = setup()
    const a = diagram.addComponent({ x: 1, y: 2 })
    const b = diagram.addComponent({ x: 3, y: 4 })
    a.details.patch({ name: 'A' })
    a.diagram.addComponent({ x: 0, y: 0 })

    const nodes = toNodes(diagram)
    expect(nodes.map((x) => x.id)).toEqual([a.id, b.id])
    expect(nodes[0].position).toEqual({ x: 1, y: 2 })
    expect(nodes[0].data).toEqual({})
    expect(nodes.every((x) => x.type === 'component')).toBe(true)
    expect(nodes[0].parentId).toBeUndefined()
  })

  it('projects one edge per Link with matching id, endpoints and the link edge type, without a label', () => {
    const diagram = setup()
    const a = diagram.addComponent({ x: 0, y: 0 })
    const b = diagram.addComponent({ x: 1, y: 1 })
    const named = connect(diagram, a, b)
    const unnamed = connect(diagram, b, a)
    named.details.patch({ name: 'calls' })

    const edges = toEdges(diagram)
    expect(edges.map((e) => e.id)).toEqual([named.id, unnamed.id])
    expect(edges[0]).toMatchObject({ source: a.id, target: b.id, type: 'link' })
    expect(edges[1]).toMatchObject({ source: b.id, target: a.id })
    expect(edges.every((e) => e.label === undefined)).toBe(true)
    expect(edges.every((e) => e.markerEnd && typeof e.markerEnd === 'object' && e.markerEnd.type === 'arrowclosed')).toBe(true)
  })

  it('projects each Placement as a resource node carrying its resourceId, after the Component nodes', () => {
    const { diagram, resources } = setupWithResources()
    const db = addResource(resources, 'r1', 'database', null)
    const component = diagram.addComponent({ x: 0, y: 0 })
    const placement = diagram.addPlacement(db.id, { x: 7, y: 8 })

    const nodes = toNodes(diagram)
    expect(nodes.map((n) => n.id)).toEqual([component.id, placement.id])
    expect(nodes[1]).toMatchObject({ type: 'resource', position: { x: 7, y: 8 }, data: { resourceId: 'r1' } })
  })

  it('passes stored port ids as edge handle ids for Component, database and four-sided ends', () => {
    const { diagram, resources } = setupWithResources()
    const db = addResource(resources, 'r1', 'database', null)
    const user = addResource(resources, 'r2', 'user', null)
    const component = diagram.addComponent({ x: 0, y: 0 })
    diagram.setPorts(component.id, 'outputs', [{ name: 'out', typeId: null }])
    const output = component.details.outputs[0]
    const store = diagram.addPlacement(db.id, { x: 0, y: 0 })
    const person = diagram.addPlacement(user.id, { x: 0, y: 0 })

    const toDb = diagram.addLink(component.id, store.id, output.id, 'write')
    const fromDb = diagram.addLink(store.id, person.id, 'read', 'left')

    const edges = toEdges(diagram)
    expect(edges.find((e) => e.id === toDb.id)).toMatchObject({ sourceHandle: output.id, targetHandle: 'write' })
    expect(edges.find((e) => e.id === fromDb.id)).toMatchObject({ sourceHandle: 'read', targetHandle: 'left' })
  })

  // PlacementNode renders its Handles from these same constants, so this pins the ids it exposes per kind.
  it.each([
    ['database', ['read'], ['write']],
    ['user', ['top', 'right', 'bottom', 'left'], ['top', 'right', 'bottom', 'left']],
    ['artifact', ['top', 'right', 'bottom', 'left'], ['top', 'right', 'bottom', 'left']],
    ['input-object', ['top', 'right', 'bottom', 'left'], ['top', 'right', 'bottom', 'left']],
  ] as const)('%s exposes the expected source and target handle ids', (kind, sources, targets) => {
    expect([...RESOURCE_KINDS[kind].sourceIds]).toEqual(sources)
    expect([...RESOURCE_KINDS[kind].targetIds]).toEqual(targets)
  })
})
