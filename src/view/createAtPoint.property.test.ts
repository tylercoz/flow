import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { History } from '../domain/History'
import { Navigator } from '../domain/Navigator'
import { TimerScheduler } from '../domain/Scheduler'
import { positionArb, workspaceArb } from '../domain/testing/workspaceArbitrary'
import { NODE_SIZE, createComponentAt } from './createAtPoint'
import { RenameController } from './RenameController'

describe('createComponentAt', () => {
  // Feature: components-as-resources, Property 10: Double-click creation is one step
  // **Validates: Requirements 7.2, 7.4**
  it('Property 10: adds one component Resource and one centred Placement, and one undo removes both', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), positionArb, ({ workspace }, pick, point) => {
        const diagrams = workspace.allDiagrams()
        const diagram = diagrams[pick % diagrams.length]
        const history = new History(workspace, new Navigator(workspace))
        history.start()
        const before = workspace.capture()
        const resourceIds = workspace.resources.all.map((r) => r.id)
        const placementIds = diagram.placements.map((p) => p.id)
        const viewport = { ...diagram.viewport }

        const created = createComponentAt(workspace, diagram, point, new RenameController(new TimerScheduler()))

        const newResources = workspace.resources.all.filter((r) => !resourceIds.includes(r.id))
        expect(newResources).toHaveLength(1)
        expect(newResources[0].kind).toBe('component')
        expect(created.resourceId).toBe(newResources[0].id)
        expect(diagram.placements.map((p) => p.id).filter((id) => !placementIds.includes(id))).toEqual([created.id])
        expect(created.position.x + NODE_SIZE.width / 2).toBe(point.x)
        expect(created.position.y + NODE_SIZE.height / 2).toBe(point.y)
        expect(diagram.viewport).toEqual(viewport)

        history.undo()
        expect(workspace.capture()).toBe(before)
        expect(history.canUndo).toBe(false)
      }),
      { numRuns: 100 },
    )
  })
})
