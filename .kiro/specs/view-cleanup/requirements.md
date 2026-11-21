# Requirements Document

## Introduction

A refactor of the view layer with no change to user-visible behavior. It corrects inaccurate comments and design documents, removes dead code and a redundant indirection, and makes subscription wiring and React typing consistent across the codebase.

## Glossary

- **Codebase**: The source files, tests, specs, and diagrams in the Flow repository.
- **ComponentNode**: The React Flow node renderer in `src/view/ComponentNode.tsx`.
- **DiagramProjector**: The module in `src/view/DiagramProjector.ts` whose `toNodes` function converts domain Components into React Flow nodes.
- **CanvasView**: The React component in `src/view/CanvasView.tsx` that hosts the React Flow canvas.
- **Diagram**: The domain object in `src/domain/Diagram.ts` that exposes `setViewport`.
- **recordViewport**: The helper in `src/view/recordViewport.ts` and its test `src/view/recordViewport.test.ts`.
- **Smoke_Test**: The file `src/smoke.test.ts`.
- **RenameController**: The class in `src/view/RenameController.ts`.
- **Workspace**: The class in `src/domain/Workspace.ts`.
- **ChangeSignal**: The class in `src/domain/ChangeSignal.ts` whose `subscribe` and `getVersion` members are bound arrow functions.
- **Scheduler_Comment**: The explanatory comment in `src/domain/Scheduler.ts`.
- **Click_Design_Doc**: `.kiro/specs/component-click-interaction/design.md`.
- **Create_Design_Doc**: `.kiro/specs/canvas-double-click-create/design.md`.
- **Flow_Design_Doc**: `.kiro/specs/flow/design.md`.
- **Architecture_Diagram**: `docs/diagrams/system-architecture.mmd`.
- **Quality_Gate**: The commands `npm run build`, `npm test`, and `npm run lint`.

## Requirements

### Requirement 1: Accurate selection comment

**User Story:** As a maintainer, I want the selection-timing comment to be accurate, so that readers understand when React Flow selects a node.

#### Acceptance Criteria

1. THE ComponentNode comment SHALL state that React Flow selects a node on click.
2. THE ComponentNode comment SHALL state that capturing `selected` at pointerdown remains correct because pointerdown precedes click.
3. THE Click_Design_Doc SHALL state that React Flow selects a node on click, and SHALL state the pointerdown capture rationale given in criterion 2.

### Requirement 2: No unused node label

**User Story:** As a maintainer, I want DiagramProjector to stop emitting an unused node label, so that node data contains only what ComponentNode reads.

#### Acceptance Criteria

1. THE DiagramProjector `toNodes` function SHALL set the `data` field of every node to an empty object.
2. THE DiagramProjector test file SHALL assert the empty `data` object and SHALL contain no assertion on `data.label`.

### Requirement 3: Inline viewport recording

**User Story:** As a maintainer, I want the viewport wrapper removed, so that CanvasView has one fewer indirection.

#### Acceptance Criteria

1. WHEN the React Flow viewport changes, THE CanvasView SHALL call `diagram.setViewport(viewport)` directly.
2. THE Codebase SHALL contain neither `src/view/recordViewport.ts` nor `src/view/recordViewport.test.ts`.
3. THE Flow_Design_Doc SHALL contain no reference to recordViewport.
4. THE Architecture_Diagram SHALL contain no reference to recordViewport.

### Requirement 4: Remove smoke test

**User Story:** As a maintainer, I want the redundant smoke test removed, so that the test suite contains only tests of project behavior.

#### Acceptance Criteria

1. THE Codebase SHALL not contain the Smoke_Test file.

### Requirement 5: Consistent subscription wiring

**User Story:** As a maintainer, I want consistent subscription wiring, so that the difference in Workspace is clearly intentional.

#### Acceptance Criteria

1. THE RenameController SHALL declare `subscribe = this.signal.subscribe` and `getVersion = this.signal.getVersion` as class fields, in the same form used by DeleteFlow, Navigator, and Notifier.
2. THE Workspace `subscribe` and `getVersion` members SHALL keep their arrow-function form and carry a one-line comment stating why: `signal` is assigned in the constructor.

### Requirement 6: View formatting and typing

**User Story:** As a maintainer, I want consistent formatting and typing in the view files, so that the code reads cleanly and follows React typing conventions.

#### Acceptance Criteria

1. THE CanvasView SHALL indent the JSX inside `RenameContext.Provider` and inside the wrapper `div` according to their nesting depth.
2. THE CanvasView SHALL import `type MouseEvent` from `react` and SHALL use `MouseEvent` in place of `React.MouseEvent`.
3. THE ComponentNode `onClick` handler SHALL use the React `MouseEvent` type.
4. THE Scheduler_Comment SHALL name RenameController as a user of the scheduler, or SHALL describe the scheduler's users generically.

### Requirement 7: Design documents match implementation

**User Story:** As a maintainer, I want the design documents to match the implementation, so that the documents do not describe behavior the code no longer has.

#### Acceptance Criteria

1. THE Click_Design_Doc SHALL describe node selection as occurring on click and not on pointerdown.
2. THE Click_Design_Doc and THE Create_Design_Doc SHALL describe pending focus as state that is not held in a ref, matching the current implementation.
3. THE Click_Design_Doc and THE Create_Design_Doc SHALL describe focus as not being single-shot on mount, matching the current implementation.
4. THE Click_Design_Doc and THE Create_Design_Doc SHALL describe `onSelectionChange` as cancelling pending work only when the selection actually changes, and not on every call.

### Requirement 8: No behavior change

**User Story:** As a maintainer, I want proof that the cleanup changed no behavior, so that the refactor is safe to merge.

#### Acceptance Criteria

1. WHEN the refactor is complete, THE Quality_Gate SHALL finish with exit code 0 for each of its three commands.
2. THE Codebase SHALL retain every test that existed before the refactor, except `src/view/recordViewport.test.ts` and `src/smoke.test.ts`.

## Out of Scope

- Restructuring the Workspace constructor so that `subscribe` and `getVersion` become field initializers.
- `.kiro/specs/flow/tasks.md` and `.kiro/specs/flow/tasks.meta.json`. They are completed historical tasks and keep their references to recordViewport.
