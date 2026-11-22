import { describe, expect, it } from 'vitest'
import { Catalog } from './Catalog'

const ids = () => {
  let n = 0
  return { next: () => `id${++n}` }
}

describe('Catalog', () => {
  it('adds entries with generated ids', () => {
    const c = new Catalog(ids())
    expect(c.add('a')).toEqual({ id: 'id1', name: 'a' })
    expect(c.all).toEqual([{ id: 'id1', name: 'a' }])
  })

  it('renames only the matching entry', () => {
    const c = new Catalog(ids(), [{ id: 'x', name: 'a' }, { id: 'y', name: 'b' }])
    c.rename('x', 'z')
    expect(c.all).toEqual([{ id: 'x', name: 'z' }, { id: 'y', name: 'b' }])
  })

  it('removes entries and reports membership', () => {
    const c = new Catalog(ids(), [{ id: 'x', name: 'a' }])
    expect(c.has('x')).toBe(true)
    c.remove('x')
    expect(c.has('x')).toBe(false)
    expect(c.all).toEqual([])
  })

  it('copies its input and replaces contents without mutating earlier reads', () => {
    const source = [{ id: 'x', name: 'a' }]
    const c = new Catalog(ids(), source)
    const before = c.all
    c.replace([{ id: 'y', name: 'b' }])
    expect(before).toEqual([{ id: 'x', name: 'a' }])
    expect(before[0]).not.toBe(source[0])
    expect(c.all).toEqual([{ id: 'y', name: 'b' }])
  })
})
