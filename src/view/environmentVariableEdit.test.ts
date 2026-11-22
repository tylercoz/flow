import { describe, expect, it } from 'vitest'
import { availableEnvironmentVariables } from './environmentVariableEdit'

const catalog = [
  { id: 'a', name: 'DATABASE_URL' },
  { id: 'b', name: 'API_KEY' },
]

describe('availableEnvironmentVariables', () => {
  it('offers the whole catalog when none is used', () => {
    expect(availableEnvironmentVariables(catalog, [])).toEqual(catalog)
  })
  it('leaves out variables already used', () => {
    expect(availableEnvironmentVariables(catalog, ['a'])).toEqual([catalog[1]])
  })
  it('offers nothing once all are used', () => {
    expect(availableEnvironmentVariables(catalog, ['a', 'b'])).toEqual([])
  })
})
