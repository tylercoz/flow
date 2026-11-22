# Requirements Document

## Introduction

Inside a component, each of its input and output ports appears as a node on the component's Level. A user links these nodes to the nodes inside the component.

## Glossary

- **Component**: A Resource of kind component. It has input ports and output ports.
- **Level**: One Diagram displayed at a time. A component's Level is its child Diagram, shared by every Placement of that component.
- **Port_Node**: A node on a component's Level that stands for one port of that component. An Input_Port_Node stands for an input port. An Output_Port_Node stands for an output port.
- **Inner_Node**: A Placement on the same Level as a Port_Node.

## Requirements

### Requirement 1: Show ports as nodes

**User Story:** As a diagram author, I want to see a component's ports inside it, so that I can wire them to its contents.

#### Acceptance Criteria

1. WHEN a component's Level is displayed, THE System SHALL show one Input_Port_Node per input port and one Output_Port_Node per output port.
2. THE System SHALL NOT show Port_Nodes on the root Level.
3. A Port_Node SHALL show the port's name, and the name of its Data Type when it has one.
4. WHEN a port is added, renamed, retyped, reordered or removed, THE System SHALL update the Port_Nodes on that component's Level at once, with no separate edit.
5. A Port_Node with no stored position SHALL appear in a left column (inputs) or a right column (outputs), in port order.

### Requirement 2: Port_Nodes are not Resources

**User Story:** As a diagram author, I want port nodes to follow the component's ports, so that the two never disagree.

#### Acceptance Criteria

1. THE System SHALL NOT let the user rename, retype, delete, copy, duplicate or open a Port_Node.
2. WHEN a Port_Node is selected, THE System SHALL show no Inspector item for it.
3. WHEN a selection that includes a Port_Node is deleted, copied or duplicated, THE System SHALL act only on the other selected items.

### Requirement 3: Link Port_Nodes to Inner_Nodes

**User Story:** As a diagram author, I want to link a port node to the nodes inside the component, so that I can show how data enters and leaves.

#### Acceptance Criteria

1. THE System SHALL let a Link start at an Input_Port_Node and end at an Inner_Node.
2. THE System SHALL let a Link start at an Inner_Node and end at an Output_Port_Node.
3. THE System SHALL let a Link join an Input_Port_Node to an Output_Port_Node.
4. IF a Link would end at an Input_Port_Node or start at an Output_Port_Node, THEN THE System SHALL reject it with the existing invalid-port error.
5. A Link that starts or ends at a Port_Node SHALL support everything other Links support: rename, delete, bend points, undo and redo.

### Requirement 4: Port removal

**User Story:** As a diagram author, I want removing a port to remove its links, so that no link points at nothing.

#### Acceptance Criteria

1. WHEN a port is removed, THE System SHALL remove the Links on its Port_Node, in the same undo step as the port removal.

### Requirement 5: Position

**User Story:** As a diagram author, I want to arrange port nodes, so that the Level stays readable.

#### Acceptance Criteria

1. THE System SHALL let the user drag a Port_Node.
2. THE System SHALL keep a Port_Node's position per port, shared by every Placement of the component.
3. A Port_Node move SHALL be one undo step.
4. WHEN a port is removed, THE System SHALL discard its stored position.

### Requirement 6: Persistence

**User Story:** As a diagram author, I want port node positions and links to survive a reload.

#### Acceptance Criteria

1. THE System SHALL save and load Port_Node positions and the Links on Port_Nodes.
2. WHEN loading, IF a Link on a Level ends at an id that is neither a Placement nor a port of that component, THEN THE System SHALL refuse the data.
3. WHEN loading, IF a Link breaks the direction rule of Requirement 3, THEN THE System SHALL refuse the data.
4. THE System SHALL raise `schemaVersion` to 12 and SHALL NOT migrate older saves.
