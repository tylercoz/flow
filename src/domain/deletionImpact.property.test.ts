import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { allComponents, allDiagrams, workspaceArb } from './testing/workspaceArbitrary'
import type { Workspace } from './Workspace'

const totals = (w: Workspace) => {
  const diagrams = allDiagrams(w)
  return {
    // Placements count as contents, so they are totalled with components.
    components: diagrams.reduce((n, d) => n + d.components.length + d.placements.length, 0),
    links: diagrams.reduce((n, d) => n + d.links.length, 0),
  }
}

describe('deletionImpact', () => {
  // Feature: flow, Property 6: Deletion impact matches what is deleted
  // **Validates: Requirements 1.5**
  it('reports the links and subtree contents that removeComponent actually removes', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), ({ workspace }, pick) => {
        const components = allComponents(workspace)
        fc.pre(components.length > 0)
        const target = components[pick % components.length]
        const owner = allDiagrams(workspace).find((d) => d.component(target.id))!

        const impact = owner.deletionImpact(target.id)
        const before = totals(workspace)
        const linksBefore = owner.links.length
        owner.removeComponent(target.id)
        const after = totals(workspace)

        const removedLinksInDiagram = linksBefore - owner.links.length
        const removedTotal = before.components - after.components + (before.links - after.links)
        // The component itself is removed too but is not counted as "contents".
        expect(impact.links).toBe(removedLinksInDiagram)
        expect(impact.contents).toBe(removedTotal - removedLinksInDiagram - 1)
      }),
    )
  })
})
