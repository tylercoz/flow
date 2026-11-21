# Implementation Plan: Component Click Interaction

## Overview

View-only change in TypeScript/React. Build `RenameController` first, then the pieces that depend on it (`ComponentNode`, `CanvasView.Level`), then wire everything together. No domain changes. The design has no Correctness Properties section, so tests are example-based.

## Tasks

- [x] 1. Build RenameController
  - [x] 1.1 Implement `RenameController` in `src/view/RenameController.ts`
    - Export `RENAME_DELAY_MS = 300` and the class implementing `ObservableStore` via `ChangeSignal`, with no React import
    - `schedule` replaces any pending start, `cancel` drops only the pending start, `end` is idempotent and notifies only when `editingId` was set
    - Inject `Scheduler` through the constructor
    - _Requirements: 2.1, 2.5, 2.6, 3.1_

  - [ ]* 1.2 Write unit tests in `src/view/RenameController.test.ts`
    - Use a fake `Scheduler` as in `AutoSaver.test.ts`
    - Cover: no start before 300 ms, start at 300 ms, second `schedule` replaces the first, `cancel` before the delay, `cancel` after start keeps `editingId`, `end` notifies once, subscribers notified on start and end
    - _Requirements: 2.1, 2.6, 3.1_

- [x] 2. Project Components as custom nodes
  - [x] 2.1 Add `type: 'component'` to nodes in `DiagramProjector.toNodes` and update `DiagramProjector.test.ts` for the new field
    - Keep `data.label`
    - _Requirements: 1.1, 2.1_

- [x] 3. Expose the Scheduler to the view
  - [x] 3.1 Add `scheduler: Scheduler` to `AppServices` in `src/view/AppProvider.tsx` and pass the existing `TimerScheduler` from `src/main.tsx`
    - _Requirements: 2.1, 2.6_

- [x] 4. Build ComponentNode
  - [x] 4.1 Implement `ComponentNode` and `RenameContext` in `src/view/ComponentNode.tsx`
    - Render the name, a target `Handle`, a source `Handle`, and while `editingId === id` an input with `nodrag nopan` classes
    - Capture `wasFocused` from `selected` on `pointerdown`; on `click` with `detail === 1` and `wasFocused`, call `controller.schedule(id)`; ignore clicks after pointer movement beyond a few pixels (drag guard, verify against React Flow behavior)
    - `onDoubleClick` calls `controller.cancel()`
    - Input: focus and select all on mount; Enter or blur calls `details.patch({ name: draft })` then `controller.end()`; Escape calls `controller.end()` first and discards the draft; input `onDoubleClick` calls `stopPropagation`; empty draft is saved as is
    - Read the live name via `useApp().navigator.current.component(id)` with `useStore(workspace)`
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.3_

- [x] 5. Wire into the canvas
  - [x] 5.1 Update `CanvasView.Level` in `src/view/CanvasView.tsx`
    - Create one `RenameController` per Level with `useState` and the `scheduler` from `useApp()`; wrap `ReactFlow` in `RenameContext.Provider`
    - Pass a module-level `nodeTypes={{ component: ComponentNode }}`
    - Call `controller.cancel()` in `onSelectionChange` and in `onNodeDragStart`
    - In a `useEffect` cleanup, call `controller.cancel()` and `controller.end()`
    - Keep `onNodeDoubleClick` opening via `navigator.open` and the default empty-canvas deselect
    - _Requirements: 1.1, 1.2, 1.3, 2.6, 3.1, 3.2_

  - [ ]* 5.2 Check for a DOM test environment (jsdom) in the Vitest setup
    - If present, add component tests in `src/view/ComponentNode.test.tsx` for: click unfocused shows no input, click focused then 300 ms shows input with text selected, Enter/blur/Escape/empty commit behavior, double-click on focused opens with no input, double-click inside the input does not open
    - If absent, add no dependency and skip; the behaviors stay manual checks
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.3_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update documentation diagrams
  - [x] 7.1 Update `docs/diagrams/system-architecture.mmd`
    - Add `ComponentNode` and `RenameController` to the view layer; `CanvasView` owns the controller, `ComponentNode` uses it, `Scheduler` is injected into it
    - Update `docs/diagrams/README.md` only if its index changes
    - _Requirements: 2.1, 2.6_

- [x] 8. Final checkpoint - Run build, test and lint
  - Run `npm run build`, `npm test` and `npm run lint`; ensure all pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Requirement 1.2 and 3.2 rely on existing React Flow and `Level` behavior; task 5.1 keeps it intact
- Requirement 2.5 is met because rename writes through `Details.patch`, which the Inspector already observes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "4.1"] },
    { "id": 2, "tasks": ["5.1"] },
    { "id": 3, "tasks": ["5.2", "7.1"] },
    { "id": 4, "tasks": ["6"] },
    { "id": 5, "tasks": ["8"] }
  ]
}
```
