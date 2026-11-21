# Implementation Plan: undo-redo-buttons

## Overview

TypeScript. Build bottom-up: Workspace snapshot support and `Navigator.reconcile`, then `History`, then the view pieces (`shortcutAction`, `FocusGroup`, `HistoryControls`), then wiring in `main.tsx`. Finish with spec checks, diagram updates and the full build, test and lint run. Property tests share `src/domain/history.property.test.ts`, so they run in separate waves.

## Tasks

- [x] 1. Add snapshot support to Workspace
  - [x] 1.1 Extend Workspace and delegate serialization
    - In `src/domain/Workspace.ts`: make `root` a getter over a private `_root`; add `toSnapshot(includeViewports = true)` (moved `diagramToDto` logic), `capture()` and `replaceContent(snapshot)` as in the design.
    - `replaceContent` keeps the current viewport of every Diagram that still exists and calls `signal.notify()` once.
    - In `src/persistence/WorkspaceSerializer.ts`: `serialize` delegates to `workspace.toSnapshot()`; delete `diagramToDto`.
    - _Requirements: 4.1, 4.2, 6.1_

  - [x]* 1.2 Write unit tests for Workspace snapshots
    - `src/domain/Workspace.test.ts`: `replaceContent` rebuilds types; `capture` ignores viewport changes; a deleted-then-restored Diagram gets the neutral viewport.
    - `src/persistence/WorkspaceSerializer.test.ts`: output is unchanged after the move.
    - _Requirements: 4.1, 4.2, 6.1_

- [x] 2. Add Navigator.reconcile
  - [x] 2.1 Implement `reconcile()` in `src/domain/Navigator.ts`
    - Return immediately if every id in `path` resolves from the root; otherwise set `path = []` and notify. Do not call `trail()`.
    - _Requirements: 4.3, 4.4_

  - [x]* 2.2 Write unit tests for `reconcile`
    - `src/domain/Navigator.test.ts`: valid path, stale path, root.
    - _Requirements: 4.3, 4.4_

- [x] 3. Implement History
  - [x] 3.1 Create `src/domain/History.ts`
    - Export `Snapshot`, `Restorable`, `HISTORY_LIMIT` and class `History implements ObservableStore` with `start`, `beginGroup`, `endGroup`, `undo`, `redo`, `canUndo`, `canRedo`.
    - Subscribe to the Workspace, compare captures against `baseline`, honor `applying` and `grouping` flags, bound both stacks by `limit`, call `levels.reconcile()` after a restore.
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 4.1, 4.3, 4.4, 5.4, 6.1_

  - [x]* 3.2 Write unit tests for History
    - `src/domain/History.test.ts`: fresh History has empty stacks; edit, undo, new edit clears redo; typing "abc" in a group gives one step; typing then restoring the original gives none; small injected limit; `canUndo` and `canRedo` after each operation.
    - _Requirements: 1.2, 1.5, 1.6, 2.3, 2.4, 3.1, 6.2_

  - [x]* 3.3 Write property test for undo and redo round trip
    - **Property 1: Undo and redo round trip**
    - **Validates: Requirements 1.3, 1.4**

  - [x]* 3.4 Write property test for edits recording one step
    - **Property 2: Edits record one step**
    - **Validates: Requirements 1.2, 1.5, 1.6, 2.1, 2.2**

  - [x]* 3.5 Write property test for unchanged writes
    - **Property 3: Writes that leave content unchanged record nothing**
    - **Validates: Requirements 2.4**

  - [x]* 3.6 Write property test for bounded history
    - **Property 4: History is bounded**
    - **Validates: Requirements 3.1**

  - [x]* 3.7 Write property test for single notification on restore
    - **Property 5: Restore notifies once**
    - **Validates: Requirements 4.1**

  - [x]* 3.8 Write property test for viewport preservation
    - **Property 6: Restore keeps current viewports**
    - **Validates: Requirements 4.2**

  - [x]* 3.9 Write property test for Navigator validity after restore
    - **Property 7: Navigator stays valid after restore**
    - **Validates: Requirements 4.3, 4.4**

  - [x]* 3.10 Write property test for empty stacks
    - **Property 8: Empty stacks are inert**
    - **Validates: Requirements 5.4**

  - [x]* 3.11 Write property test for groups
    - **Property 10: A group records one step**
    - **Validates: Requirements 2.3, 2.4**

  - [x]* 3.12 Write property test for closing groups
    - **Property 11: Closing a group is safe and implied by undo and redo**
    - **Validates: Requirements 2.5**

