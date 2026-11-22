import fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { positionArb, workspaceArb } from './testing/workspaceArbitrary'

describe('Created components start empty', () => {
  // **Validates: Requirements 1.1, 1.2, 7.2**
  it('adds exactly one component Resource and one Placement of it, with no ports and an empty child Diagram', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), positionArb, ({ workspace }, pick, position) => {
        const diagrams = workspace.allDiagrams()
        const diagram = diagrams[pick % diagrams.length]
        const resourcesBefore = [...workspace.resources.all]
        const placementsBefore = [...diagram.placements]

        const created = workspace.createPlacedResource(diagram, { kind: 'component', name: '' }, position)
        const resource = workspace.resources.get(created.resourceId)!

        expect(workspace.resources.all).toHaveLength(resourcesBefore.length + 1)
        expect(workspace.resources.all.slice(0, -1)).toEqual(resourcesBefore)
        expect(workspace.resources.all.at(-1)).toBe(resource)
        expect(resource.kind).toBe('component')
        expect(diagram.placements).toHaveLength(placementsBefore.length + 1)
        expect(diagram.placements.slice(0, -1)).toEqual(placementsBefore)
        expect(diagram.placements.at(-1)).toBe(created)
        expect(created.position).toEqual(position)
        expect(resource.definition!.details.inputs).toHaveLength(0)
        expect(resource.definition!.details.outputs).toHaveLength(0)
        expect(resource.definition!.diagram.placements).toHaveLength(0)
        expect(resource.definition!.diagram.links).toHaveLength(0)
      }),
    )
  })
})
