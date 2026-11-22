import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { workspaceArb } from './testing/workspaceArbitrary'
import type { Diagram } from './Diagram'

const sizes = (diagrams: readonly Diagram[]) =>
  new Map(diagrams.map((d) => [d.id, { placements: d.placements.length, links: d.links.length }]))

describe('resourceImpact', () => {
  // Feature: components-as-resources, Property 8: Impact matches deletion
  // **Validates: Requirements 6.2**
  it('reports the Placements, Links and child Diagram contents that removeResource removes', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), ({ workspace }, pick) => {
        const resources = workspace.resources.all
        fc.pre(resources.length > 0)
        const target = resources[pick % resources.length]
        const child = target.definition?.diagram

        const impact = workspace.resourceImpact(target.id)
        const before = sizes(workspace.allDiagrams())
        const childBefore = child ? before.get(child.id) : undefined
        workspace.removeResource(target.id)
        const after = sizes(workspace.allDiagrams())

        // The child Diagram leaves with its Resource; every other Diagram survives and is compared.
        expect(child !== undefined && after.has(child.id)).toBe(false)
        let placements = 0
        let links = 0
        for (const [id, now] of after) {
          const was = before.get(id)!
          placements += was.placements - now.placements
          links += was.links - now.links
        }
        expect(impact.placements).toBe(placements)
        expect(impact.links).toBe(links)
        expect(impact.contents).toEqual(childBefore && { nodes: childBefore.placements, links: childBefore.links })
      }),
      { numRuns: 100 },
    )
  })
})
