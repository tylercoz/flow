import { describe, expect, it } from 'vitest'
import { Workspace } from '../domain/Workspace'
import { PersistenceError } from './PersistenceError'
import { WorkspaceSerializer } from './WorkspaceSerializer'

const serializer = new WorkspaceSerializer()
const details = { name: '', inputs: [], outputs: [], notes: '' }
const diagram = (id: string, components: unknown[] = [], links: unknown[] = []) => ({
  id,
  viewport: { x: 0, y: 0, zoom: 1 },
  components,
  links,
})
const component = (id: string, child = diagram(`${id}-d`)) => ({ id, details, position: { x: 1, y: 2 }, diagram: child })
const valid = (root = diagram('root')) => ({ schemaVersion: 4, types: [], root })

describe('WorkspaceSerializer', () => {
  it('round-trips a serialized Workspace through deserialize', () => {
    let n = 0
    const ws = Workspace.empty({ next: () => `id${++n}` })
    const a = ws.root.addComponent({ x: 0, y: 0 })
    const b = ws.root.addComponent({ x: 5, y: 5 })
    ws.root.addLink(a.id, b.id, 'bottom', 'top')
    const snapshot = serializer.serialize(ws)
    expect(serializer.deserialize(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it('serializes exactly the Workspace snapshot, including viewports', () => {
    const ws = Workspace.empty({ next: (() => { let n = 0; return () => `s${++n}` })() })
    ws.root.setViewport({ x: 3, y: 4, zoom: 2 })
    ws.root.addComponent({ x: 1, y: 1 })
    expect(serializer.serialize(ws)).toEqual(ws.toSnapshot())
    expect(serializer.serialize(ws).schemaVersion).toBe(4)
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
    const typed = { ...details, outputs: [{ name: 'o', typeId: 't1' }] }
    const raw = { ...valid(diagram('r', [{ ...component('a'), details: typed }])), types: [{ id: 't1', name: 'number' }] }
    expect(serializer.deserialize(raw)).toEqual(raw)
  })
  it('rejects a port that names a missing type', () => {
    const typed = { ...details, outputs: [{ name: 'o', typeId: 'ghost' }] }
    expect(() => serializer.deserialize(valid(diagram('r', [{ ...component('a'), details: typed }])))).toThrow(PersistenceError)
  })
  it.each([[1], [2], [3], [undefined], ['4']])('rejects schemaVersion %s', (schemaVersion) => {
    expect(() => serializer.deserialize({ ...valid(), schemaVersion })).toThrow(PersistenceError)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['missing root', { schemaVersion: 4 }],
    ['non-array components', valid({ ...diagram('r'), components: {} } as never)],
    ['missing details field', valid(diagram('r', [{ ...component('c'), details: { name: 'x' } }]))],
    ['non-finite position', valid(diagram('r', [{ ...component('c'), position: { x: Infinity, y: 0 } }]))],
    ['non-numeric size', valid(diagram('r', [{ ...component('c'), size: { width: '9', height: 1 } }]))],
    ['malformed nested diagram', valid(diagram('r', [component('c', 5 as never)]))],
  ])('rejects malformed shape: %s', (_name, raw) => {
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })

  it('rejects a link whose endpoint is missing from its diagram', () => {
    const link = { id: 'l', details, sourceId: 'a', targetId: 'ghost', sourceSide: 'bottom', targetSide: 'top' }
    const raw = valid(diagram('r', [component('a')], [link]))
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })

  it('rejects a link whose endpoint lives in a different diagram', () => {
    const link = { id: 'l', details, sourceId: 'a', targetId: 'inner', sourceSide: 'bottom', targetSide: 'top' }
    const raw = valid(diagram('r', [component('a', diagram('d', [component('inner')]))], [link]))
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })
})
