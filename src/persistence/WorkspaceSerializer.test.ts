import { describe, expect, it } from 'vitest'
import { connect } from '../domain/testing/connect'
import { Workspace } from '../domain/Workspace'
import { PersistenceError } from './PersistenceError'
import { WorkspaceSerializer } from './WorkspaceSerializer'

const serializer = new WorkspaceSerializer()
const diagram = (id: string, placements: unknown[] = [], links: unknown[] = []) => ({
  id,
  viewport: { x: 0, y: 0, zoom: 1 },
  placements,
  links,
})
const placement = (id: string, resourceId: string) => ({ id, resourceId, position: { x: 1, y: 2 } })
// A component Resource.
const componentResource = (id: string, over: Record<string, unknown> = {}, child = diagram(`${id}-d`)) => ({
  id,
  kind: 'component',
  name: '',
  typeId: null,
  component: { inputs: [], outputs: [], notes: '', exceptionIds: [], environmentVariableIds: [], diagram: child, ...over },
})
const port = (id: string) => ({ id, name: id, typeId: null })
const valid = (root = diagram('root'), resources: unknown[] = [], over: Record<string, unknown> = {}) => ({
  schemaVersion: 11,
  types: [],
  exceptions: [],
  environmentVariables: [],
  resources,
  root,
  ...over,
})

