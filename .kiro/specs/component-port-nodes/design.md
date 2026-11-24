# Design Document

## Overview

A Port_Node is a stored `PortPlacement` of a port on the component's child Diagram, like a Placement of a Resource. The port stays the single source of name and type: a `PortPlacement` holds only an id, the port id and a position, so a copy can never drift from its port.

A node id is a Placement id or a `PortPlacement` id of the Diagram's component, from the same `IdGenerator`, so the two never collide. A Link end is a node id.

Every port has at least one `PortPlacement`. `ComponentDefinition` keeps this true: `setPorts` creates the first one, and `removePortPlacements` refuses to remove the last.

## Components

### PortRole and PortPlacement (in `Port.ts`)
- `type PortRole = 'input' | 'output'`.
- `portNodeHandleIds(role: PortRole, linkRole: HandleRole): readonly string[]`: an input Port_Node offers `SIDE_PORTS` as source handles and none as target handles; an output Port_Node is the reverse.
- `type PortPlacement = { id: string; portId: string; position: Position | null }`. A null position means the default slot.
- Requirements: 3.1 to 3.4, 4, 7.3.

### ComponentDefinition (extended)
- Responsibility: owns the ports and the `PortPlacement` list, and keeps them consistent with the child Diagram's Links.
- Constructor takes an `IdGenerator` (injected), so it can name new `PortPlacement`s.
- Interface: `portPlacements`, `portPlacement(id)`, `portOf(nodeId): Port | undefined`, `portRole(nodeId): PortRole | undefined`, `setPortPlacementPosition(id, p)`, `addPortPlacements(items: {portId, position}[]): PortPlacement[]`, `removePortPlacements(ids)`.
- `setPorts` also drops the `PortPlacement`s of removed ports, creates one for each new port, and drops the Links of the dropped ones from the child Diagram. One notification.
- `removePortPlacements` checks first, then removes the nodes and their Links in one notification. It throws `LAST_PORT_NODE` when a port would end with none, and `NOT_IN_DIAGRAM` for an unknown id. `addPortPlacements` throws `INVALID_PORT` for an unknown port.
- Collaborators: Diagram (`attachPortOwner`, `dropLinksOfNodes`), IdGenerator, DomainError.
- Requirements: 1.5, 4.1 to 4.6, 5.1, 5.2, 6.2, 6.3.

### Diagram (extended)
- Resolves a Link endpoint id to its allowed handle ids, whether the id is a Placement or a Port_Node of its owner.
- Interface: `attachPortOwner(owner: PortOwner)` with `PortOwner = { portRole(nodeId): PortRole | undefined }`; `dropLinksOfNodes(ids)` (no notification). `addLink` uses private `handlesOf(nodeId, role)`.
- Requirements: 3.1 to 3.4, 5.1.

### Workspace (extended)
- `setPorts` keeps only the cross-Diagram Link pruning for Placements of the component. The component's own Level is handled by `ComponentDefinition.setPorts`.
- Requirements: 5.1.

### Navigator (extended)
- `currentComponent: ComponentDefinition | null`.
- Requirements: 1.1, 1.2.

### WorkspaceSnapshot, WorkspaceSnapshotMapper, WorkspaceSerializer
- `ComponentDto` has `portNodes: { id, portId, position: Position | null }[]`. `schemaVersion` becomes 13.
- The serializer checks that every `portId` names a port, every port has a node, and node ids are unique. It gives `parseDiagram` a map of Port_Node ends built with `portNodeHandleIds`, so the existing duplicate-id, endpoint and `checkLink` checks cover Port_Node ends.
- Requirements: 7.

### DiagramProjector (extended)
- `toNodes(diagram, owner)` appends one node per `PortPlacement`: `type: 'port'`, `id` = node id, `position` = stored or default slot (x by role, y = index of the port within its role × row height).
- Requirements: 1.1, 1.4, 1.5.

### PortNode (view)
- Renders name and Data Type of `owner.portOf(id)` with side Handles of one type. No rename, resizer or open button.
- Requirements: 1.3, 2.1, 3.1, 3.2.

### CanvasView (changed)
- Registers `port: PortNode`; passes `navigator.currentComponent` to `toNodes`.
- Drag stop on a port node calls `owner.setPortPlacementPosition`.
- Copy keeps `{ portId, position }` for selected port nodes and the owner they came from, next to the Placement Fragment. Paste and duplicate add Placements through `workspace.paste` and Port_Nodes through `owner.addPortPlacements`, inside `history.beginGroup()` and `endGroup()` so a mixed action is one undo step. Port_Nodes copied from another component are ignored.
- Delete: `onBeforeDelete` first calls `owner.removePortPlacements` for the selected port nodes. On a `DomainError` it posts the message to the Notifier and returns without deleting anything else.
- Selection: a port node reports no Inspector item.
- Requirements: 2.2, 4.1 to 4.6, 6.1.

## Data flow

```
ComponentDefinition.setPorts -> PortPlacements + Diagram.dropLinksOfNodes -> one notify
  -> History snapshot -> CanvasView re-projects nodes and edges
```

## Error handling

- A Link in the wrong direction throws `DomainError('INVALID_PORT')` from `checkLink`; `CanvasView.onConnect` already posts it.
- Deleting the last Port_Node of a port throws `LAST_PORT_NODE`; `CanvasView` posts it.
- An unknown endpoint id throws `NOT_IN_DIAGRAM`, as today.
- Bad stored data throws `PersistenceError`.

## Testing

- Unit: Diagram `addLink` with Port_Node ids; `setPorts` creates and drops Port_Nodes and Links in one change; `addPortPlacements` and `removePortPlacements` (last-node refusal is atomic); Navigator `currentComponent`; serializer refusals.
- Property: round trip with Port_Nodes, duplicates and Port_Node Links; every port keeps at least one Port_Node and no Link ends at a missing node.
- Pure view logic (default position) is in `DiagramProjector` and has a unit test.

## Diagrams

Update `domain-model.mmd` and `system-architecture.mmd`. Update `docs/clear-saved-data.md` to `schemaVersion` 13.
