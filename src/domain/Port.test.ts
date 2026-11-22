import { describe, expect, it } from 'vitest'
import { portNodeHandleIds } from './Port'
import { SIDE_PORTS } from './ResourceKinds'

describe('portNodeHandleIds', () => {
  it('lets an input port start Links only', () => {
    expect(portNodeHandleIds('input', 'source')).toEqual(SIDE_PORTS)
    expect(portNodeHandleIds('input', 'target')).toEqual([])
  })
  it('lets an output port end Links only', () => {
    expect(portNodeHandleIds('output', 'target')).toEqual(SIDE_PORTS)
    expect(portNodeHandleIds('output', 'source')).toEqual([])
  })
})
