# Requirements Document

## Introduction

Today a Component is owned by one Diagram and has its own details, ports, and child Diagram. Resources (database, artifact, user, input-object) are shared: many Placements can point at one Resource. This feature makes the Component a fourth kind of Resource, so one Component definition and its child Diagram can appear in many Diagrams. The `Component` class is replaced by `Placement`. Each Placement keeps its own position and size.

**Interpretation to confirm: "Links shouldn't be stored in the resource".** A Resource record (in the ResourceRegistry) holds no Links. Every Link is stored in the Diagram that contains the Placements it connects, and refers to Placements by id and to ports by the Resource's port ids. The child Diagram of a component Resource is a Diagram like any other and keeps its own Links, so those Links are shared by every Placement of that Resource because the child Diagram is shared, not because the Resource owns them. If you meant that a component Resource should hold no child Diagram at all, this document needs to change.

## Glossary

- **Workspace**: The root domain object holding the root Diagram, catalogs, and the ResourceRegistry.
- **Diagram**: One Level of the model, holding Placements and Links.
- **Resource**: A shared definition referenced by Placements. Kinds are database, artifact, user, input-object, and component.
- **Component_Resource**: A Resource of kind component. It holds details (name, input ports, output ports, notes), exception ids, environment variable ids, and one child Diagram.
- **Placement**: A node in a Diagram that references one Resource by id and has its own position and size.
- **Link**: A connection between an output port of one Placement and an input port of another Placement in the same Diagram.
- **ResourceRegistry**: The Workspace collection of all Resources.
- **Picker**: The UI list used to add a node to the canvas.
- **Canvas**: The editing surface showing the current Diagram.
- **History**: The undo and redo stack.
- **Loader**: The component that reads a saved WorkspaceSnapshot and builds the Workspace.
- **Reference_Cycle**: A chain of Component_Resources in which a Component_Resource's child Diagram, directly or through descendants, contains a Placement of that same Component_Resource.

## Requirements

### Requirement 1: Component as Resource

**User Story:** As a modeler, I want a component to be a Resource, so that I can reuse one component definition in many Diagrams.

#### Acceptance Criteria

1. THE Workspace SHALL support `component` as a Resource kind in the ResourceRegistry.
2. THE Component_Resource SHALL own its details, exception ids, environment variable ids, and child Diagram.
3. THE Placement SHALL own its id, Resource id, position, and size, and no other state.
4. WHEN a Component_Resource is edited through any of its Placements, THE Workspace SHALL show the edit in every Placement of that Resource.
5. THE Workspace SHALL contain no `Component` class; Placement SHALL replace it.
6. THE ResourceRegistry SHALL store no Links; each Link SHALL be stored in the Diagram that contains the Placements it connects.

### Requirement 2: Placement geometry

**User Story:** As a modeler, I want each placement to have its own position and size, so that I can lay out the same component differently in each Diagram.

#### Acceptance Criteria

1. WHEN a Placement is moved or resized, THE Workspace SHALL change only the position and size of that Placement.
2. WHEN a Placement is created, THE Workspace SHALL assign it a new id and the given position.

### Requirement 3: Copy, paste, duplicate

**User Story:** As a modeler, I want copy, paste, and duplicate to reference the same Resource, so that copies stay in sync with the original.

#### Acceptance Criteria

1. WHEN a Placement of a Component_Resource is copied and pasted, THE Workspace SHALL create a new Placement that references the same Resource.
2. WHEN a Placement of a Component_Resource is duplicated, THE Workspace SHALL create a new Placement that references the same Resource.
3. THE Workspace SHALL offer no action that creates an independent copy of a Resource.
4. WHEN a paste would place a Placement of Component_Resource R inside the child Diagram of R or of any Component_Resource that R's child Diagram contains, THE Workspace SHALL reject the paste with a DomainError and leave the Workspace unchanged.

### Requirement 4: Recursion rejected

**User Story:** As a modeler, I want recursive nesting rejected, so that the model stays finite.

