# Requirements Document

## Introduction

Changes how clicking a Component on the canvas behaves: a click focuses it, a click on the focused Component renames it in place, and a double-click opens it. Extends the `flow` spec (Requirements 1 and 2).

## Glossary

- **Flow**: The web application.
- **Component**: A user-defined node, as defined in the `flow` spec.
- **Level**: The Diagram currently shown on the canvas, as defined in the `flow` spec.
- **Focus**: The existing single-element selection of the canvas. The Inspector shows the focused Component or Link. No new state is introduced.
- **Focused Component**: The Component that is the only focused element.
- **Rename**: Editing a Component's name in an input on the Component's node.
- **Rename Delay**: 300 ms, the time Flow waits after a click on a Focused Component before starting Rename.

## Requirements

### Requirement 1: Focus on click

**User Story:** As a user, I want to click a component to focus it, so that I can see and act on its details.

#### Acceptance Criteria

1. WHEN the user clicks an unfocused Component, THE Flow SHALL focus it and show it in the Inspector.
2. WHEN the user clicks the empty canvas, THE Flow SHALL clear the Focus.
3. WHEN the user drags a Component, THE Flow SHALL focus it and not start Rename.

### Requirement 2: Rename on click of a Focused Component

**User Story:** As a user, I want to click a focused component to rename it, so that I can edit names without the Inspector.

#### Acceptance Criteria

1. WHEN the user clicks a Focused Component and no second click follows within the Rename Delay, THE Flow SHALL start Rename with the current name selected.
2. WHEN the user presses Enter or the Rename input loses focus, THE Flow SHALL save the entered text as the Component's name and end Rename.
3. WHEN the user presses Escape during Rename, THE Flow SHALL keep the previous name and end Rename.
4. WHEN the user commits an empty name, THE Flow SHALL save the empty name, as the Inspector does.
5. WHILE Rename is active, THE Flow SHALL keep the Component focused and the Inspector name field showing the saved name.
6. IF the Focus changes or the Level changes during the Rename Delay, THEN THE Flow SHALL cancel the pending Rename.

### Requirement 3: Open on double-click

**User Story:** As a user, I want to double-click a focused component to open it, so that I can edit its inner diagram.

#### Acceptance Criteria

1. WHEN the user double-clicks a Focused Component, THE Flow SHALL cancel any pending Rename and open the Component.
2. WHEN the user double-clicks an unfocused Component, THE Flow SHALL focus it and open it.
3. WHILE Rename is active, THE Flow SHALL treat a double-click inside the Rename input as text selection and not open the Component.

## Out of Scope

Renaming Links on the canvas, keyboard shortcuts for focus or open, touch-specific gestures.
