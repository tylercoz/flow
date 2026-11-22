import { describe, expect, it, vi } from 'vitest'
import { DomainError } from './DomainError'
import { Resource } from './Resource'
import { ResourceRegistry } from './ResourceRegistry'
import { DATABASE_PORTS, RESOURCE_KINDS, SIDE_PORTS, isResourceKind, type ResourceKind } from './ResourceKinds'

const KINDS: ResourceKind[] = ['database', 'artifact', 'user', 'input-object']
const make = (id: string, kind: ResourceKind, onChange = () => {}) =>
  new Resource(id, kind, id, RESOURCE_KINDS[kind].typed ? 't1' : null, onChange)

describe('ResourceKinds', () => {
  it('has an entry for every kind, typed only for artifact and input-object', () => {
    for (const kind of KINDS) expect(RESOURCE_KINDS[kind]).toBeDefined()
    expect(KINDS.filter((k) => RESOURCE_KINDS[k].typed)).toEqual(['artifact', 'input-object'])
  })

  it('gives a database read as source and write as target, others the four sides', () => {
    expect(RESOURCE_KINDS.database.sourceIds).toEqual([DATABASE_PORTS.read])
    expect(RESOURCE_KINDS.database.targetIds).toEqual([DATABASE_PORTS.write])
    for (const kind of ['artifact', 'user', 'input-object'] as const) {
      expect(RESOURCE_KINDS[kind].sourceIds).toEqual(SIDE_PORTS)
      expect(RESOURCE_KINDS[kind].targetIds).toEqual(SIDE_PORTS)
    }
  })

  it('isResourceKind accepts kinds and rejects other values', () => {
    expect(KINDS.every(isResourceKind)).toBe(true)
    for (const v of ['toString', 'nope', 1, null, undefined]) expect(isResourceKind(v)).toBe(false)
  })
})

describe('Resource', () => {
  it('rejects a typed kind without a type and an untyped kind with one', () => {
    const onChange = vi.fn()
    expect(() => new Resource('r', 'artifact', 'A', null, onChange)).toThrow(DomainError)
    expect(() => new Resource('r', 'input-object', 'A', null, onChange)).toThrow(DomainError)
    expect(() => new Resource('r', 'database', 'A', 't1', onChange)).toThrow(DomainError)
    expect(() => new Resource('r', 'user', 'A', 't1', onChange)).toThrow(DomainError)
    expect(() => new Resource('r', 'user', 'A', null, onChange)).not.toThrow()
  })

  it('setName and setType update the value and call onChange', () => {
    const onChange = vi.fn()
    const r = make('a', 'artifact', onChange)
    r.setName('B')
    r.setType('t2')
    expect(r.name).toBe('B')
    expect(r.typeId).toBe('t2')
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('setType on an untyped kind throws INVALID_RESOURCE and does not notify', () => {
    const onChange = vi.fn()
    const r = make('d', 'database', onChange)
    expect(() => r.setType('t1')).toThrow(expect.objectContaining({ code: 'INVALID_RESOURCE' }))
    expect(r.typeId).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ResourceRegistry', () => {
  it('adds, gets and removes resources', () => {
    const registry = new ResourceRegistry()
    const a = make('a', 'user')
    registry.add(a)
    expect(registry.get('a')).toBe(a)
    expect(registry.all).toEqual([a])
    registry.remove('a')
    expect(registry.get('a')).toBeUndefined()
    expect(registry.all).toEqual([])
  })

  it('byKind returns only resources of that kind, in insertion order', () => {
    const [d1, a1, d2] = [make('d1', 'database'), make('a1', 'artifact'), make('d2', 'database')]
    const registry = new ResourceRegistry([d1, a1, d2])
    expect(registry.byKind('database')).toEqual([d1, d2])
    expect(registry.byKind('artifact')).toEqual([a1])
    expect(registry.byKind('user')).toEqual([])
  })
})