describe('WorkspaceSerializer', () => {
  it('round-trips a serialized Workspace through deserialize', () => {
    let n = 0
    const ws = Workspace.empty({ next: () => `id${++n}` })
    const a = ws.createPlacedResource(ws.root, { kind: 'component', name: 'a' }, { x: 0, y: 0 })
    const b = ws.createPlacedResource(ws.root, { kind: 'component', name: 'b' }, { x: 5, y: 5 })
    connect(ws, ws.root, a, b)
    const snapshot = serializer.serialize(ws)
    expect(serializer.deserialize(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it('serializes exactly the Workspace snapshot, including viewports', () => {
    const ws = Workspace.empty({ next: (() => { let n = 0; return () => `s${++n}` })() })
    ws.root.setViewport({ x: 3, y: 4, zoom: 2 })
    ws.createPlacedResource(ws.root, { kind: 'component', name: 'a' }, { x: 1, y: 1 })
    expect(serializer.serialize(ws)).toEqual(ws.toSnapshot())
    expect(serializer.serialize(ws).schemaVersion).toBe(11)
    expect(serializer.serialize(ws).root.viewport).toEqual({ x: 3, y: 4, zoom: 2 })
  })

  it('round-trips Link bend points and loads Links saved without them', () => {
    let n = 0
    const ws = Workspace.empty({ next: () => `id${++n}` })
    const a = ws.createPlacedResource(ws.root, { kind: 'component', name: 'a' }, { x: 0, y: 0 })
    const b = ws.createPlacedResource(ws.root, { kind: 'component', name: 'b' }, { x: 5, y: 5 })
    const link = connect(ws, ws.root, a, b)
    expect(serializer.serialize(ws).root.links[0].waypoints).toBeUndefined()
    link.setWaypoints([{ x: 1, y: 2 }, { x: 3, y: 4 }])
    const snapshot = serializer.serialize(ws)
    expect(snapshot.root.links[0].waypoints).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }])
    expect(serializer.deserialize(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it('rejects malformed Link bend points', () => {
    const a = componentResource('a', { outputs: [port('o')] })
    const b = componentResource('b', { inputs: [port('i')] })
    const link = { id: 'l', name: '', sourceId: 'p1', targetId: 'p2', sourcePortId: 'o', targetPortId: 'i' }
    const ps = [placement('p1', 'a'), placement('p2', 'b')]
    for (const bad of ['x', [1], [{ x: 1 }], [{ x: 1, y: 'y' }]]) {
      expect(() => serializer.deserialize(valid(diagram('r', ps, [{ ...link, waypoints: bad }]), [a, b]))).toThrow(PersistenceError)
    }
  })

  it('round-trips a Placement size and loads data saved without one', () => {
    const resources = [componentResource('a')]
    const sized = { ...placement('p', 'a'), size: { width: 200, height: 80 } }
    expect(serializer.deserialize(valid(diagram('r', [sized]), resources)).root.placements[0].size).toEqual({ width: 200, height: 80 })
    expect(serializer.deserialize(valid(diagram('r', [placement('p', 'a')]), resources)).root.placements[0].size).toBeUndefined()
  })

  it('round-trips one Resource shared by Placements in two Diagrams, and an unplaced Resource', () => {
    const shared = componentResource('s')
    const host = componentResource('h', {}, diagram('h-d', [placement('inner', 's')]))
    const raw = valid(diagram('r', [placement('p1', 's'), placement('p2', 'h')]), [shared, host, componentResource('unplaced')])
    expect(serializer.deserialize(JSON.parse(JSON.stringify(raw)))).toEqual(raw)
  })

  it('drops unknown extra fields', () => {
    const raw = { ...valid(), extra: 1 }
    expect(serializer.deserialize(raw)).toEqual(valid())
  })

  it('keeps types and port type references', () => {
    const typed = [{ id: 'p', name: 'o', typeId: 't1' }]
    const raw = valid(diagram('r'), [componentResource('a', { outputs: typed })], { types: [{ id: 't1', name: 'number' }] })
    expect(serializer.deserialize(raw)).toEqual(raw)
  })
  it('rejects a port that names a missing type', () => {
    const typed = [{ id: 'p', name: 'o', typeId: 'ghost' }]
    expect(() => serializer.deserialize(valid(diagram('r'), [componentResource('a', { outputs: typed })]))).toThrow(PersistenceError)
  })
  it('keeps exceptions and the exception ids of component Resources', () => {
    const raw = valid(diagram('r'), [componentResource('a', { exceptionIds: ['e1'] })], { exceptions: [{ id: 'e1', name: 'NotFound' }] })
    expect(serializer.deserialize(raw)).toEqual(raw)
  })
  it('rejects a component Resource that names a missing exception', () => {
    expect(() => serializer.deserialize(valid(diagram('r'), [componentResource('a', { exceptionIds: ['ghost'] })]))).toThrow(PersistenceError)
  })
  it('keeps environment variables and the variable ids of component Resources', () => {
    const raw = valid(diagram('r'), [componentResource('a', { environmentVariableIds: ['v1'] })], {
      environmentVariables: [{ id: 'v1', name: 'DATABASE_URL' }],
    })
    expect(serializer.deserialize(raw)).toEqual(raw)
  })
  it('rejects a component Resource that names a missing environment variable', () => {
    expect(() => serializer.deserialize(valid(diagram('r'), [componentResource('a', { environmentVariableIds: ['ghost'] })]))).toThrow(PersistenceError)
  })

  it.each([[1], [2], [3], [4], [5], [6], [7], [8], [9], [10], [undefined], ['11']])('rejects schemaVersion %s', (schemaVersion) => {
    expect(() => serializer.deserialize({ ...valid(), schemaVersion })).toThrow(PersistenceError)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['missing root', { schemaVersion: 11 }],
    ['missing exceptionIds', valid(diagram('r'), [componentResource('c', { exceptionIds: undefined })])],
    ['missing environmentVariableIds', valid(diagram('r'), [componentResource('c', { environmentVariableIds: undefined })])],
    ['non-array placements', valid({ ...diagram('r'), placements: {} } as never)],
    ['missing notes', valid(diagram('r'), [componentResource('c', { notes: undefined })])],
    ['non-array inputs', valid(diagram('r'), [componentResource('c', { inputs: 'x' })])],
    ['non-finite position', valid(diagram('r', [{ ...placement('p', 'c'), position: { x: Infinity, y: 0 } }]), [componentResource('c')])],
    ['non-numeric size', valid(diagram('r', [{ ...placement('p', 'c'), size: { width: '9', height: 1 } }]), [componentResource('c')])],
    ['malformed child diagram', valid(diagram('r'), [componentResource('c', { diagram: 5 })])],
    ['component kind without a component', valid(diagram('r'), [{ ...componentResource('c'), component: null }])],
    ['non-component kind with a component', valid(diagram('r'), [{ ...componentResource('c'), kind: 'database' }])],
  ])('rejects malformed shape: %s', (_name, raw) => {
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })

  describe('rejections name the offending id', () => {
    const rejection = (raw: unknown): string => {
      try {
        serializer.deserialize(raw)
      } catch (e) {
        expect(e).toBeInstanceOf(PersistenceError)
        return (e as PersistenceError).message
      }
      throw new Error('expected deserialize to throw')
    }

    it('names the Placement of an unknown resourceId, in the root and in a child Diagram', () => {
      expect(rejection(valid(diagram('r', [placement('bad-p', 'ghost')])))).toContain('bad-p')
      const host = componentResource('h', {}, diagram('h-d', [placement('inner-p', 'ghost')]))
      expect(rejection(valid(diagram('r'), [host]))).toContain('inner-p')
    })

    it('names the Link whose endpoint is missing from its diagram', () => {
      const link = { id: 'bad-l', name: '', sourceId: 'p1', targetId: 'ghost', sourcePortId: 'o', targetPortId: 'i' }
      const a = componentResource('a', { outputs: [port('o')] })
      expect(rejection(valid(diagram('r', [placement('p1', 'a')], [link]), [a]))).toContain('bad-l')
    })

    it('names the Link whose port is not on the referenced Resource or is on the wrong side', () => {
      const a = componentResource('a', { outputs: [port('o')] })
      const b = componentResource('b', { inputs: [port('i')] })
      const link = { id: 'bad-l', name: '', sourceId: 'p1', targetId: 'p2', sourcePortId: 'o', targetPortId: 'i' }
      const ps = [placement('p1', 'a'), placement('p2', 'b')]
      expect(() => serializer.deserialize(valid(diagram('r', ps, [link]), [a, b]))).not.toThrow()
      for (const bad of [{ targetPortId: 'o' }, { sourcePortId: 'i' }, { targetPortId: 'ghost' }]) {
        expect(rejection(valid(diagram('r', ps, [{ ...link, ...bad }]), [a, b]))).toContain('bad-l')
      }
    })

    it('names a component Resource on a Diagram cycle: self-nesting and indirect', () => {
      const self = componentResource('self', {}, diagram('self-d', [placement('p', 'self')]))
      expect(rejection(valid(diagram('r', [placement('root-p', 'self')]), [self]))).toContain('self')

      const a = componentResource('a', {}, diagram('a-d', [placement('pb', 'b')]))
      const b = componentResource('b', {}, diagram('b-d', [placement('pa', 'a')]))
      expect(rejection(valid(diagram('r'), [a, b]))).toMatch(/Component (a|b) /)
    })

    it('rejects a cycle among unplaced Resources', () => {
      const a = componentResource('a', {}, diagram('a-d', [placement('pb', 'b')]))
      const b = componentResource('b', {}, diagram('b-d', [placement('pa', 'a')]))
      expect(() => serializer.deserialize(valid(diagram('r'), [a, b]))).toThrow(PersistenceError)
    })

    it('accepts a diamond, which is shared but not cyclic', () => {
      const leaf = componentResource('leaf')
      const left = componentResource('left', {}, diagram('left-d', [placement('l', 'leaf')]))
      const right = componentResource('right', {}, diagram('right-d', [placement('r', 'leaf')]))
      const root = diagram('r', [placement('pl', 'left'), placement('pr', 'right')])
      expect(() => serializer.deserialize(valid(root, [leaf, left, right]))).not.toThrow()
    })
  })

  describe('resources and placements', () => {
    const types = [{ id: 't1', name: 'string' }]
    const resources = [
      { id: 'r1', kind: 'database', name: 'Orders', typeId: null, component: null },
      { id: 'r2', kind: 'artifact', name: 'Invoice', typeId: 't1', component: null },
    ]
    const withResources = (root: unknown, overrides: Record<string, unknown> = {}) => ({ ...valid(), types, resources, root, ...overrides })

    it('round-trips resources, placements with a size, and a link between placements', () => {
      const out = componentResource('c', { outputs: [port('o')] })
      const link = { id: 'l', name: '', sourceId: 'pc', targetId: 'p1', sourcePortId: 'o', targetPortId: 'left' }
      const sized = { ...placement('p1', 'r1'), size: { width: 90, height: 40 } }
      const raw = withResources(diagram('r', [placement('pc', 'c'), sized, placement('p2', 'r2')], [link]), { resources: [...resources, out] })
      expect(serializer.deserialize(JSON.parse(JSON.stringify(raw)))).toEqual(raw)
    })

    it('accepts a link between two placements using side ids', () => {
      const link = { id: 'l', name: '', sourceId: 'p1', targetId: 'p2', sourcePortId: 'right', targetPortId: 'left' }
      expect(() => serializer.deserialize(withResources(diagram('r', [placement('p1', 'r1'), placement('p2', 'r2')], [link])))).not.toThrow()
    })

    it.each([
      ['an unknown resource kind', { resources: [{ ...resources[0], kind: 'queue' }] }],
      ['a typed resource without a type', { resources: [{ ...resources[1], typeId: null }] }],
      ['an untyped resource with a type', { resources: [{ ...resources[0], typeId: 't1' }] }],
      ['a typed resource naming an unknown type', { resources: [{ ...resources[1], typeId: 'ghost' }] }],
      ['non-array resources', { resources: {} }],
    ])('rejects %s', (_name, overrides) => {
      expect(() => serializer.deserialize(withResources(diagram('r'), overrides))).toThrow(PersistenceError)
    })

    it('rejects a link end in another diagram, or with a handle the placement lacks', () => {
      const inner = componentResource('c', {}, diagram('c-d', [placement('inner', 'r1')]))
      const outside = { id: 'l', name: '', sourceId: 'p1', targetId: 'inner', sourcePortId: 'right', targetPortId: 'left' }
      const raw = withResources(diagram('r', [placement('p1', 'r1')], [outside]), { resources: [...resources, inner] })
      expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)

      const base = { id: 'l', name: '', sourceId: 'p1', targetId: 'p2', sourcePortId: 'right', targetPortId: 'left' }
      for (const bad of [{ sourcePortId: 'read' }, { targetPortId: 'write' }, { targetPortId: 'middle' }]) {
        const ps = [placement('p1', 'r1'), placement('p2', 'r2')]
        // Both placements are four-sided; the retired database ids and unknown ids are not handles.
        expect(() => serializer.deserialize(withResources(diagram('r', ps, [{ ...base, ...bad }])))).toThrow(PersistenceError)
      }
    })

    it('rejects duplicate resource ids and duplicate placement ids', () => {
      expect(() => serializer.deserialize(withResources(diagram('r'), { resources: [resources[0], resources[0]] }))).toThrow(PersistenceError)
      expect(() => serializer.deserialize(withResources(diagram('r', [placement('p', 'r1'), placement('p', 'r2')])))).toThrow(PersistenceError)
    })

    it('rejects a snapshot without a resources list or placements list', () => {
      expect(() => serializer.deserialize({ ...valid(), resources: undefined })).toThrow(PersistenceError)
      expect(() => serializer.deserialize(valid({ ...diagram('r'), placements: undefined } as never))).toThrow(PersistenceError)
    })
  })
})
