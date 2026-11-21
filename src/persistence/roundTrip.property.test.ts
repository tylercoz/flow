import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { CounterIds, workspaceArb } from '../domain/testing/workspaceArbitrary'
import { Workspace } from '../domain/Workspace'
import { LocalStorageRepository } from './LocalStorageRepository'
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

describe('Property 9: Serialization round trip', () => {
  const serializer = new WorkspaceSerializer()

  // **Validates: Requirements 5.1, 5.2**
  it('serialize(restore(deserialize(JSON round trip))) equals serialize(w)', () => {
    fc.assert(
      fc.property(workspaceArb, ({ workspace }) => {
        const snapshot = serializer.serialize(workspace)
        const raw: unknown = JSON.parse(JSON.stringify(snapshot))
        const restored = Workspace.restore(serializer.deserialize(raw), new CounterIds())
        expect(serializer.serialize(restored)).toEqual(snapshot)
      }),
    )
  })

  // **Validates: Requirements 5.1, 5.2**
  it('holds through LocalStorageRepository backed by an in-memory Storage', async () => {
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
