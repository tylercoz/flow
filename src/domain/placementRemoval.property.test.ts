import fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import type { Diagram } from './Diagram'
import { workspaceArb } from './testing/workspaceArbitrary'

const shape = (d: Diagram) => ({
  id: d.id,
  placements: d.placements.map((p) => ({ id: p.id, resourceId: p.resourceId, position: { ...p.position }, size: p.size && { ...p.size } })),
  links: d.links.map((l) => [l.id, l.sourceId, l.targetId, l.sourcePortId, l.targetPortId]),
})

describe('Placement removal', () => {
  // Feature: components-as-resources, Property 7: Removing a Placement deletes its Resource only with the last one
  // **Validates: Requirements 6.1, 7.2**
  it('Property 7: removePlacement drops the Placement and its Links, and deletes the Resource only with its last Placement', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), fc.nat({ max: 1000 }), ({ workspace }, dPick, pPick) => {
        const withPlacements = workspace.allDiagrams().filter((d) => d.placements.length > 0)
        fc.pre(withPlacements.length > 0)
        const diagram = withPlacements[dPick % withPlacements.length]
        const placement = diagram.placements[pPick % diagram.placements.length]

        const resourceIds = workspace.resources.all.map((r) => r.id)
        const lastOne = workspace.allDiagrams().flatMap((d) => d.placements).filter((p) => p.resourceId === placement.resourceId).length === 1
        const others = workspace.allDiagrams().filter((d) => d !== diagram)
        const othersBefore = others.map(shape)
        const before = shape(diagram)

        diagram.removePlacement(placement.id)

        const after = shape(diagram)
        expect(after.placements).toEqual(before.placements.filter((p) => p.id !== placement.id))
        expect(after.links).toEqual(before.links.filter((l) => l[1] !== placement.id && l[2] !== placement.id))
        expect(workspace.resources.get(placement.resourceId) === undefined).toBe(lastOne)
        // A deleted component takes its child Diagram and the Resources placed only there, so those are exempt.
        if (!lastOne) {
          expect(workspace.resources.all.map((r) => r.id)).toEqual(resourceIds)
          expect(workspace.allDiagrams().filter((d) => d !== diagram).map(shape)).toEqual(othersBefore)
        }
      }),
    )
  })
})
