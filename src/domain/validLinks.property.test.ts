import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { allDiagrams, workspaceArb } from './testing/workspaceArbitrary'

const pick = fc.nat({ max: 1000 })

describe('Diagram links', () => {
  // Feature: flow, Property 3: Valid links are created, and removal restores the link set
  // **Validates: Requirements 3.1, 3.3**
  it('addLink adds exactly one link between two distinct components, and removeLink restores the link set', () => {
    fc.assert(
      fc.property(workspaceArb, pick, pick, pick, ({ workspace }, di, a, b) => {
        const diagrams = allDiagrams(workspace).filter((d) => d.components.length >= 2)
        fc.pre(diagrams.length > 0)
        const diagram = diagrams[di % diagrams.length]
        const source = diagram.components[a % diagram.components.length]
        // Offset by 1..n-1 guarantees a distinct target.
        const target = diagram.components[(a + 1 + (b % (diagram.components.length - 1))) % diagram.components.length]

        const before = diagram.links.map((l) => l.id)
        const link = diagram.addLink(source.id, target.id)

        expect(diagram.links).toHaveLength(before.length + 1)
        expect(diagram.links.filter((l) => !before.includes(l.id))).toEqual([link])
        expect([link.sourceId, link.targetId]).toEqual([source.id, target.id])

        diagram.removeLink(link.id)
        expect(diagram.links.map((l) => l.id)).toEqual(before)
      }),
    )
  })
})
