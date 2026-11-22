import { describe, expect, it } from 'vitest'
import { DomainError } from './DomainError'
import { Navigator } from './Navigator'
import { Workspace } from './Workspace'

// `a` is placed in the root and `b` inside a's child Diagram. The same id sequence builds the same ids.
function build() {
  let n = 0
  const workspace = Workspace.empty({ next: () => `id${++n}` })
  const a = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'A' }, { x: 0, y: 0 })
  const ra = workspace.resources.get(a.resourceId)!
  const b = workspace.createPlacedResource(ra.definition!.diagram, { kind: 'component', name: 'B' }, { x: 0, y: 0 })
  const rb = workspace.resources.get(b.resourceId)!
  return { workspace, a, b, ra, rb }
}

function setup() {
  const built = build()
  return { ...built, root: built.workspace.root, nav: new Navigator(built.workspace) }
}

describe('Navigator', () => {
  it('starts at the root', () => {
    const { nav, root } = setup()
    expect(nav.path).toEqual([])
    expect(nav.current).toBe(root)
    expect(nav.trail()).toEqual([])
  })

  it('opens nested components by Placement id and notifies', () => {
    const { nav, a, b, ra, rb } = setup()
    let calls = 0
    nav.subscribe(() => calls++)
    nav.open(a.id)
    nav.open(b.id)
    expect(nav.path).toEqual([a.id, b.id])
    expect(nav.current).toBe(rb.definition!.diagram)
    expect(nav.trail()).toEqual([ra, rb])
    expect(calls).toBe(2)
  })

  it('opens the same Diagram from two Placements of one Resource', () => {
    const { workspace, nav, a, ra } = setup()
    const twin = workspace.root.addPlacement(a.resourceId, { x: 5, y: 5 })
    nav.open(twin.id)
    expect(nav.current).toBe(ra.definition!.diagram)
  })

  it('rejects Placements outside the current Diagram', () => {
    const { nav, b } = setup()
    expect(() => nav.open(b.id)).toThrow(DomainError)
    expect(nav.path).toEqual([])
  })

  it('rejects a Placement of a Resource that is not a component', () => {
    const { workspace, nav } = setup()
    const user = workspace.createPlacedResource(workspace.root, { kind: 'user', name: 'U' }, { x: 0, y: 0 })
    expect(() => nav.open(user.id)).toThrow(expect.objectContaining({ code: 'NOT_A_COMPONENT' }))
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
      const { a, b, root } = setup()
      const holder = { root }
      return { holder, a, b, nav: new Navigator(holder) }
    }

    it('keeps a valid path and does not notify', () => {
      const { holder, a, b, nav } = swappable()
      nav.open(a.id)
      nav.open(b.id)
      holder.root = build().workspace.root
      let calls = 0
      nav.subscribe(() => calls++)
      nav.reconcile()
      expect(nav.path).toEqual([a.id, b.id])
      expect(calls).toBe(0)
      expect(() => nav.trail()).not.toThrow()
    })

    it('resets a stale path to the root and notifies once', () => {
      const { holder, a, nav } = swappable()
      nav.open(a.id)
      holder.root = Workspace.empty({ next: () => 'y' }).root
      let calls = 0
      nav.subscribe(() => calls++)
      nav.reconcile()
      expect(nav.path).toEqual([])
      expect(nav.current).toBe(holder.root)
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

  it('reports the component whose Level is shown, and null at the root', () => {
    const { nav, a, b, ra, rb } = setup()
    expect(nav.currentComponent).toBeNull()
    nav.open(a.id)
    expect(nav.currentComponent).toBe(ra.definition)
    nav.open(b.id)
    expect(nav.currentComponent).toBe(rb.definition)
  })
  it('trail shows a renamed component', () => {
    const { nav, a, ra } = setup()
    nav.open(a.id)
    ra.setName('Renamed')
    expect(nav.trail()[0].name).toBe('Renamed')
  })
})
