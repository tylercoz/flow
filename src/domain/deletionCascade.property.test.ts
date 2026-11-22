import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { History } from './History'
import { Navigator } from './Navigator'
import { buildWorkspace, commandsArb } from './testing/workspaceArbitrary'

const pick = fc.nat({ max: 1000 })

// Feature: components-as-resources, Property 9: Resource deletion removes only its own scope
describe('Property 9: Resource deletion removes only its own scope', () => {
  // **Validates: Requirements 6.3, 6.5**
  it('removes the Resource, its Placements, their Links and its child Diagram, keeps every other Resource and is one undo step', () => {
    fc.assert(
      fc.property(commandsArb, pick, (commands, resourcePick) => {
        const workspace = buildWorkspace(commands)
        const resources = workspace.resources.all
        fc.pre(resources.length > 0)
        const target = resources[resourcePick % resources.length]
        const doomedDiagram = target.definition?.diagram

        // Expected survivors, taken before deletion: a Link survives when neither end is a Placement of the target.
        const touchesTarget = (d: ReturnType<typeof workspace.allDiagrams>[number], id: string): boolean =>
          d.placement(id)?.resourceId === target.id
        const survivingDiagrams = workspace.allDiagrams().filter((d) => d !== doomedDiagram)
        const expectedPlacements = survivingDiagrams.map((d) => [d.id, d.placements.filter((p) => p.resourceId !== target.id).map((p) => p.id)])
        const expectedLinks = survivingDiagrams.map((d) => [d.id, d.links.filter((l) => !touchesTarget(d, l.sourceId) && !touchesTarget(d, l.targetId)).map((l) => l.id)])
        const survivingResourceIds = resources.filter((r) => r !== target).map((r) => r.id)

        const history = new History(workspace, new Navigator(workspace))
        history.start()
        const before = workspace.capture()

        workspace.removeResource(target.id)

        expect(workspace.resources.all.map((r) => r.id)).toEqual(survivingResourceIds)
        const after = workspace.allDiagrams()
        if (doomedDiagram) expect(after).not.toContain(doomedDiagram)
        expect(after.map((d) => d.id)).toEqual(survivingDiagrams.map((d) => d.id))
        expect(after.map((d) => [d.id, d.placements.map((p) => p.id)])).toEqual(expectedPlacements)
        expect(after.map((d) => [d.id, d.links.map((l) => l.id)])).toEqual(expectedLinks)
        for (const d of after) {
          for (const p of d.placements) expect(workspace.resources.get(p.resourceId)).toBeDefined()
          for (const l of d.links) {
            expect(d.placement(l.sourceId)).toBeDefined()
            expect(d.placement(l.targetId)).toBeDefined()
          }
        }

        // The removal always changes content (a Resource left the registry), so exactly one step is recorded.
        expect(history.canUndo).toBe(true)
        history.undo()
        expect(workspace.capture()).toBe(before)
        expect(history.canUndo).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})