- [x] 4. Implement shortcut classification and FocusGroup
  - [x] 4.1 Create `src/view/historyShortcut.ts`
    - Export `ShortcutEvent`, `isTextInput` (INPUT, TEXTAREA or contentEditable, checked structurally) and `shortcutAction(e, isMac)`.
    - _Requirements: 5.1, 5.2, 5.3_

  - [x]* 4.2 Write property test for shortcut classification
    - `src/view/historyShortcut.property.test.ts`
    - **Property 9: Shortcut classification**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 4.3 Create `src/view/FocusGroup.tsx`
    - Wrapper `<div>` with `onFocus` and `onBlur` that call `history.beginGroup()` and `history.endGroup()` for Text_Input targets; effect cleanup calls `endGroup()`.
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 4.4 Wrap Inspector and TypesDialog fields in FocusGroup
    - `src/view/Inspector.tsx`: wrap the field list. `src/view/TypesDialog.tsx`: wrap the Type name inputs.
    - _Requirements: 2.3, 2.4_

- [x] 5. Wire History into the app
  - [x] 5.1 Add History to services and the composition root
    - `src/view/AppProvider.tsx`: add `history: History` to `AppServices`.
    - `src/main.tsx`: after the load and the Navigator, build `new History(workspace, navigator)`, call `start()`, pass it in `services`.
    - _Requirements: 6.1, 6.2_

  - [x] 5.2 Create HistoryControls and render it in the Top_Bar
    - `src/view/HistoryControls.tsx`: Undo and Redo buttons bound to `canUndo` and `canRedo` via `useStore`; one `window` `keydown` listener using `shortcutAction`, calling `preventDefault`, ignored while `[aria-modal="true"]` exists.
    - `src/App.tsx`: render it in `.app-header`; `src/index.css`: group the buttons in one container taking the right-align margin.
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6, 5.1, 5.2, 5.3, 5.5_

  - [x]* 5.3 Write test that a restore is autosaved
    - `src/persistence/AutoSaver.test.ts`: after `undo()` and `flush()`, the repository holds the restored content.
    - _Requirements: 6.3_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Verify spec consistency
  - [x] 7.1 Check the flow specs for undo/redo out-of-scope listings
    - Search `.kiro/specs/flow/requirements.md` and `.kiro/specs/flow/design.md` for undo or redo; remove any out-of-scope listing found.
    - _Requirements: 7.1_

- [x] 8. Update diagrams in `docs/diagrams/`
  - [x] 8.1 Update `system-architecture.mmd`
    - Add `HistoryControls`, `FocusGroup`, `shortcutAction` nodes and the `History` edges listed in the design; update the `Main` services edge.
    - _Requirements: 1.1, 2.3, 4.1, 5.1_

  - [x] 8.2 Update `domain-model.mmd`
    - Add `History`, `Restorable`, the new `Workspace` and `Navigator` members, and the relationships listed in the design.
    - _Requirements: 1.2, 4.1, 4.3_

  - [x] 8.3 Update `startup-and-save.mmd` and `README.md`
    - Add participant `H as History`, the startup and group notes, and mention History in the `domain-model.mmd` index description.
    - _Requirements: 2.3, 6.2, 6.3_

- [x] 9. Final checkpoint - Run build, test and lint
  - Run `npm run build`, `npm test -- --run` and `npm run lint`; fix any failure until all three pass.
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests 3.3 to 3.12 share one file and are sequenced to avoid write conflicts
- Button rendering and FocusGroup focus wiring are not covered by automated tests (see the design's Testing Strategy)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.1", "4.2"] },
    { "id": 2, "tasks": ["3.2", "3.3", "5.1"] },
    { "id": 3, "tasks": ["3.4", "4.3", "5.2"] },
    { "id": 4, "tasks": ["3.5", "4.4", "5.3"] },
    { "id": 5, "tasks": ["3.6"] },
    { "id": 6, "tasks": ["3.7"] },
    { "id": 7, "tasks": ["3.8"] },
    { "id": 8, "tasks": ["3.9"] },
    { "id": 9, "tasks": ["3.10"] },
    { "id": 10, "tasks": ["3.11"] },
    { "id": 11, "tasks": ["3.12"] },
    { "id": 12, "tasks": ["6"] },
    { "id": 13, "tasks": ["7.1", "8.1", "8.2", "8.3"] },
    { "id": 14, "tasks": ["9"] }
  ]
}
```
