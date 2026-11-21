import { describe, expect, it } from 'vitest'
import { Workspace } from '../domain/Workspace'
import { PersistenceError } from './PersistenceError'
import { WorkspaceSerializer } from './WorkspaceSerializer'

const serializer = new WorkspaceSerializer()
const details = { name: '', description: '', notes: '' }
const diagram = (id: string, components: unknown[] = [], links: unknown[] = []) => ({
  id,
  viewport: { x: 0, y: 0, zoom: 1 },
  components,
  links,
})
const component = (id: string, child = diagram(`${id}-d`)) => ({ id, details, position: { x: 1, y: 2 }, diagram: child })
const valid = (root = diagram('root')) => ({ schemaVersion: 1, root })

describe('WorkspaceSerializer', () => {
  it('round-trips a serialized Workspace through deserialize', () => {
    let n = 0
    const ws = Workspace.empty({ next: () => `id${++n}` })
    const a = ws.root.addComponent({ x: 0, y: 0 })
    const b = ws.root.addComponent({ x: 5, y: 5 })
    ws.root.addLink(a.id, b.id)
    const snapshot = serializer.serialize(ws)
    expect(serializer.deserialize(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot)
  })

  it('drops unknown extra fields', () => {
    const raw = { ...valid(), extra: 1 }
    expect(serializer.deserialize(raw)).toEqual(valid())
  })

  it.each([[2], [undefined], ['1']])('rejects schemaVersion %s', (schemaVersion) => {
    expect(() => serializer.deserialize({ ...valid(), schemaVersion })).toThrow(PersistenceError)
  })

  it.each([
    ['null', null],
    ['array', []],
    ['missing root', { schemaVersion: 1 }],
    ['non-array components', valid({ ...diagram('r'), components: {} } as never)],
    ['missing details field', valid(diagram('r', [{ ...component('c'), details: { name: 'x' } }]))],
    ['non-finite position', valid(diagram('r', [{ ...component('c'), position: { x: Infinity, y: 0 } }]))],
    ['malformed nested diagram', valid(diagram('r', [component('c', 5 as never)]))],
  ])('rejects malformed shape: %s', (_name, raw) => {
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })

  it('rejects a link whose endpoint is missing from its diagram', () => {
    const link = { id: 'l', details, sourceId: 'a', targetId: 'ghost' }
    const raw = valid(diagram('r', [component('a')], [link]))
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })

  it('rejects a link whose endpoint lives in a different diagram', () => {
    const link = { id: 'l', details, sourceId: 'a', targetId: 'inner' }
    const raw = valid(diagram('r', [component('a', diagram('d', [component('inner')]))], [link]))
    expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
  })
})
