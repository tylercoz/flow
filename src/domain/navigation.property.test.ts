import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
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
        const diagrams = [workspace.root]
        for (const pick of picks) {
          const components = nav.current.components
          if (components.length === 0) break
          const component = components[pick % components.length]
          nav.open(component.id)
          opened.push(component.id)
          diagrams.push(component.diagram)
          expect(nav.current).toBe(component.diagram)
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
