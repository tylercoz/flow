import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Diagram } from './Diagram'
import { Navigator } from './Navigator'
import { viewportArb, workspaceArb } from './testing/workspaceArbitrary'

// Every Diagram with the component-id path that opens it, root first.
function diagramPaths(root: Diagram): { diagram: Diagram; path: string[] }[] {
  const out: { diagram: Diagram; path: string[] }[] = []
  const visit = (diagram: Diagram, path: string[]): void => {
    out.push({ diagram, path })
    diagram.components.forEach((c) => visit(c.diagram, [...path, c.id]))
  }
  visit(root, [])
  return out
}

describe('Viewports', () => {
  // Feature: flow, Property 8: Viewports survive navigation
  // **Validates: Requirements 4.1, 4.2**
  it('a Diagram keeps the viewport set on it after navigating away and back', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), viewportArb, ({ workspace }, pick, viewport) => {
        const all = diagramPaths(workspace.root)
        const { diagram, path } = all[pick % all.length]
        const nav = new Navigator(workspace)

        path.forEach((id) => nav.open(id))
        expect(nav.current).toBe(diagram)
        diagram.setViewport(viewport)

        nav.navigateTo(0)
        // Visit every other Diagram too, so "away" is more than the root.
        for (const other of all) {
          nav.navigateTo(0)
          other.path.forEach((id) => nav.open(id))
        }
        nav.navigateTo(0)
        path.forEach((id) => nav.open(id))

        expect(nav.current).toBe(diagram)
        expect(nav.current.viewport).toEqual(viewport)
      }),
    )
  })
})
