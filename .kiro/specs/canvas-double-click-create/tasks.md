# Implementation Plan: Canvas Double-Click Create

## Overview

View-only change in TypeScript. Build the shared pieces first (`RenameController.start`, `createAtPoint.ts`), then wire them into `Level` in `CanvasView.tsx`, then update the architecture diagram and run the full build, test and lint.

## Tasks

- [x] 1. Extend RenameController
  - [x] 1.1 Add `start(componentId)` to `RenameController` in `src/view/RenameController.ts`
    - `start` cancels any pending start, sets `editingId`, and notifies
    - The timer callback in `schedule` calls `start`, so that logic has one home
    - `cancel()` stays unchanged
    - _Requirements: 2.2, 2.3_

  - [x] 1.2 Write unit tests for `RenameController.start` in `src/view/RenameController.test.ts`
    - `start` drops a pending `schedule`
    - `schedule` still starts Rename after the delay
    - `cancel()` after `start` leaves `editingId` unchanged
    - _Requirements: 2.2, 2.3_

- [x] 2. Implement createAtPoint
  - [x] 2.1 Create `src/view/createAtPoint.ts`
    - Export `NODE_SIZE` (`{ width: 122, height: 40 }`)
    - `isEmptyCanvas(target)`: true only for an element with class `react-flow__pane`; false for `null`
    - `createComponentAt(diagram, point, rename)`: call `diagram.addComponent` at `point - NODE_SIZE / 2`, call `rename.start(component.id)`, return the Component
    - _Requirements: 1.1, 1.2, 1.4, 2.2_

  - [x] 2.2 Write property test for centered creation in `src/view/createAtPoint.property.test.ts`
    - **Property 1: Created Component is centered on the point**
    - Use the builders in `src/domain/testing/workspaceArbitrary.ts`; at least 100 runs
    - Tag: `Feature: canvas-double-click-create, Property 1`
    - **Validates: Requirements 1.1, 1.3**

  - [x] 2.3 Write property test for Rename start in `src/view/createAtPoint.property.test.ts`
    - **Property 2: Rename starts on the new Component and survives focus changes**
    - Use a fake `Scheduler`; at least 100 runs
    - Tag: `Feature: canvas-double-click-create, Property 2`
    - **Validates: Requirements 2.2, 2.3**

  - [x] 2.4 Write unit tests in `src/view/createAtPoint.test.ts`
    - `isEmptyCanvas`: true for `react-flow__pane`; false for node, edge, control and input elements and for `null`
    - `createComponentAt` creates a Component with the same defaults as the toolbar's add action
    - _Requirements: 1.2, 1.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Wire double-click creation into `Level` in `src/view/CanvasView.tsx`
  - Wrap `<ReactFlow>` in a full-size `<div>` with `onDoubleClick`
  - The handler returns unless `isEmptyCanvas(e.target)`; otherwise it converts `clientX/Y` with `useReactFlow().screenToFlowPosition` and calls `createComponentAt`
  - Store the new id in state (not a ref; lint forbids refs during render); the model-to-React-Flow sync marks that node `selected` and clears it, so `onSelectionChange` focuses it and shows the Inspector
  - Confirm the `rename.cancel()` in the selection handler leaves the active Rename alone
  - Do not touch the viewport; keep `zoomOnDoubleClick={false}` and `onNodeDoubleClick` as is
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 5. Update `docs/diagrams/system-architecture.mmd`
  - Add `createAtPoint` to the view layer
  - Add edges `Level --> createAtPoint`, `createAtPoint --> RenameController` and `createAtPoint -->|addComponent| Diagram`
  - List `start` among the `RenameController` calls
  - Check `docs/diagrams/README.md` still describes the diagram correctly
  - _Requirements: 1.1, 2.2_

- [x] 6. Final checkpoint - Build, test and lint
  - Run `npm run build`, `npm test` and `npm run lint`; fix any failures
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Rendering and focus behavior (Requirements 2.1, 2.4) are covered by the manual UI check in the design's Testing Strategy, not by automated tests
- Property tests validate universal correctness properties; unit tests cover specific examples

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.4"] },
    { "id": 3, "tasks": ["2.3"] },
    { "id": 4, "tasks": ["3"] },
    { "id": 5, "tasks": ["4", "5"] },
    { "id": 6, "tasks": ["6"] }
  ]
}
```
