# Requirements Document

## Introduction

Flow gains four leaf node kinds: database, artifact, user, and input object. Each is a Placement of a shared Resource kept in the Workspace, so one definition can appear in many Diagrams and be edited in one place. Links can attach to these nodes through fixed handle ids.

## Glossary

- **Flow**: The web application.
- **Workspace**: The domain root holding the Root Diagram, the Data Type catalog, and the Resource Registry.
- **Diagram**: The Components, Placements, and Links shown at one Level.
- **Resource**: A shared definition with an id, a Resource Kind, and a name. Artifact and input-object Resources also have a Data Type.
- **Resource Kind**: One of `database`, `artifact`, `user`, `input-object`.
- **Resource Registry**: The Workspace's collection of Resources.
- **Placement**: A leaf node in a Diagram that references one Resource. It has a position and an optional size, and no inner Diagram.
- **Data Type**: An entry in the Workspace type catalog.
- **Link**: A connection between two nodes in one Diagram. Each end stores the id of the port or handle it attaches to.
- **Picker**: The list shown from the palette or canvas context menu to pick an existing Resource of a Resource Kind or create a new one.
- **Inspector**: The panel that edits the selected node or Link.
- **Cascade Delete**: Deleting a Resource, all its Placements, and every Link attached to them.
- **Snapshot**: The serialized Workspace used for persistence and undo/redo.
- **Dangling Reference**: A Placement whose Resource id is not in the Resource Registry, or a Resource whose Data Type id is not in the type catalog.

## Requirements

### Requirement 1: Resources and Placements

**User Story:** As a user, I want shared resource definitions placed on diagrams, so that one edit updates every use.

#### Acceptance Criteria

1. THE Workspace SHALL hold a Resource Registry of Resources of the Resource Kinds `database`, `artifact`, `user`, and `input-object`.
2. THE Resource of kind `artifact` or `input-object` SHALL have a Data Type from the type catalog, and a Resource of kind `database` or `user` SHALL have none.
3. THE Diagram SHALL allow any number of Placements of the same Resource, in one Diagram or several.
4. WHEN the user moves or resizes a Placement, THE Flow SHALL keep the new position or size on that Placement.
5. WHEN the user renames a Resource or changes its Data Type, THE Flow SHALL show the change on every Placement of that Resource.

### Requirement 2: Links and ports

**User Story:** As a user, I want to link resources to components, so that I can show how data and access flow.

#### Acceptance Criteria

1. THE Flow SHALL allow a Link between any two nodes of one Diagram, whether Component or Placement, subject to criteria 2 to 5.
2. THE Flow SHALL give each `user`, `artifact`, and `input-object` Placement four side handles with fixed ids `top`, `right`, `bottom`, and `left`, and no typed ports, and SHALL apply no direction rule to these ends.
3. THE Flow SHALL give each `database` Placement two fixed handles, `read` as a Link source and `write` as a Link target.
4. WHEN the user connects to a Placement, THE Flow SHALL store the id of the handle used on that end of the Link, and a Component end SHALL store a real output port id as source or input port id as target.
5. IF the user connects a node to itself, to a node in another Diagram, or to a port or handle the node does not have in that role, THEN THE Flow SHALL reject the Link and state the reason.

### Requirement 3: Creating Placements

**User Story:** As a user, I want to create a new resource or pick an existing one when adding a node, so that I can reuse definitions.

#### Acceptance Criteria

1. WHEN the user chooses a Resource Kind from the palette or the canvas context menu, THE Flow SHALL show the Picker for that Resource Kind, listing its existing Resources and an option to create one.
2. WHEN the user picks an existing Resource, THE Flow SHALL add a Placement of it to the current Diagram.
3. WHEN the user creates a Resource in the Picker, THE Flow SHALL add the Resource and its Placement as one undo step.
4. WHEN the user creates an `artifact` or `input-object` Resource, THE Flow SHALL require a Data Type selection.
5. IF the type catalog is empty when the user creates an `artifact` or `input-object` Resource, THEN THE Flow SHALL state that a Data Type must be added first and create no Resource.

### Requirement 4: Inspector

