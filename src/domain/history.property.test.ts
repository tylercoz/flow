import fc from 'fast-check'
import { describe, it, expect } from 'vitest'
import { History } from './History'
import { Navigator } from './Navigator'
import { allComponents, allDiagrams, applyCommand, buildWorkspace, commandArb, commandsArb, viewportArb } from './testing/workspaceArbitrary'
import type { Workspace } from './Workspace'

// Shared by every property in this file: a started History (and its Navigator) over a Workspace.
function historyFor(workspace: Workspace, limit?: number): { history: History; navigator: Navigator } {
  const navigator = new Navigator(workspace)
  const history = new History(workspace, navigator, limit)
  history.start()
  return { history, navigator }
}

const RUNS = { numRuns: 100 }

// History does not expose depths, so measure them by walking both stacks, then walk back to the starting position.
function stackDepths(history: History): { undo: number; redo: number } {
  let undone = 0
  while (history.canUndo) {
    history.undo()
    undone += 1
  }
  let redone = 0
  while (history.canRedo) {
    history.redo()
    redone += 1
  }
  const redo = redone - undone
  for (let i = 0; i < redo; i++) history.undo()
  return { undo: undone, redo }
}

describe('History properties', () => {
  // Feature: undo-redo-buttons, Property 1: Undo and redo round trip
  // **Validates: Requirements 1.3, 1.4**
  it('Property 1: undo restores the pre-edit content and redo restores the post-edit content', () => {
    fc.assert(
      fc.property(commandsArb, commandArb, (setup, edit) => {
        const workspace = buildWorkspace(setup)
        const { history } = historyFor(workspace)

        const before = workspace.capture()
        applyCommand(workspace, edit)
        const after = workspace.capture()
        // Edits that leave content unchanged (e.g. a skipped command or a viewport change) record no step.
        fc.pre(after !== before)

        history.undo()
        expect(workspace.capture()).toBe(before)
        history.redo()
        expect(workspace.capture()).toBe(after)
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 2: Edits record one step
  // **Validates: Requirements 1.2, 1.5, 1.6, 2.1, 2.2**
  it('Property 2: each content-changing edit adds one undo step and clears redo', () => {
    const opArb = fc.oneof(
      { arbitrary: commandArb.map((cmd) => ({ op: 'edit' as const, cmd })), weight: 4 },
      { arbitrary: fc.constant({ op: 'undo' as const }), weight: 1 },
      { arbitrary: fc.constant({ op: 'redo' as const }), weight: 1 },
    )
    fc.assert(
      fc.property(commandsArb, fc.array(opArb, { maxLength: 30 }), (setup, ops) => {
        const workspace = buildWorkspace(setup)
        const { history } = historyFor(workspace)
        // Model of the two stack depths; History does not expose them.
        let undoDepth = 0
        let redoDepth = 0

        for (const o of ops) {
          if (o.op === 'edit') {
            const before = workspace.capture()
            applyCommand(workspace, o.cmd)
            if (workspace.capture() !== before) {
              undoDepth += 1
              redoDepth = 0
            }
          } else if (o.op === 'undo' && undoDepth > 0) {
            history.undo()
            undoDepth -= 1
            redoDepth += 1
          } else if (o.op === 'redo' && redoDepth > 0) {
            history.redo()
            redoDepth -= 1
            undoDepth += 1
          }
          expect(history.canUndo).toBe(undoDepth > 0)
          expect(history.canRedo).toBe(redoDepth > 0)
        }

        let undone = 0
        while (history.canUndo) {
          history.undo()
          undone += 1
        }
        expect(undone).toBe(undoDepth)
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 3: Writes that leave content unchanged record nothing
  // **Validates: Requirements 2.4**
  it('Property 3: viewport changes and same-value patches record no step', () => {
    const depths = stackDepths
    const writeArb = fc.oneof(
      fc.record({ kind: fc.constant('viewport' as const), diagram: fc.nat({ max: 1000 }), viewport: viewportArb }),
      fc.record({ kind: fc.constant('samePatch' as const), pick: fc.nat({ max: 1000 }) }),
    )
    fc.assert(
      fc.property(commandsArb, fc.boolean(), fc.array(writeArb, { minLength: 1, maxLength: 10 }), (setup, undoOnce, writes) => {
        const workspace = buildWorkspace(setup)
        const { history } = historyFor(workspace)
        // Edits after start() are recorded, so both stacks can be non-empty before the unchanged writes.
        setup.forEach((cmd) => applyCommand(workspace, cmd))
        if (undoOnce && history.canUndo) history.undo()

        const content = workspace.capture()
        const before = depths(history)
        expect(workspace.capture()).toBe(content)

        for (const w of writes) {
          if (w.kind === 'viewport') {
            const diagrams = allDiagrams(workspace)
            diagrams[w.diagram % diagrams.length].setViewport(w.viewport)
          } else {
            const targets = [...allComponents(workspace).map((c) => c.details), ...allDiagrams(workspace).flatMap((d) => d.links.map((l) => l.details))]
            if (targets.length) {
              const details = targets[w.pick % targets.length]
              details.patch(details.toJSON())
            }
          }
        }

        expect(workspace.capture()).toBe(content)
        expect(depths(history)).toEqual(before)
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 4: History is bounded
  // **Validates: Requirements 3.1**
  it('Property 4: undo depth is min(N, L) and undoing to empty yields the content after edit N - L', () => {
    fc.assert(
      fc.property(commandsArb, fc.array(commandArb, { maxLength: 25 }), fc.integer({ min: 1, max: 8 }), (setup, edits, limit) => {
        const workspace = buildWorkspace(setup)
        const { history } = historyFor(workspace, limit)

        // contents[i] is the content after i recorded edits; contents[0] is the initial content.
        const contents = [workspace.capture()]
        for (const cmd of edits) {
          applyCommand(workspace, cmd)
          const current = workspace.capture()
          if (current !== contents[contents.length - 1]) contents.push(current)
        }
        const n = contents.length - 1
        const depth = Math.min(n, limit)

        let undone = 0
        while (history.canUndo) {
          history.undo()
          undone += 1
        }
        expect(undone).toBe(depth)
        expect(workspace.capture()).toBe(contents[n - depth])

        let redone = 0
        while (history.canRedo) {
          history.redo()
          redone += 1
        }
        expect(redone).toBe(depth)
        expect(workspace.capture()).toBe(contents[n])
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 5: Restore notifies once
  // **Validates: Requirements 4.1**
  it('Property 5: a single undo or redo notifies each Workspace subscriber exactly once', () => {
    fc.assert(
      fc.property(commandsArb, fc.array(commandArb, { minLength: 1, maxLength: 10 }), (setup, edits) => {
        const workspace = buildWorkspace(setup)
        const { history } = historyFor(workspace)
        edits.forEach((cmd) => applyCommand(workspace, cmd))
        fc.pre(history.canUndo)

        let notifications = 0
        workspace.subscribe(() => {
          notifications += 1
        })

        history.undo()
        expect(notifications).toBe(1)
        // Undo always leaves a redo step behind.
        expect(history.canRedo).toBe(true)
        history.redo()
        expect(notifications).toBe(2)
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 6: Restore keeps current viewports
  // **Validates: Requirements 4.2**
  it('Property 6: undo keeps the current viewport of every Diagram that exists before and after', () => {
    fc.assert(
      fc.property(commandsArb, commandArb, fc.array(viewportArb, { minLength: 1, maxLength: 10 }), (setup, edit, viewports) => {
        const workspace = buildWorkspace(setup)
        const { history } = historyFor(workspace)

        const before = workspace.capture()
        applyCommand(workspace, edit)
        fc.pre(workspace.capture() !== before)

        // Viewport writes record no step, so the edit stays the top of the undo stack.
        const diagrams = allDiagrams(workspace)
        viewports.forEach((v, i) => diagrams[i % diagrams.length].setViewport(v))
        const current = new Map(allDiagrams(workspace).map((d) => [d.id, { ...d.viewport }]))

        history.undo()

        for (const d of allDiagrams(workspace)) {
          const expected = current.get(d.id)
          if (expected) expect(d.viewport).toEqual(expected)
        }
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 7: Navigator stays valid after restore
  // **Validates: Requirements 4.3, 4.4**
  it('Property 7: after undo or redo the path is unchanged if it still resolves, otherwise empty, and never throws', () => {
    // Independent of Navigator: walks the ids from the root.
    const resolves = (workspace: Workspace, path: readonly string[]): boolean => {
      let diagram = workspace.root
      for (const id of path) {
        const component = diagram.component(id)
        if (!component) return false
        diagram = component.diagram
      }
      return true
    }
    // Opens up to picks.length nested Components, stopping where a Diagram has none.
    const openPath = (navigator: Navigator, picks: readonly number[]): void => {
      for (const p of picks) {
        const components = [...navigator.current.components]
        if (components.length === 0) return
        navigator.open(components[p % components.length].id)
      }
    }
    const checkRestore = (workspace: Workspace, navigator: Navigator, restore: () => void): void => {
      const path = navigator.path
      restore()
      if (resolves(workspace, path)) {
        expect(navigator.path).toEqual(path)
      } else {
        expect(navigator.path).toEqual([])
        expect(navigator.current).toBe(workspace.root)
      }
      expect(() => navigator.current).not.toThrow()
      expect(() => navigator.trail()).not.toThrow()
    }

    const picksArb = fc.array(fc.nat({ max: 1000 }), { maxLength: 6 })
    fc.assert(
      fc.property(commandsArb, picksArb, picksArb, (edits, undoPicks, redoPicks) => {
        const workspace = buildWorkspace([])
        const { history, navigator } = historyFor(workspace)
        edits.forEach((cmd) => applyCommand(workspace, cmd))
        fc.pre(history.canUndo)

        openPath(navigator, undoPicks)
        checkRestore(workspace, navigator, () => history.undo())

        openPath(navigator, redoPicks)
        checkRestore(workspace, navigator, () => history.redo())
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 8: Empty stacks are inert
  // **Validates: Requirements 5.4**
  it('Property 8: undo or redo on an empty stack leaves content and version unchanged', () => {
    fc.assert(
      fc.property(commandsArb, commandsArb, (setup, edits) => {
        const workspace = buildWorkspace(setup)
        const { history } = historyFor(workspace)

        const expectInert = (op: () => void): void => {
          const content = workspace.capture()
          const version = workspace.getVersion()
          op()
          expect(workspace.capture()).toBe(content)
          expect(workspace.getVersion()).toBe(version)
        }

        // Fresh History: both stacks are empty.
        expect(history.canUndo).toBe(false)
        expect(history.canRedo).toBe(false)
        expectInert(() => history.undo())
        expectInert(() => history.redo())

        // After undoing everything the undo stack is empty again.
        edits.forEach((cmd) => applyCommand(workspace, cmd))
        while (history.canUndo) history.undo()
        expectInert(() => history.undo())

        // After redoing everything the redo stack is empty.
        while (history.canRedo) history.redo()
        expectInert(() => history.redo())
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 10: A group records one step
  // **Validates: Requirements 2.3, 2.4**
  it('Property 10: a group adds one undo step if the content changed and none otherwise', () => {
    fc.assert(
      fc.property(commandsArb, fc.boolean(), fc.array(commandArb, { minLength: 1, maxLength: 15 }), (prior, undoOnce, edits) => {
        const workspace = buildWorkspace([])
        const { history } = historyFor(workspace)
        // Prior steps, and optionally a redo step, so the group is tested against non-empty stacks.
        prior.forEach((cmd) => applyCommand(workspace, cmd))
        if (undoOnce && history.canUndo) history.undo()
        const before = stackDepths(history)

        const atBegin = workspace.capture()
        history.beginGroup()
        edits.forEach((cmd) => applyCommand(workspace, cmd))
        history.endGroup()
        const changed = workspace.capture() !== atBegin

        const after = stackDepths(history)
        expect(after.undo).toBe(before.undo + (changed ? 1 : 0))
        expect(after.redo).toBe(changed ? 0 : before.redo)
        if (changed) {
          history.undo()
          expect(workspace.capture()).toBe(atBegin)
        }
      }),
      RUNS,
    )
  })

  // Feature: resource-nodes, Property 10: Undo and redo restore Resources, Placements and Links
  // **Validates: Requirements 3.3, 9.1, 9.2, 9.3**
  it('Resource Property 10: each command records at most one step and undo/redo restore the captured content', () => {
    fc.assert(
      fc.property(commandsArb, (commands) => {
        const workspace = buildWorkspace([])
        const { history } = historyFor(workspace, commands.length + 1)
        const contents = [workspace.capture()]

        for (const cmd of commands) {
          const before = workspace.capture()
          applyCommand(workspace, cmd)
          const after = workspace.capture()
          if (after === before) continue
          contents.push(after)
          // Undo then redo of the newest step: one step means undo lands exactly on the previous content.
          history.undo()
          expect(workspace.capture()).toBe(before)
          history.redo()
          expect(workspace.capture()).toBe(after)
        }

        // The undo depth equals the number of content-changing commands, so none recorded two steps.
        for (let i = contents.length - 1; i > 0; i--) {
          expect(history.canUndo).toBe(true)
          history.undo()
          expect(workspace.capture()).toBe(contents[i - 1])
        }
        expect(history.canUndo).toBe(false)
        for (let i = 1; i < contents.length; i++) {
          history.redo()
          expect(workspace.capture()).toBe(contents[i])
        }
        expect(history.canRedo).toBe(false)
      }),
      RUNS,
    )
  })

  // Feature: undo-redo-buttons, Property 11: Closing a group is safe and implied by undo and redo
  // **Validates: Requirements 2.5**
  it('Property 11: endGroup is idempotent, undo and redo close an open group first, and later edits record their own step', () => {
    const closerArb = fc.constantFrom('endTwice' as const, 'undo' as const, 'redo' as const)
    fc.assert(
      fc.property(
        commandsArb,
        fc.array(commandArb, { minLength: 1, maxLength: 15 }),
        closerArb,
        commandArb,
        (prior, edits, closer, after) => {
          const workspace = buildWorkspace([])
          const { history } = historyFor(workspace)
          prior.forEach((cmd) => applyCommand(workspace, cmd))
          const before = stackDepths(history)

          const atBegin = workspace.capture()
          history.beginGroup()
          edits.forEach((cmd) => applyCommand(workspace, cmd))
          const grouped = workspace.capture()
          const changed = grouped !== atBegin

          if (closer === 'endTwice') {
            history.endGroup()
            history.endGroup()
            expect(stackDepths(history)).toEqual({ undo: before.undo + (changed ? 1 : 0), redo: changed ? 0 : before.redo })
            expect(workspace.capture()).toBe(grouped)
          } else if (closer === 'undo') {
            // An unchanged group records nothing, so undo would revert a prior step instead.
            fc.pre(changed)
            history.undo()
            expect(workspace.capture()).toBe(atBegin)
            expect(history.canRedo).toBe(true)
            history.redo()
            expect(workspace.capture()).toBe(grouped)
          } else {
            // A recorded group clears redo, so redo is then a no-op; an unchanged group leaves redo intact.
            fc.pre(changed)
            history.redo()
            expect(workspace.capture()).toBe(grouped)
            expect(stackDepths(history)).toEqual({ undo: before.undo + 1, redo: 0 })
          }

          // The group is closed, so the next edit is its own step.
          const mid = workspace.capture()
          applyCommand(workspace, after)
          if (workspace.capture() !== mid) {
            history.undo()
            expect(workspace.capture()).toBe(mid)
          }
        },
      ),
      RUNS,
    )
  })
})
