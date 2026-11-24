import { describe, expect, it } from 'vitest'
import { DomainError } from './DomainError'
import { History } from './History'
import { connect } from './testing/connect'
import { Workspace } from './Workspace'
import type { DiagramDto, ResourceDto, WorkspaceSnapshot } from './WorkspaceSnapshot'

const viewport = { x: 0, y: 0, zoom: 1 }
const diagramDto = (id: string, placements: DiagramDto['placements'] = []): DiagramDto => ({ id, viewport, placements, links: [] })
const componentDto = (id: string, name: string, diagram: DiagramDto): ResourceDto => ({
  id,
  kind: 'component',
  name,
  typeId: null,
  component: { inputs: [], outputs: [], portNodes: [], notes: '', exceptionIds: [], environmentVariableIds: [], diagram },
})

const snapshot: WorkspaceSnapshot = {
  schemaVersion: 15,
  project: { name: 'P', description: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  types: [],
  exceptions: [],
  environmentVariables: [],
  resources: [
    componentDto('ra', 'A', diagramDto('ad', [{ id: 'pb', resourceId: 'rb', position: { x: 3, y: 4 } }])),
    componentDto('rb', 'B', diagramDto('bd')),
  ],
  diagrams: [{ name: 'D', diagram: diagramDto('r', [{ id: 'pa', resourceId: 'ra', position: { x: 1, y: 2 } }]) }],
}

function restore() {
  let n = 0
  const workspace = Workspace.restore(snapshot, { next: () => `new${++n}` })
  const a = workspace.resources.get('ra')!.definition!
  const b = workspace.resources.get('rb')!.definition!
  return { workspace, a, b }
}

describe('Workspace.restore', () => {
  it('keeps stored ids and names', () => {
    const { workspace, a } = restore()
    expect(workspace.root.id).toBe('r')
    expect(workspace.root.placements[0].id).toBe('pa')
    expect(a.diagram.placements[0].id).toBe('pb')
    expect(workspace.resources.get('rb')!.name).toBe('B')
  })

  it('notifies when a nested component Resource changes', () => {
    const { workspace, b } = restore()
    const before = workspace.getVersion()
    b.setNotes('changed')
    expect(workspace.getVersion()).toBeGreaterThan(before)
  })

  it('gives Placements and Resources added after restore fresh ids', () => {
    const { workspace, b } = restore()
    const added = workspace.createPlacedResource(b.diagram, { kind: 'component', name: '' }, { x: 0, y: 0 })
    const stored = ['r', 'ra', 'rb', 'ad', 'bd', 'pa', 'pb']
    expect(stored).not.toContain(added.id)
    expect(stored).not.toContain(added.resourceId)
    expect(stored).not.toContain(workspace.resources.get(added.resourceId)!.definition!.diagram.id)
  })

  it('lists the root and every component Diagram, placed or not', () => {
    const { workspace } = restore()
    expect(workspace.allDiagrams().map((d) => d.id)).toEqual(['r', 'ad', 'bd'])
  })
})

describe('Workspace types', () => {
  const empty = () => {
    let n = 0
    return Workspace.empty({ next: () => `t${++n}` })
  }
  it('starts with number, string and boolean', () => {
    expect(empty().types.map((t) => t.name)).toEqual(['number', 'string', 'boolean'])
  })
  it('adds, renames and removes an unused type, notifying each time', () => {
    const ws = empty()
    const before = ws.getVersion()
    const type = ws.addType('date')
    ws.renameType(type.id, 'timestamp')
    expect(ws.types.at(-1)).toEqual({ id: type.id, name: 'timestamp' })
    ws.removeType(type.id)
    expect(ws.types.some((t) => t.id === type.id)).toBe(false)
    expect(ws.getVersion()).toBe(before + 3)
  })
  it('refuses to remove a type used by the port of a nested component or of another component', () => {
    const ws = empty()
    const [number, string] = ws.types
    const parent = ws.createPlacedResource(ws.root, { kind: 'component', name: 'P' }, { x: 0, y: 0 })
    const parentDiagram = ws.resources.get(parent.resourceId)!.definition!.diagram
    const nested = ws.createPlacedResource(parentDiagram, { kind: 'component', name: 'N' }, { x: 0, y: 0 })
    ws.setPorts(nested.resourceId, 'inputs', [{ name: 'a', typeId: number.id }])
    const other = ws.createPlacedResource(ws.root, { kind: 'component', name: 'O' }, { x: 1, y: 1 })
    ws.setPorts(other.resourceId, 'outputs', [{ name: 'b', typeId: string.id }])
    expect(() => ws.removeType(number.id)).toThrow(DomainError)
    expect(() => ws.removeType(string.id)).toThrow(DomainError)
    ws.setPorts(nested.resourceId, 'inputs', [])
    ws.removeType(number.id)
    expect(ws.types.some((t) => t.id === number.id)).toBe(false)
  })
  it('removing a port drops its port node Links and position in one change', () => {
    const ws = empty()
    const outer = ws.createPlacedResource(ws.root, { kind: 'component', name: 'O' }, { x: 0, y: 0 })
    ws.setPorts(outer.resourceId, 'inputs', [{ name: 'a', typeId: null }, { name: 'b', typeId: null }])
    const def = ws.resources.get(outer.resourceId)!.definition!
    const [a, b] = def.inputs
    const nodeOf = (portId: string) => def.portPlacements.find((n) => n.portId === portId)!
    const [nodeA, nodeB] = [nodeOf(a.id), nodeOf(b.id)]
    const inner = ws.createPlacedResource(def.diagram, { kind: 'database', name: 'D' }, { x: 0, y: 0 })
    def.diagram.addLink(nodeA.id, inner.id, 'right', 'left')
    def.diagram.addLink(nodeB.id, inner.id, 'right', 'left')
    const before = ws.getVersion()
    ws.setPorts(outer.resourceId, 'inputs', [b])
    expect(def.diagram.links.map((l) => l.sourceId)).toEqual([nodeB.id])
    expect(def.portPlacement(nodeA.id)).toBeUndefined()
    expect(ws.getVersion()).toBe(before + 1)
  })
  it('keeps a port node position through an undo-style content replacement', () => {
    const ws = empty()
    const outer = ws.createPlacedResource(ws.root, { kind: 'component', name: 'O' }, { x: 0, y: 0 })
    ws.setPorts(outer.resourceId, 'outputs', [{ name: 'a', typeId: null }])
    const def = ws.resources.get(outer.resourceId)!.definition!
    const node = def.portPlacements[0]
    def.setPortPlacementPosition(node.id, { x: 7, y: 8 })
    ws.replaceContent(ws.capture())
    expect(ws.resources.get(outer.resourceId)!.definition!.portPlacement(node.id)?.position).toEqual({ x: 7, y: 8 })
  })
})

describe('Workspace snapshots', () => {
  const fresh = () => {
    let n = 0
    return Workspace.empty({ next: () => `w${++n}` })
  }

  it('replaceContent rebuilds types and notifies once', () => {
    const ws = fresh()
    const before = ws.capture()
    ws.addType('date')
    ws.renameType(ws.types[0].id, 'num')
    const after = ws.capture()
    ws.replaceContent(before)
    expect(ws.types.map((t) => t.name)).toEqual(['number', 'string', 'boolean'])
    const version = ws.getVersion()
    ws.replaceContent(after)
    expect(ws.types.map((t) => t.name)).toEqual(['num', 'string', 'boolean', 'date'])
    expect(ws.getVersion()).toBe(version + 1)
  })

  it('capture ignores viewport changes', () => {
    const ws = fresh()
    const before = ws.capture()
    ws.root.setViewport({ x: 10, y: 20, zoom: 2 })
    expect(ws.capture()).toBe(before)
    ws.createPlacedResource(ws.root, { kind: 'component', name: '' }, { x: 0, y: 0 })
    expect(ws.capture()).not.toBe(before)
  })

  it('replaceContent keeps the current viewport of Diagrams that still exist', () => {
    const ws = fresh()
    const snap = ws.capture()
    ws.root.setViewport({ x: 5, y: 6, zoom: 3 })
    ws.replaceContent(snap)
    expect(ws.root.viewport).toEqual({ x: 5, y: 6, zoom: 3 })
  })

  it('gives a deleted-then-restored Diagram the neutral viewport', () => {
    const ws = fresh()
    const placement = ws.createPlacedResource(ws.root, { kind: 'component', name: '' }, { x: 0, y: 0 })
    const { diagram } = ws.resources.get(placement.resourceId)!.definition!
    diagram.setViewport({ x: 9, y: 9, zoom: 4 })
    const withComponent = ws.capture()
    ws.removeResource(placement.resourceId)
    ws.replaceContent(withComponent)
    const restored = ws.allDiagrams().find((d) => d.id === diagram.id)
    expect(restored?.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

// Component Resources, each with a Placement in the root; `inner` is placed inside `outer`'s Diagram.
function setupComponents() {
  let n = 0
  const workspace = Workspace.empty({ next: () => `x${++n}` })
  const make = (diagram = workspace.root) => {
    const placement = workspace.createPlacedResource(diagram, { kind: 'component', name: '' }, { x: 0, y: 0 })
    return workspace.resources.get(placement.resourceId)!.definition!
  }
  const outer = make()
  const other = make()
  const inner = make(outer.diagram)
  return { workspace, outer, other, inner }
}

describe('Workspace environment variables', () => {
  it('adds and renames catalog entries', () => {
    const { workspace } = setupComponents()
    const v = workspace.addEnvironmentVariable('DATABASE_URL')
    workspace.renameEnvironmentVariable(v.id, 'DB_URL')
    expect(workspace.environmentVariables).toEqual([{ id: v.id, name: 'DB_URL' }])
  })
  it('stores each variable once per component and notifies once', () => {
    const { workspace, outer } = setupComponents()
    const v = workspace.addEnvironmentVariable('API_KEY')
    const before = workspace.getVersion()
    outer.setEnvironmentVariables([v.id, v.id])
    expect(outer.environmentVariableIds).toEqual([v.id])
    expect(workspace.getVersion()).toBe(before + 1)
  })
  it('counts and removes uses at every nesting level', () => {
    const { workspace, outer, other, inner } = setupComponents()
    const v = workspace.addEnvironmentVariable('API_KEY')
    const keep = workspace.addEnvironmentVariable('KEEP')
    ;[outer, other, inner].forEach((c) => c.setEnvironmentVariables([v.id, keep.id]))
    expect(workspace.environmentVariableUsage(v.id)).toBe(3)
    workspace.removeEnvironmentVariable(v.id)
    expect(workspace.environmentVariableUsage(v.id)).toBe(0)
    expect(workspace.environmentVariables.map((x) => x.id)).toEqual([keep.id])
    expect([outer, other, inner].map((c) => c.environmentVariableIds)).toEqual([[keep.id], [keep.id], [keep.id]])
  })
  it('removes a variable from many components as one undo step', () => {
    const { workspace, outer, other, inner } = setupComponents()
    const v = workspace.addEnvironmentVariable('API_KEY')
    ;[outer, other, inner].forEach((c) => c.setEnvironmentVariables([v.id]))
    const history = new History(workspace, { reconcile: () => {} })
    history.start()
    workspace.removeEnvironmentVariable(v.id)
    history.undo()
    // History started after the setup, so an empty stack means the removal was exactly one step.
    expect(history.canUndo).toBe(false)
    expect(workspace.environmentVariables).toEqual([v])
    expect(workspace.environmentVariableUsage(v.id)).toBe(3)
  })
})

describe('Workspace exceptions', () => {
  it('adds and renames catalog entries', () => {
    const { workspace } = setupComponents()
    const e = workspace.addException('NotFound')
    workspace.renameException(e.id, 'Missing')
    expect(workspace.exceptions).toEqual([{ id: e.id, name: 'Missing' }])
  })

  it('stores each exception once per component and notifies once', () => {
    const { workspace, outer } = setupComponents()
    const e = workspace.addException('NotFound')
    const before = workspace.getVersion()
    outer.setExceptions([e.id, e.id])
    expect(outer.exceptionIds).toEqual([e.id])
    expect(workspace.getVersion()).toBe(before + 1)
  })

  it('counts and removes uses at every nesting level', () => {
    const { workspace, outer, other, inner } = setupComponents()
    const e = workspace.addException('Timeout')
    const keep = workspace.addException('Keep')
    ;[outer, other, inner].forEach((c) => c.setExceptions([e.id, keep.id]))
    expect(workspace.exceptionUsage(e.id)).toBe(3)
    workspace.removeException(e.id)
    expect(workspace.exceptionUsage(e.id)).toBe(0)
    expect(workspace.exceptions.map((x) => x.id)).toEqual([keep.id])
    expect([outer, other, inner].map((c) => c.exceptionIds)).toEqual([[keep.id], [keep.id], [keep.id]])
  })

  it('removes an exception from many components as one undo step', () => {
    const { workspace, outer, other, inner } = setupComponents()
    const e = workspace.addException('Timeout')
    ;[outer, other, inner].forEach((c) => c.setExceptions([e.id]))
    const history = new History(workspace, { reconcile: () => {} })
    history.start()
    workspace.removeException(e.id)
    history.undo()
    // History started after the setup, so an empty stack means the removal was exactly one step.
    expect(history.canUndo).toBe(false)
    expect(workspace.exceptions).toEqual([e])
    expect(workspace.exceptionUsage(e.id)).toBe(3)
  })

  it('reverts setExceptions with undo', () => {
    const { workspace, outer } = setupComponents()
    const e = workspace.addException('NotFound')
    const history = new History(workspace, { reconcile: () => {} })
    history.start()
    outer.setExceptions([e.id])
    history.undo()
    expect(workspace.componentResources()[0].definition!.exceptionIds).toEqual([])
  })
})

describe('Workspace resources', () => {
  const setup = () => {
    let n = 0
    const workspace = Workspace.empty({ next: () => `x${++n}` })
    const holder = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'Holder' }, { x: 0, y: 0 })
    const nested = workspace.resources.get(holder.resourceId)!.definition!.diagram
    return { workspace, nested }
  }
  const code = (c: string) => expect.objectContaining({ code: c })

  it('creates a typed resource and its placement in one notification', () => {
    const { workspace } = setup()
    const before = workspace.getVersion()
    const placement = workspace.createPlacedResource(workspace.root, { kind: 'artifact', name: 'Invoice', typeId: workspace.types[0].id }, { x: 1, y: 2 })
    expect(workspace.getVersion()).toBe(before + 1)
    expect(workspace.resources.get(placement.resourceId)?.typeId).toBe(workspace.types[0].id)
  })

  it('records creating a component Resource and its Placement as one undo step', () => {
    const { workspace } = setup()
    const history = new History(workspace, { reconcile: () => {} })
    history.start()
    const placement = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'New' }, { x: 4, y: 5 })
    expect(placement.position).toEqual({ x: 4, y: 5 })
    history.undo()
    expect(history.canUndo).toBe(false)
    expect(workspace.resources.get(placement.resourceId)).toBeUndefined()
    expect(workspace.root.placement(placement.id)).toBeUndefined()
  })

  it('rejects a typed resource when the catalog is empty, creating nothing', () => {
    const { workspace } = setup()
    workspace.types.slice().forEach((t) => workspace.removeType(t.id))
    const before = workspace.getVersion()
    const resources = workspace.resources.all.length
    expect(() => workspace.createPlacedResource(workspace.root, { kind: 'input-object', name: 'In' }, { x: 0, y: 0 })).toThrow(code('NO_TYPES'))
    expect(workspace.resources.all).toHaveLength(resources)
    expect(workspace.root.placements).toHaveLength(1)
    expect(workspace.getVersion()).toBe(before)
  })

  it('rejects a typed resource with a missing or unknown type, creating nothing', () => {
    const { workspace } = setup()
    expect(() => workspace.createPlacedResource(workspace.root, { kind: 'artifact', name: 'A' }, { x: 0, y: 0 })).toThrow(code('TYPE_REQUIRED'))
    expect(() => workspace.createPlacedResource(workspace.root, { kind: 'artifact', name: 'A', typeId: 'nope' }, { x: 0, y: 0 })).toThrow(code('UNKNOWN_TYPE'))
    expect(workspace.resources.all).toHaveLength(1)
    expect(workspace.root.placements).toHaveLength(1)
  })

  it('creates an untyped resource without a type', () => {
    const { workspace } = setup()
    const placement = workspace.createPlacedResource(workspace.root, { kind: 'database', name: 'Orders' }, { x: 0, y: 0 })
    expect(workspace.resources.get(placement.resourceId)?.typeId).toBeNull()
  })

  it('removes a resource from every Diagram with its links as one notification', () => {
    const { workspace, nested } = setup()
    const first = workspace.createPlacedResource(workspace.root, { kind: 'user', name: 'Ann' }, { x: 0, y: 0 })
    const second = nested.addPlacement(first.resourceId, { x: 5, y: 5 })
    const target = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'T' }, { x: 9, y: 9 })
    workspace.setPorts(target.resourceId, 'inputs', [{ name: 'in', typeId: null }])
    const input = workspace.resources.get(target.resourceId)!.definition!.inputs[0]
    workspace.root.addLink(first.id, target.id, 'top', input.id)
    expect(workspace.resourceImpact(first.resourceId)).toEqual({ placements: 2, links: 1 })

    const before = workspace.getVersion()
    workspace.removeResource(first.resourceId)
    expect(workspace.getVersion()).toBe(before + 1)
    expect(workspace.resources.get(first.resourceId)).toBeUndefined()
    expect(workspace.root.placement(first.id)).toBeUndefined()
    expect(nested.placement(second.id)).toBeUndefined()
    expect(workspace.root.links).toEqual([])
    expect(workspace.root.placements).toHaveLength(2)
  })

  it('refuses to remove a type a resource uses until the resource is gone', () => {
    const { workspace } = setup()
    const typeId = workspace.types[0].id
    const placement = workspace.createPlacedResource(workspace.root, { kind: 'artifact', name: 'A', typeId }, { x: 0, y: 0 })
    expect(() => workspace.removeType(typeId)).toThrow(code('TYPE_IN_USE'))
    expect(workspace.types.some((t) => t.id === typeId)).toBe(true)
    workspace.removeResource(placement.resourceId)
    workspace.removeType(typeId)
    expect(workspace.types.some((t) => t.id === typeId)).toBe(false)
  })

  it('shows an edit made through one Placement in every Placement of the Resource', () => {
    const { workspace, nested } = setup()
    const first = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'Shared' }, { x: 0, y: 0 })
    const second = nested.addPlacement(first.resourceId, { x: 7, y: 7 })
    expect(workspace.root.resourceOf(first.id)).toBe(nested.resourceOf(second.id))
    workspace.root.resourceOf(first.id)!.setName('Renamed')
    expect(nested.resourceOf(second.id)!.name).toBe('Renamed')
    workspace.setPorts(first.resourceId, 'inputs', [{ name: 'in', typeId: null }])
    expect(nested.resourceOf(second.id)!.definition!.inputs).toHaveLength(1)
    // Geometry stays private to each Placement.
    expect(second.position).toEqual({ x: 7, y: 7 })
    expect(first.position).toEqual({ x: 0, y: 0 })
  })
})

