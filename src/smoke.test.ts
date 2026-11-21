import fc from 'fast-check'
import { expect, test } from 'vitest'

test('toolchain runs example and property tests', () => {
  expect(1 + 1).toBe(2)
  fc.assert(fc.property(fc.integer(), fc.integer(), (a, b) => a + b === b + a))
})
