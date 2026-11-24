# Implementation Plan: Component Port Nodes

## Overview

TypeScript, strict. Bottom-up: shared rule, domain, snapshot and serializer, view, docs, final check. Run `npx vitest --run <file>` per task and the full build, test and lint at task 6.

## Tasks

- [x] 1. Shared rule
  - [x] 1.1 Add PortRole and `portNodeHandleIds` to `Port.ts`, with a unit test
    - _Requirements: 3.1 to 3.4, 7.3_
  - [x] 1.2 Add the `PortPlacement` type to `Port.ts` and the `LAST_PORT_NODE` error code
    - _Requirements: 4.6_
- [x] 2. Domain
  - [x] 2.1 Extend ComponentDefinition: injected `IdGenerator`, `PortPlacement` list, `portOf`, `portRole`, `setPortPlacementPosition`, `addPortPlacements`, `removePortPlacements`; `setPorts` creates and drops Port_Nodes and their Links; attach to its Diagram in the constructor
    - Unit tests: first Port_Node on a new port, drop on removal, one change, atomic last-node refusal.
    - _Requirements: 1.5, 4.1 to 4.6, 5.1, 5.2, 6.2, 6.3_
  - [x] 2.2 Extend Diagram: `attachPortOwner`, `handlesOf`, `dropLinksOfNodes`; `addLink` accepts Port_Node ids
    - Unit tests: every valid and invalid direction, unknown id, self link.
    - _Requirements: 3.1 to 3.4_
  - [x] 2.3 Reduce Workspace.setPorts to the cross-Diagram pruning
    - _Requirements: 5.1_
  - [x] 2.4 Add `Navigator.currentComponent` with a unit test
    - _Requirements: 1.1, 1.2_
- [x] 3. Snapshot and persistence
  - [x] 3.1 Add `portNodes` to `ComponentDto`, set `schemaVersion` to 13, update the mapper
    - _Requirements: 7.1, 7.5_
  - [x] 3.2 Update WorkspaceSerializer: parse `portNodes`, check ports and ids, give `parseDiagram` the Port_Node ends, with refusal tests
    - _Requirements: 7.2 to 7.4_
  - [x] 3.3 Extend the test generator (duplicate, remove, move, link Port_Nodes) and the round-trip and `setPorts` property tests
    - _Requirements: 4, 5, 7.1_
- [x] 4. View
  - [x] 4.1 Extend DiagramProjector: one node per `PortPlacement`, default slot, with a unit test
    - _Requirements: 1.1, 1.4, 1.5_
  - [x] 4.2 Create PortNode and its styles in `index.css`
    - _Requirements: 1.3, 2.1, 3.1, 3.2_
  - [x] 4.3 Change CanvasView: node type, owner, drag stop, selection, delete guard
    - _Requirements: 2.2, 4.5, 4.6, 6.1_
  - [x] 4.4 Change CanvasView: copy, paste and duplicate of Port_Nodes in one undo group
    - _Requirements: 4.1 to 4.4_
- [x] 5. Docs
  - [x] 5.1 Update `domain-model.mmd`, `system-architecture.mmd`, `startup-and-save.mmd` and `docs/clear-saved-data.md`
    - _Requirements: 7.5_
- [x] 6. Final check
  - [x] 6.1 Run `npm run build`, `npm test` and `npm run lint`; fix failures
    - _Requirements: all_