describe('Workspace.setPorts', () => {
  it('prunes Links in every Diagram holding a Placement of the Resource, as one undo step', () => {
    const { workspace, outer } = setupComponents()
    const target = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'T' }, { x: 5, y: 5 })
    // The same Resource T is placed in two Diagrams, each with its own Link to a source.
    const sourceA = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'SA' }, { x: 0, y: 0 })
    const otherDiagram = outer.diagram
    const tInOther = otherDiagram.addPlacement(target.resourceId, { x: 1, y: 1 })
    const sourceB = workspace.createPlacedResource(otherDiagram, { kind: 'component', name: 'SB' }, { x: 2, y: 2 })
    const linkA = connect(workspace, workspace.root, sourceA, target)
    const linkB = connect(workspace, otherDiagram, sourceB, tInOther)
    expect(workspace.root.links).toEqual([linkA])
    expect(otherDiagram.links).toEqual([linkB])

    const history = new History(workspace, { reconcile: () => {} })
    history.start()
    workspace.setPorts(target.resourceId, 'inputs', [])
    expect(workspace.root.links).toHaveLength(0)
    expect(otherDiagram.links).toHaveLength(0)
    history.undo()
    expect(history.canUndo).toBe(false)
    expect(workspace.root.links).toHaveLength(1)
    // Undo rebuilds every Diagram, so the old object is stale; find it again by id.
    expect(workspace.allDiagrams().find((d) => d.id === otherDiagram.id)!.links).toHaveLength(1)
  })

  it('rejects a non-component and an unknown Resource', () => {
    const { workspace } = setupComponents()
    const user = workspace.createPlacedResource(workspace.root, { kind: 'user', name: 'U' }, { x: 0, y: 0 })
    expect(() => workspace.setPorts(user.resourceId, 'inputs', [])).toThrow(expect.objectContaining({ code: 'INVALID_RESOURCE' }))
    expect(() => workspace.setPorts('nope', 'inputs', [])).toThrow(expect.objectContaining({ code: 'MISSING_RESOURCE' }))
  })
})
