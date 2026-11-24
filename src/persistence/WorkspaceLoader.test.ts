import { describe, expect, it } from 'vitest'
import type { IdGenerator } from '../domain/IdGenerator'
import { Notifier } from '../domain/Notifier'
import type { Scheduler } from '../domain/Scheduler'
import { PersistenceError } from './PersistenceError'
import type { Repository } from './Repository'
import { WorkspaceLoader } from './WorkspaceLoader'
import { WorkspaceSerializer } from './WorkspaceSerializer'

class FakeIds implements IdGenerator {
  private n = 0
  next(): string {
    return `id-${++this.n}`
  }
}

// Never fires, which is enough because the load message is persistent.
const fakeScheduler: Scheduler = {
  set: () => setTimeout(() => {}, 0),
  cancel: () => {},
}

class FakeRepository implements Repository {
  saveCalls = 0
  private readonly outcome: () => unknown
  constructor(outcome: () => unknown) {
    this.outcome = outcome
  }
  load(): Promise<unknown | null> {
    return Promise.resolve().then(this.outcome)
  }
  save(): Promise<void> {
    this.saveCalls++
    return Promise.resolve()
  }
}

const stored = {
  schemaVersion: 16,
  project: { name: 'P', description: '', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
  types: [],
  exceptions: [],
  environmentVariables: [],
  resources: [
    {
      id: 'r1',
      kind: 'component',
      name: 'A',
      typeId: null,
      component: {
        inputs: [],
        outputs: [],
        portNodes: [],
        notes: '',
        exceptionIds: [],
        environmentVariableIds: [],
        localVariables: [],
        diagram: { id: 'd1', viewport: { x: 0, y: 0, zoom: 1 }, placements: [], links: [] },
      },
    },
  ],
  diagrams: [
    {
      name: 'D',
      diagram: {
        id: 'root',
        viewport: { x: 0, y: 0, zoom: 1 },
        placements: [{ id: 'c1', resourceId: 'r1', position: { x: 1, y: 2 } }],
        links: [],
      },
    },
  ],
}

function setup(outcome: () => unknown, serializer = new WorkspaceSerializer()) {
  const repository = new FakeRepository(outcome)
  const notifier = new Notifier(fakeScheduler)
  const loader = new WorkspaceLoader(repository, serializer, new FakeIds(), notifier)
  return { repository, notifier, loader }
}

describe('WorkspaceLoader', () => {
  it('gives an empty workspace with canSave true when nothing is stored', async () => {
    const { loader, notifier } = setup(() => null)
    const result = await loader.load()
    expect(result.canSave).toBe(true)
    expect(result.workspace.root.placements).toHaveLength(0)
    expect(notifier.messages).toHaveLength(0)
  })

  it('restores readable data with canSave true', async () => {
    const { loader } = setup(() => stored)
    const result = await loader.load()
    expect(result.canSave).toBe(true)
    expect(result.workspace.root.id).toBe('root')
    expect(result.workspace.root.placements.map((p) => p.id)).toEqual(['c1'])
    expect(result.workspace.resources.get('r1')?.name).toBe('A')
  })

  it('handles a PersistenceError from repository.load', async () => {
    const { loader, notifier, repository } = setup(() => {
      throw new PersistenceError('bad json')
    })
    const result = await loader.load()
    expect(result.canSave).toBe(false)
    expect(result.workspace.root.placements).toHaveLength(0)
    expect(notifier.messages).toEqual([expect.objectContaining({ key: 'load', kind: 'persistent' })])
    expect(repository.saveCalls).toBe(0)
  })

  it('handles a PersistenceError from deserialize', async () => {
    const { loader, notifier, repository } = setup(() => ({ schemaVersion: 109 }))
    const result = await loader.load()
    expect(result.canSave).toBe(false)
    expect(result.workspace.root.placements).toHaveLength(0)
    expect(notifier.messages).toEqual([expect.objectContaining({ key: 'load', kind: 'persistent' })])
    expect(repository.saveCalls).toBe(0)
  })

  it('rejects a schemaVersion 9 save, starts empty and never writes over it', async () => {
    const { loader, notifier, repository } = setup(() => ({ ...stored, schemaVersion: 9 }))
    const result = await loader.load()
    expect(result.canSave).toBe(false)
    expect(result.workspace.root.placements).toHaveLength(0)
    expect(notifier.messages).toEqual([expect.objectContaining({ key: 'load', kind: 'persistent' })])
    expect(repository.saveCalls).toBe(0)
  })

  it('rejects a snapshot with a dangling resource reference', async () => {
    const root = { ...stored.diagrams[0].diagram, placements: [{ id: 'p', resourceId: 'ghost', position: { x: 0, y: 0 } }] }
    const { loader, repository } = setup(() => ({ ...stored, diagrams: [{ name: 'D', diagram: root }] }))
    const result = await loader.load()
    expect(result.canSave).toBe(false)
    expect(repository.saveCalls).toBe(0)
  })

  it('rejects a snapshot whose Diagrams contain a cycle, starts empty and never writes over it', async () => {
    const resource = stored.resources[0]
    const cyclic = {
      ...resource,
      component: { ...resource.component, diagram: { ...resource.component.diagram, placements: [{ id: 'p', resourceId: 'r1', position: { x: 0, y: 0 } }] } },
    }
    const { loader, repository } = setup(() => ({ ...stored, resources: [cyclic] }))
    const result = await loader.load()
    expect(result.canSave).toBe(false)
    expect(result.workspace.root.placements).toHaveLength(0)
    expect(repository.saveCalls).toBe(0)
  })

  it('rethrows errors that are not PersistenceError', async () => {
    const { loader, notifier } = setup(() => {
      throw new TypeError('bug')
    })
    await expect(loader.load()).rejects.toThrow(TypeError)
    expect(notifier.messages).toHaveLength(0)
  })

  it('rethrows non-PersistenceError errors from deserialize', async () => {
    const serializer = new WorkspaceSerializer()
    serializer.deserialize = () => {
      throw new RangeError('bug')
    }
    const { loader } = setup(() => stored, serializer)
    await expect(loader.load()).rejects.toThrow(RangeError)
  })
})
