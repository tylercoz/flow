import { describe, expect, it } from 'vitest'
import { selectionKey } from './selectionKey'

describe('selectionKey', () => {
  it('is equal for the same ids in any order', () => {
    expect(selectionKey(['a', 'b'], ['e'])).toBe(selectionKey(['b', 'a'], ['e']))
  })

  it('differs when the selection differs, including node vs edge', () => {
    expect(selectionKey(['a'], [])).not.toBe(selectionKey([], ['a']))
    expect(selectionKey(['a'], [])).not.toBe(selectionKey([], []))
  })
})
