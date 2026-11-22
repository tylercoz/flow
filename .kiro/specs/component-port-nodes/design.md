# Design Document

## Overview

A Port_Node is derived, not stored. The ports stay on `ComponentDefinition`; the child Diagram and the view read them live. Only two things are new state: a position per port, and Links whose endpoint id is a port id.

A port id is a `crypto.randomUUID()` from the same `IdGenerator` as Placement ids, so a node id in a Diagram is either a Placement id or a port id of that Diagram's component, never both.

## Components

### PortRole (in `Port.ts`)
- Responsibility: the one definition of which side of a Link a Port_Node may take.
- Interface: `type PortRole = 'input' | 'output'`; `portNodeHandleIds(role: PortRole, linkRole: HandleRole): readonly string[]`. An input port node has `SIDE_PORTS` as source handles and none as target handles. An output port node is the reverse.
- Collaborators: `ResourceKinds` (`SIDE_PORTS`, `HandleRole`).
- Used by: Diagram (Req 3), WorkspaceSerializer (Req 6), PortNode view (Req 3).

### ComponentDefinition (extended)
- Responsibility: also owns the Port_Node positions of its ports and answers which role a port id has.
- Interface added: `portRole(id): PortRole | undefined`; `portPosition(id): Position | undefined`; `setPortPosition(id, p)`; `setPorts` also drops positions of removed ports.
- Collaborators: Diagram (calls `attachPortOwner(this)` in the constructor), Port.
- Requirements: 1.5, 5.2, 5.3, 5.4.

### Diagram (extended)
- Responsibility: resolves a Link endpoint id to its allowed handle ids, whether the id is a Placement or a port of its owner.
- Interface added: `attachPortOwner(owner: PortOwner)` where `PortOwner = { portRole(id: string): PortRole | undefined }`; `dropLinksOfNodes(ids)` (no notification, like `dropLinksOnPorts`). `addLink` uses a private `handlesOf(nodeId, role)` in place of `resourceOf(...).handleIds`.
- Collaborators: ComponentDefinition (as `PortOwner`), `LinkRules.checkLink`, PortRole.
- Requirements: 3.1 to 3.4, 4.1.

### Workspace (extended)
- `setPorts` collects the removed port ids and calls `definition.diagram.dropLinksOfNodes(removed)` before `definition.setPorts`, so one notification covers the port, its Links and its position.
- Requirements: 4.1, 5.4.

### Navigator (extended)
- Interface added: `currentComponent: ComponentDefinition | null`, the definition of the last Resource on the path, or null at the root.
- Requirements: 1.1, 1.2.

### WorkspaceSnapshot, WorkspaceSnapshotMapper, WorkspaceSerializer
- `ComponentDto` gains `portPositions: Record<string, Position>`. `schemaVersion` becomes 12.
- The mapper writes and reads `portPositions`.
- The serializer parses `portPositions` (keys must be port ids of that component) and gives `parseDiagram` an extra map of port-id ends built with `portNodeHandleIds`, so the existing duplicate-id, endpoint and `checkLink` checks cover port ends.
- Requirements: 6.1 to 6.4.

### DiagramProjector (extended)
- `toNodes(diagram, owner)` appends one node per port, with `type: 'port'`, `id` = port id, `deletable: false`, `data: { role }`, and `position` = stored position or the default column slot (`input` at x 0, `output` at x 480, y = index * 72).
- `toEdges` is unchanged: a port id is already the edge's source or target id.
- Requirements: 1.1, 1.4, 1.5, 2.1.

### PortNode (new view component)
- Responsibility: renders a Port_Node: name, Data Type name, and four side Handles of one type (source for input, target for output).
- Resolves its port by id from `navigator.currentComponent` and reads the Data Type name from the Workspace, like `PlacementNode`.
- No rename, no resizer, no open button.
- Requirements: 1.3, 2.1, 3.1, 3.2.

### CanvasView (changed)
- Registers `port: PortNode` in `nodeTypes`.
- Passes `navigator.currentComponent` to `toNodes`.
- Drag stop: a node of type `port` calls `owner.setPortPosition`; others call `placement.setPosition`.
- Copy and duplicate use only selected nodes of type `placement`.
- A selection that includes a port node reports no Inspector item for it.
- Requirements: 2.2, 2.3, 5.1, 5.3.

## Why not stored Resources

A stored Input Object per port would copy name and type into a second place and need locking and sync rules. Deriving the node from the port avoids both.

## Data flow

```
Workspace.setPorts -> Diagram.dropLinksOfNodes + ComponentDefinition.setPorts -> one notify
  -> History snapshot -> CanvasView re-projects nodes and edges
```

## Error handling

- A Link in the wrong direction throws `DomainError('INVALID_PORT')` from `checkLink`; `CanvasView.onConnect` already posts it.
- An unknown endpoint id throws `NOT_IN_DIAGRAM`, as today.
- Bad stored data throws `PersistenceError`.

## Testing

- Unit: Diagram `addLink` with port ids (each valid and invalid direction, unknown id, self link); `setPorts` removes links and positions in one change; Navigator `currentComponent`; mapper round trip; serializer refusals.
- Property: round trip with port positions and port links; `setPorts` never leaves a Link on a missing port.
- View logic that is pure (default position) is a function in `DiagramProjector` and gets a unit test.

## Diagrams

Update `domain-model.mmd` (ComponentDefinition, Diagram, Navigator, Link endpoints, PortRole) and `system-architecture.mmd` (PortNode). Update `docs/clear-saved-data.md` to `schemaVersion` 12.
