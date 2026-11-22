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
  links,
})
const component = (id: string, child = diagram(`${id}-d`)) => ({ id, details, position: { x: 1, y: 2 }, exceptionIds: [], diagram: child })
const valid = (root = diagram('root')) => ({ schemaVersion: 6, types: [], exceptions: [], root })

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
    expect(serializer.serialize(ws).schemaVersion).toBe(6)
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
  it.each([[1], [2], [3], [4], [5], [undefined], ['6']])('rejects schemaVersion %s', (schemaVersion) => {
    expect(() => serializer.deserialize({ ...valid(), schemaVersion })).toThrow(PersistenceError)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['missing root', { schemaVersion: 6 }],
    ['missing exceptionIds', valid(diagram('r', [{ ...component('c'), exceptionIds: undefined }]))],
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
  it('rejects a link whose endpoint lives in a different diagram', () => {
    const link = { id: 'l', details, sourceId: 'a', targetId: 'inner', sourcePortId: "p", targetPortId: "q" }
    const raw = valid(diagram('r', [component('a', diagram('d', [component('inner')]))], [link]))
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })
})
