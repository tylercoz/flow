# Requirements Document

## Introduction

Flow is a browser-based, local-first app for diagramming software. Every component contains its own diagram of components, to any depth. The user decides what a component represents. No diagramming standard is followed.

## Glossary

- **Flow**: The web application.
- **Component**: A user-defined node with a name, description, and notes. It contains one Diagram.
- **Diagram**: The set of Components directly inside a Component, or at the top level (the Root Diagram).
- **Link**: A connection between two Components in the same Diagram, with a name, description, and notes.
- **Level**: The Diagram currently shown on the canvas.

## Requirements

### Requirement 1: Components

**User Story:** As a user, I want to create and describe components, so that I can model anything I choose.

#### Acceptance Criteria

1. WHEN the user creates a Component in a Level, THE Flow SHALL add it to that Level's Diagram with an empty Diagram of its own.
2. WHEN the user edits a Component's name, description, or notes, THE Flow SHALL save the new values.
3. WHEN the user moves a Component on the canvas, THE Flow SHALL keep its new position.
4. WHEN the user deletes a Component, THE Flow SHALL delete its contents and every Link inside it or attached to it.
5. WHEN the user requests deletion of a Component that has contents or Links, THE Flow SHALL ask for confirmation first.

### Requirement 2: Nested diagrams

**User Story:** As a user, I want to open a component to see and edit the diagram inside it, so that I can model detail at any depth.

#### Acceptance Criteria

1. WHEN the user opens a Component, THE Flow SHALL show that Component's Diagram as the current Level.
2. THE Flow SHALL show the path from the Root Diagram to the current Level.
3. WHEN the user selects an element of that path, THE Flow SHALL make that Level current.
4. THE Flow SHALL allow nesting to any depth.

### Requirement 3: Links

**User Story:** As a user, I want to link components in the same diagram, so that I can show how they relate.

#### Acceptance Criteria

1. WHEN the user connects two different Components in the same Diagram, THE Flow SHALL create a Link and draw it between them.
2. WHEN the user edits a Link's name, description, or notes, THE Flow SHALL save the new values.
3. WHEN the user deletes a Link, THE Flow SHALL remove it.
4. IF the user connects two Components that are not in the same Diagram, or connects a Component to itself, THEN THE Flow SHALL reject the Link and state the reason.

### Requirement 4: Navigation of the canvas

**User Story:** As a user, I want to pan and zoom, so that I can work on large diagrams.

#### Acceptance Criteria

1. WHEN the user pans or zooms the canvas, THE Flow SHALL update the view of the current Level.
2. WHEN the user returns to a Level, THE Flow SHALL restore that Level's last pan and zoom.

### Requirement 5: Local persistence

**User Story:** As a user, I want my work saved in my browser, so that I need no account or server.

#### Acceptance Criteria

1. WHEN the user changes a Component, Link, or position, THE Flow SHALL save the change to browser storage within 1 second.
2. WHEN the user opens Flow, THE Flow SHALL restore the saved Root Diagram and all nested content.
3. IF saving to browser storage fails, THEN THE Flow SHALL notify the user that changes are not saved.
4. THE Flow SHALL operate without a backend or user account.

## Out of Scope

Cross-level links, export/import, image export, user-defined types, tags, shapes, colors, undo/redo, multi-user collaboration.
