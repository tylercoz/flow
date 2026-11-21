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
  schemaVersion: 4,
  types: [],
  root: {
    id: 'root',
    viewport: { x: 0, y: 0, zoom: 1 },
    components: [
      {
        id: 'c1',
        details: { name: 'A', inputs: [], outputs: [], notes: '' },
        position: { x: 1, y: 2 },
        diagram: { id: 'd1', viewport: { x: 0, y: 0, zoom: 1 }, components: [], links: [] },
      },
    ],
    links: [],
  },
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
    expect(result.workspace.root.components).toHaveLength(0)
    expect(notifier.messages).toHaveLength(0)
  })

  it('restores readable data with canSave true', async () => {
    const { loader } = setup(() => stored)
    const result = await loader.load()
    expect(result.canSave).toBe(true)
    expect(result.workspace.root.id).toBe('root')
    expect(result.workspace.root.components.map((c) => c.id)).toEqual(['c1'])
  })

  it('handles a PersistenceError from repository.load', async () => {
    const { loader, notifier, repository } = setup(() => {
      throw new PersistenceError('bad json')
    })
    const result = await loader.load()
    expect(result.canSave).toBe(false)
    expect(result.workspace.root.components).toHaveLength(0)
    expect(notifier.messages).toEqual([expect.objectContaining({ key: 'load', kind: 'persistent' })])
    expect(repository.saveCalls).toBe(0)
  })

  it('handles a PersistenceError from deserialize', async () => {
    const { loader, notifier, repository } = setup(() => ({ schemaVersion: 99 }))
    const result = await loader.load()
    expect(result.canSave).toBe(false)
    expect(result.workspace.root.components).toHaveLength(0)
    expect(notifier.messages).toEqual([expect.objectContaining({ key: 'load', kind: 'persistent' })])
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
