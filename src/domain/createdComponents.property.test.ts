import fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { allDiagrams, positionArb, workspaceArb } from './testing/workspaceArbitrary'

describe('Property 1: Created Components start empty', () => {
  // **Validates: Requirements 1.1**
  it('adds exactly one Component at the given position with an empty child Diagram', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), positionArb, ({ workspace }, pick, position) => {
        const diagrams = allDiagrams(workspace)
        const diagram = diagrams[pick % diagrams.length]
        const before = [...diagram.components]

        const created = diagram.addComponent(position)

        expect(diagram.components).toHaveLength(before.length + 1)
        expect(diagram.components.slice(0, -1)).toEqual(before)
        expect(diagram.components.at(-1)).toBe(created)
        expect(created.position).toEqual(position)
        expect(created.diagram.components).toHaveLength(0)
        expect(created.diagram.links).toHaveLength(0)
      }),
    )
  })
})