**User Story:** As a user, I want to edit a resource from any of its placements, so that I need not hunt for the definition.

#### Acceptance Criteria

1. WHEN the user selects a Placement, THE Inspector SHALL show the Resource name for editing and a delete action for the Resource.
2. WHILE the selected Placement references an `artifact` or `input-object` Resource, THE Inspector SHALL show a Data Type selector.
3. WHEN the user edits the name or Data Type in the Inspector, THE Flow SHALL update the shared Resource.

### Requirement 5: Deletion

**User Story:** As a user, I want safe deletion of placements and resources, so that I do not lose work by accident.

#### Acceptance Criteria

1. WHEN the user deletes a Placement, THE Flow SHALL remove it and its attached Links and keep the Resource.
2. WHEN the user requests deletion of a Resource, THE Flow SHALL ask for confirmation stating the number of Placements and Links the Cascade Delete will remove.
3. WHEN the user confirms, THE Flow SHALL perform the Cascade Delete across every Diagram as one undo step.
4. WHEN the user cancels, THE Flow SHALL leave the Workspace unchanged.

### Requirement 6: Data Type usage

**User Story:** As a user, I want types used by resources protected, so that no resource loses its type.

#### Acceptance Criteria

1. THE Workspace SHALL count a Data Type as in use when any port, Link, or `artifact` or `input-object` Resource references it.
2. IF the user removes a Data Type that is in use, THEN THE Workspace SHALL refuse with the error `TYPE_IN_USE` and keep the Data Type.

### Requirement 7: Copy and paste

**User Story:** As a user, I want to copy and paste placements, so that I can reuse a resource quickly.

#### Acceptance Criteria

1. WHEN the user copies a selection, THE Workspace SHALL include its Placements and the Links with both ends in the selection.
2. WHEN the user pastes, THE Workspace SHALL create Placements with new ids that reference the original Resources, create no Resource, and preserve Link port ids.
3. WHEN the user pastes, THE Workspace SHALL record one undo step.
4. IF a pasted Placement references a Resource no longer in the Resource Registry, THEN THE Flow SHALL reject the paste and state the reason.

### Requirement 8: Persistence

**User Story:** As a user, I want resources saved and validated, so that my workspace reloads intact.

#### Acceptance Criteria

1. THE Workspace SHALL write `schemaVersion` 8 in every Snapshot, including the Resource Registry, and Placements.
2. FOR ALL valid Workspaces, serializing then loading SHALL produce a Workspace with an equal Snapshot.
3. IF a loaded Snapshot has a `schemaVersion` other than 8, a Dangling Reference, or a Link end outside its Diagram, THEN THE Flow SHALL reject it as unreadable, start empty, and leave the stored data unchanged.

### Requirement 9: Undo and redo

**User Story:** As a user, I want resource actions undoable, so that I can recover from mistakes.

#### Acceptance Criteria

1. THE Snapshot used for undo and redo SHALL include the Resource Registry and Placements.
2. WHEN the user creates, moves, resizes, or deletes a Placement, or creates, renames, retypes, or deletes a Resource, THE Flow SHALL record one undo step.
3. WHEN the user undoes or redoes a step, THE Flow SHALL restore the Resource Registry, Placements, and Links to the state before or after that step.

### Requirement 10: Visual identity

**User Story:** As a user, I want each kind to look distinct, so that I can tell them apart at a glance.

#### Acceptance Criteria

1. THE Flow SHALL show a distinct icon per Resource Kind on the Placement, in the palette, and in the Picker, using the C4 person icon for `user`.
2. THE Flow SHALL show the Resource name on each Placement, and the Data Type name on `artifact` and `input-object` Placements.

### Requirement 11: Documentation

**User Story:** As a maintainer, I want docs to match the code, so that they stay trustworthy.

#### Acceptance Criteria

1. WHEN this feature is complete, THE `docs/diagrams/` files SHALL show the Resource Registry, Placement, and Placement handle ids.
2. WHEN this feature is complete, THE `docs/clear-saved-data.md` file SHALL state that `schemaVersion` 7 saves cannot be read, with the back-up and clear steps.
