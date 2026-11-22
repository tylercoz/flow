import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Diagram } from './Diagram'
import { Navigator } from './Navigator'
import { workspaceArb } from './testing/workspaceArbitrary'

describe('navigation', () => {
  // Feature: flow, Property 7: Navigation follows the nesting
  // **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  it('opens nested components to any depth and truncates the path on navigateTo', () => {
    fc.assert(
      fc.property(workspaceArb, fc.array(fc.nat({ max: 1000 }), { maxLength: 12 }), fc.nat({ max: 1000 }), ({ workspace }, picks, back) => {
        const nav = new Navigator(workspace)
        const opened: string[] = []
        const diagrams: Diagram[] = [workspace.root]
        for (const pick of picks) {
          const current = nav.current
          const components = current.placements.filter((p) => current.resourceOf(p.id)?.definition)
          if (components.length === 0) break
          const placement = components[pick % components.length]
          const child = current.resourceOf(placement.id)!.definition!.diagram
          nav.open(placement.id)
          opened.push(placement.id)
          diagrams.push(child)
          expect(nav.current).toBe(child)
          expect(nav.path).toEqual(opened)
        }

        const index = back % (opened.length + 1)
        nav.navigateTo(index)
        expect(nav.current).toBe(diagrams[index])
        expect(nav.path).toEqual(opened.slice(0, index))
      }),
    )
  })
})
