# Implementation Plan: Resource Nodes

## Overview

Build bottom-up in TypeScript: domain first, then snapshot and serializer, copy/paste, test arbitraries and property tests, then the view, then docs. Each top-level task ends with the build, existing tests and lint green, so an existing test that breaks (for example one asserting `schemaVersion: 7`) is updated in the task that breaks it. `src/domain` and `src/persistence` must not import `react` or `@xyflow/react`.

## Tasks

- [x] 1. Resource kinds and Resource model
  - [x] 1.1 Create `src/domain/ResourceKinds.ts` and add error codes
    - Add `ResourceKind`, `DATABASE_PORTS`, `SIDE_PORTS`, `KindSpec`, `RESOURCE_KINDS`, `isResourceKind`
    - Add `MISSING_RESOURCE`, `INVALID_RESOURCE`, `TYPE_REQUIRED`, `NO_TYPES`, `UNKNOWN_TYPE` to `DomainError.ts`
    - _Requirements: 1.1, 1.2, 2.2, 2.3_

  - [x] 1.2 Create `Resource` and `ResourceRegistry` in `src/domain`
    - `Resource` constructor rejects a typed kind without `typeId` and an untyped kind with one (`INVALID_RESOURCE`); `setName`, `setType` call `onChange`; `setType` on an untyped kind throws `INVALID_RESOURCE`
    - `ResourceRegistry`: `all`, `get`, `byKind`, `add`, `remove`, no notifications
    - _Requirements: 1.1, 1.2, 1.5, 4.3_

  - [x] 1.3 Write unit tests for `ResourceKinds`, `Resource` and `ResourceRegistry`
    - Every kind has an entry; constructor invariants; `byKind` filtering
    - _Requirements: 1.1, 1.2_

- [x] 2. NodeBounds and Placement
  - [x] 2.1 Create `NodeBounds` and the `Positioned` interface; make `Component` delegate to `NodeBounds`
    - `Component` public API unchanged; existing tests keep passing
    - _Requirements: 1.4_

  - [x] 2.2 Create `Placement` in `src/domain`
    - Composes `NodeBounds`; holds `resourceId`; implements `Positioned`; not `Describable`
    - _Requirements: 1.3, 1.4_

  - [x] 2.3 Write unit tests for `NodeBounds` and `Placement`
    - `setPosition` and `setBounds` call `onChange`; size is optional
    - _Requirements: 1.4_

- [x] 3. LinkRules
  - [x] 3.1 Create `src/domain/LinkRules.ts` with `EndShape` and `checkLink`
    - Component ends need a real output id as source and input id as target; `database` needs `read` as source and `write` as target; four-sided kinds accept any side id in either role; return `INVALID_PORT` otherwise
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 Write unit tests for `checkLink`
    - Every kind in both roles, wrong-role handle ids, unknown side id, Placement to Placement
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 4. Diagram changes
  - [x] 4.1 Extend `Diagram` and its `DiagramContext`
    - Add `resources: ResourceLookup` to `DiagramContext`; `Workspace` creates an empty `ResourceRegistry` and passes it (full Workspace work is task 6)
    - Add `placements`, `placement`, `positioned`, `addPlacement` (`MISSING_RESOURCE` for an unknown Resource), `removePlacement` (removes attached Links, keeps the Resource), `dropPlacementsOf`, `countPlacementsOf`, `addAll(components, placements, links)`
    - `addLink` keeps `SELF_LINK` and `NOT_IN_DIAGRAM`, resolves each end to Component or Placement and validates with `checkLink`
    - `countDescendants` also counts Placements
    - Update existing tests that call `addLink` or build `DiagramContext`
    - _Requirements: 1.3, 1.4, 2.1, 2.4, 2.5, 5.1_

  - [x] 4.2 Write unit tests for the new `Diagram` members
    - `addPlacement`, `removePlacement`, two Placements of one Resource in two Diagrams, Placement to Placement Link, rejected Links
    - _Requirements: 1.3, 2.1, 2.5, 5.1_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Workspace and snapshot types
  - [x] 6.1 Update `WorkspaceSnapshot.ts`
    - Add `ResourceDto`, `PlacementDto`, `placements` on `DiagramDto`, `resources` on the snapshot, `schemaVersion: 8`
    - _Requirements: 8.1_

  - [x] 6.2 Extend `Workspace`
    - Own a `ResourceRegistry` and pass it to `DiagramContext.resources`
    - Add `resources`, `createPlacedResource` (validate first: `TYPE_REQUIRED`, `NO_TYPES`, `UNKNOWN_TYPE`; Resource and Placement in one notification), `setResourceType`, `resourceImpact`, `removeResource` (all Diagrams via `allDiagrams()`, one notification)
    - `isTypeInUse` counts typed Resources; `TYPE_IN_USE` message becomes "This type is used by a port or resource."
    - `toSnapshot` writes version 8, `resources` and `placements`; `replaceContent` and `restore` rebuild them
    - Bump the serializer's accepted version to 8 and pass `resources` and `placements` through so existing persistence tests stay green; full validation lands in 7.1
    - Update existing tests that assert `schemaVersion: 7`
    - _Requirements: 1.1, 1.2, 1.5, 3.3, 3.4, 3.5, 4.3, 5.2, 5.3, 6.1, 6.2, 8.1, 9.1_

  - [x] 6.3 Write unit tests for the new `Workspace` members
    - `createPlacedResource` with an empty catalog (3.5), missing type, unknown type; `removeResource` across two Diagrams; `removeType` with a Resource using it
    - _Requirements: 3.4, 3.5, 5.2, 5.3, 6.2_

