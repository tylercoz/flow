import { describe, expect, it } from 'vitest'
import { availableExceptions } from './exceptionEdit'

const catalog = [
  { id: 'a', name: 'NotFound' },
  { id: 'b', name: 'Timeout' },
]

describe('availableExceptions', () => {
  it('offers the whole catalog when none is used', () => {
    expect(availableExceptions(catalog, [])).toEqual(catalog)
  })
  it('leaves out exceptions already used', () => {
    expect(availableExceptions(catalog, ['a'])).toEqual([catalog[1]])
  })
  it('offers nothing once all are used', () => {
    expect(availableExceptions(catalog, ['a', 'b'])).toEqual([])
  })
})
