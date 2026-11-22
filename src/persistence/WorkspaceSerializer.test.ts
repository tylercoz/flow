import { describe, expect, it } from 'vitest'
import { connect } from '../domain/testing/connect'
import { Workspace } from '../domain/Workspace'
import { PersistenceError } from './PersistenceError'
import { WorkspaceSerializer } from './WorkspaceSerializer'

const serializer = new WorkspaceSerializer()
const details = { name: '', inputs: [], outputs: [], notes: '' }
const diagram = (id: string, components: unknown[] = [], links: unknown[] = []) => ({
  id,
  viewport: { x: 0, y: 0, zoom: 1 },
  components,
  placements: [] as unknown[],
  links,
})
const component = (id: string, child = diagram(`${id}-d`)) => ({ id, details, position: { x: 1, y: 2 }, exceptionIds: [], environmentVariableIds: [], diagram: child })
const valid = (root = diagram('root')) => ({ schemaVersion: 8, types: [], exceptions: [], environmentVariables: [], resources: [], root })

describe('WorkspaceSerializer', () => {
  it('round-trips a serialized Workspace through deserialize', () => {
    let n = 0
    const ws = Workspace.empty({ next: () => `id${++n}` })
    const a = ws.root.addComponent({ x: 0, y: 0 })
    const b = ws.root.addComponent({ x: 5, y: 5 })
    connect(ws.root, a, b)
    const snapshot = serializer.serialize(ws)
    expect(serializer.deserialize(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it('serializes exactly the Workspace snapshot, including viewports', () => {
    const ws = Workspace.empty({ next: (() => { let n = 0; return () => `s${++n}` })() })
    ws.root.setViewport({ x: 3, y: 4, zoom: 2 })
    ws.root.addComponent({ x: 1, y: 1 })
    expect(serializer.serialize(ws)).toEqual(ws.toSnapshot())
    expect(serializer.serialize(ws).schemaVersion).toBe(8)
    expect(serializer.serialize(ws).root.viewport).toEqual({ x: 3, y: 4, zoom: 2 })
  })

  it('round-trips a Component size and loads data saved without one', () => {
    const sized = { ...component('a'), size: { width: 200, height: 80 } }
    expect(serializer.deserialize(valid(diagram('r', [sized]))).root.components[0].size).toEqual({ width: 200, height: 80 })
    expect(serializer.deserialize(valid(diagram('r', [component('b')]))).root.components[0].size).toBeUndefined()
  })
  it('drops unknown extra fields', () => {
    const raw = { ...valid(), extra: 1 }
    expect(serializer.deserialize(raw)).toEqual(valid())
  })

  it('keeps types and port type references', () => {
    const typed = { ...details, outputs: [{ id: 'p', name: 'o', typeId: 't1' }] }
    const raw = { ...valid(diagram('r', [{ ...component('a'), details: typed }])), types: [{ id: 't1', name: 'number' }] }
    expect(serializer.deserialize(raw)).toEqual(raw)
  })
  it('rejects a port that names a missing type', () => {
    const typed = { ...details, outputs: [{ id: 'p', name: 'o', typeId: 'ghost' }] }
    expect(() => serializer.deserialize(valid(diagram('r', [{ ...component('a'), details: typed }])))).toThrow(PersistenceError)
  })
  it('keeps exceptions and the exception ids of Components', () => {
    const raw = { ...valid(diagram('r', [{ ...component('a'), exceptionIds: ['e1'] }])), exceptions: [{ id: 'e1', name: 'NotFound' }] }
    expect(serializer.deserialize(raw)).toEqual(raw)
  })
  it('rejects a Component, at any depth, that names a missing exception', () => {
    const ghost = { ...component('inner'), exceptionIds: ['ghost'] }
    expect(() => serializer.deserialize(valid(diagram('r', [component('a', diagram('d', [ghost]))])))).toThrow(PersistenceError)
  })
  it('keeps environment variables and the variable ids of Components', () => {
    const raw = {
      ...valid(diagram('r', [{ ...component('a'), environmentVariableIds: ['v1'] }])),
      environmentVariables: [{ id: 'v1', name: 'DATABASE_URL' }],
    }
    expect(serializer.deserialize(raw)).toEqual(raw)
  })
  it('rejects a Component, at any depth, that names a missing environment variable', () => {
    const ghost = { ...component('inner'), environmentVariableIds: ['ghost'] }
    expect(() => serializer.deserialize(valid(diagram('r', [component('a', diagram('d', [ghost]))])))).toThrow(PersistenceError)
  })
  it.each([[1], [2], [3], [4], [5], [6], [7], [undefined], ['8']])('rejects schemaVersion %s', (schemaVersion) => {
    expect(() => serializer.deserialize({ ...valid(), schemaVersion })).toThrow(PersistenceError)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['missing root', { schemaVersion: 8 }],
    ['missing exceptionIds', valid(diagram('r', [{ ...component('c'), exceptionIds: undefined }]))],
    ['missing environmentVariableIds', valid(diagram('r', [{ ...component('c'), environmentVariableIds: undefined }]))],
    ['non-array components', valid({ ...diagram('r'), components: {} } as never)],
    ['missing details field', valid(diagram('r', [{ ...component('c'), details: { name: 'x' } }]))],
    ['non-finite position', valid(diagram('r', [{ ...component('c'), position: { x: Infinity, y: 0 } }]))],
    ['non-numeric size', valid(diagram('r', [{ ...component('c'), size: { width: '9', height: 1 } }]))],
    ['malformed nested diagram', valid(diagram('r', [component('c', 5 as never)]))],
  ])('rejects malformed shape: %s', (_name, raw) => {
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })

  it('rejects a link whose endpoint is missing from its diagram', () => {
    const link = { id: 'l', details, sourceId: 'a', targetId: 'ghost', sourcePortId: "p", targetPortId: "q" }
    const raw = valid(diagram('r', [component('a')], [link]))
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })

  it('rejects a link whose ports are missing or on the wrong side', () => {
    const port = { id: 'p', name: 'x', typeId: null }
    const a = { ...component('a'), details: { ...details, outputs: [port] } }
    const b = { ...component('b'), details: { ...details, inputs: [{ ...port, id: 'q' }] } }
    const link = { id: 'l', details, sourceId: 'a', targetId: 'b', sourcePortId: 'p', targetPortId: 'q' }
    expect(() => serializer.deserialize(valid(diagram('r', [a, b], [link])))).not.toThrow()
    for (const bad of [{ targetPortId: 'p' }, { sourcePortId: 'q' }, { targetPortId: 'ghost' }]) {
      expect(() => serializer.deserialize(valid(diagram('r', [a, b], [{ ...link, ...bad }])))).toThrow(PersistenceError)
    }
  })
  describe('resources and placements', () => {
    const types = [{ id: 't1', name: 'string' }]
    const resources = [
      { id: 'r1', kind: 'database', name: 'Orders', typeId: null },
      { id: 'r2', kind: 'artifact', name: 'Invoice', typeId: 't1' },
    ]
    const placement = (id: string, resourceId: string) => ({ id, resourceId, position: { x: 1, y: 2 } })
    const withResources = (root: unknown, overrides: Record<string, unknown> = {}) => ({ ...valid(), types, resources, root, ...overrides })
    const rootWith = (placements: unknown[], links: unknown[] = [], components: unknown[] = []) => ({ ...diagram('r', components, links), placements })

    it('round-trips resources, placements with a size, and links to a placement', () => {
      const out = { ...component('c'), details: { ...details, outputs: [{ id: 'o', name: 'o', typeId: null }] } }
      const link = { id: 'l', details, sourceId: 'c', targetId: 'p1', sourcePortId: 'o', targetPortId: 'write' }
      const sized = { ...placement('p1', 'r1'), size: { width: 90, height: 40 } }
      const raw = withResources(rootWith([sized, placement('p2', 'r2')], [link], [out]))
      expect(serializer.deserialize(JSON.parse(JSON.stringify(raw)))).toEqual(raw)
    })

    it('accepts a link between two placements using side ids', () => {
      const link = { id: 'l', details, sourceId: 'p1', targetId: 'p2', sourcePortId: 'read', targetPortId: 'left' }
      expect(() => serializer.deserialize(withResources(rootWith([placement('p1', 'r1'), placement('p2', 'r2')], [link])))).not.toThrow()
    })

    it.each([
      ['an unknown resource kind', { resources: [{ ...resources[0], kind: 'queue' }] }],
      ['a typed resource without a type', { resources: [{ ...resources[1], typeId: null }] }],
      ['an untyped resource with a type', { resources: [{ ...resources[0], typeId: 't1' }] }],
      ['a typed resource naming an unknown type', { resources: [{ ...resources[1], typeId: 'ghost' }] }],
      ['non-array resources', { resources: {} }],
    ])('rejects %s', (_name, overrides) => {
      expect(() => serializer.deserialize(withResources(rootWith([]), overrides))).toThrow(PersistenceError)
    })

    it('rejects a placement of an unknown resource, at any depth', () => {
      const nested = component('c', rootWith([placement('p', 'ghost')]))
      expect(() => serializer.deserialize(withResources(rootWith([placement('p', 'ghost')])))).toThrow(PersistenceError)
      expect(() => serializer.deserialize(withResources(rootWith([], [], [nested])))).toThrow(PersistenceError)
    })

    it('rejects a placement that shares an id with a component', () => {
      expect(() => serializer.deserialize(withResources(rootWith([placement('c', 'r1')], [], [component('c')])))).toThrow(PersistenceError)
    })

    it('rejects a link end in another diagram, or with a handle the placement lacks', () => {
      const inner = component('c', rootWith([placement('inner', 'r1')]))
      const outside = { id: 'l', details, sourceId: 'p1', targetId: 'inner', sourcePortId: 'read', targetPortId: 'write' }
      expect(() => serializer.deserialize(withResources(rootWith([placement('p1', 'r1')], [outside], [inner])))).toThrow(PersistenceError)

      const base = { id: 'l', details, sourceId: 'p1', targetId: 'p2', sourcePortId: 'read', targetPortId: 'left' }
      for (const bad of [{ sourcePortId: 'write' }, { sourcePortId: 'top' }, { targetPortId: 'read' }, { targetPortId: 'middle' }]) {
        const ps = [placement('p1', 'r1'), placement('p2', 'r2')]
        // p1 is a database (read/write only), p2 is four-sided.
        expect(() => serializer.deserialize(withResources(rootWith(ps, [{ ...base, ...bad }])))).toThrow(PersistenceError)
      }
    })

    it('rejects a snapshot without a resources list or placements list', () => {
      expect(() => serializer.deserialize({ ...valid(), resources: undefined })).toThrow(PersistenceError)
      expect(() => serializer.deserialize(valid({ ...diagram('r'), placements: undefined } as never))).toThrow(PersistenceError)
    })
  })

  it('rejects a link whose endpoint lives in a different diagram', () => {
    const link = { id: 'l', details, sourceId: 'a', targetId: 'inner', sourcePortId: "p", targetPortId: "q" }
    const raw = valid(diagram('r', [component('a', diagram('d', [component('inner')]))], [link]))
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })
})