- [x] 7. Serializer validation
  - [x] 7.1 Update `WorkspaceSerializer.deserialize`
    - Accept only `schemaVersion` 8; parse `resources` first and reject an unknown kind, a typed kind without `typeId`, an untyped kind with one, or a `typeId` not in the catalog
    - `parseDiagram` takes a `ReadonlyMap<string, ResourceKind>`, parses Placements, rejects an unknown `resourceId`, and treats Component and Placement ids as one set
    - Check Link ends with `checkLink` built from DTO data, replacing the inline port check
    - _Requirements: 8.1, 8.3_

  - [x] 7.2 Write unit tests for the serializer and loader
    - Version 7 save is rejected and left unchanged; each corruption in Requirement 8.3 is rejected
    - _Requirements: 8.2, 8.3_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Copy and paste
  - [x] 9.1 Extend `Fragment`, `Workspace.copy`, `Workspace.paste` and `withFreshIds`
    - `Fragment` gains `placements`; `copy` returns selected Components and Placements and Links with both ends selected
    - `paste` checks every Placement, including those nested in Components, against the registry and throws `MISSING_RESOURCE` before changing anything; otherwise remaps ids from one `renamed` map, keeps port ids, and calls `Diagram.addAll`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 9.2 Write unit tests in `copyPaste.test.ts`
    - Placements pasted with new ids and same `resourceId`; Link port ids kept; paste after the Resource was deleted is rejected
    - _Requirements: 7.1, 7.2, 7.4_

