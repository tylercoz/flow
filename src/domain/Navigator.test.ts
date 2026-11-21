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

  describe('reconcile', () => {
    // Swapping the root mimics Workspace.replaceContent building a new tree.
    function swappable() {
      const { root, a, b } = setup()
      const workspace = { root }
      return { workspace, a, b, nav: new Navigator(workspace) }
    }

    it('keeps a valid path and does not notify', () => {
      const { workspace, a, b, nav } = swappable()
      nav.open(a.id)
      nav.open(b.id)
      // Same id sequence as setup(), so the new tree has the same ids, as after a restore.
      let n = 0
      const rebuilt = new Diagram('root', { ids: { next: () => `id${++n}` }, onChange: () => {} })
      rebuilt.addComponent({ x: 0, y: 0 }).diagram.addComponent({ x: 0, y: 0 })
      workspace.root = rebuilt
      let calls = 0
      nav.subscribe(() => calls++)
      nav.reconcile()
      expect(nav.path).toEqual([a.id, b.id])
      expect(calls).toBe(0)
      expect(() => nav.trail()).not.toThrow()
    })

    it('resets a stale path to the root and notifies once', () => {
      const { workspace, a, nav } = swappable()
      nav.open(a.id)
      workspace.root = new Diagram('root', { ids: { next: () => 'y' }, onChange: () => {} })
      let calls = 0
      nav.subscribe(() => calls++)
      nav.reconcile()
      expect(nav.path).toEqual([])
      expect(nav.current).toBe(workspace.root)
      expect(calls).toBe(1)
    })

    it('does nothing at the root', () => {
      const { nav } = swappable()
      let calls = 0
      nav.subscribe(() => calls++)
      nav.reconcile()
      expect(nav.path).toEqual([])
      expect(calls).toBe(0)
    })
  })

  it('trail shows a renamed Component', () => {
    const { nav, a } = setup()
    nav.open(a.id)
    a.details.patch({ name: 'Renamed' })
    expect(nav.trail()[0].details.name).toBe('Renamed')
  })
})
