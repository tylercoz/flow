# Requirements Document

## Introduction

Undo and Redo buttons in the top bar, plus keyboard shortcuts, backed by an in-memory, snapshot-based history of Workspace content. Pan and zoom are not part of history.

## Glossary

- **Workspace**: The root domain object holding the root Diagram and the Types.
- **Diagram**: The Components and Links shown on one Level.
- **Level**: One Diagram displayed at a time.
- **Navigator**: Tracks the Level currently displayed.
- **Viewport**: The pan and zoom state of a Diagram.
- **History**: Holds the undo stack and the redo stack of Snapshots.
- **Snapshot**: A copy of the Workspace content (Diagram tree and Types) excluding every Viewport.
- **Edit**: A user action that changes Workspace content (create, delete, move, resize, rename, retype of a Component, Link or Type).
- **Top_Bar**: The application header containing the Breadcrumb and the Types button.
- **Undo_Button**: The Top_Bar button that reverts the most recent Edit.
- **Redo_Button**: The Top_Bar button that re-applies the most recently undone Edit.
- **Text_Input**: Any input, textarea or content-editable element.
- **History_Limit**: 100 Snapshots per stack.

## Requirements

### Requirement 1: Undo and redo

**User Story:** As a diagram author, I want to undo and redo edits, so that I can recover from mistakes.

#### Acceptance Criteria

1. THE Top_Bar SHALL display an Undo_Button and a Redo_Button.
2. WHEN an Edit completes, THE History SHALL push the pre-Edit Snapshot onto the undo stack and clear the redo stack.
3. WHEN the user activates the Undo_Button, THE History SHALL pop the undo stack, push the current content as a Snapshot onto the redo stack, and restore the popped Snapshot.
4. WHEN the user activates the Redo_Button, THE History SHALL pop the redo stack, push the current content as a Snapshot onto the undo stack, and restore the popped Snapshot.
5. WHILE the undo stack is empty, THE Undo_Button SHALL be disabled.
6. WHILE the redo stack is empty, THE Redo_Button SHALL be disabled.

### Requirement 2: Step granularity

**User Story:** As a diagram author, I want each drag and each text edit to be one step, so that undo moves in meaningful increments and never one keystroke at a time.

#### Acceptance Criteria

1. WHEN the user completes a drag or drag-resize of a Component, THE History SHALL record exactly one Snapshot.
2. WHEN the user commits a Rename that changes the text, THE History SHALL record exactly one Snapshot.
3. WHEN a Text_Input in the Inspector or the Types dialog loses focus after its content changed, THE History SHALL record exactly one Snapshot covering every change since it gained focus, regardless of the number of keystrokes.
4. WHEN the user cancels a Rename, commits it unchanged, or leaves a Text_Input whose content is the same as at focus, THE History SHALL record no Snapshot.
5. WHEN the user activates the Undo_Button or Redo_Button while a Text_Input edit is in progress, THE History SHALL first record that edit as one Snapshot.

### Requirement 3: Bounded history

**User Story:** As a diagram author, I want bounded history, so that memory use stays limited.

#### Acceptance Criteria

1. IF a stack would exceed the History_Limit, THEN THE History SHALL discard the oldest Snapshot of that stack.

### Requirement 4: Restore behavior

**User Story:** As a diagram author, I want undo to leave my view alone, so that the canvas does not jump.

#### Acceptance Criteria

1. WHEN the History restores a Snapshot, THE Workspace SHALL replace its content in place and notify subscribers once.
2. WHEN the History restores a Snapshot, THE Workspace SHALL keep the current Viewport of every Diagram that still exists.
3. WHEN the History restores a Snapshot in which the displayed Level still exists, THE Navigator SHALL keep displaying that Level.
4. IF the History restores a Snapshot in which the displayed Level no longer exists, THEN THE Navigator SHALL display the root Level.

### Requirement 5: Keyboard shortcuts

**User Story:** As a diagram author, I want standard shortcuts, so that I can undo and redo without the mouse.

#### Acceptance Criteria

1. WHEN the user presses Cmd+Z (macOS) or Ctrl+Z (other platforms) and no Text_Input has focus, THE Top_Bar SHALL trigger the Undo_Button action.
2. WHEN the user presses Cmd+Shift+Z (macOS) or Ctrl+Shift+Z (other platforms) and no Text_Input has focus, THE Top_Bar SHALL trigger the Redo_Button action.
3. WHILE a Text_Input has focus, THE Top_Bar SHALL leave both shortcuts to the browser's native text undo.
4. WHEN a shortcut triggers an action on an empty stack, THE History SHALL leave the Workspace content unchanged.
5. WHILE a modal dialog is open, THE Top_Bar SHALL ignore both shortcuts.

### Requirement 6: Persistence

**User Story:** As a diagram author, I want history to be session-only, so that saved data and loading behave as before.

#### Acceptance Criteria

1. THE persistence layer SHALL exclude History from saved data.
2. WHEN the whole Workspace is replaced by a load, THE History SHALL clear both stacks.
3. WHEN the History restores a Snapshot, THE AutoSaver SHALL save the restored content as for any other Edit.

### Requirement 7: Spec consistency

**User Story:** As a maintainer, I want the flow spec to match shipped features, so that specs do not contradict each other.

#### Acceptance Criteria

1. THE files `.kiro/specs/flow/requirements.md` and `.kiro/specs/flow/design.md` SHALL NOT list undo/redo as out of scope.
