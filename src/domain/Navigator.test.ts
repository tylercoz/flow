import { describe, expect, it } from 'vitest'
import { Diagram } from './Diagram'
import { DomainError } from './DomainError'
import { Navigator } from './Navigator'

function setup() {
  let n = 0
  const root = new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => {} })
  const a = root.addComponent({ x: 0, y: 0 })
  const b = a.diagram.addComponent({ x: 0, y: 0 })
  return { root, a, b, nav: new Navigator({ root }) }
}

describe('Navigator', () => {
  it('starts at the root', () => {
    const { nav, root } = setup()
    expect(nav.path).toEqual([])
    expect(nav.current).toBe(root)
    expect(nav.trail()).toEqual([])
  })

  it('opens nested Components and notifies', () => {
    const { nav, a, b } = setup()
    let calls = 0
    nav.subscribe(() => calls++)
    nav.open(a.id)
    nav.open(b.id)
    expect(nav.path).toEqual([a.id, b.id])
    expect(nav.current).toBe(b.diagram)
    expect(nav.trail()).toEqual([a, b])
    expect(calls).toBe(2)
  })

  it('rejects Components outside the current Diagram', () => {
    const { nav, b } = setup()
    expect(() => nav.open(b.id)).toThrow(DomainError)
    expect(nav.path).toEqual([])
  })

  it('navigateTo keeps the first i elements and rejects bad indexes', () => {
    const { nav, a, b, root } = setup()
    nav.open(a.id)
    nav.open(b.id)
    nav.navigateTo(1)
    expect(nav.path).toEqual([a.id])
    nav.navigateTo(0)
    expect(nav.current).toBe(root)
    expect(() => nav.navigateTo(1)).toThrow(RangeError)
    expect(() => nav.navigateTo(-1)).toThrow(RangeError)
  })

  it('trail shows a renamed Component', () => {
    const { nav, a } = setup()
    nav.open(a.id)
    a.details.patch({ name: 'Renamed' })
    expect(nav.trail()[0].details.name).toBe('Renamed')
  })
})
