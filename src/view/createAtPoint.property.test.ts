import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { TimerScheduler } from '../domain/Scheduler'
import type { Scheduler } from '../domain/Scheduler'
import { allDiagrams, positionArb, workspaceArb } from '../domain/testing/workspaceArbitrary'
import { NODE_SIZE, createComponentAt } from './createAtPoint'
import { RenameController } from './RenameController'

// Never fires: Rename start must not depend on the delay timer.
const inertScheduler: Scheduler = {
  set: () => setTimeout(() => {}, 0),
  cancel: () => {},
}

describe('createComponentAt', () => {
  // Feature: canvas-double-click-create, Property 1: Created Component is centered on the point
  // **Validates: Requirements 1.1, 1.3**
  it('adds exactly one Component centered on the point and leaves the viewport unchanged', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), positionArb, ({ workspace }, pick, point) => {
        const diagrams = allDiagrams(workspace)
        const diagram = diagrams[pick % diagrams.length]
        const before = diagram.components.map((c) => c.id)
        const viewport = { ...diagram.viewport }

        const created = createComponentAt(diagram, point, new RenameController(new TimerScheduler()))

        const after = diagram.components.map((c) => c.id)
        expect(after).toHaveLength(before.length + 1)
        expect(after.filter((id) => !before.includes(id))).toEqual([created.id])
        expect(created.position.x + NODE_SIZE.width / 2).toBe(point.x)
        expect(created.position.y + NODE_SIZE.height / 2).toBe(point.y)
        expect(diagram.viewport).toEqual(viewport)
      }),
      { numRuns: 100 },
    )
  })

  // Feature: canvas-double-click-create, Property 2: Rename starts on the new Component and survives focus changes
  // **Validates: Requirements 2.2, 2.3**
  it('starts Rename on the created Component and keeps it after cancel', () => {
    fc.assert(
      fc.property(workspaceArb, fc.nat({ max: 1000 }), positionArb, ({ workspace }, pick, point) => {
        const diagrams = allDiagrams(workspace)
        const diagram = diagrams[pick % diagrams.length]
        const rename = new RenameController(inertScheduler)

        const created = createComponentAt(diagram, point, rename)
        expect(rename.editingId).toBe(created.id)

        rename.cancel()
        expect(rename.editingId).toBe(created.id)
      }),
      { numRuns: 100 },
    )
  })
})
