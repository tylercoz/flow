import { describe, expect, it } from 'vitest'
import { applyPortName, movePort } from './portEdit'
const ports = [
  { name: 'a', typeId: 't1' },
  { name: 'b', typeId: null },
]
describe('applyPortName', () => {
  it('renames a port and keeps its type', () => {
    expect(applyPortName(ports, 0, 'x')).toEqual([{ name: 'x', typeId: 't1' }, ports[1]])
  })
  it('appends an untyped port when the index is past the end', () => {
    expect(applyPortName(ports, 2, 'c')).toEqual([...ports, { name: 'c', typeId: null }])
  })
  it('removes an existing port when the name is emptied', () => {
    expect(applyPortName(ports, 0, '')).toEqual([ports[1]])
  })
  it('changes nothing for an unchanged name or an empty new port', () => {
    expect(applyPortName(ports, 0, 'a')).toBeUndefined()
    expect(applyPortName(ports, 2, '')).toBeUndefined()
  })
})

describe('movePort', () => {
  const list = ['a', 'b', 'c']
  it('moves a port down and up', () => {
    expect(movePort(list, 0, 2)).toEqual(['b', 'c', 'a'])
    expect(movePort(list, 2, 0)).toEqual(['c', 'a', 'b'])
  })
  it('changes nothing for the same or an out-of-range position', () => {
    expect(movePort(list, 1, 1)).toBeUndefined()
    expect(movePort(list, 1, 3)).toBeUndefined()
    expect(movePort(list, 1, -1)).toBeUndefined()
  })
})
