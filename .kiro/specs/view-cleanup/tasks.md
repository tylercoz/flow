# Implementation Plan: view-cleanup

## Overview

No-behavior-change cleanup of the view layer, grouped by file. Existing tests cover behavior, so there are no new test tasks. `.kiro/specs/flow/tasks.md` and `tasks.meta.json` are out of scope.

## Tasks

- [x] 1. Clean up `src/view/ComponentNode.tsx`
  - [x] 1.1 Fix the selection-timing comment above `press`
    - State that React Flow selects a node on click, and that capturing `selected` at pointerdown is still correct because pointerdown precedes click.
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Type the `onClick` handler as React `MouseEvent`
    - Add `type MouseEvent` to the `react` import and change the parameter type of `onClick`.
    - _Requirements: 6.3_

- [x] 2. Remove the unused node label
  - [x] 2.1 Emit `data: {}` in `src/view/DiagramProjector.ts`
    - Replace `data: { label: c.details.name }` in `toNodes`.
    - _Requirements: 2.1_

  - [x] 2.2 Update `src/view/DiagramProjector.test.ts`
    - Assert `data` equals `{}`, drop the `a.details.patch({ name: 'A' })` line, and rename the test to "...with matching id and position".
    - _Requirements: 2.2_

- [x] 3. Inline viewport recording in `src/view/CanvasView.tsx`
  - [x] 3.1 Call `diagram.setViewport(viewport)` directly in `onMoveEnd`
    - Remove the `recordViewport` import.
    - _Requirements: 3.1_

  - [x] 3.2 Delete `src/view/recordViewport.ts` and `src/view/recordViewport.test.ts`
    - Depends on 3.1 so no import is left dangling.
    - _Requirements: 3.2, 8.2_

  - [x] 3.3 Use `MouseEvent` from `react` and fix JSX indentation in `CanvasView.tsx`
    - Import `type MouseEvent`, replace `React.MouseEvent`, and indent the `div` and `<ReactFlow>` block inside `RenameContext.Provider`. Whitespace only.
    - _Requirements: 6.1, 6.2_

- [x] 4. Delete `src/smoke.test.ts`
  - _Requirements: 4.1, 8.2_

- [x] 5. Subscription wiring and comments
  - [x] 5.1 `src/view/RenameController.ts`: use `subscribe = this.signal.subscribe` and `getVersion = this.signal.getVersion`
    - Replace the two arrow-function members with the field form used by DeleteFlow, Navigator, and Notifier.
    - _Requirements: 5.1_

  - [x] 5.2 `src/domain/Workspace.ts`: add a one-line comment on `subscribe` and `getVersion`
    - Explain that they stay arrow wrappers because `signal` is assigned in the constructor. No code change.
    - _Requirements: 5.2_

  - [x] 5.3 `src/domain/Scheduler.ts`: update the comment
    - Use "Lets Notifier, AutoSaver and RenameController run against a fake clock in tests."
    - _Requirements: 6.4_

- [x] 6. Update docs and diagrams
  - Edit `.kiro/specs/flow/design.md`: replace the `recordViewport` call with `diagram.setViewport(viewport)`, remove it from the CanvasView collaborators line, delete its block and test bullet, reword "Not tested here", and drop it from the 4.1 and 4.2 traceability rows.
  - Edit `.kiro/specs/component-click-interaction/design.md`: selection on click with pointerdown capture rationale, "this click moves the selection" in the sequence note, decisions table rationale, no `data.label`, per-frame focus retry up to `MAX_FOCUS_FRAMES`, cancel only when the selection key changes.
  - Edit `.kiro/specs/canvas-double-click-create/design.md`: pending focus is state cleared in the same sync pass, `onSelectionChange` cancels only on a real selection change and leaves an active Rename alone, focus retries per frame instead of single-shot on mount.
  - Edit `docs/diagrams/system-architecture.mmd`: delete the `recordViewport` node and the `CanvasView --> recordViewport` edge.
  - _Requirements: 1.3, 3.3, 3.4, 7.1, 7.2, 7.3, 7.4_

- [x] 7. Final checkpoint - Run the quality gate
  - Run `npm run build`, `npm test`, and `npm run lint`; all three must exit 0.
  - Confirm `grep -r recordViewport src docs .kiro/specs/flow/design.md` returns nothing.
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 3.2, 3.3, 3.4, 8.1, 8.2_

## Notes

- No optional test tasks: the refactor adds no behavior and the design has no Correctness Properties.
- Tasks touching the same file are in separate waves.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1", "4", "5.1", "5.2", "5.3"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.2", "3.3", "6"] },
    { "id": 2, "tasks": ["7"] }
  ]
}
```
