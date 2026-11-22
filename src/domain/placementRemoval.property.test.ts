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
  // Feature: components-as-resources, Property 7: Removing a Placement keeps its Resource
  // **Validates: Requirements 6.1, 7.2**
  it('Property 7: removePlacement drops the Placement and its Links, and leaves the registry and other Diagrams unchanged', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), fc.nat({ max: 1000 }), ({ workspace }, dPick, pPick) => {
        const withPlacements = workspace.allDiagrams().filter((d) => d.placements.length > 0)
        fc.pre(withPlacements.length > 0)
        const diagram = withPlacements[dPick % withPlacements.length]
        const placement = diagram.placements[pPick % diagram.placements.length]

        const resourceIds = workspace.resources.all.map((r) => r.id)
        const othersBefore = workspace.allDiagrams().filter((d) => d !== diagram).map(shape)
        const before = shape(diagram)

        diagram.removePlacement(placement.id)

        const after = shape(diagram)
        expect(after.placements).toEqual(before.placements.filter((p) => p.id !== placement.id))
        expect(after.links).toEqual(before.links.filter((l) => l[1] !== placement.id && l[2] !== placement.id))
        expect(workspace.resources.all.map((r) => r.id)).toEqual(resourceIds)
        expect(workspace.resources.get(placement.resourceId)).toBeDefined()
        expect(workspace.allDiagrams().filter((d) => d !== diagram).map(shape)).toEqual(othersBefore)
      }),
    )
  })
})
