import { describe, expect, it } from 'vitest'
import { availableEntries } from './idListEdit'
const catalog = [
  { id: 'a', name: 'NotFound' },
  { id: 'b', name: 'Timeout' },
]
describe('availableEntries', () => {
  it('offers the whole catalog when none is used', () => {
    expect(availableEntries(catalog, [])).toEqual(catalog)
  })
  it('leaves out entries already used', () => {
    expect(availableEntries(catalog, ['a'])).toEqual([catalog[1]])
  })
  it('offers nothing once all are used', () => {
    expect(availableEntries(catalog, ['a', 'b'])).toEqual([])
  })
})
