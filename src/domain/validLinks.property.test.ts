import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { connect } from './testing/connect'
import { handleIds, workspaceArb } from './testing/workspaceArbitrary'

const pick = fc.nat({ max: 1000 })

describe('Diagram links', () => {
  // Feature: flow, Property 3: Valid links are created, and removal restores the link set
  // **Validates: Requirements 3.1, 3.3**
  it('addLink adds exactly one link between two distinct component Placements, and removeLink restores the link set', () => {
    fc.assert(
      fc.property(workspaceArb, pick, pick, pick, ({ workspace }, di, a, b) => {
        const isComponent = (d: ReturnType<typeof workspace.allDiagrams>[number]) =>
          d.placements.filter((p) => d.resourceOf(p.id)?.definition)
        const diagrams = workspace.allDiagrams().filter((d) => isComponent(d).length >= 2)
        fc.pre(diagrams.length > 0)
        const diagram = diagrams[di % diagrams.length]
        const nodes = isComponent(diagram)
        const source = nodes[a % nodes.length]
        // Offset by 1..n-1 guarantees a distinct target.
        const target = nodes[(a + 1 + (b % (nodes.length - 1))) % nodes.length]

        const before = diagram.links.map((l) => l.id)
        const link = connect(workspace, diagram, source, target)

        expect(diagram.links).toHaveLength(before.length + 1)
        expect(diagram.links.filter((l) => !before.includes(l.id))).toEqual([link])
        expect([link.sourceId, link.targetId]).toEqual([source.id, target.id])
        const out = workspace.resources.get(source.resourceId)!.definition!.details.outputs.at(-1)?.id
        const inn = workspace.resources.get(target.resourceId)!.definition!.details.inputs.at(-1)?.id
        expect([link.sourcePortId, link.targetPortId]).toEqual([out, inn])

        diagram.removeLink(link.id)
        expect(diagram.links.map((l) => l.id)).toEqual(before)
        // Requirement 1.6: Links live in the Diagram, never in the registry.
        expect(workspace.resources.all.every((r) => !('links' in r))).toBe(true)
      }),
    )
  })

  // Feature: components-as-resources, Property 3: Links are valid and live in their Diagram
  // **Validates: Requirements 1.6, 5.1**
  it('every Link joins two Placements of its own Diagram through ports of their Resources, and no Resource stores Links', () => {
    fc.assert(
      fc.property(workspaceArb, ({ workspace }) => {
        const diagrams = workspace.allDiagrams()
        const all = diagrams.flatMap((d) => d.links.map((l) => l.id))
        expect(new Set(all).size).toBe(all.length)

        for (const diagram of diagrams) {
          for (const link of diagram.links) {
            const source = diagram.placement(link.sourceId)
            const target = diagram.placement(link.targetId)
            expect(source).toBeDefined()
            expect(target).toBeDefined()
            expect(handleIds(workspace, source!, 'source')).toContain(link.sourcePortId)
            expect(handleIds(workspace, target!, 'target')).toContain(link.targetPortId)
          }
        }

        for (const resource of workspace.resources.all) {
          expect('links' in resource).toBe(false)
          if (resource.definition) expect('links' in resource.definition).toBe(false)
        }
      }),
      { numRuns: 100 },
    )
  })
})
