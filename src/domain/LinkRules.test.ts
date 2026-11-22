import { describe, expect, it } from 'vitest'
import { checkLink, type EndShape } from './LinkRules'
import { SIDE_PORTS, type ResourceKind } from './ResourceKinds'

const component: EndShape = { kind: 'component', inputIds: ['in1'], outputIds: ['out1'] }
const placement = (resource: ResourceKind): EndShape => ({ kind: 'placement', resource })
const sided: ResourceKind[] = ['user', 'artifact', 'input-object']

describe('checkLink', () => {
  it('accepts a Component output to a Component input', () => {
    expect(checkLink(component, 'out1', component, 'in1')).toBeNull()
  })

  it('rejects Component ports used in the wrong role or unknown', () => {
    expect(checkLink(component, 'in1', component, 'in1')?.code).toBe('INVALID_PORT')
    expect(checkLink(component, 'out1', component, 'out1')?.code).toBe('INVALID_PORT')
    expect(checkLink(component, 'nope', component, 'in1')?.code).toBe('INVALID_PORT')
  })

  it.each(sided)('accepts every side id in both roles for %s', (kind) => {
    for (const side of SIDE_PORTS) {
      expect(checkLink(placement(kind), side, component, 'in1')).toBeNull()
      expect(checkLink(component, 'out1', placement(kind), side)).toBeNull()
    }
  })

  it.each(sided)('rejects an unknown side id and database handles for %s', (kind) => {
    expect(checkLink(placement(kind), 'middle', component, 'in1')?.code).toBe('INVALID_PORT')
    expect(checkLink(component, 'out1', placement(kind), 'read')?.code).toBe('INVALID_PORT')
    expect(checkLink(placement(kind), 'write', component, 'in1')?.code).toBe('INVALID_PORT')
  })

  it('accepts database read as source and write as target', () => {
    expect(checkLink(placement('database'), 'read', component, 'in1')).toBeNull()
    expect(checkLink(component, 'out1', placement('database'), 'write')).toBeNull()
  })

  it('rejects database write as source, read as target, and side ids', () => {
    expect(checkLink(placement('database'), 'write', component, 'in1')?.code).toBe('INVALID_PORT')
    expect(checkLink(component, 'out1', placement('database'), 'read')?.code).toBe('INVALID_PORT')
    expect(checkLink(placement('database'), 'top', component, 'in1')?.code).toBe('INVALID_PORT')
    expect(checkLink(component, 'out1', placement('database'), 'left')?.code).toBe('INVALID_PORT')
  })

  it('accepts Placement to Placement for every kind pair with valid handles', () => {
    const kinds: ResourceKind[] = ['database', 'artifact', 'user', 'input-object']
    for (const a of kinds) {
      for (const b of kinds) {
        const src = a === 'database' ? 'read' : 'top'
        const tgt = b === 'database' ? 'write' : 'bottom'
        expect(checkLink(placement(a), src, placement(b), tgt)).toBeNull()
      }
    }
  })

  it('reports which end is invalid', () => {
    expect(checkLink(component, 'bad', component, 'in1')?.message).toMatch(/source/)
    expect(checkLink(component, 'out1', component, 'bad')?.message).toMatch(/target/)
  })
})
