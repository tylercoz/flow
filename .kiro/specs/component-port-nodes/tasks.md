# Implementation Plan: Component Port Nodes

## Overview

TypeScript, strict. Bottom-up: shared rule, domain, snapshot and serializer, view, docs, final check. Run `npx vitest --run <file>` per task and the full build, test and lint at task 6.

## Tasks

- [x] 1. Shared rule
  - [x] 1.1 Add PortRole and `portNodeHandleIds` to `Port.ts`, with a unit test
    - _Requirements: 3.1 to 3.4, 6.3_
- [x] 2. Domain
  - [x] 2.1 Extend ComponentDefinition: `portRole`, `portPosition`, `setPortPosition`, position pruning in `setPorts`; attach to its Diagram in the constructor
    - _Requirements: 1.5, 5.2 to 5.4_
  - [x] 2.2 Extend Diagram: `attachPortOwner`, `handlesOf`, `dropLinksOfNodes`; `addLink` accepts port ids
    - Unit tests: every valid and invalid direction, unknown id, self link.
    - _Requirements: 3.1 to 3.4_
  - [x] 2.3 Extend Workspace.setPorts to drop the Links of removed ports in the same change
    - Unit test: one history step; positions and Links gone.
    - _Requirements: 4.1, 5.4_
  - [x] 2.4 Add `Navigator.currentComponent` with a unit test
    - _Requirements: 1.1, 1.2_
- [x] 3. Snapshot and persistence
  - [x] 3.1 Add `portPositions` to `ComponentDto`, set `schemaVersion` to 12, update the mapper
    - _Requirements: 6.1, 6.4_
  - [x] 3.2 Update WorkspaceSerializer: parse `portPositions`, give `parseDiagram` the port ends, with refusal tests
    - _Requirements: 6.2, 6.3_
  - [x] 3.3 Extend the round-trip property test and the `setPorts` link-pruning property test
    - _Requirements: 4.1, 6.1_
- [x] 4. View
  - [x] 4.1 Extend DiagramProjector: port nodes, default column position, `deletable: false`, with a unit test
    - _Requirements: 1.1, 1.4, 1.5, 2.1_
  - [x] 4.2 Create PortNode and its styles in `index.css`
    - _Requirements: 1.3, 2.1, 3.1, 3.2_
  - [x] 4.3 Change CanvasView: register the node type, pass the owner, drag stop, copy filter, selection
    - _Requirements: 2.2, 2.3, 5.1, 5.3_
- [x] 5. Docs
  - [x] 5.1 Update `domain-model.mmd`, `system-architecture.mmd` and `docs/clear-saved-data.md`
    - _Requirements: 6.4_
- [x] 6. Final check
  - [x] 6.1 Run `npm run build`, `npm test` and `npm run lint`; fix failures
    - _Requirements: all_