- [x] 10. Test arbitraries and property tests
  - [x] 10.1 Extend `src/domain/testing/workspaceArbitrary.ts` and `connect.ts`
    - Add commands `addResource`, `addPlacement`, `removePlacement`, `movePlacement`, `renameResource`, `retypeResource`, `removeResource`, `addResourceLink`, `addPlacementLink`, resolved by modulo picks; `applyCommand` skips commands with no valid target
    - _Requirements: 1.1 to 1.5, 2.1 to 2.4, 3.3, 5.1 to 5.3, 9.2_

  - [x] 10.2 Write property test for resource creation
    - **Property 1: Resource creation respects the type rule**
    - **Validates: Requirements 1.2, 3.4, 3.5**
    - File: `resources.property.test.ts`

  - [x] 10.3 Write property test for resource edits
    - **Property 2: Resource edits reach every Placement**
    - **Validates: Requirements 1.5, 4.3**
    - File: `resources.property.test.ts`

  - [x] 10.4 Write property test for Placement bounds
    - **Property 3: Placement bounds are kept**
    - **Validates: Requirements 1.4**
    - File: `resources.property.test.ts`

  - [x] 10.5 Write property test for accepted Links
    - **Property 4: Accepted Links have the right end ids**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - File: `resourceLinks.property.test.ts`

  - [x] 10.6 Write property test for rejected Links
    - **Property 5: Invalid Links are rejected without change**
    - **Validates: Requirements 2.5**
    - File: `resourceLinks.property.test.ts`

  - [x] 10.7 Write property test for Placement deletion
    - **Property 6: Placement deletion keeps the Resource**
    - **Validates: Requirements 5.1**
    - File: `resources.property.test.ts`

  - [x] 10.8 Write property test for Cascade Delete
    - **Property 7: Cascade Delete matches its warning and is one step**
    - **Validates: Requirements 5.2, 5.3**
    - File: `resources.property.test.ts`

  - [x] 10.9 Write property test for Data Type usage
    - **Property 8: A Data Type in use cannot be removed**
    - **Validates: Requirements 6.1, 6.2**
    - File: `resources.property.test.ts`

  - [x] 10.10 Write property test for copy and paste
    - **Property 9: Copy and paste reuse Resources**
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - File: `resources.property.test.ts`

  - [x] 10.11 Extend `history.property.test.ts`
    - **Property 10: Undo and redo restore Resources, Placements and Links**
    - **Validates: Requirements 3.3, 9.1, 9.2, 9.3**

  - [x] 10.12 Extend `persistence/roundTrip.property.test.ts` for round trip
    - **Property 11: Snapshots round trip**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 10.13 Extend `persistence/roundTrip.property.test.ts` for corruption
    - **Property 12: Invalid snapshots are rejected**
    - **Validates: Requirements 8.3**

  - [x] 10.14 Write property test for paste of a missing Resource
    - **Property 13: Paste of a missing Resource is rejected**
    - **Validates: Requirements 7.4**
    - File: `resources.property.test.ts`

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. View: icons, projector and PlacementNode
  - [x] 12.1 Create `src/view/resourceIcons.tsx`
    - One icon per `ResourceKind`; C4 person glyph for `user`
    - _Requirements: 10.1_

  - [x] 12.2 Update `DiagramProjector`
    - `toNodes` adds one `type: 'resource'` node per Placement with `data: { resourceId }`; `toEdges` passes stored port ids as `sourceHandle` and `targetHandle`
    - _Requirements: 2.4, 10.2_

  - [x] 12.3 Create `PlacementNode.tsx`
    - Show icon, Resource name and, for typed kinds, Data Type name
    - `database`: handles `read` and `write`; other kinds: `top`, `right`, `bottom`, `left`, each as overlaid source and target Handle; reuse `NodeResizer` and the stored-size-as-floor logic from `ComponentNode`
    - _Requirements: 1.4, 2.2, 2.3, 10.1, 10.2_

  - [x] 12.4 Write example tests for projector and handle ids
    - Placement nodes, stored handle ids on edges, handle ids per kind
    - _Requirements: 2.2, 2.3, 2.4_

- [x] 13. Delete flow
  - [x] 13.1 Update `DeleteFlow` and `ConfirmDialog`
    - `DeleteTarget.kind` gains `'placement'` and `'resource'`; `DeleteFlow` receives the Workspace in its constructor
    - Placement deletes at once; resource sets a pending confirmation from `resourceImpact`; `PendingDelete` becomes `{ subject; counts; run() }`
    - `ConfirmDialog` picks its message by `subject` and states the Placement and Link counts
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 13.2 Write unit tests in `DeleteFlow.test.ts`
    - Placement deletes at once, resource goes pending with counts, cancel changes nothing, confirm is one step
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 14. Picker and Inspector
  - [x] 14.1 Create `ResourcePicker.tsx`
    - List `workspace.resources.byKind(kind)`; picking calls `diagram.addPlacement`; create form calls `workspace.createPlacedResource`
    - Typed kinds require a Data Type select; an empty catalog shows "Add a Data Type first" and disables creation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 10.1_

  - [x] 14.2 Create `ResourceInspector.tsx`
    - Name field, Data Type select for typed kinds, "Delete" and "Delete resource" buttons routed through `DeleteFlow`
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2_

