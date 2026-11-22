import { describe, expect, it } from 'vitest'
import type { WorkspaceSnapshot } from '../domain/WorkspaceSnapshot'
import { LocalStorageRepository, STORAGE_KEY } from './LocalStorageRepository'
import { PersistenceError } from './PersistenceError'

// Minimal in-memory Storage; `failOn` makes the named method throw.
function fakeStorage(failOn?: 'getItem' | 'setItem'): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  const fail = (method: string) => {
    if (failOn === method) throw new Error(`${method} blocked`)
  }
  return {
    data,
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => {
      fail('getItem')
      return data.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      fail('setItem')
      data.set(k, v)
    },
    removeItem: (k: string) => void data.delete(k),
  }
}

const snapshot: WorkspaceSnapshot = {
  schemaVersion: 6,
  types: [],
  exceptions: [],
  root: { id: 'd1', viewport: { x: 0, y: 0, zoom: 1 }, components: [], links: [] },
}

describe('LocalStorageRepository', () => {
  it('load returns null when nothing is stored', async () => {
    expect(await new LocalStorageRepository(fakeStorage()).load()).toBeNull()
  })

  it('round-trips a saved snapshot', async () => {
    const repo = new LocalStorageRepository(fakeStorage())
    await repo.save(snapshot)
    expect(await repo.load()).toEqual(snapshot)
  })

  it('load throws PersistenceError with cause on malformed JSON', async () => {
    const storage = fakeStorage()
    storage.setItem(STORAGE_KEY, '{not json')
    const err = await new LocalStorageRepository(storage).load().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PersistenceError)
    expect((err as PersistenceError).cause).toBeInstanceOf(SyntaxError)
  })

  it('load throws PersistenceError when getItem throws', async () => {
    await expect(new LocalStorageRepository(fakeStorage('getItem')).load()).rejects.toBeInstanceOf(
      PersistenceError,
    )
  })

  it('save throws PersistenceError when setItem throws and stores nothing', async () => {
    const storage = fakeStorage('setItem')
    await expect(new LocalStorageRepository(storage).save(snapshot)).rejects.toBeInstanceOf(
      PersistenceError,
    )
    expect(storage.data.size).toBe(0)
  })
})
