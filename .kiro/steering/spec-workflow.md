---
inclusion: fileMatch
fileMatchPattern: ".kiro/specs/**"
---

# Spec Workflow

Applies when creating, editing, or executing anything under `.kiro/specs/`.

## Requirements

- Keep them as succinct as possible: one short, testable statement per requirement.
- Use EARS-style wording ("WHEN ... THE SYSTEM SHALL ...") only where it shortens the statement.
- State what the system must do, not how. No implementation detail, rationale essays, or restated context.
- Merge or delete requirements that overlap.

## Design

- Organize around reusable components. Identify shared behavior first and give it one home.
- Strongly prefer OOP: classes with a single responsibility, interfaces/abstract types for contracts, composition over inheritance, dependency injection for collaborators.
- For each component, list its responsibility, public interface, and collaborators. Note which components are reused by which requirements.
- Before adding a component, check whether an existing one can be extended or reused.
- Do not design one-off, requirement-specific code when a reusable abstraction fits.

## Tasks

- Each task names the component(s) it builds and the requirement(s) it satisfies.
- Order tasks so shared components are built before the code that uses them.

## Keep In Sync

`requirements.md`, `design.md`, and `tasks.md` must always agree.

- Any change to one file requires checking and updating the other two in the same turn.
- Every requirement is covered by at least one design component and one task.
- Every design component and task traces to a requirement. Remove anything that doesn't.
- When implementation changes the design, update the design, then requirements and tasks, before finishing.
- Update the affected diagrams in `docs/diagrams/`.
