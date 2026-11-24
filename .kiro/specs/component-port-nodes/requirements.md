# Requirements Document

## Introduction

Inside a component, each of its input and output ports appears as a node on the component's Level. A user links these nodes to the nodes inside the component. A port may have several nodes, so the same input can be wired to many places without long lines.

## Glossary

- **Component**: A Resource of kind component. It has input ports and output ports.
- **Level**: One Diagram displayed at a time. A component's Level is its child Diagram, shared by every Placement of that component.
- **Port_Node**: A node on a component's Level that shows one port of that component. An Input_Port_Node shows an input port. An Output_Port_Node shows an output port. A port may have several Port_Nodes, all showing the same port.
- **Inner_Node**: A Placement on the same Level as a Port_Node.

## Requirements

### Requirement 1: Show ports as nodes

**User Story:** As a diagram author, I want to see a component's ports inside it, so that I can wire them to its contents.

#### Acceptance Criteria

1. WHEN a component's Level is displayed, THE System SHALL show at least one Port_Node per port: an Input_Port_Node per input port and an Output_Port_Node per output port.
2. THE System SHALL NOT show Port_Nodes on the root Level.
3. A Port_Node SHALL show the port's name, and the name of its Data Type when it has one.
4. WHEN a port is added, renamed, retyped, reordered or removed, THE System SHALL update its Port_Nodes at once, with no separate edit.
5. A Port_Node that has not been moved SHALL appear in a left column (inputs) or a right column (outputs), in port order.

### Requirement 2: Port_Nodes are not Resources

**User Story:** As a diagram author, I want port nodes to follow the component's ports, so that the two never disagree.

#### Acceptance Criteria

1. THE System SHALL NOT let the user rename, retype or open a Port_Node.
2. WHEN a Port_Node is selected, THE System SHALL show no Inspector item for it.

### Requirement 3: Link Port_Nodes to Inner_Nodes

**User Story:** As a diagram author, I want to link a port node to the nodes inside the component, so that I can show how data enters and leaves.

#### Acceptance Criteria

1. THE System SHALL let a Link start at an Input_Port_Node and end at an Inner_Node.
2. THE System SHALL let a Link start at an Inner_Node and end at an Output_Port_Node.
3. THE System SHALL let a Link join an Input_Port_Node to an Output_Port_Node.
4. IF a Link would end at an Input_Port_Node or start at an Output_Port_Node, THEN THE System SHALL reject it with the existing invalid-port error.
5. A Link that starts or ends at a Port_Node SHALL support everything other Links support: rename, delete, bend points, undo and redo.

### Requirement 4: Several Port_Nodes per port

**User Story:** As a diagram author, I want to place the same port more than once, so that I can lay out one input feeding many nodes.

#### Acceptance Criteria

1. WHEN the user duplicates selected Port_Nodes, THE System SHALL add a new Port_Node for the same port next to each, with no Links.
2. WHEN the user copies selected Port_Nodes and pastes on the same component's Level, THE System SHALL add a new Port_Node for the same port for each, with no Links.
3. WHEN the user pastes copied Port_Nodes on any other Level, THE System SHALL ignore them.
4. WHEN Port_Nodes and Placements are copied, pasted or duplicated together, THE System SHALL treat the action as one undo step.
5. WHEN the user deletes selected Port_Nodes, THE System SHALL remove them and their Links.
6. IF deleting would leave a port with no Port_Node, THEN THE System SHALL refuse the whole deletion, change nothing, and tell the user.

### Requirement 5: Port removal

**User Story:** As a diagram author, I want removing a port to remove its nodes and links, so that no link points at nothing.

#### Acceptance Criteria

1. WHEN a port is removed, THE System SHALL remove all its Port_Nodes and their Links, in the same undo step as the port removal.
2. WHEN a port is added, THE System SHALL give it one Port_Node, in the same undo step.

### Requirement 6: Position

**User Story:** As a diagram author, I want to arrange port nodes, so that the Level stays readable.

#### Acceptance Criteria

1. THE System SHALL let the user drag a Port_Node.
2. THE System SHALL keep each Port_Node's position shared by every Placement of the component.
3. A Port_Node move SHALL be one undo step.

### Requirement 7: Persistence

**User Story:** As a diagram author, I want port nodes and their links to survive a reload.

#### Acceptance Criteria

1. THE System SHALL save and load every Port_Node (its port and position) and the Links on Port_Nodes.
2. WHEN loading, IF a Link on a Level ends at an id that is neither a Placement nor a Port_Node of that component, THEN THE System SHALL refuse the data.
3. WHEN loading, IF a Link breaks the direction rule of Requirement 3, THEN THE System SHALL refuse the data.
4. WHEN loading, IF a Port_Node names a port the component does not have, or a port has no Port_Node, THEN THE System SHALL refuse the data.
5. THE System SHALL raise `schemaVersion` to 13 and SHALL NOT migrate older saves.
