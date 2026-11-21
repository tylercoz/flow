import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Diagram } from './Diagram'
import { allComponents, allDiagrams, buildWorkspace, commandsArb } from './testing/workspaceArbitrary'

const pick = fc.nat({ max: 1000 })

// The shared helpers start from a Workspace; the doomed subtree starts from one Diagram.
const subtree = (d: Diagram): Diagram[] => [d, ...d.components.flatMap((c) => subtree(c.diagram))]

// Feature: flow, Property 5: Deletion cascades and keeps references intact
describe('Property 5: Deletion cascades and keeps references intact', () => {
  // **Validates: Requirements 1.4**
  it('removes the component, its child tree and attached links, leaving every link intact', () => {
    fc.assert(
      fc.property(commandsArb, pick, pick, (commands, diagramPick, componentPick) => {
        const workspace = buildWorkspace(commands)
        const candidates = allDiagrams(workspace).filter((d) => d.components.length > 0)
        fc.pre(candidates.length > 0)
        const diagram = candidates[diagramPick % candidates.length]
        const target = diagram.components[componentPick % diagram.components.length]

        const doomedDiagrams = subtree(target.diagram)
        const doomedComponentIds = new Set([target.id, ...doomedDiagrams.flatMap((d) => d.components.map((c) => c.id))])
        const doomedLinkIds = new Set([
          ...doomedDiagrams.flatMap((d) => d.links.map((l) => l.id)),
          ...diagram.links.filter((l) => l.sourceId === target.id || l.targetId === target.id).map((l) => l.id),
        ])
        const survivingComponents = allComponents(workspace).map((c) => c.id).filter((id) => !doomedComponentIds.has(id))
        const survivingLinks = allDiagrams(workspace).flatMap((d) => d.links.map((l) => l.id)).filter((id) => !doomedLinkIds.has(id))

        diagram.removeComponent(target.id)

        const after = allDiagrams(workspace)
        expect(allComponents(workspace).map((c) => c.id)).toEqual(survivingComponents)
        expect(after.flatMap((d) => d.links.map((l) => l.id))).toEqual(survivingLinks)
        for (const d of after) {
          for (const l of d.links) {
            expect(d.component(l.sourceId)).toBeDefined()
            expect(d.component(l.targetId)).toBeDefined()
          }
        }
      }),
    )
  })
})