- [x] 15. Canvas and App wiring
  - [x] 15.1 Update `pasteOffset`
    - `offsetToCenter` includes Placements, with a default size when none is stored; update its tests
    - _Requirements: 7.2_

  - [x] 15.2 Wire `CanvasView` and `App`
    - Register `PlacementNode` in `nodeTypes`; `onConnect` passes handle ids to `addLink` and posts errors to the Notifier; loose connection mode
    - Drag, selection-drag and resize use `diagram.positioned`; `CanvasSelection` and App `selection` gain `kind: 'component' | 'placement'`; App renders `ResourceInspector` for a Placement
    - Palette and context menu open `ResourcePicker`; copy, paste and duplicate use the extended `Fragment` and post `MISSING_RESOURCE`; `onBeforeDelete` sends Placements to `DeleteFlow`
    - _Requirements: 1.4, 2.1 to 2.5, 3.1, 3.2, 4.1, 5.1, 7.1 to 7.4_

- [x] 16. Documentation
  - [x] 16.1 Update `docs/diagrams/`
    - `domain-model.mmd`: `Resource`, `ResourceRegistry`, `Placement`, `NodeBounds`, `ResourceKinds`, `LinkRules`, new `Workspace` and `Diagram` members, new `DomainError` codes
    - `system-architecture.mmd`: `ResourcePicker`, `ResourceInspector`, `PlacementNode`, `resourceIcons`
    - `startup-and-save.mmd`: update only if it names the schema version; keep `README.md` index current
    - _Requirements: 11.1_

  - [x] 16.2 Update `docs/clear-saved-data.md`
    - State that `schemaVersion` 7 saves cannot be read, with back-up and clear steps
    - _Requirements: 11.2_

- [x] 17. Final checkpoint - Run build, test and lint
  - Run `npm run build`, `npm test` and `npm run lint`; fix every failure.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties; unit tests validate examples and edge cases
- Task 6.2 keeps persistence compiling by bumping the serializer version; task 7.1 adds the full validation

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "3.1"] },
    { "id": 3, "tasks": ["2.2", "3.2"] },
    { "id": 4, "tasks": ["2.3", "4.1"] },
    { "id": 5, "tasks": ["4.2"] },
    { "id": 6, "tasks": ["5"] },
    { "id": 7, "tasks": ["6.1"] },
    { "id": 8, "tasks": ["6.2"] },
    { "id": 9, "tasks": ["6.3", "7.1"] },
    { "id": 10, "tasks": ["7.2"] },
    { "id": 11, "tasks": ["8"] },
    { "id": 12, "tasks": ["9.1"] },
    { "id": 13, "tasks": ["9.2", "10.1"] },
    { "id": 14, "tasks": ["10.2", "10.5", "10.11", "10.12"] },
    { "id": 15, "tasks": ["10.3", "10.6", "10.13"] },
    { "id": 16, "tasks": ["10.4"] },
    { "id": 17, "tasks": ["10.7"] },
    { "id": 18, "tasks": ["10.8"] },
    { "id": 19, "tasks": ["10.9"] },
    { "id": 20, "tasks": ["10.10"] },
    { "id": 21, "tasks": ["10.14"] },
    { "id": 22, "tasks": ["11"] },
    { "id": 23, "tasks": ["12.1"] },
    { "id": 24, "tasks": ["12.2", "12.3"] },
    { "id": 25, "tasks": ["12.4", "13.1"] },
    { "id": 26, "tasks": ["13.2", "14.1", "14.2"] },
    { "id": 27, "tasks": ["15.1"] },
    { "id": 28, "tasks": ["15.2"] },
    { "id": 29, "tasks": ["16.1", "16.2"] },
    { "id": 30, "tasks": ["17"] }
  ]
}
```
