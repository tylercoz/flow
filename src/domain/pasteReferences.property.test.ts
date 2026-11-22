import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { positionArb, workspaceArb } from './testing/workspaceArbitrary'

describe('paste properties', () => {
  // Feature: components-as-resources, Property 4: Paste references the same Resources
  // **Validates: Requirements 3.1, 3.2**
  it('paste adds one fresh Placement per copied Placement on the same Resource, keeps inner Links, and leaves the registry unchanged', () => {
    fc.assert(
      fc.property(
        workspaceArb,
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        fc.array(fc.boolean(), { maxLength: 40 }),
        positionArb,
        ({ workspace }, sourcePick, targetPick, mask, offset) => {
          const diagrams = workspace.allDiagrams()
          const source = diagrams[sourcePick % diagrams.length]
          const target = diagrams[targetPick % diagrams.length]
          const selected = source.placements.filter((_, i) => mask[i])
          // Cyclic pastes are Property 5's concern; only acyclic targets are in scope here.
          if (selected.some((p) => workspace.wouldCreateCycle(target, p.resourceId))) return

          const ids = new Set(selected.map((p) => p.id))
          const innerLinks = source.links.filter((l) => ids.has(l.sourceId) && ids.has(l.targetId))
          const resourcesBefore = [...workspace.resources.all]
          const placementIdsBefore = new Set(workspace.allDiagrams().flatMap((d) => d.placements.map((p) => p.id)))
          const placementsBefore = target.placements.length
          const linksBefore = target.links.length

          const fragment = workspace.copy(source, ids)
          const pasted = workspace.paste(target, fragment, offset)

          expect(pasted.placements).toHaveLength(selected.length)
          pasted.placements.forEach((p, i) => {
            expect(p.resourceId).toBe(selected[i].resourceId)
            expect(placementIdsBefore.has(p.id)).toBe(false)
          })
          expect(new Set(pasted.placements.map((p) => p.id)).size).toBe(selected.length)
          expect(target.placements).toHaveLength(placementsBefore + selected.length)

          expect(pasted.links).toHaveLength(innerLinks.length)
          expect(target.links).toHaveLength(linksBefore + innerLinks.length)
          const newId = new Map(selected.map((p, i) => [p.id, pasted.placements[i].id]))
          innerLinks.forEach((l, i) => {
            expect(pasted.links[i].sourceId).toBe(newId.get(l.sourceId))
            expect(pasted.links[i].targetId).toBe(newId.get(l.targetId))
            expect(pasted.links[i].sourcePortId).toBe(l.sourcePortId)
            expect(pasted.links[i].targetPortId).toBe(l.targetPortId)
          })

          expect(workspace.resources.all).toEqual(resourcesBefore)
        },
      ),
      { numRuns: 200 },
    )
  })
})
