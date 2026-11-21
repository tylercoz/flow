# Implementation Plan: Flow

## Overview

Build bottom-up in TypeScript (strict). The framework-free domain comes first, then persistence, then the React view and composition root. Shared components (primitives, Scheduler, Notifier, `useStore`) are built before the code that uses them. Property tests sit next to the code they check and are optional. Playwright and DOM-based tests are out of scope.

## Tasks

- [x] 1. Scaffold the project
  - [x] 1.1 Create the Vite React + TypeScript project in the existing repo root
    - The repo already contains `.kiro/`, `docs/` and `.git/`. Generate the template in a temporary directory and copy in only the files that don't already exist. Don't overwrite or delete anything existing.
    - Enable TypeScript `strict`. Add `@xyflow/react`. Add a `.gitignore` entry for `node_modules` and `dist` if one is missing.
    - Add scripts: `build`, `test` (`vitest --run`), `lint`, `dev`.
    - _Requirements: 5.4 (no backend)_

  - [x] 1.2 Add Vitest, fast-check and ESLint with typescript-eslint
    - Configure Vitest with the `src/**/*.test.ts` and `src/**/*.property.test.ts` globs.
    - Add an ESLint rule that blocks imports from `react` and `@xyflow/react` inside `src/domain` and `src/persistence`.
    - Add a trivial passing test to confirm that `test`, `lint` and `build` all run.
    - _Design: Testing Strategy (Lint), Overview (stack)_

  - [x] 1.3 Fill in `.kiro/steering/tech.md`
    - Record languages, frameworks and libraries, build tooling, and the real build, test, lint and run commands from 1.1 and 1.2. Keep the existing template headings.
    - _Design: Overview (stack)_

