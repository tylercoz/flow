import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CounterIds, workspaceArb } from '../domain/testing/workspaceArbitrary'
import { Workspace } from '../domain/Workspace'
import { LocalStorageRepository } from './LocalStorageRepository'
import { PersistenceError } from './PersistenceError'
import { WorkspaceSerializer } from './WorkspaceSerializer'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  }
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

// Each corruption adds ids that cannot collide with generated ones, so it applies to any snapshot.
const corruptions: Record<string, (s: Json) => void> = {
  'wrong schemaVersion': (s) => {
    s.schemaVersion = 7
  },
  'placement of an unknown resource': (s) => {
    s.root.placements.push({ id: 'bad-placement', resourceId: 'no-such-resource', position: { x: 0, y: 0 } })
  },
  'typed resource with an unknown data type': (s) => {
    s.resources.push({ id: 'bad-resource', kind: 'artifact', name: 'x', typeId: 'no-such-type' })
  },
  'typed resource without a type': (s) => {
    s.resources.push({ id: 'bad-resource', kind: 'input-object', name: 'x', typeId: null })
  },
  'untyped resource with a type': (s) => {
    s.resources.push({ id: 'bad-resource', kind: 'user', name: 'x', typeId: 'any-type' })
  },
  'link end outside its diagram': (s) => {
    s.root.links.push({
      id: 'bad-link',
      details: { name: '', inputs: [], outputs: [], notes: '' },
      sourceId: 'no-such-node',
      targetId: 'no-such-node-2',
      sourcePortId: 'top',
      targetPortId: 'top',
    })
  },
}

describe('Property 12: Invalid snapshots are rejected', () => {
  const serializer = new WorkspaceSerializer()

  // **Validates: Requirements 8.3**
  it('Property 12: deserialize throws PersistenceError for any one corruption of a valid snapshot', () => {
    fc.assert(
      fc.property(workspaceArb, fc.constantFrom(...Object.keys(corruptions)), ({ workspace }, name) => {
        const raw = JSON.parse(JSON.stringify(serializer.serialize(workspace))) as Json
        corruptions[name](raw)
        expect(() => serializer.deserialize(raw)).toThrow(PersistenceError)
      }),
    )
  })
})

describe('Property 11: Snapshots round trip', () => {
  const serializer = new WorkspaceSerializer()

  // **Validates: Requirements 8.1, 8.2**
  it('Property 11: serialize(restore(deserialize(JSON round trip))) equals serialize(w) at schemaVersion 8', () => {
    fc.assert(
      fc.property(workspaceArb, ({ workspace }) => {
        const snapshot = serializer.serialize(workspace)
        expect(snapshot.schemaVersion).toBe(8)
        const raw: unknown = JSON.parse(JSON.stringify(snapshot))
        const restored = Workspace.restore(serializer.deserialize(raw), new CounterIds())
        expect(serializer.serialize(restored)).toEqual(snapshot)
      }),
    )
  })

  // **Validates: Requirements 8.1, 8.2**
  it('Property 11 holds through LocalStorageRepository backed by an in-memory Storage', async () => {
    await fc.assert(
      fc.asyncProperty(workspaceArb, async ({ workspace }) => {
        const repository = new LocalStorageRepository(memoryStorage())
        const snapshot = serializer.serialize(workspace)
        await repository.save(snapshot)
        const restored = Workspace.restore(serializer.deserialize(await repository.load()), new CounterIds())
        expect(serializer.serialize(restored)).toEqual(snapshot)
      }),
    )
  })
})
