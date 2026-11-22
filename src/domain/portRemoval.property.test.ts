import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { History } from './History'
import { Navigator } from './Navigator'
import { workspaceArb } from './testing/workspaceArbitrary'

const port = (id: string) => ({ id, name: id, typeId: null })

describe('port removal', () => {
  // Feature: components-as-resources, Property 6: Port removal is one undo step and prunes every Diagram
  // **Validates: Requirements 5.1, 5.2**
  it('Property 6: setPorts records one History step and leaves no Link on a removed port in any Diagram', () => {
    fc.assert(
      fc.property(
        workspaceArb,
        fc.constantFrom('inputs' as const, 'outputs' as const),
        fc.array(fc.boolean(), { minLength: 2, maxLength: 2 }),
        fc.nat({ max: 2 }),
        ({ workspace }, field, keep, added) => {
          // A fresh Resource has no Placement above it, so it can be placed in every Diagram without a cycle.
          const shared = workspace.createPlacedResource(workspace.root, { kind: 'component', name: 'shared' }, { x: 0, y: 0 })
          const resourceId = shared.resourceId
          workspace.setPorts(resourceId, 'inputs', [port('i1'), port('i2')])
          workspace.setPorts(resourceId, 'outputs', [port('o1'), port('o2')])
          for (const d of workspace.allDiagrams()) {
            if (workspace.wouldCreateCycle(d, resourceId)) continue
            const a = d.addPlacement(resourceId, { x: 0, y: 0 })
            const b = d.addPlacement(resourceId, { x: 10, y: 10 })
            for (const o of ['o1', 'o2']) for (const i of ['i1', 'i2']) d.addLink(a.id, b.id, o, i)
          }

          const history = new History(workspace, new Navigator(workspace))
          history.start()
          const before = workspace.capture()

          const existing = field === 'inputs' ? ['i1', 'i2'] : ['o1', 'o2']
          const next = [
            ...existing.filter((_, n) => keep[n]).map(port),
            ...Array.from({ length: added }, (_, n) => ({ name: `new${n}`, typeId: null })),
          ]
          workspace.setPorts(resourceId, field, next)

          const details = workspace.resources.get(resourceId)!.definition!.details
          const inputIds = new Set(details.inputs.map((p) => p.id))
          const outputIds = new Set(details.outputs.map((p) => p.id))
          for (const d of workspace.allDiagrams()) {
            for (const l of d.links) {
              if (d.placement(l.sourceId)?.resourceId === resourceId) expect(outputIds.has(l.sourcePortId)).toBe(true)
              if (d.placement(l.targetId)?.resourceId === resourceId) expect(inputIds.has(l.targetPortId)).toBe(true)
            }
          }

          // Port removal and Link removals are one step: a single undo restores everything.
          if (workspace.capture() === before) {
            expect(history.canUndo).toBe(false)
            return
          }
          history.undo()
          expect(workspace.capture()).toBe(before)
          expect(history.canUndo).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })
})
