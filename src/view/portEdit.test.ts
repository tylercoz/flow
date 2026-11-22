import { describe, expect, it } from 'vitest'
import { applyPortName } from './portEdit'
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
