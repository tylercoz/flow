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

// Random commands only sometimes yield a shared or unplaced Resource, so add both on top of every generated workspace.
function withSharedAndUnplaced(workspace: Workspace): Workspace {
  const origin = { x: 0, y: 0 }
  const shared = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'shared' }, origin)
  const host = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'host' }, origin)
  // `host` is not reachable from `shared`, so this places one Resource in two Diagrams without a cycle.
  workspace.resources.get(host.resourceId)!.definition!.diagram.addPlacement(shared.resourceId, origin)
  const unplaced = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'unplaced' }, origin)
  workspace.root.removePlacement(unplaced.id)
  return workspace
}

describe('Property 12: Snapshots round trip', () => {
  const serializer = new WorkspaceSerializer()

  // **Validates: Requirements 8.1, 8.6**
  it('Feature: components-as-resources, Property 12: serialize(restore(deserialize(JSON round trip))) equals serialize(w) at schemaVersion 14', () => {
    fc.assert(
      fc.property(workspaceArb, ({ workspace }) => {
        const snapshot = serializer.serialize(workspace)
        expect(snapshot.schemaVersion).toBe(14)
        const raw: unknown = JSON.parse(JSON.stringify(snapshot))
        const restored = Workspace.restore(serializer.deserialize(raw), new CounterIds())
        expect(serializer.serialize(restored)).toEqual(snapshot)
      }),
    )
  })

  // **Validates: Requirements 8.1, 8.6**
  it('Feature: components-as-resources, Property 12: shared and unplaced Resources survive the round trip', () => {
    fc.assert(
      fc.property(workspaceArb, ({ workspace }) => {
        const snapshot = serializer.serialize(withSharedAndUnplaced(workspace))
        const raw: unknown = JSON.parse(JSON.stringify(snapshot))
        const restored = Workspace.restore(serializer.deserialize(raw), new CounterIds())
        expect(serializer.serialize(restored)).toEqual(snapshot)
      }),
    )
  })

  // **Validates: Requirements 8.1, 8.6**
  it('Feature: components-as-resources, Property 12 holds through LocalStorageRepository backed by an in-memory Storage', async () => {
    await fc.assert(
      fc.asyncProperty(workspaceArb, async ({ workspace }) => {
        const repository = new LocalStorageRepository(memoryStorage())
        const snapshot = serializer.serialize(withSharedAndUnplaced(workspace))
        await repository.save(snapshot)
        const restored = Workspace.restore(serializer.deserialize(await repository.load()), new CounterIds())
        expect(serializer.serialize(restored)).toEqual(snapshot)
      }),
    )
  })
})
