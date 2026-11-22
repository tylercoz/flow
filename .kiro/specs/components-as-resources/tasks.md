# Implementation Plan: Components as Resources

## Overview

TypeScript, strict. The work runs bottom-up: domain, snapshot and serializer, copy and paste, test support, property tests, view, docs, final check.

Removing the `Component` class breaks compilation in stages. Plan around these windows:

- **Task 1.1 to 1.6:** `src/domain` is half migrated. Existing domain tests stay red until task 4. Task 1.1 and 1.2 stay green. Tasks 1.3 to 1.5 leave tests that use `Component` red.
- **Task 1.3 to 8.6:** `tsc -b` (and so `npm run build` and `npm run lint` type-aware rules) stays red, because `src/view` still imports `Component`. Vitest transpiles per file, so domain and persistence test files that do not import view code can run green from task 5.
- **Task 6 and the three property files rewritten there** (`createdComponents`, `deletionCascade`, `deletionImpact`) stay red until their tasks (6.7 to 6.9 and 4.4) run. The window is short because they are the next steps after task 5.
- Run `npx vitest --run <file>` on the files named in each task as you go. Run the full build, test and lint only at task 10.

All test tasks are required, not optional.

## Tasks

- [x] 1. Domain model
  - [x] 1.1 Move geometry types and add error codes
    - In `NodeBounds.ts`, add `Position` and `Size` (moved from `Component.ts`). Delete the `Positioned` interface.
    - Add `REFERENCE_CYCLE` and `NOT_A_COMPONENT` to `DomainError.ts`.
    - Leaves `Component.ts` importing from its new home; domain tests stay green.
    - _Requirements: 1.3, 2.1, 4.1_

  - [x] 1.2 Create DiagramGraph with unit tests
    - New `DiagramGraph.ts`: `DiagramGraph` type, reflexive `reaches`, `findCycle`.
    - New `DiagramGraph.test.ts`: self-loop, indirect cycle, diamond (no cycle), unreachable pair, empty graph.
    - _Requirements: 3.4, 4.1, 8.5_

  - [x] 1.3 Add ComponentDefinition and extend Resource and ResourceKinds
    - Create `ComponentDefinition.ts` from `Component.ts` minus id and bounds (details, child `diagram`, exception and variable id methods). Delete `Component.ts`.
    - `Resource.ts`: add `definition: ComponentDefinition | null`, reject a kind/definition mismatch with `INVALID_RESOURCE`, make `name` and `setName` read and write `definition.details` for a component.
    - `ResourceKinds.ts` and `ResourceRegistry.ts`: add `component` (untyped, empty id lists) and make `byKind('component')` work.
    - Tests that use `Component` are red from here until task 4.
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 1.4 Rework Diagram around Placements
    - `Diagram.ts`: `DiagramContext` gains `wouldCreateCycle`. Add `placement`, `resourceOf`, `addPlacement` (`MISSING_RESOURCE`, `REFERENCE_CYCLE`), `addAll`, `dropPlacementsOf`, `dropLinksOnPorts`, `countPlacementsOf`. `endShape` returns the `component` shape from `definition.details` for a component Resource.
    - Remove `components`, `component`, `positioned`, `addComponent`, `removeComponent`, `deletionImpact`, `setPorts`, `countDescendants`.
    - `removePlacement` keeps the Resource and removes attached Links.
    - _Requirements: 1.3, 1.6, 2.1, 2.2, 4.1, 5.1_

  - [x] 1.5 Rework Workspace operations
    - `Workspace.ts`: public `allDiagrams()` (root plus each component Resource's `definition.diagram`), `diagramGraph()`, `wouldCreateCycle`, `createPlacedResource`, `setPorts` (prunes Links in every Diagram, one notification), `resourceImpact`, `removeResource` (one notification), `componentResources()`.
    - Catalog operations (`exceptionUsage`, `environmentVariableUsage`, `removeException`, `removeEnvironmentVariable`, `isTypeInUse`) iterate `componentResources()` and `allDiagrams()`.
    - Pass `wouldCreateCycle` in `DiagramContext`.
    - Each operation ends in exactly one notification.
    - _Requirements: 1.4, 1.6, 2.2, 4.1, 5.1, 5.2, 6.2, 6.3, 6.5, 7.2, 7.4_

  - [x] 1.6 Rework Navigator
    - `Navigator.ts`: the path is a list of Placement ids. Add `trail(): Resource[]` and `open(placementId)` (`NOT_IN_DIAGRAM`, `NOT_A_COMPONENT`). `current` is the last `definition.diagram`, or the root. `reconcile` and `navigateTo` keep their behaviour.
    - _Requirements: 1.4, 1.5_

- [x] 2. Snapshot and serializer (`schemaVersion` 9)
  - [x] 2.1 Update snapshot types and Workspace snapshot read and write
    - `WorkspaceSnapshot.ts`: add `ComponentDto`, change `ResourceDto` (`component: ComponentDto | null`), `DiagramDto` (placements and links only), `Fragment` (placements and links), `schemaVersion: 9`.
    - `Workspace.ts`: `toSnapshot` writes the new shape (component name from `details.name`). `replaceContent` rebuilds Resources with their child Diagrams and preserves viewports through a `Map<diagramId, Viewport>` taken from `allDiagrams()`.
    - _Requirements: 8.1, 8.6_

  - [x] 2.2 Rework WorkspaceSerializer validation
    - `WorkspaceSerializer.ts`: require `schemaVersion === 9`. First pass builds an `EndShape` map per Resource. Then parse the root and each component Diagram. Reject an unknown `resourceId` naming the Placement id, reject a Link with a missing Placement or port naming the Link id, build a `DiagramGraph` and reject `findCycle` naming the owning component Resource. Catalog existence checks iterate Resource definitions and all Diagrams.
    - Raise `PersistenceError` for every failure; never swallow.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 3. Copy and paste
  - [x] 3.1 Implement placement-only copy and paste
    - `Workspace.ts`: `copy(diagram, nodeIds)` returns a placement-only `Fragment` with the Links between selected Placements. `paste` checks, before any mutation, that each `resourceId` exists (`MISSING_RESOURCE`) and that no cycle results (`REFERENCE_CYCLE`), then assigns fresh Placement and Link ids, keeps port ids, shifts positions and calls `diagram.addAll`. Delete the nested-Diagram id regeneration.
    - No Resource or child Diagram is copied. Duplicate uses the same path.
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Test support and existing tests
  - [x] 4.1 Update test support
    - `testing/workspaceArbitrary.ts`: remove `allDiagrams` and `allComponents` helpers (use `workspace.allDiagrams()` and `componentResources`). Drop the component-only and resource-only Link commands and the `removeComponent` command. Add `createPlacedResource` for components, one `addLink` over Placements using a test-only `handleIds`, port patches through `workspace.setPorts`, and skip `addPlacement` when `wouldCreateCycle`. Every command stays one notification.
    - `testing/connect.ts`: `connect(workspace, diagram, source: Placement, target: Placement): Link` using `workspace.setPorts`.
    - _Requirements: 1.4, 1.6, 4.1, 5.2_

  - [x] 4.2 Update domain example tests
    - `Diagram.test`, `Workspace.test`, `Navigator.test`, `copyPaste.test`, `LinkRules.test`, `primitives.test`, `Resource.test`, `NodeBounds.test`: replace `addComponent`/`component()` with `createPlacedResource`/`placement()`, open Navigator by Placement id, use placement-only Fragments.
    - Add cases: `setPorts` prunes Links in two Diagrams, cycle rejection leaves the Workspace unchanged for `addPlacement` and `paste` (including a self-nesting paste), a shared Resource edit shows through two Placements, `createPlacedResource` is one undo step.
    - Domain test files other than the three rewritten in task 6 are green after this.
    - _Requirements: 1.4, 2.1, 2.2, 3.4, 4.1, 5.1, 5.2, 7.4_

  - [x] 4.3 Update persistence tests
    - `WorkspaceSerializer.test`, `WorkspaceLoader.test`, `LocalStorageRepository.test`, `AutoSaver.test`: `schemaVersion` 9 and the new snapshot shape. Add rejection cases: wrong version, unknown `resourceId` (error names the Placement id), bad Link port (names the Link id), Diagram cycle (names a component Resource).
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 4.4 Update existing property tests to the new command set
    - `edits`, `viewports`, `navigation`, `validLinks`, `invalidLinks`, `resourceLinks`, `resources`, `history`, `roundTrip` property tests: target component Resources and Placement ids, merge the Link tests onto the Placement-to-Placement `addLink`, keep the self-link, foreign-end and wrong-role cases, add component to kind generation, and keep one History step per command including `setPorts` and `createPlacedResource`.
    - `createdComponents`, `deletionCascade`, `deletionImpact` stay red until tasks 6.7 to 6.9 rewrite them.
    - _Requirements: 1.4, 1.6, 5.2, 8.6_

- [x] 5. Checkpoint - domain and persistence
  - Run `npx vitest --run src/domain src/persistence`. Only the three files named in task 4.4 may fail. Ask the user if questions arise.

- [x] 6. Property tests (fast-check, at least 100 runs, tagged `Feature: components-as-resources, Property N: ...`)
  - [x] 6.1 Write property test for resource edits visible through every Placement
    - Extend `resources.property.test.ts`.
    - **Property 1: Resource edits are visible through every Placement**
    - **Validates: Requirements 1.4**

  - [x] 6.2 Write property test for private Placement bounds
    - Extend `edits.property.test.ts`.
    - **Property 2: Placement bounds are private**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 6.3 Write property test for Link validity and storage
    - Extend `validLinks.property.test.ts`; also assert the registry stores no Links.
    - **Property 3: Links are valid and live in their Diagram**
    - **Validates: Requirements 1.6, 5.1**

  - [x] 6.4 Write property test for paste referencing the same Resources
    - New `pasteReferences.property.test.ts`.
    - **Property 4: Paste references the same Resources**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 6.5 Write property test for cycle rejection
    - New `referenceCycles.property.test.ts`; cover `addPlacement`, `paste` and the `wouldCreateCycle` filter that the Picker uses.
    - **Property 5: Cycles are rejected without change**
    - **Validates: Requirements 3.4, 4.1, 4.2**

  - [x] 6.6 Write property test for port removal
    - New `portRemoval.property.test.ts`; one History step and no Link on a removed port in any Diagram.
    - **Property 6: Port removal is one undo step and prunes every Diagram**
    - **Validates: Requirements 5.1, 5.2**

  - [x] 6.7 Rewrite createdComponents test and write property test for Placement removal
    - Rewrite `createdComponents.property.test.ts`: a new component Resource has empty ports and an empty child Diagram, and creation adds one Resource and one Placement.
    - New `placementRemoval.property.test.ts`.
    - **Property 7: Removing a Placement keeps its Resource**
    - **Validates: Requirements 6.1, 7.2**

  - [x] 6.8 Rewrite deletionImpact property test
    - Rewrite `deletionImpact.property.test.ts` for `resourceImpact` against what `removeResource` removes.
    - **Property 8: Impact matches deletion**
    - **Validates: Requirements 6.2**

  - [x] 6.9 Rewrite deletionCascade property test
    - Rewrite `deletionCascade.property.test.ts` for `removeResource`: other Resources survive, Links stay valid, one History step.
    - **Property 9: Resource deletion removes only its own scope**
    - **Validates: Requirements 6.3, 6.5**

  - [x] 6.10 Write property test for corrupt snapshots
    - New `src/persistence/corruptSnapshots.property.test.ts`: wrong version, unknown `resourceId`, Link port not on the Resource, Placement closing a cycle.
    - **Property 11: Corrupt snapshots are rejected**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

  - [x] 6.11 Write property test for snapshot round trip
    - Extend `roundTrip.property.test.ts` with shared and unplaced Resources at `schemaVersion` 9.
    - **Property 12: Snapshots round trip**
    - **Validates: Requirements 8.1, 8.6**

- [x] 7. Checkpoint - domain and persistence fully green
  - Run `npx vitest --run src/domain src/persistence`. Everything must pass. Ask the user if questions arise.

- [x] 8. View
  - [x] 8.1 Merge ComponentNode into PlacementNode
    - `PlacementNode.tsx`: single `placement` node type, resolves `diagram.resourceOf(id)`, renders a component inner component (port lists through `workspace.setPorts`, open button through `navigator.open`, measured minimum size) or the existing resource inner component. Move `RenameContext`, `useRenameController` and `RenameInput` here. Delete `ComponentNode.tsx`.
    - `LinkEdge.tsx`: update the import.
    - `DiagramProjector.ts`: map `diagram.placements` to `placement` nodes with empty `data`.
    - `Breadcrumb.tsx`: labels from `navigator.trail()` (`name || 'Untitled'`).
    - _Requirements: 1.3, 1.4, 2.1_

  - [x] 8.2 Merge ResourceInspector into Inspector
    - `Inspector.tsx`: takes a `Placement`, shows name for every kind, Data Type for typed kinds, ports, exceptions, environment variables and notes when `resource.definition` is set, and two buttons ("Delete" for the Placement, "Delete resource"). Delete `ResourceInspector.tsx`.
    - _Requirements: 1.4, 5.1, 6.1, 6.2_

  - [x] 8.3 Add component to the Picker
    - `ResourcePicker.tsx` and `resourceIcons`: add a `component` label and icon. Filter the existing-Resource list with `!workspace.wouldCreateCycle(diagram, resource.id)`.
    - _Requirements: 4.2, 7.1_

  - [x] 8.4 Rework createAtPoint
    - `createAtPoint.ts`: `createComponentAt(workspace, diagram, point, rename)` calls `createPlacedResource` with `kind: 'component'` and starts inline rename on the new Placement id.
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 8.5 Rework DeleteFlow and ConfirmDialog
    - `DeleteFlow.ts`: target kinds `link | placement | resource`; `PendingDelete` holds `ResourceImpact`; remove the `component` case.
    - `ConfirmDialog.tsx`: show Placements and Links removed and, when `counts.contents` is set, the nodes and Links in the child Diagram plus a note that Resources placed there stay in the registry. Cancel changes nothing.
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 8.6 Wire CanvasView, App and AppProvider
    - `CanvasView.tsx`: `onBeforeDelete` requests `placement`; selection reports `placement` or `link`; drag stop uses `diagram.placement(id)?.setPosition`; the paste handler catches `DomainError` including `REFERENCE_CYCLE`; `Copied` and `pasteOffset` use `fragment.placements`.
    - `App.tsx`: one Inspector for the selected Placement; aria-label "Details". Update `AppProvider.tsx` if it references removed types.
    - `npm run build` is green again after this task.
    - _Requirements: 3.1, 3.2, 3.4, 6.1, 7.2, 7.3_

  - [x] 8.7 Update and add view tests
    - Update `DeleteFlow.test`, `DiagramProjector.test`, `createAtPoint.test`, `pasteOffset.test` (no `component` delete kind, single node type, `createComponentAt(workspace, ...)`, Fragment without components).
    - Add: Picker lists Component and omits cyclic components, cancelling the confirmation leaves the Workspace unchanged, inline rename starts on the new Placement.
    - _Requirements: 4.2, 6.4, 7.1, 7.3_

  - [x] 8.8 Write property test for double-click creation
    - Update `createAtPoint.property.test.ts`.
    - **Property 10: Double-click creation is one step**
    - **Validates: Requirements 7.2, 7.4**

- [x] 9. Docs and diagrams
  - [x] 9.1 Update diagrams
    - `docs/diagrams/domain-model.mmd`: Placement replaces Component; add component as a Resource kind, ComponentDefinition, DiagramGraph and the Diagram graph.
    - `docs/diagrams/system-architecture.mmd`: ComponentNode and ResourceInspector merged into PlacementNode and Inspector.
    - `docs/diagrams/startup-and-save.mmd`: check for `schemaVersion` and component mentions. Update `docs/diagrams/README.md` if the index changes.
    - _Requirements: 9.1_

  - [x] 9.2 Update clear-saved-data doc
    - `docs/clear-saved-data.md`: state `schemaVersion` 9.
    - _Requirements: 9.2_

- [x] 10. Final checkpoint - build, test and lint
  - Run `npm run build`, `npm test` and `npm run lint`. All three must pass. Ask the user if questions arise.

## Notes

- All test tasks are required; none are marked optional.
- Each task references the requirement clauses it satisfies.
- Red windows are listed in the Overview and repeated in the task text where they start.
- Property tests validate universal properties; example tests cover specific cases.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4"] },
    { "id": 3, "tasks": ["1.5"] },
    { "id": 4, "tasks": ["1.6", "2.1"] },
    { "id": 5, "tasks": ["2.2"] },
    { "id": 6, "tasks": ["3.1"] },
    { "id": 7, "tasks": ["4.1"] },
    { "id": 8, "tasks": ["4.2", "4.3", "4.4"] },
    { "id": 9, "tasks": ["5"] },
    { "id": 10, "tasks": ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "6.9", "6.10", "6.11"] },
    { "id": 11, "tasks": ["7"] },
    { "id": 12, "tasks": ["8.1", "8.2", "8.3", "8.4", "8.5"] },
    { "id": 13, "tasks": ["8.6"] },
    { "id": 14, "tasks": ["8.7", "8.8"] },
    { "id": 15, "tasks": ["9.1", "9.2"] },
    { "id": 16, "tasks": ["10"] }
  ]
}
```