#### Acceptance Criteria

1. IF adding a Placement would create a Reference_Cycle, THEN THE Workspace SHALL reject the addition with a DomainError and leave the Workspace unchanged.
2. WHILE the Picker is shown for a Diagram, THE Picker SHALL list a Component_Resource only if adding it to that Diagram would not create a Reference_Cycle.

### Requirement 5: Port removal prunes Links

**User Story:** As a modeler, I want port changes to keep Links valid everywhere, so that no Diagram shows a Link to a missing port.

#### Acceptance Criteria

1. WHEN a port is removed from a Component_Resource, THE Workspace SHALL remove every Link that uses that port in every Diagram that contains a Placement of that Resource.
2. WHEN a port is removed, THE Workspace SHALL apply the port removal and the Link removals as one undo step.

### Requirement 6: Deletion

**User Story:** As a modeler, I want deleting a Resource to be deliberate, so that I do not lose shared definitions by accident.

#### Acceptance Criteria

1. WHEN the user presses the Delete key with Placements selected, THE Canvas SHALL remove only those Placements and the Links attached to them, and SHALL keep the Resources.
2. WHEN the user requests deletion of a Resource, THE Canvas SHALL show a confirmation dialog stating the number of Placements of the Resource, the number of Links removed, and, for a Component_Resource, the number of nodes and Links inside its child Diagram.
3. WHEN the user confirms deletion of a Resource, THE Workspace SHALL remove only that Resource, every Placement of it in every Diagram, every Link attached to those Placements, and, for a Component_Resource, its child Diagram with the Placements and Links inside it. Other Resources placed inside that child Diagram SHALL stay in the ResourceRegistry, even when they become unplaced.
4. WHEN the user cancels the confirmation dialog, THE Workspace SHALL remain unchanged.
5. THE Workspace SHALL record a confirmed Resource deletion as one undo step.

### Requirement 7: Creating components

**User Story:** As a modeler, I want to create components from the Picker and the canvas, so that creating a component is as quick as creating any other Resource.

#### Acceptance Criteria

1. THE Picker SHALL include Component alongside the other Resource kinds.
2. WHEN the user double-clicks an empty area of the Canvas, THE Workspace SHALL create a Component_Resource and a Placement of it at the clicked position in one History step.
3. WHEN the Component_Resource and Placement are created by double-click, THE Canvas SHALL start inline rename on the new Placement.
4. WHEN the user undoes the creation, THE Workspace SHALL remove both the Component_Resource and the Placement in one step.

### Requirement 8: Load validation

**User Story:** As a modeler, I want saved data validated on load, so that corrupt files cannot produce a broken model.

#### Acceptance Criteria

1. THE WorkspaceSnapshot SHALL use `schemaVersion` 9.
2. WHEN a saved WorkspaceSnapshot has a `schemaVersion` other than 9, THE Loader SHALL reject it with a PersistenceError.
3. IF a Placement refers to a Resource id absent from the ResourceRegistry, THEN THE Loader SHALL reject the snapshot with a PersistenceError naming the Placement id.
4. IF a Link refers to a Placement id absent from its Diagram or to a port id absent from the referenced Resource, THEN THE Loader SHALL reject the snapshot with a PersistenceError naming the Link id.
5. IF the snapshot contains a Reference_Cycle, THEN THE Loader SHALL reject the snapshot with a PersistenceError naming a Component_Resource in the cycle.
6. WHEN a Workspace is saved and then loaded, THE Loader SHALL produce a Workspace equal to the saved one, including shared Resources referenced from several Diagrams.

### Requirement 9: Docs and diagrams

**User Story:** As a maintainer, I want the documentation and diagrams updated, so that they match the code.

#### Acceptance Criteria

1. THE project SHALL update the diagrams in `docs/diagrams/` to show Placement replacing Component and component as a Resource kind.
2. THE project SHALL update `docs/clear-saved-data.md` to state `schemaVersion` 9.