- [x] 2. Implement the domain model
  - [x] 2.1 Build the shared domain primitives in `src/domain`
    - `ChangeSignal`, `ObservableStore` (interface), `IdGenerator` (interface) with `UuidGenerator`, `Scheduler` (interface) with `TimerScheduler`, `DomainError` (`SELF_LINK`, `NOT_IN_DIAGRAM`), `Viewport` (default `{0, 0, 1}`), `Details` (with `patch`), `Describable` (interface).
    - _Requirements: 1.2, 3.2, 3.4, 4.1, 4.2, 5.1, 5.3_

  - [x] 2.2 Implement `Component`, `Link` and `Diagram`
    - `Component` owns `Details`, `position` and exactly one child `Diagram`. `Link` has immutable endpoints.
    - `Diagram` implements `addComponent`, `removeComponent` (cascade), `deletionImpact`, `addLink` (throws `DomainError`), `removeLink`, and `setViewport`. Every mutation calls the change callback supplied by the Workspace.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 4.2_

  - [x] 2.3 Implement `Workspace` and the snapshot types
    - Define `WorkspaceSnapshot` and its DTOs in `src/domain` (plain data, no behavior).
    - `Workspace` holds the root `Diagram` and implements `ObservableStore`. `empty(ids)` and `restore(snapshot, ids)` both build every Diagram, Component, Link and Details through one private factory that wires the shared `ChangeSignal` and the `IdGenerator`. `restore` walks the validated snapshot, keeps the stored ids, and returns a tree that behaves exactly like newly created content.
    - _Requirements: 5.1, 5.2_

  - [x] 2.4 Implement `Navigator`
    - `path` is an array of Component ids only. `trail()` resolves the path to the live Components. Also `current`, `open(componentId)` (current Diagram's Components only) and `navigateTo(index)`. It implements `ObservableStore`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.2_

  - [x]* 2.5 Write the shared workspace arbitrary
    - A fast-check arbitrary that builds random nested workspaces from random command sequences, using a counter-based `IdGenerator`.
    - _Design: Correctness Properties (generator), Testing Strategy_

  - [x]* 2.6 Write property test for created Components
    - **Property 1: Created Components start empty**
    - **Validates: Requirements 1.1**

  - [x]* 2.7 Write property test for edits
    - **Property 2: Edits are read back unchanged**
    - **Validates: Requirements 1.2, 1.3, 3.2**

  - [x]* 2.8 Write property test for valid links
    - **Property 3: Valid links are created, and removal restores the link set**
    - **Validates: Requirements 3.1, 3.3**

  - [x]* 2.9 Write property test for deletion cascade
    - **Property 5: Deletion cascades and keeps references intact**
    - **Validates: Requirements 1.4**

  - [x]* 2.10 Write property test for deletion impact
    - **Property 6: Deletion impact matches what is deleted**
    - **Validates: Requirements 1.5**

  - [x]* 2.11 Write property test for navigation
    - **Property 7: Navigation follows the nesting**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x]* 2.12 Write property test for viewports
    - **Property 8: Viewports survive navigation**
    - **Validates: Requirements 4.2**

  - [x]* 2.13 Write unit tests for `Workspace.restore` and `Navigator.trail`
    - A nested Component built by `restore` notifies on change, and new Components added after `restore` get fresh ids.
    - `trail()` shows the new name after a Component is renamed.
    - _Requirements: 2.2, 5.2_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement persistence and notifications
  - [x] 4.1 Implement `PersistenceError` and `WorkspaceSerializer`
    - `serialize(workspace)` returns a `WorkspaceSnapshot`. `deserialize(raw: unknown)` validates and returns plain data only, without building domain objects. It throws `PersistenceError` for an unknown `schemaVersion`, a malformed shape, or a dangling link endpoint.
    - _Requirements: 5.2, 5.5, 4.2_

  - [x] 4.2 Implement `Repository` and `LocalStorageRepository`
    - Async `load(): Promise<unknown | null>` and `save(snapshot)` under the key `flow.workspace`, with `Storage` injected. Wrap quota and parse errors in `PersistenceError`.
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 4.3 Implement `Notifier`
    - `post(key, text, kind)`, `clear(key)` and `messages`, as an `ObservableStore`. The constructor takes a `Scheduler` and a transient timeout (default 5000 ms). Posting under an existing key replaces the message and restarts a transient timer. Transient messages auto-clear after the timeout, and `clear` cancels the timer. Persistent messages stay until cleared.
    - _Requirements: 3.4, 5.3, 5.5_

  - [x] 4.4 Implement `AutoSaver`
    - Subscribes to the `Workspace`. Debounces 500 ms with a 900 ms maximum wait, using the injected `Scheduler`. `flush` also runs on `pagehide`. On failure it posts a persistent `save` message to the `Notifier`, and it clears the message on the next success.
    - _Requirements: 5.1, 5.3_

  - [x] 4.5 Implement `WorkspaceLoader`
    - `load()` returns `{ workspace, canSave }`. No stored data gives `Workspace.empty()`. Readable data goes through `serializer.deserialize` and `Workspace.restore`. If loading or deserializing throws `PersistenceError`, return an empty Workspace with `canSave: false` and post a persistent `load` message to the `Notifier`.
    - _Requirements: 5.2, 5.5_

  - [x]* 4.6 Write property test for invalid links
    - **Property 4: Invalid links are rejected and change nothing**
    - **Validates: Requirements 3.4**

  - [x]* 4.7 Write property test for the serialization round trip
    - **Property 9: Serialization round trip**
    - Use `serialize(Workspace.restore(deserialize(JSON round trip)))`. Include a run through `LocalStorageRepository` backed by an in-memory `Storage`.
    - **Validates: Requirements 5.2, 4.2**

  - [x]* 4.8 Write unit tests for `WorkspaceSerializer`
    - Unknown `schemaVersion`, malformed shape and dangling link endpoints are rejected.
    - _Requirements: 5.2, 5.5_

  - [x]* 4.9 Write unit tests for `LocalStorageRepository`
    - A fake `Storage` that throws on `setItem`, and malformed stored JSON.
    - _Requirements: 5.2, 5.3, 5.5_

  - [x]* 4.10 Write unit tests for `AutoSaver`
    - With a fake `Scheduler`: first save within 1 s of a change, bursts coalesce, the maximum wait holds, and `flush` runs on `pagehide`. With a failing `Repository`: the message is posted, then cleared after a later success.
    - _Requirements: 5.1, 5.3_

  - [x]* 4.11 Write unit tests for `Notifier`
    - With a fake `Scheduler`: post, clear, replace by key, a transient message auto-clears after the timeout, replacing it restarts the timer, and a persistent message never auto-clears.
    - _Requirements: 3.4, 5.3_

  - [x]* 4.12 Write unit tests for `WorkspaceLoader`
    - Nothing stored gives an empty Workspace. Readable data is restored. Unreadable data gives an empty Workspace, `canSave: false`, a `load` message, and no write to the Repository.
    - _Requirements: 5.2, 5.5_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the React view and composition root
  - [x] 6.1 Implement `useStore` and `AppProvider`
    - `useStore` wraps `useSyncExternalStore`. `AppProvider` supplies `Workspace`, `Navigator` and `Notifier`.
    - _Requirements: 1.2, 2.1, 2.2, 3.4, 5.3, 5.5 (view refresh)_

  - [x] 6.2 Implement `DiagramProjector`
    - `toNodes` and `toEdges`: one node per Component and one edge per Link, with the same ids.
    - _Requirements: 1.1, 3.1, 3.3_

  - [x] 6.3 Implement `recordViewport`
    - A pure function `recordViewport(diagram, viewport)` with no React imports. It copies `{x, y, zoom}` from the React Flow viewport into `diagram.setViewport`.
    - _Requirements: 4.1, 4.2_

  - [x] 6.4 Implement `DeleteFlow` and `ConfirmDialog`
    - For a Component, read `deletionImpact`. Confirm first when `contents + links > 0`, then call `removeComponent`. Links delete directly.
    - _Requirements: 1.4, 1.5, 3.3_

  - [x] 6.5 Implement `Breadcrumb`, `NotificationBar` and `Toolbar`
    - `Breadcrumb` renders a Root label plus `navigator.trail()` names, subscribes to both `Navigator` and `Workspace` so renames show at once, and calls `navigateTo`. `NotificationBar` renders `Notifier` messages with a dismiss button on transient ones that calls `clear`. `Toolbar` adds a Component at the canvas center.
    - _Requirements: 1.1, 2.2, 2.3, 3.4, 5.3, 5.5_

  - [x] 6.6 Implement `CanvasView`
    - Host `ReactFlow` for `navigator.current`, keyed by Diagram id with `defaultViewport`. Wire `onNodeDragStop` to `setPosition`, `onMoveEnd` to `recordViewport(navigator.current, viewport)`, `onConnect` to `addLink` (catch `DomainError` and post the reason to `Notifier` as a transient message under key `link`), double-click to `navigator.open`, and the Delete key to `DeleteFlow`.
    - _Requirements: 1.3, 2.1, 3.1, 3.4, 4.1, 4.2_

  - [x] 6.7 Implement `Inspector`
    - Edit name, description and notes of the selected `Describable` through `details.patch`, and expose Delete through `DeleteFlow`.
    - _Requirements: 1.2, 1.4, 3.2, 3.3_

  - [x] 6.8 Implement `App` and the `main.tsx` composition root
    - Build `WorkspaceLoader` and call `load()`. Start `AutoSaver` only when `canSave` is true, so unreadable stored data is never overwritten. Compose `App` from `Breadcrumb`, `CanvasView`, `Inspector`, `Toolbar`, `ConfirmDialog` and `NotificationBar`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x]* 6.9 Write unit tests for `DiagramProjector`
    - One node per Component and one edge per Link, with matching ids.
    - _Requirements: 1.1, 3.1_

  - [x]* 6.10 Write unit tests for `DeleteFlow`
    - The dialog appears only when `contents + links > 0`, and deletion happens only after confirm. Cancel leaves the model unchanged.
    - _Requirements: 1.4, 1.5_

  - [x]* 6.11 Write unit tests for `recordViewport`
    - Given a Diagram and a viewport, the Diagram's viewport equals the given `x`, `y` and `zoom`. React Flow's own pan and zoom is not re-tested.
    - _Requirements: 4.1, 4.2_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update the diagrams in `docs/diagrams/`
  - Bring `system-architecture.mmd`, `domain-model.mmd` and `startup-and-save.mmd` in line with the built code, and keep `README.md` current.
  - _Design: Architecture, Data Models, Startup sequence_

- [x] 9. Final checkpoint - Run build, test and lint
  - Run build, test and lint. Ensure all pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task names the design components it builds and the requirements it satisfies.
- Property tests validate the universal properties in the design. Unit tests cover examples and edge cases.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["2.3", "2.4"] },
    { "id": 5, "tasks": ["2.5"] },
    { "id": 6, "tasks": ["2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "2.12", "2.13"] },
    { "id": 7, "tasks": ["3"] },
    { "id": 8, "tasks": ["4.1", "4.3"] },
    { "id": 9, "tasks": ["4.2", "4.6", "4.8", "4.11"] },
    { "id": 10, "tasks": ["4.4", "4.5", "4.7", "4.9"] },
    { "id": 11, "tasks": ["4.10", "4.12"] },
    { "id": 12, "tasks": ["5"] },
    { "id": 13, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 14, "tasks": ["6.5", "6.6", "6.7", "6.9", "6.10", "6.11"] },
    { "id": 15, "tasks": ["6.8"] },
    { "id": 16, "tasks": ["7"] },
    { "id": 17, "tasks": ["8"] },
    { "id": 18, "tasks": ["9"] }
  ]
}
```
