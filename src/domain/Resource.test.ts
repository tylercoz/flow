import { describe, expect, it, vi } from 'vitest'
import { DomainError } from './DomainError'
import { Resource } from './Resource'
import { ResourceRegistry } from './ResourceRegistry'
import { Workspace } from './Workspace'
import { DATABASE_PORTS, RESOURCE_KINDS, SIDE_PORTS, handleIds, isResourceKind, kindInvariantError, type ResourceKind } from './ResourceKinds'

const KINDS: ResourceKind[] = ['database', 'artifact', 'user', 'input-object', 'component']
const make = (id: string, kind: ResourceKind, onChange = () => {}) =>
  new Resource(id, kind, id, RESOURCE_KINDS[kind].typed ? 't1' : null, null, onChange)

describe('ResourceKinds', () => {
  it('has an entry for every kind, typed only for artifact and input-object', () => {
    for (const kind of KINDS) expect(RESOURCE_KINDS[kind]).toBeDefined()
    expect(KINDS.filter((k) => RESOURCE_KINDS[k].typed)).toEqual(['artifact', 'input-object'])
  })

  it('gives a database read and write in both roles, others the four sides', () => {
    expect(handleIds('database', null, 'source')).toEqual([DATABASE_PORTS.read, DATABASE_PORTS.write])
    expect(handleIds('database', null, 'target')).toEqual([DATABASE_PORTS.read, DATABASE_PORTS.write])
    for (const kind of ['artifact', 'user', 'input-object'] as const) {
      expect(handleIds(kind, null, 'source')).toEqual(SIDE_PORTS)
      expect(handleIds(kind, null, 'target')).toEqual(SIDE_PORTS)
    }
  })

  it('takes component handles from the given port lists, outputs as source and inputs as target', () => {
    const ports = { inputs: [{ id: 'i' }], outputs: [{ id: 'o' }] }
    expect(handleIds('component', ports, 'source')).toEqual(['o'])
    expect(handleIds('component', ports, 'target')).toEqual(['i'])
  })

  it('kindInvariantError returns a message for each broken invariant and null otherwise', () => {
    expect(kindInvariantError('artifact', null, false)).toMatch(/needs a data type/)
    expect(kindInvariantError('user', 't1', false)).toMatch(/cannot have a data type/)
    expect(kindInvariantError('component', null, false)).toMatch(/must have a component definition/)
    expect(kindInvariantError('user', null, true)).toMatch(/cannot have a component definition/)
    expect(kindInvariantError('artifact', 't1', false)).toBeNull()
    expect(kindInvariantError('component', null, true)).toBeNull()
  })

  it('isResourceKind accepts kinds and rejects other values', () => {
    expect(KINDS.every(isResourceKind)).toBe(true)
    for (const v of ['toString', 'nope', 1, null, undefined]) expect(isResourceKind(v)).toBe(false)
  })
})

describe('Resource', () => {
  it('rejects a typed kind without a type and an untyped kind with one', () => {
    const onChange = vi.fn()
    expect(() => new Resource('r', 'artifact', 'A', null, null, onChange)).toThrow(DomainError)
    expect(() => new Resource('r', 'input-object', 'A', null, null, onChange)).toThrow(DomainError)
    expect(() => new Resource('r', 'database', 'A', 't1', null, onChange)).toThrow(DomainError)
    expect(() => new Resource('r', 'user', 'A', 't1', null, onChange)).toThrow(DomainError)
    expect(() => new Resource('r', 'user', 'A', null, null, onChange)).not.toThrow()
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

  it('requires a definition for a component and forbids one for other kinds', () => {
    const ws = Workspace.empty({ next: () => 'x' + Math.random() })
    const placement = ws.createPlacedResource(ws.root, { kind: 'component', name: 'C' }, { x: 0, y: 0 })
    const definition = ws.resources.get(placement.resourceId)!.definition!
    const code = expect.objectContaining({ code: 'INVALID_RESOURCE' })
    expect(() => new Resource('r', 'component', 'C', null, null, () => {})).toThrow(code)
    expect(() => new Resource('r', 'user', 'U', null, definition, () => {})).toThrow(code)
    expect(() => new Resource('r', 'component', 'C', null, definition, () => {})).not.toThrow()
  })

  it('renames a component through the Resource, notifying once', () => {
    const ws = Workspace.empty({ next: () => 'x' + Math.random() })
    const placement = ws.createPlacedResource(ws.root, { kind: 'component', name: 'C' }, { x: 0, y: 0 })
    const resource = ws.resources.get(placement.resourceId)!
    const before = ws.getVersion()
    resource.setName('D')
    expect(resource.name).toBe('D')
    expect(ws.getVersion()).toBe(before + 1)
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
