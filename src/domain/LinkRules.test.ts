import { describe, expect, it } from 'vitest'
import { checkLink } from './LinkRules'
import { handleIds, SIDE_PORTS, type ResourceKind } from './ResourceKinds'

const ports = { inputs: [{ id: 'in1' }], outputs: [{ id: 'out1' }] }
const sourceOf = (kind: ResourceKind) => handleIds(kind, kind === 'component' ? ports : null, 'source')
const targetOf = (kind: ResourceKind) => handleIds(kind, kind === 'component' ? ports : null, 'target')
const sided: ResourceKind[] = ['user', 'artifact', 'input-object']

describe('checkLink', () => {
  it('accepts a Component output to a Component input', () => {
    expect(checkLink(sourceOf('component'), 'out1', targetOf('component'), 'in1')).toBeNull()
  })

  it('rejects Component ports used in the wrong role or unknown', () => {
    const [s, t] = [sourceOf('component'), targetOf('component')]
    expect(checkLink(s, 'in1', t, 'in1')?.code).toBe('INVALID_PORT')
    expect(checkLink(s, 'out1', t, 'out1')?.code).toBe('INVALID_PORT')
    expect(checkLink(s, 'nope', t, 'in1')?.code).toBe('INVALID_PORT')
  })

  it.each(sided)('accepts every side id in both roles for %s', (kind) => {
    for (const side of SIDE_PORTS) {
      expect(checkLink(sourceOf(kind), side, targetOf('component'), 'in1')).toBeNull()
      expect(checkLink(sourceOf('component'), 'out1', targetOf(kind), side)).toBeNull()
    }
  })

  it.each(sided)('rejects an unknown side id and database handles for %s', (kind) => {
    expect(checkLink(sourceOf(kind), 'middle', targetOf('component'), 'in1')?.code).toBe('INVALID_PORT')
    expect(checkLink(sourceOf('component'), 'out1', targetOf(kind), 'read')?.code).toBe('INVALID_PORT')
    expect(checkLink(sourceOf(kind), 'write', targetOf('component'), 'in1')?.code).toBe('INVALID_PORT')
  })

  it('accepts database read and write in either role', () => {
    for (const handle of ['read', 'write']) {
      expect(checkLink(sourceOf('database'), handle, targetOf('component'), 'in1')).toBeNull()
      expect(checkLink(sourceOf('component'), 'out1', targetOf('database'), handle)).toBeNull()
    }
  })
  it('rejects database side ids', () => {
    expect(checkLink(sourceOf('database'), 'top', targetOf('component'), 'in1')?.code).toBe('INVALID_PORT')
    expect(checkLink(sourceOf('component'), 'out1', targetOf('database'), 'left')?.code).toBe('INVALID_PORT')
  })
  it('accepts Placement to Placement for every kind pair, using the first and last handle of each', () => {
    const kinds: ResourceKind[] = ['database', 'artifact', 'user', 'input-object']
    for (const a of kinds) {
      for (const b of kinds) {
        const [s, t] = [sourceOf(a), targetOf(b)]
        expect(checkLink(s, s[0], t, t[0])).toBeNull()
        expect(checkLink(s, s.at(-1)!, t, t.at(-1)!)).toBeNull()
      }
    }
  })
  it('reports which end is invalid', () => {
    expect(checkLink(sourceOf('component'), 'bad', targetOf('component'), 'in1')?.message).toMatch(/source/)
    expect(checkLink(sourceOf('component'), 'out1', targetOf('component'), 'bad')?.message).toMatch(/target/)
  })
})
