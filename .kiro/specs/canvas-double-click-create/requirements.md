# Requirements Document

## Introduction

Double-clicking empty canvas space creates a Component at that point and starts Rename. Extends the `flow` spec and works alongside `component-click-interaction`.

## Glossary

- **Flow**: The web application.
- **Component**: A user-defined node, as defined in the `flow` spec.
- **Level**: The Diagram currently shown on the canvas.
- **Empty Canvas**: The canvas background of the Level. Components, Links, canvas controls and the Rename input are not Empty Canvas.
- **Focus**: The single-element selection, as defined in the `component-click-interaction` spec.
- **Rename**: Editing a Component's name in place, as defined in the `component-click-interaction` spec.

## Requirements

### Requirement 1: Create on double-click

**User Story:** As a user, I want to double-click empty canvas space to create a component, so that I can add components without the toolbar.

#### Acceptance Criteria

1. WHEN the user double-clicks the Empty Canvas, THE Flow SHALL create a Component in the Level, centered on the double-click point.
2. WHEN the user double-clicks a Component, a Link, a canvas control or the Rename input, THE Flow SHALL create no Component.
3. WHEN the user double-clicks the Empty Canvas, THE Flow SHALL leave the Level's zoom and pan unchanged.
4. THE Flow SHALL create the Component with the same defaults as the toolbar's add action.

### Requirement 2: Focus and Rename the new Component

**User Story:** As a user, I want the new component ready for naming, so that I can type its name immediately.

#### Acceptance Criteria

1. WHEN Flow creates a Component by double-click, THE Flow SHALL focus it and show it in the Inspector.
2. WHEN Flow creates a Component by double-click, THE Flow SHALL start Rename on it with the current name selected.
3. WHILE the new Component's Rename is active, THE Flow SHALL keep the Component focused, and the Focus change caused by its creation SHALL NOT cancel Rename.
4. WHEN the user commits or cancels that Rename, THE Flow SHALL behave as specified in `component-click-interaction` Requirement 2.

## Out of Scope

Double-click creation inside a Link, touch gestures, keyboard shortcuts for creation.
