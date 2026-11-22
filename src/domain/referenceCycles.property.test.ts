import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import type { Diagram } from './Diagram'
import type { Fragment } from './WorkspaceSnapshot'
import { positionArb, workspaceArb } from './testing/workspaceArbitrary'
import type { Workspace } from './Workspace'

// Oracle that does not use DiagramGraph: walks Placements of component Resources from `from` looking for `to`.
function reachable(workspace: Workspace, from: Diagram, to: Diagram): boolean {
  const seen = new Set<string>()
  const visit = (d: Diagram): boolean => {
    if (d === to) return true
    if (seen.has(d.id)) return false
    seen.add(d.id)
    return d.placements.some((p) => {
      const child = workspace.resources.get(p.resourceId)?.definition?.diagram
      return !!child && visit(child)
    })
  }
  return visit(from)
}

describe('reference cycles', () => {
  // Feature: components-as-resources, Property 5: Cycles are rejected without change
  // **Validates: Requirements 3.4, 4.1, 4.2**
  it('Property 5: addPlacement and paste throw REFERENCE_CYCLE and change nothing exactly when the target is reachable from the Resource', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat(), fc.nat(), positionArb, ({ workspace }, diagramPick, resourcePick, position) => {
        // Guarantee a nesting so cyclic targets exist whatever the generated shape.
        const outer = workspace.createPlacedResource(workspace.root, { kind: 'component', name: '' }, { x: 0, y: 0 })
        workspace.createPlacedResource(workspace.resources.get(outer.resourceId)!.definition!.diagram, { kind: 'component', name: '' }, { x: 0, y: 0 })

        const diagrams = workspace.allDiagrams()
        const target = diagrams[diagramPick % diagrams.length]
        const components = workspace.componentResources()
        const resource = components[resourcePick % components.length]
        const expectCycle = reachable(workspace, resource.definition!.diagram, target)

        // The Picker filter and the mutators share one rule.
        expect(workspace.wouldCreateCycle(target, resource.id)).toBe(expectCycle)

        const fragment: Fragment = { placements: [{ id: 'fragment-placement', resourceId: resource.id, position }], links: [] }
        const before = workspace.capture()
        const version = workspace.getVersion()
        const cycle = expect.objectContaining({ code: 'REFERENCE_CYCLE' })

        if (expectCycle) {
          expect(() => target.addPlacement(resource.id, position)).toThrowError(cycle)
          expect(() => workspace.paste(target, fragment, { x: 1, y: 1 })).toThrowError(cycle)
          expect(workspace.capture()).toBe(before)
          expect(workspace.getVersion()).toBe(version)
        } else {
          const count = target.placements.length
          expect(target.addPlacement(resource.id, position).resourceId).toBe(resource.id)
          expect(workspace.paste(target, fragment, { x: 1, y: 1 }).placements).toHaveLength(1)
          expect(target.placements).toHaveLength(count + 2)
        }
      }),
      { numRuns: 100 },
    )
  })
})
